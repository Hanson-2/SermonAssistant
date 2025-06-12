import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Home, X, ChevronDown, Download } from 'lucide-react';
import { Sermon, getSermon, getUserProfile } from '../services/firebaseService';
import { extractScriptureReferences, ScriptureReference } from '../utils/smartParseScriptureInput';
import { buildScriptureReference } from '../utils/scriptureReferenceUtils';
import ScriptureOverlay from '../components/ScriptureOverlay';
import PptxGenJS from 'pptxgenjs';
import './PresentationPage.scss';

// Animation configurations
type AnimationType = 'slide' | 'fade' | 'zoom' | 'flip' | 'slideUp' | 'rotate' | 'bounce' | 'blur';

const ANIMATION_OPTIONS = [
  { value: 'slide', label: 'Slide Horizontal', description: 'Slides left and right' },
  { value: 'fade', label: 'Fade', description: 'Simple fade in/out' },
  { value: 'zoom', label: 'Zoom', description: 'Scale in and out' },
  { value: 'flip', label: 'Flip', description: '3D flip transition' },
  { value: 'slideUp', label: 'Slide Vertical', description: 'Slides up and down' },
  { value: 'rotate', label: 'Rotate', description: 'Rotation effect' },
  { value: 'bounce', label: 'Bounce', description: 'Elastic bounce' },
  { value: 'blur', label: 'Blur', description: 'Blur transition' },
] as const;

const getAnimationVariants = (animationType: AnimationType, direction: 'next' | 'prev') => {
  const isNext = direction === 'next';
  
  switch (animationType) {
    case 'slide':
      return {
        initial: { opacity: 0, x: isNext ? 50 : -50 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: isNext ? -50 : 50 },
        transition: { duration: 0.3, ease: "easeInOut" }
      };
      
    case 'fade':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.4, ease: "easeInOut" }
      };
      
    case 'zoom':
      return {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.2 },
        transition: { duration: 0.3, ease: "easeInOut" }
      };
      
    case 'flip':
      return {
        initial: { opacity: 0, rotateY: isNext ? 90 : -90 },
        animate: { opacity: 1, rotateY: 0 },
        exit: { opacity: 0, rotateY: isNext ? -90 : 90 },
        transition: { duration: 0.5, ease: "easeInOut" }
      };
      
    case 'slideUp':
      return {
        initial: { opacity: 0, y: isNext ? 50 : -50 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: isNext ? -50 : 50 },
        transition: { duration: 0.3, ease: "easeInOut" }
      };
      
    case 'rotate':
      return {
        initial: { opacity: 0, rotate: isNext ? 45 : -45, scale: 0.8 },
        animate: { opacity: 1, rotate: 0, scale: 1 },
        exit: { opacity: 0, rotate: isNext ? -45 : 45, scale: 0.8 },
        transition: { duration: 0.4, ease: "easeInOut" }
      };
      
    case 'bounce':
      return {
        initial: { opacity: 0, y: 30, scale: 0.9 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -30, scale: 0.9 },
        transition: { 
          duration: 0.5, 
          ease: "easeOut",
          y: { type: "spring", stiffness: 200, damping: 20 }
        }
      };
      
    case 'blur':
      return {
        initial: { opacity: 0, filter: 'blur(10px)' },
        animate: { opacity: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, filter: 'blur(10px)' },
        transition: { duration: 0.4, ease: "easeInOut" }
      };
      
    default:
      return {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { duration: 0.2 }
      };
  }
};

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
  const [sermon, setSermon] = useState<Sermon | null>(null);  const [currentSlide, setCurrentSlide] = useState(0);  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false); // For navigation button animations
  
  // Animation states
  const [selectedAnimation, setSelectedAnimation] = useState<AnimationType>('slide');
  const [animationDirection, setAnimationDirection] = useState<'next' | 'prev'>('next');
  const [showAnimationDropdown, setShowAnimationDropdown] = useState(false);
  
  // User's preferred Bible translation
  const [defaultTranslation, setDefaultTranslation] = useState<string>('KJV');
  
  // Scripture overlay state
  const [scriptureOverlayOpen, setScriptureOverlayOpen] = useState(false);  const [selectedScripture, setSelectedScripture] = useState<{
    book: string;
    chapter: string;
    verse?: string;  // Make verse optional
    endVerse?: string;
    reference: string;
  } | null>(null);
  // Mobile hamburger menu state
  const [menuOpen, setMenuOpen] = useState(false);

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
  }, [slides, currentSlide]);  // Navigation handlers with fade animations
  const goToPreviousSlide = useCallback(() => {
    if (isTransitioning) return; // Prevent multiple rapid clicks
    
    setAnimationDirection('prev'); // Set direction for animation
    setIsTransitioning(true);
    
    // Brief fade out of nav buttons
    setTimeout(() => {
      setCurrentSlide(prev => Math.max(0, prev - 1));
      
      // Fade nav buttons back in after slide transition
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150); // Match slide transition duration
    }, 100); // Short delay for button fade out
  }, [isTransitioning]);

  const goToNextSlide = useCallback(() => {
    if (isTransitioning) return; // Prevent multiple rapid clicks
    
    setAnimationDirection('next'); // Set direction for animation
    setIsTransitioning(true);
    
    // Brief fade out of nav buttons
    setTimeout(() => {
      setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
      
      // Fade nav buttons back in after slide transition
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150); // Match slide transition duration
    }, 100); // Short delay for button fade out
  }, [slides.length, isTransitioning]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return; // Prevent multiple rapid clicks
    
    // Determine direction based on target slide
    setAnimationDirection(index > currentSlide ? 'next' : 'prev');
    setIsTransitioning(true);
    
    // Brief fade out of nav buttons
    setTimeout(() => {      setCurrentSlide(Math.max(0, Math.min(slides.length - 1, index)));
      
      // Fade nav buttons back in after slide transition
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150); // Match slide transition duration
    }, 100); // Short delay for button fade out
  }, [slides.length, isTransitioning, currentSlide]);
  // PowerPoint Export functionality
  const exportToPowerPoint = useCallback(async () => {
    if (!sermon || slides.length === 0) return;

    try {
      const pptx = new PptxGenJS();
      
      // Set presentation properties
      pptx.author = 'Sermon Notes Assistant';
      pptx.title = sermon.title || 'Presentation';
      pptx.subject = 'Sermon Presentation';
      
      // Define golden theme colors (hex values for PowerPoint)
      const goldTheme = {
        primary: 'D4AF37',      // primary-gold
        light: 'F4E4BC',        // light-gold
        dark: '1A1A1A',         // dark-bg-primary
        secondary: '2A2A2A',    // dark-bg-secondary
        text: 'E5E5E5'          // text-color-primary
      };

      // Font mapping for better PowerPoint compatibility
      const fontMapping: Record<string, string> = {
        // System fonts
        'system-ui': 'Segoe UI',
        'Arial': 'Arial',
        'Georgia': 'Georgia',
        'Times New Roman': 'Times New Roman',
        'Courier New': 'Courier New',
        'Trebuchet MS': 'Trebuchet MS',
        'Verdana': 'Verdana',
        'Comic Sans MS': 'Comic Sans MS',
        'Tahoma': 'Tahoma',
        'Helvetica': 'Arial', // Fallback to Arial
        'Calibri': 'Calibri',
        'Segoe UI': 'Segoe UI',
        
        // Google Fonts with PowerPoint-compatible fallbacks
        'Roboto': 'Calibri',
        'Open Sans': 'Segoe UI',
        'Lato': 'Calibri',
        'Montserrat': 'Arial',
        'Source Sans Pro': 'Segoe UI',
        'PT Sans': 'Arial',
        'Ubuntu': 'Calibri',
        'Nunito': 'Segoe UI',
        'Raleway': 'Arial',
        'Oswald': 'Impact',
        
        // Serif fonts
        'Merriweather': 'Georgia',
        'Playfair Display': 'Georgia',
        'Crimson Text': 'Times New Roman',
        'Libre Baskerville': 'Georgia',
        'Lora': 'Georgia',
        'PT Serif': 'Times New Roman',
        
        // Monospace fonts
        'Source Code Pro': 'Courier New',
        'Fira Code': 'Consolas',
        'Inconsolata': 'Consolas',
        'JetBrains Mono': 'Consolas',
        
        // App defaults
        'Trajan Pro': 'Times New Roman', // Title font fallback
        'Garamond': 'Times New Roman'
      };

      // Helper function to detect font from HTML style attributes
      const extractFontFamily = (html: string): string => {
        // Look for inline font-family styles
        const fontFamilyMatch = html.match(/font-family:\s*['"]?([^;'"]+)['"]?/i);
        if (fontFamilyMatch) {
          const fontFamily = fontFamilyMatch[1].trim();
          // Extract first font from comma-separated list
          const firstFont = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
          return fontMapping[firstFont] || 'Segoe UI'; // Default fallback
        }
        
        // Check for specific font classes or data attributes
        if (html.includes('font-family')) {
          // Try to extract from various font patterns
          const patterns = [
            /font-family:\s*["']([^"']+)["']/gi,
            /font-family:\s*([^;,\s]+)/gi
          ];
          
          for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
              const fontName = match[1].replace(/['"]/g, '').trim();
              return fontMapping[fontName] || 'Segoe UI';
            }
          }
        }
        
        return 'Segoe UI'; // Default font
      };

      // Helper function to strip HTML and convert to PowerPoint-compatible text
      const htmlToPlainText = (html: string): string => {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
      };

      // Enhanced function to parse HTML and extract formatting
      const parseHtmlContent = (html: string) => {
        const textBlocks: Array<{
          text: string;
          fontFamily: string;
          fontSize: number;
          color: string;
          bold: boolean;
          italic: boolean;
          underline: boolean;
          isHeading: boolean;
          headingLevel?: number;
        }> = [];

        // Create a temporary DOM element to parse HTML
        const div = document.createElement('div');
        div.innerHTML = html;

        // Function to recursively extract text with formatting
        const extractTextWithFormatting = (element: Node, inheritedFont = 'Segoe UI', inheritedSize = 24): void => {
          if (element.nodeType === Node.TEXT_NODE) {
            const text = element.textContent?.trim();
            if (text) {
              textBlocks.push({
                text,
                fontFamily: inheritedFont,
                fontSize: inheritedSize,
                color: goldTheme.text,
                bold: false,
                italic: false,
                underline: false,
                isHeading: false
              });
            }
          } else if (element.nodeType === Node.ELEMENT_NODE) {
            const elem = element as Element;
            let currentFont = inheritedFont;
            let currentSize = inheritedSize;
            let isBold = false;
            let isItalic = false;
            let isUnderline = false;
            let isHeading = false;
            let headingLevel = 0;
            let textColor = goldTheme.text;

            // Extract font from style attribute
            const style = elem.getAttribute('style');
            if (style) {
              const fontMatch = style.match(/font-family:\s*['"]?([^;'"]+)['"]?/i);
              if (fontMatch) {
                const fontFamily = fontMatch[1].split(',')[0].trim().replace(/['"]/g, '');
                currentFont = fontMapping[fontFamily] || currentFont;
              }
              
              const sizeMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)(px|pt|rem|em)/i);
              if (sizeMatch) {
                let size = parseFloat(sizeMatch[1]);
                const unit = sizeMatch[2].toLowerCase();
                // Convert to approximate PowerPoint points
                if (unit === 'px') size = size * 0.75;
                else if (unit === 'rem' || unit === 'em') size = size * 16 * 0.75;
                currentSize = Math.max(8, Math.min(72, size)); // Clamp between 8-72pt
              }
            }

            // Handle specific HTML tags
            const tagName = elem.tagName.toLowerCase();
            switch (tagName) {
              case 'h1':
                isHeading = true;
                headingLevel = 1;
                currentSize = 36;
                textColor = goldTheme.primary;
                isBold = true;
                break;
              case 'h2':
                isHeading = true;
                headingLevel = 2;
                currentSize = 32;
                textColor = goldTheme.primary;
                isBold = true;
                break;
              case 'h3':
                isHeading = true;
                headingLevel = 3;
                currentSize = 28;
                textColor = goldTheme.primary;
                isBold = true;
                break;
              case 'h4':
                isHeading = true;
                headingLevel = 4;
                currentSize = 24;
                textColor = goldTheme.primary;
                isBold = true;
                break;
              case 'strong':
              case 'b':
                isBold = true;
                textColor = goldTheme.primary;
                break;
              case 'em':
              case 'i':
                isItalic = true;
                textColor = goldTheme.light;
                break;
              case 'u':
                isUnderline = true;
                break;
            }

            // If this is a leaf element with text content
            if (elem.children.length === 0 && elem.textContent?.trim()) {
              textBlocks.push({
                text: elem.textContent.trim(),
                fontFamily: currentFont,
                fontSize: currentSize,
                color: textColor,
                bold: isBold,
                italic: isItalic,
                underline: isUnderline,
                isHeading,
                headingLevel
              });
            } else {
              // Recursively process children
              Array.from(elem.childNodes).forEach(child => {
                extractTextWithFormatting(child, currentFont, currentSize);
              });
            }
          }
        };

        // Start extraction
        Array.from(div.childNodes).forEach(child => {
          extractTextWithFormatting(child);
        });

        return textBlocks;
      };

      // Create title slide
      const titleSlide = pptx.addSlide();
      
      // Set slide background
      titleSlide.background = { color: goldTheme.dark };
      
      // Title with proper font detection
      const titleFont = fontMapping['Trajan Pro'] || 'Times New Roman';
      titleSlide.addText(sermon.title || 'Sermon Presentation', {
        x: 1, y: 2, w: 8, h: 1.5,
        fontSize: 44,
        fontFace: titleFont,
        color: goldTheme.primary,
        bold: true,
        align: 'center'
      });
      
      if (sermon.date) {
        titleSlide.addText(new Date(sermon.date).toLocaleDateString(), {
          x: 1, y: 3.8, w: 8, h: 0.8,
          fontSize: 20,
          fontFace: 'Segoe UI',
          color: goldTheme.light,
          align: 'center'
        });      }
      
      // Add scripture references if available
      if (currentSlideScriptureRefs.length > 0) {
        const scriptureText = currentSlideScriptureRefs
          .map(ref => buildScriptureReference(ref))
          .join(' • ');
          
        titleSlide.addText(scriptureText, {
          x: 1, y: 4.8, w: 8, h: 0.8,
          fontSize: 16,
          fontFace: 'Georgia',
          color: goldTheme.light,
          italic: true,
          align: 'center'
        });
      }

      // Create content slides with enhanced font preservation
      slides.forEach((slideContent, index) => {
        const slide = pptx.addSlide();
        
        // Set slide background
        slide.background = { color: goldTheme.dark };
        
        // Add slide number
        slide.addText(`${index + 1}`, {
          x: 9, y: 6.5, w: 0.5, h: 0.3,
          fontSize: 12,
          fontFace: 'Segoe UI',
          color: goldTheme.light,
          align: 'center'
        });
        
        // Parse HTML content to preserve formatting and fonts
        const textBlocks = parseHtmlContent(slideContent);
        
        if (textBlocks.length === 0) {
          // Fallback to plain text if parsing fails
          const plainText = htmlToPlainText(slideContent);
          const lines = plainText.split('\n').filter(line => line.trim());
          
          let yPosition = 1;
          const lineHeight = 0.8;
          
          lines.forEach((line, lineIndex) => {
            let fontSize = 24;
            let fontColor = goldTheme.text;
            let fontFamily = 'Segoe UI';
            let isBold = false;
            
            // Simple heading detection
            if (lineIndex === 0 && line.length < 100) {
              fontSize = 36;
              fontColor = goldTheme.primary;
              fontFamily = titleFont;
              isBold = true;
            }
            
            slide.addText(line, {
              x: 1,
              y: yPosition,
              w: 8,
              h: lineHeight,
              fontSize: fontSize,
              fontFace: fontFamily,
              color: fontColor,
              bold: isBold,
              align: 'center',
              valign: 'top'
            });
            
            yPosition += lineHeight;
          });
        } else {
          // Use parsed text blocks with preserved formatting
          let yPosition = 1;
          const lineHeight = 0.6;
          
          textBlocks.forEach((block, blockIndex) => {
            // Adjust positioning for different text types
            let xPos = 1;
            let width = 8;
            let alignment = 'center';
            
            if (block.isHeading) {
              // Center headings
              alignment = 'center';
            } else if (blockIndex > 0 && !textBlocks[blockIndex - 1].isHeading) {
              // Left-align body text
              alignment = 'left';
              xPos = 1.5;
              width = 7;
            }            slide.addText(block.text, {
              x: xPos,
              y: yPosition,
              w: width,
              h: lineHeight + 0.2, // Slightly more height for better spacing
              fontSize: block.fontSize,
              fontFace: block.fontFamily,
              color: block.color,
              bold: block.bold,
              italic: block.italic,
              underline: block.underline ? { style: 'sng', color: block.color } : undefined,
              align: alignment as 'left' | 'center' | 'right',
              valign: 'top'
            });
            
            // Add extra spacing after headings
            yPosition += lineHeight + (block.isHeading ? 0.3 : 0.1);
          });
        }
      });

      // Generate and download the PowerPoint file
      const fileName = `${sermon.title?.replace(/[^a-zA-Z0-9\s]/g, '') || 'Sermon'}_Presentation.pptx`;
      
      await pptx.writeFile({ fileName });
      
      // Show success message (you might want to add a toast notification)
      console.log('PowerPoint presentation exported successfully with preserved fonts and formatting!');
      
    } catch (error) {
      console.error('Error exporting to PowerPoint:', error);
      // You might want to show an error toast here
    }
  }, [sermon, slides, currentSlideScriptureRefs]);

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
  }, []);

  // Close animation dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showAnimationDropdown && !target.closest('.animation-dropdown-container')) {
        setShowAnimationDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAnimationDropdown]);// Handle scripture reference click
  const handleScriptureRefClick = useCallback((ref: ScriptureReference) => {    const reference = buildScriptureReference(ref);
    
    console.log('[PresentationPage] Scripture reference clicked:', reference);
    console.log('[PresentationPage] User preferred defaultTranslation:', defaultTranslation);setSelectedScripture({
      book: ref.book,
      chapter: ref.chapter.toString(),
      verse: ref.verse?.toString(),
      endVerse: ref.endVerse?.toString(),
      reference
    });
    setScriptureOverlayOpen(true);  }, [defaultTranslation]);
  // Toggle functions
  const toggleMenu = () => setMenuOpen(!menuOpen);
  
  // Navigation functions for hamburger menu
  const navigateToEdit = () => {
    if (id) {
      // Navigate to the edit page for this sermon
      navigate(`/expository/${id}`);
    } else {
      // Fallback to dashboard if no ID
      navigate('/dashboard');
    }
  };
    // Function to export to PowerPoint
  const exportToPPTX = () => {
    // Use the existing PowerPoint export function
    exportToPowerPoint();
  };

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
      {!isFullscreen && (        <header className="presentation-header">
          <div className="presentation-header-content">
            {/* Left side: Hamburger menu + Title */}
            <div className="presentation-left-section">
              {/* Hamburger menu button for mobile - positioned on left */}
              {typeof window !== 'undefined' && window.innerWidth <= 700 && (
                <button 
                  className="hamburger-btn header-hamburger"
                  onClick={toggleMenu} 
                  aria-label="Toggle menu"
                >
                  ☰
                </button>
              )}
              
              <div className="presentation-title-area">
                <h1 className="presentation-title">{sermon.title}</h1>
                <p className="presentation-date">{sermon.date}</p>
              </div>
            </div>
            
            {/* Right side: Desktop controls */}
            <div className="presentation-controls">
              {/* Back to Edit Button */}
              <button
                onClick={() => navigate(`/expository/${id}`)}
                className="presentation-control-btn back-to-edit-btn"
                title="Back to Edit Mode"
              >
                <span className="back-btn-text">Back to Edit</span>
              </button>
              
              {/* Export to PowerPoint Button */}              <button
                onClick={exportToPowerPoint}
                className="presentation-control-btn export-ppt-btn"
                title="Export to PowerPoint"
              >
                <Download size={16} />
                <span className="export-btn-text">Export PPT</span>
              </button>
              
              {/* Animation Selection Dropdown */}
              <div className="presentation-animation-selector">
                <div className="animation-dropdown-container">
                  <button
                    className="animation-dropdown-trigger"
                    onClick={() => setShowAnimationDropdown(!showAnimationDropdown)}
                    title="Select slide animation"
                  >
                    <span className="animation-label">
                      {ANIMATION_OPTIONS.find(opt => opt.value === selectedAnimation)?.label || 'Animation'}
                    </span>
                    <ChevronDown size={16} className={`dropdown-icon ${showAnimationDropdown ? 'open' : ''}`} />
                  </button>
                  
                  {showAnimationDropdown && (
                    <div className="animation-dropdown-menu">
                      {ANIMATION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          className={`animation-option ${selectedAnimation === option.value ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedAnimation(option.value);
                            setShowAnimationDropdown(false);
                          }}
                        >
                          <div className="option-content">
                            <span className="option-label">{option.label}</span>
                            <span className="option-description">{option.description}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
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
      )}{/* Main presentation area */}
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
                  title="Click to view scripture text"                >
                  {buildScriptureReference(ref)}
                </button>
              ))}
            </div>
          </Motion.div>
        )}        <div className="presentation-slide-container">
          {/* Navigation arrows - moved OUTSIDE slide area */}
          <button
            onClick={goToPreviousSlide}
            disabled={currentSlide === 0}
            className={`presentation-nav-btn presentation-nav-prev ${isTransitioning ? 'fade-out' : 'fade-in'}`}
            aria-label="Previous slide"
            title="Previous slide (←)"
          >
            <ChevronLeft size={32} />
          </button>
          
          {/* Slide content */}
          <div className="presentation-slide-area">
            <AnimatePresence mode="wait">
              <Motion.div
                key={currentSlide}
                {...getAnimationVariants(selectedAnimation, animationDirection)}
                className="presentation-slide"
              >
                <div 
                  className="presentation-slide-content"
                  dangerouslySetInnerHTML={{ __html: slides[currentSlide] }}
                />
              </Motion.div>
            </AnimatePresence>
          </div>
          
          <button
            onClick={goToNextSlide}
            disabled={currentSlide === slides.length - 1}
            className={`presentation-nav-btn presentation-nav-next ${isTransitioning ? 'fade-out' : 'fade-in'}`}
            aria-label="Next slide"
            title="Next slide (→)"
          >
            <ChevronRight size={32} />
          </button>
        </div>
      </main>      {/* Footer with slide indicators only */}
      <footer className="presentation-footer">
        <div className="presentation-footer-content">          
          {/* Slide indicators */}
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

          {/* Footer controls: slide counter and icons */}
          <div className="presentation-footer-controls">
            <div className="presentation-slide-counter">
              {currentSlide + 1} / {slides.length}
            </div>
            <button
              className="presentation-footer-btn"
              title="Go to Home"
              onClick={() => goToSlide(0)}
              aria-label="Go to Home"
              style={{ borderRadius: 0, background: 'none', border: 'none', boxShadow: 'none', padding: 0, marginLeft: 8, marginRight: 0 }}
            >
              <Home size={22} />
            </button>
            <button
              className="presentation-footer-btn presentation-footer-close"
              title="Close Presentation"
              onClick={() => navigate(-1)}
              aria-label="Close Presentation"
              style={{ borderRadius: 0, background: 'none', border: 'none', boxShadow: 'none', padding: 0, marginLeft: 8, marginRight: 0, color: 'var(--error-border, #e57373)' }}
            >
              <X size={22} />
            </button>
          </div>
        </div>
      </footer>      {/* Scripture Overlay */}
      <ScriptureOverlay
        open={scriptureOverlayOpen}
        onClose={() => setScriptureOverlayOpen(false)}
        book={selectedScripture?.book || ''}
        chapter={selectedScripture?.chapter || ''}
        verseRange={selectedScripture?.verse || ''}
        reference={selectedScripture?.reference || ''}
        defaultTranslation={defaultTranslation}      />

      {/* Mobile action buttons overlay (only when hamburger menu is open) */}
      {menuOpen && (
        <>
          <div className="menu-overlay" onClick={toggleMenu} />          <div className={`action-buttons ${menuOpen ? 'open' : ''}`}>
            <button onClick={() => navigate(`/expository/${id}`)}>Back to Edit</button>
            <button onClick={exportToPowerPoint}>Download to PPT</button>
            <button onClick={() => setShowAnimationDropdown(!showAnimationDropdown)}>
              Animation
            </button>
            <button onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
