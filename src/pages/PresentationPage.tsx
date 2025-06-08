import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Home, X } from 'lucide-react';
import { Sermon, getSermon, getUserProfile } from '../services/firebaseService';
import { extractScriptureReferences, ScriptureReference } from '../utils/smartParseScriptureInput';
import ScriptureOverlay from '../components/ScriptureOverlay';
import './PresentationPage.scss';

function splitSlides(notes: string): string[] {
  return notes.split(/\n\s*---+\s*\n/).map(s => s.trim());
}

function stripHtmlTags(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export default function PresentationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // User's preferred Bible translation
  const [defaultTranslation, setDefaultTranslation] = useState<string>('KJV');
  
  // Scripture overlay state
  const [scriptureOverlayOpen, setScriptureOverlayOpen] = useState(false);
  const [selectedScripture, setSelectedScripture] = useState<{
    book: string;
    chapter: string;
    verse: string;
    endVerse?: string;
    reference: string;
  } | null>(null);

  // Load sermon data
  useEffect(() => {
    if (!id) {
      navigate('/dashboard');
      return;
    }

    const loadSermon = async () => {
      try {
        const sermonData = await getSermon(id);
        if (sermonData) {
          setSermon(sermonData);
        } else {
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error loading sermon:', error);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };    loadSermon();
  }, [id, navigate]);

  // Load user's default translation from their profile
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        console.log('[PresentationPage] Loading user profile...');
        const profile = await getUserProfile();
        console.log('[PresentationPage] User profile loaded:', profile);
        
        if (profile?.preferences?.defaultBibleVersion) {
          console.log('[PresentationPage] Setting defaultTranslation from profile:', profile.preferences.defaultBibleVersion);
          setDefaultTranslation(profile.preferences.defaultBibleVersion);
        } else {
          console.log('[PresentationPage] No defaultBibleVersion in profile, checking localStorage...');
          // Fallback to localStorage if profile doesn't exist yet
          const stored = localStorage.getItem('defaultBibleVersion');
          console.log('[PresentationPage] localStorage defaultBibleVersion:', stored);
          if (stored) {
            setDefaultTranslation(stored);
          }
        }
      } catch (error) {
        console.error('[PresentationPage] Error loading user profile:', error);
        // Fallback to localStorage if there's an error
        const stored = localStorage.getItem('defaultBibleVersion');
        console.log('[PresentationPage] Fallback to localStorage:', stored);
        if (stored) {
          setDefaultTranslation(stored);
        }
      }
    };
    loadUserPreferences();
  }, []);

  // Parse slides from sermon notes
  const slides = useMemo(() => {
    if (!sermon?.notes) return ['No content available'];
    
    // Convert notes object to string if needed
    const notesString = typeof sermon.notes === 'string' 
      ? sermon.notes 
      : Object.values(sermon.notes || {}).join('\n---\n');
    
    const parsedSlides = splitSlides(notesString);
    return parsedSlides.length > 0 ? parsedSlides : ['No content available'];
  }, [sermon?.notes]);

  // Extract scripture references from current slide
  const currentSlideScriptureRefs = useMemo(() => {
    if (!slides[currentSlide]) return [];
    const plainText = stripHtmlTags(slides[currentSlide]);
    return extractScriptureReferences(plainText);
  }, [slides, currentSlide]);

  // Navigation handlers
  const goToPreviousSlide = useCallback(() => {
    setCurrentSlide(prev => Math.max(0, prev - 1));
  }, []);

  const goToNextSlide = useCallback(() => {
    setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
  }, [slides.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(Math.max(0, Math.min(slides.length - 1, index)));
  }, [slides.length]);

  // Fullscreen functionality
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goToPreviousSlide();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          goToNextSlide();
          break;
        case 'Escape':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            navigate(-1);
          }
          break;
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'Home':
          e.preventDefault();
          goToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          goToSlide(slides.length - 1);
          break;
        default:
          // Check for number keys 1-9
          if (e.key >= '1' && e.key <= '9') {
            const slideIndex = parseInt(e.key) - 1;
            if (slideIndex < slides.length) {
              e.preventDefault();
              goToSlide(slideIndex);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [goToPreviousSlide, goToNextSlide, goToSlide, slides.length, navigate, toggleFullscreen]);
  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle scripture overlay events
  useEffect(() => {
    const handleScriptureOverlay = (event: any) => {
      const { book, chapter, verse, endVerse, reference } = event.detail;
      setSelectedScripture({ book, chapter, verse, endVerse, reference });
      setScriptureOverlayOpen(true);
    };

    window.addEventListener('showScriptureOverlay', handleScriptureOverlay);
    return () => window.removeEventListener('showScriptureOverlay', handleScriptureOverlay);
  }, []);  // Handle scripture reference click
  const handleScriptureRefClick = useCallback((ref: ScriptureReference) => {
    const reference = `${ref.book} ${ref.chapter}:${ref.verse}${ref.endVerse && ref.endVerse !== ref.verse ? `-${ref.endVerse}` : ''}`;
    
    console.log('[PresentationPage] Scripture reference clicked:', reference);
    console.log('[PresentationPage] User preferred defaultTranslation:', defaultTranslation);
    
    setSelectedScripture({
      book: ref.book,
      chapter: ref.chapter.toString(),
      verse: ref.verse.toString(),
      endVerse: ref.endVerse?.toString(),
      reference
    });
    setScriptureOverlayOpen(true);
  }, [defaultTranslation]);

  if (loading) {
    return (
      <div className="presentation-loading">
        <div className="loading-spinner"></div>
        <p>Loading presentation...</p>
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="presentation-error">
        <p>Sermon not found</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`presentation-page ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Background overlay */}
      <div className="presentation-bg-overlay" />
      
      {/* Header - hidden in fullscreen */}
      {!isFullscreen && (
        <header className="presentation-header">
          <div className="presentation-header-content">
            <div className="presentation-title-area">
              <h1 className="presentation-title">{sermon.title}</h1>
              <p className="presentation-date">{sermon.date}</p>
            </div>
            <div className="presentation-controls">
              <button
                onClick={toggleFullscreen}
                className="presentation-control-btn"
                title="Enter fullscreen (F)"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"/>
                  <path d="M3 16.2V21m0 0h4.8M3 21l6-6"/>
                  <path d="M21 7.8V3m0 0h-4.8M21 3l-6 6"/>
                  <path d="M3 7.8V3m0 0h4.8M3 3l6 6"/>
                </svg>
              </button>
              <button
                onClick={() => navigate(-1)}
                className="presentation-control-btn presentation-close-btn"
                title="Close presentation (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </header>
      )}      {/* Main presentation area */}
      <main className="presentation-main">
        {/* Scripture references above content */}
        {currentSlideScriptureRefs.length > 0 && (
          <Motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="presentation-scripture-banner"
          >
            <h3>Scripture References</h3>            <div className="presentation-scripture-list">
              {currentSlideScriptureRefs.map((ref: ScriptureReference, index: number) => (
                <button
                  key={index} 
                  type="button"
                  className="presentation-scripture-ref"
                  onClick={() => handleScriptureRefClick(ref)}
                  title="Click to view scripture text"
                >
                  {ref.book} {ref.chapter}:{ref.verse}
                  {ref.endVerse && ref.endVerse !== ref.verse && `-${ref.endVerse}`}
                </button>
              ))}
            </div>
          </Motion.div>
        )}

        <div className="presentation-slide-container">
          {/* Slide content */}
          <div className="presentation-slide-area">
            <AnimatePresence mode="wait">
              <Motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="presentation-slide"
              >
                <div 
                  className="presentation-slide-content"
                  dangerouslySetInnerHTML={{ __html: slides[currentSlide] }}
                />
              </Motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            <button
              onClick={goToPreviousSlide}
              disabled={currentSlide === 0}
              className="presentation-nav-btn presentation-nav-prev"
              aria-label="Previous slide"
              title="Previous slide (←)"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={goToNextSlide}
              disabled={currentSlide === slides.length - 1}
              className="presentation-nav-btn presentation-nav-next"
              aria-label="Next slide"
              title="Next slide (→)"
            >
              <ChevronRight size={32} />
            </button>
          </div>
        </div>
      </main>

      {/* Footer with slide indicators and controls */}
      <footer className="presentation-footer">
        <div className="presentation-footer-content">          {/* Slide indicators */}
          <div className="presentation-slide-indicators">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`presentation-slide-indicator ${
                  index === currentSlide ? 'active' : ''
                }`}
                aria-label={`Go to slide ${index + 1}`}
                title={`Slide ${index + 1}`}
              >
                <span className="slide-number">{index + 1}</span>
              </button>
            ))}
          </div>

          {/* Slide counter and controls */}
          <div className="presentation-footer-controls">
            <div className="presentation-slide-counter">
              {currentSlide + 1} / {slides.length}
            </div>
            
            {isFullscreen && (
              <div className="presentation-fullscreen-controls">
                <button
                  onClick={() => goToSlide(0)}
                  className="presentation-control-btn"
                  title="Go to first slide (Home)"
                >
                  <Home size={16} />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="presentation-control-btn"
                  title="Exit fullscreen (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            )}          </div>
        </div>
      </footer>      {/* Scripture Overlay */}
      <ScriptureOverlay
        open={scriptureOverlayOpen}
        onClose={() => setScriptureOverlayOpen(false)}
        book={selectedScripture?.book || ''}
        chapter={selectedScripture?.chapter || ''}
        verseRange={selectedScripture?.verse || ''}
        reference={selectedScripture?.reference || ''}
        defaultTranslation={defaultTranslation}
      />
    </div>
  );
}
