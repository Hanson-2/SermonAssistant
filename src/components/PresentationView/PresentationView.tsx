import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Sermon } from '../SermonCard/SermonCard';
import { extractScriptureReferences } from '../../utils/smartParseScriptureInput';
import './PresentationView.css';

interface PresentationViewProps {
  sermon: Sermon;
  isOpen: boolean;
  onClose: () => void;
}

function splitSlides(notes: string): string[] {
  return notes.split(/\n\s*---+\s*\n/).map(s => s.trim());
}

function stripHtmlTags(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

export default function PresentationView({ sermon, isOpen, onClose }: PresentationViewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Parse slides from sermon notes
  const slides = useMemo(() => {
    if (!sermon.notes) return ['No content available'];
    
    // Convert notes object to string if needed
    const notesString = typeof sermon.notes === 'string' 
      ? sermon.notes 
      : Object.values(sermon.notes || {}).join('\n---\n');
    
    const parsedSlides = splitSlides(notesString);
    return parsedSlides.length > 0 ? parsedSlides : ['No content available'];
  }, [sermon.notes]);

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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

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
          onClose();
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
  }, [isOpen, goToPreviousSlide, goToNextSlide, goToSlide, slides.length, onClose]);

  // Reset slide when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="presentation-overlay"
        onClick={onClose}
      >
        <Motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="presentation-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="presentation-header">
            <div className="presentation-title">
              <h1>{sermon.title}</h1>
              <p className="presentation-date">{sermon.date}</p>
            </div>
            <button
              onClick={onClose}
              className="presentation-close-btn"
              aria-label="Close presentation"
            >
              <X size={24} />
            </button>
          </div>

          {/* Main content area */}
          <div className="presentation-main">
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
              >
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={goToNextSlide}
                disabled={currentSlide === slides.length - 1}
                className="presentation-nav-btn presentation-nav-next"
                aria-label="Next slide"
              >
                <ChevronRight size={32} />
              </button>
            </div>

            {/* Scripture references */}
            {currentSlideScriptureRefs.length > 0 && (
              <div className="presentation-scripture">
                <h3>Scripture References</h3>
                <div className="presentation-scripture-list">                  {currentSlideScriptureRefs.map((ref, index) => (
                    <span key={index} className="presentation-scripture-ref">
                      {ref.book} {ref.chapter}:{ref.verse}
                      {ref.endVerse && ref.endVerse !== ref.verse && `-${ref.endVerse}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer with slide indicators */}
          <div className="presentation-footer">
            <div className="presentation-slide-indicators">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`presentation-slide-indicator ${
                    index === currentSlide ? 'active' : ''
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
            <div className="presentation-slide-counter">
              {currentSlide + 1} / {slides.length}
            </div>
          </div>
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  );
}
