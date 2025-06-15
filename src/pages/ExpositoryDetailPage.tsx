import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, updateSermonNotes, updateSermon, getScriptureVersesForChapter, getUserProfile } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";
import { extractScriptureReferences } from "../utils/smartParseScriptureInput";
import { mergeConsecutiveVerses } from "../utils/mergeConsecutiveVerses";
import CustomRichTextEditor from "../components/CustomRichTextEditor";
import ScriptureMiniCard from "../components/ScriptureMiniCard";
import ScriptureOverlay from "../components/ScriptureOverlay";
import TagsPanel from "../components/TagsPanel";
import TagOverlay from "../components/TagOverlay";
import debounce from "lodash.debounce";
import "./ExpositoryDetailPage.css";
import { bookAliases } from "../hooks/useScriptureAutocomplete";
import { buildScriptureReference, isValidVerseNumber } from '../utils/scriptureReferenceUtils';

function splitSlides(notes: string): string[] {
  return notes.split(/\n\s*---+\s*\n/).map(s => s.trim());
}

// Utility to fetch scripture text from local JSON (KJV as default)
async function fetchScriptureText(reference: string): Promise<string> {
  try {
    const [bookAndChapter, verseStr] = reference.split(":");
    const match = bookAndChapter.trim().match(/^([1-3]?\s?[A-Za-z .]+)\s*(\d+)$/);
    if (!match) return "Invalid chapter reference.";
    const book = match[1].replace(/\s+/g, ' ').trim();
    const chapter = parseInt(match[2], 10);
    if (isNaN(chapter)) return "Invalid chapter number.";

    let lookupBook = bookAliases[book.toLowerCase()] || book.charAt(0).toUpperCase() + book.slice(1).toLowerCase();
    const verse = verseStr ? parseInt(verseStr, 10) : null;

    const verses = await getScriptureVersesForChapter(lookupBook, String(chapter));
    if (!verses || verses.length === 0) return "No verses found.";

    if (verse) {
      let found = verses.find(v => Number(v.verse) === verse && v.translation === "EXB")
              || verses.find(v => Number(v.verse) === verse);
      return found ? `${lookupBook} ${chapter}:${verse} ${found.text}` : "Verse not found.";
    } else {
      const exbVerses = verses.filter(v => v.translation === "EXB");
      const toShow = exbVerses.length > 0 ? exbVerses : verses;
      return toShow.map(v => `${lookupBook} ${chapter}:${v.verse} ${v.text}`).join("\n");
    }
  } catch (e) {
    return "Error loading scripture.";
  }
}

// Add a hook to detect mobile
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= breakpoint);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);
  return isMobile;
}

// --- Debounce scripture reference extraction for stability ---
const debouncedSetRefs = (rawRefsFromEffect: any[], setScriptureRefs: any, prevNormalizedRefs: any) => {
  // Normalize refs immediately before setting state
  const normalizedRefsFromEffect = rawRefsFromEffect.map(ref => {
    let bookName = ref.book;
    if (bookName) {
      let localRawBook = bookName.replace(/\s/g, "").toLowerCase();
      bookName = bookAliases[localRawBook] || bookName;
    }
    // Use strict builder
    let referenceString = buildScriptureReference({ ...ref, book: bookName });
    return { ...ref, book: bookName, reference: referenceString };
  });
  setScriptureRefs(prevNormalizedRefs => {
    // Compare with previously set normalized refs
    if (
      !Array.isArray(prevNormalizedRefs) ||
      normalizedRefsFromEffect.length !== prevNormalizedRefs.length ||
      JSON.stringify(normalizedRefsFromEffect) !== JSON.stringify(prevNormalizedRefs)
    ) {
      // console.log('[ExpositoryDetailPage] debouncedSetRefs: Updating scriptureRefs from useEffect', normalizedRefsFromEffect);
      return normalizedRefsFromEffect; // Set normalized refs
    }
    // console.log('[ExpositoryDetailPage] debouncedSetRefs: No change from useEffect, keeping existing scriptureRefs');
    return prevNormalizedRefs;
  });
};

export default function ExpositoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [slides, setSlides] = useState<string[]>([""]);
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [scriptureRefs, setScriptureRefs] = useState<any[]>([]);
  const [lockedOverlayRef, setLockedOverlayRef] = useState<{
    book: string;
    chapter: number;
    verseRange: string;
    reference: string;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [overlayContent, setOverlayContent] = useState<string>("");
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [overlayTranslations, setOverlayTranslations] = useState<Array<{ code: string, label: string, text: string }>>([]);
  const [overlayOpen, setOverlayOpen] = useState(false);

  // --- Editable sermon metadata state ---
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editableTitle, setEditableTitle] = useState("");
  const [editableDescription, setEditableDescription] = useState("");
  const [editableDate, setEditableDate] = useState("");
  const [savingMetadata, setSavingMetadata] = useState(false);
  
  // --- Get user's default translation from user profile ---
  const [defaultTranslation, setDefaultTranslation] = useState<string>('');
  
  // --- Tag management state ---
  const [selectedTagFromDropdown, setSelectedTagFromDropdown] = useState<string | null>(null);
  const [tagOverlayOpen, setTagOverlayOpen] = useState(false);
  // --- Per-slide Scripture Refs State ---
  const [slideScriptureRefs, setSlideScriptureRefs] = useState<Record<number, any[]>>({});
    const [slideTitles, setSlideTitles] = useState<string[]>([]);
  const [editingTitleIdx, setEditingTitleIdx] = useState<number | null>(null);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const [showTagsPanelOverlay, setShowTagsPanelOverlay] = useState(false);
  // Prevent background scroll when overlay is open
  useEffect(() => {
    if (showTagsPanelOverlay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showTagsPanelOverlay]);

  useEffect(() => {
    // Load user's default translation from their profile
    const loadUserPreferences = async () => {
      try {
        console.log('[ExpositoryDetailPage] Loading user profile...');
        const profile = await getUserProfile();
        console.log('[ExpositoryDetailPage] User profile loaded:', profile);
        
        if (profile?.preferences?.defaultBibleVersion) {
          console.log('[ExpositoryDetailPage] Setting defaultTranslation from profile:', profile.preferences.defaultBibleVersion);
          setDefaultTranslation(profile.preferences.defaultBibleVersion);
        } else {
          console.log('[ExpositoryDetailPage] No defaultBibleVersion in profile, checking localStorage...');
          // Fallback to localStorage if profile doesn't exist yet
          const stored = localStorage.getItem('defaultBibleVersion');
          console.log('[ExpositoryDetailPage] localStorage defaultBibleVersion:', stored);
          if (stored) setDefaultTranslation(stored);
        }
      } catch (error) {
        console.error('[ExpositoryDetailPage] Error loading user profile:', error);
        // Fallback to localStorage if there's an error
        const stored = localStorage.getItem('defaultBibleVersion');
        console.log('[ExpositoryDetailPage] Fallback to localStorage:', stored);
        if (stored) setDefaultTranslation(stored);
      }
    };
    loadUserPreferences();
  }, []);
  useEffect(() => {
    if (!id) return;
    getSermon(id).then((data) => {
      if (data) {
        setSermon(data);
        
        // Initialize editable metadata
        setEditableTitle(data.title || "");
        setEditableDescription(data.description || "");
        setEditableDate(data.date || "");
        
        if (data.notes && typeof data.notes === "object") {
          const orderedSlides = Object.keys(data.notes)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => data.notes![key]);
          setSlides(orderedSlides.length ? orderedSlides : [""]);
        } else {
          const initialSlides = splitSlides(data.description || "");
          setSlides(initialSlides.length ? initialSlides : [""]);
        }        // Restore slideScriptureRefs from database if available
        console.log('[ExpositoryDetailPage] Full sermon data from database:', data);
        if (data.slideScriptureRefs) {
          console.log('[ExpositoryDetailPage] Found slideScriptureRefs in database:', data.slideScriptureRefs);
          console.log('[ExpositoryDetailPage] Type of slideScriptureRefs:', typeof data.slideScriptureRefs);
          console.log('[ExpositoryDetailPage] Keys:', Object.keys(data.slideScriptureRefs));
          console.log('[ExpositoryDetailPage] Raw slideScriptureRefs structure:', JSON.stringify(data.slideScriptureRefs, null, 2));
          
          // Convert numeric keys back to numbers and set the state
          const restoredRefs: Record<number, any[]> = {};
          Object.entries(data.slideScriptureRefs).forEach(([key, value]) => {
            restoredRefs[Number(key)] = value;
            console.log(`[ExpositoryDetailPage] Restored slide ${key}:`, value);
          });
          setSlideScriptureRefs(restoredRefs);          console.log('[ExpositoryDetailPage] Final restored slideScriptureRefs:', restoredRefs);
          
          // Add a test to verify the restoration worked
          setTimeout(() => {
            console.log('[ExpositoryDetailPage] POST-RESTORATION CHECK - slideScriptureRefs state:', slideScriptureRefs);
          }, 1000);        } else {
          // Initialize empty slideScriptureRefs if none in database
          console.log('[ExpositoryDetailPage] No slideScriptureRefs in database, initializing empty');
          console.log('[ExpositoryDetailPage] Available fields in sermon data:', Object.keys(data));
          setSlideScriptureRefs({});
        }
        
        // Restore slideTitles from database if available
        if (data.slideTitles && Array.isArray(data.slideTitles)) {
          console.log('[ExpositoryDetailPage] Found slideTitles in database:', data.slideTitles);
          setSlideTitles(data.slideTitles);
        } else {
          console.log('[ExpositoryDetailPage] No slideTitles in database, will initialize default titles');
          // Note: Default titles will be initialized in the slides useEffect
        }
      } else {
        navigate("/dashboard");
      }
    });
  }, [id, navigate]);  const persistSlides = useCallback(() => {
    if (!sermon) {
      console.log('[ExpositoryDetailPage] persistSlides: No sermon, skipping persistence');
      return;
    }
    const newNotes: Record<string, string> = slides.reduce((acc, slideContent, idx) => {
      acc[String(idx)] = slideContent;
      return acc;
    }, {} as Record<string, string>);
    
    console.log('[ExpositoryDetailPage] persistSlides called with:');
    console.log('  - sermon ID:', sermon.id);
    console.log('  - newNotes:', newNotes);
    console.log('  - slideScriptureRefs:', slideScriptureRefs);
    console.log('  - slideScriptureRefs keys:', Object.keys(slideScriptureRefs));
    console.log('  - slideScriptureRefs JSON:', JSON.stringify(slideScriptureRefs, null, 2));
    console.log('  - slideTitles:', slideTitles);
    
    if (Object.keys(slideScriptureRefs).length > 0) {
      console.log('[ExpositoryDetailPage] persistSlides: Has scripture refs to save');
      Object.entries(slideScriptureRefs).forEach(([key, refs]) => {
        console.log(`[ExpositoryDetailPage] Slide ${key} has ${refs.length} refs:`, refs);
      });
    } else {
      console.log('[ExpositoryDetailPage] persistSlides: No scripture refs to save');
    }
    
    updateSermonNotes(sermon.id.toString(), newNotes, slideScriptureRefs, slideTitles)
      .then(() => {
        console.log('[ExpositoryDetailPage] Successfully persisted slides, scriptureRefs, and titles');
      })
      .catch((error) => {
        console.error("Failed to save slides", error);
      });
  }, [sermon, slides, slideScriptureRefs, slideTitles]);
  const debouncedPersistSlides = useCallback(debounce(persistSlides, 500), [persistSlides]);

  // Debug slideScriptureRefs changes and auto-persist
  useEffect(() => {
    console.log('[ExpositoryDetailPage] slideScriptureRefs state changed:', JSON.stringify(slideScriptureRefs, null, 2));
    
    // Auto-persist when slideScriptureRefs changes (but not on initial mount)
    if (sermon && Object.keys(slideScriptureRefs).length > 0) {
      console.log('[ExpositoryDetailPage] Auto-persisting due to slideScriptureRefs change');
      debouncedPersistSlides();
    }
  }, [slideScriptureRefs, sermon, debouncedPersistSlides]);
  const [isComposing, setIsComposing] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null);

  // Handle deferred updates when composition ends
  useEffect(() => {
    if (!isComposing && pendingUpdate !== null) {
      // Apply the pending update immediately when composition ends
      setSlides((prevSlides) => {
        return prevSlides.map((slide, idx) =>
          idx === activeSlide ? pendingUpdate : slide
        );
      });
      debouncedPersistSlides();
      setSaveStatus("");
      setPendingUpdate(null);
    }
  }, [isComposing, pendingUpdate, activeSlide, debouncedPersistSlides]);

  function updateSlideContent(newHtml: string) {
    if (isComposing) {
      // Store the update to apply when composition ends
      setPendingUpdate(newHtml);
      return;
    }
    setSlides((prevSlides) => {
      // Use a functional update for activeSlide to avoid stale closure
      return prevSlides.map((slide, idx) =>
        idx === activeSlide ? newHtml : slide
      );
    });
    debouncedPersistSlides();
    setSaveStatus("");
    // Note: Scripture refs are updated via useEffect watching 'slides'
    // or directly by EditableRichText's onRefsChange calling handleRefsChange
  }
  function handleRefsChange(rawRefsFromEditableRichText: any[]) {
    const normalizedRefs = rawRefsFromEditableRichText.map(ref => {
      let bookName = ref.book;
      if (bookName) {
        let localRawBook = bookName.replace(/\s/g, "").toLowerCase();
        bookName = bookAliases[localRawBook] || bookName;
      }
      let referenceString = buildScriptureReference({ ...ref, book: bookName });
      return { ...ref, book: bookName, reference: referenceString };
    });
    setScriptureRefs(normalizedRefs);
  }

  function addSlide() {
    setSlides(prevSlides => {
      const updatedSlides = [...prevSlides];
      const newIndex = activeSlide + 1;
      updatedSlides.splice(newIndex, 0, "");
      // Batch update activeSlide after slides update
      setActiveSlide(newIndex);
      debouncedPersistSlides();
      return updatedSlides;
    });
  }

  function deleteSlide() {
    if (slides.length <= 1) return;
    setSlides(prevSlides => {
      const updatedSlides = prevSlides.filter((_, idx) => idx !== activeSlide);
      // Batch update activeSlide after slides update
      setActiveSlide(prev => Math.max(prev - 1, 0));
      debouncedPersistSlides();
      return updatedSlides;
    });
  }

  function goToPreviousSlide() {
    if (activeSlide > 0) setActiveSlide(activeSlide - 1);
  }

  function goToNextSlide() {
    if (activeSlide < slides.length - 1) setActiveSlide(activeSlide + 1);
  }

  useEffect(() => {
    if (!selectedRef) return;
    setOverlayLoading(true);
    setOverlayError(null);
    setOverlayContent("");
    fetchScriptureText(selectedRef)
      .then((text) => {
        setOverlayContent(text);
        setOverlayLoading(false);
      })
      .catch(() => {
        setOverlayError("Failed to load scripture text.");
        setOverlayLoading(false);
      });
  }, [selectedRef]);

  // Listen for custom event to open overlay
  useEffect(() => {
    function handleShowScriptureOverlay(e: any) {
      if (overlayOpen && lockedOverlayRef) {
        return;
      }
      let detailBook = e.detail.book;
      let detailChapter = e.detail.chapter;
      let detailVerse = e.detail.verse;
      let detailEndVerse = e.detail.endVerse;
      // Always use buildScriptureReference for overlay
      let normalizedBook = detailBook;
      if (normalizedBook) {
        let localRawBook = normalizedBook.replace(/\s/g, "").toLowerCase();
        normalizedBook = bookAliases[localRawBook] || (normalizedBook.charAt(0).toUpperCase() + normalizedBook.slice(1).toLowerCase());
      }
      const refObj = {
        book: normalizedBook,
        chapter: detailChapter,
        verseRange: (isValidVerseNumber(detailVerse) ? (isValidVerseNumber(detailEndVerse) && detailEndVerse !== detailVerse ? `${Number(detailVerse)}-${Number(detailEndVerse)}` : `${Number(detailVerse)}`) : ""),
        reference: buildScriptureReference({ book: normalizedBook, chapter: detailChapter, verse: detailVerse, endVerse: detailEndVerse })
      };
      setLockedOverlayRef(refObj);
      setOverlayOpen(true);
    }

    window.addEventListener("showScriptureOverlay", handleShowScriptureOverlay);
    return () => {
      window.removeEventListener("showScriptureOverlay", handleShowScriptureOverlay);
    };
  }, [overlayOpen, lockedOverlayRef]);
  // When overlay closes, clear locked ref
  function handleOverlayClose() {
    console.log('[ExpositoryDetailPage] handleOverlayClose called. Current overlayOpen:', overlayOpen);
    setOverlayOpen(false);
    setLockedOverlayRef(null);
    console.log('[ExpositoryDetailPage] Overlay closed. overlayOpen set to false, lockedOverlayRef to null.');
  }

  // --- Metadata editing functions ---
  const saveMetadata = async (field: 'title' | 'description' | 'date', value: string) => {
    if (!sermon) return;
    
    setSavingMetadata(true);
    try {
      const updateData: Partial<Sermon> = {};
      updateData[field] = value;
      
      await updateSermon(sermon.id.toString(), updateData);
      
      // Update local sermon state
      setSermon(prev => prev ? { ...prev, [field]: value } : null);
      
    } catch (error) {
      console.error(`Failed to save ${field}:`, error);
      // Revert the editable value on error
      if (field === 'title') setEditableTitle(sermon.title || "");
      if (field === 'description') setEditableDescription(sermon.description || "");
      if (field === 'date') setEditableDate(sermon.date || "");
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleTitleEdit = () => {
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    if (editableTitle.trim() !== (sermon?.title || "").trim()) {
      await saveMetadata('title', editableTitle.trim());
    }
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditableTitle(sermon?.title || "");
  };
  const handleMetadataTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTitleCancel();
    }
  };

  const handleDescriptionEdit = () => {
    setIsEditingDescription(true);
  };

  const handleDescriptionSave = async () => {
    setIsEditingDescription(false);
    if (editableDescription.trim() !== (sermon?.description || "").trim()) {
      await saveMetadata('description', editableDescription.trim());
    }
  };

  const handleDescriptionCancel = () => {
    setIsEditingDescription(false);
    setEditableDescription(sermon?.description || "");
  };

  const handleMetadataDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleDescriptionSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleDescriptionCancel();
    }
  };

  const handleDateEdit = () => {
    setIsEditingDate(true);
  };

  const handleDateSave = async () => {
    setIsEditingDate(false);
    if (editableDate.trim() !== (sermon?.date || "").trim()) {
      await saveMetadata('date', editableDate.trim());
    }
  };

  const handleDateCancel = () => {
    setIsEditingDate(false);
    setEditableDate(sermon?.date || "");
  };

  const handleMetadataDateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDateSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleDateCancel();
    }  };  // Update slideScriptureRefs for slides that don't have persisted refs
  useEffect(() => {
    // Only extract scripture refs from text for slides that don't have persisted refs
    const refsBySlide = slides.map((slideText, slideIndex) => {
      // If we already have slideScriptureRefs for this slide (from database or tag selection), use those
      const existingRefs = slideScriptureRefs[slideIndex];
      if (existingRefs && existingRefs.length > 0) {
        return existingRefs.map(ref => ({
          ...ref,
          reference: buildScriptureReference(ref)
        }));
      }
      // Only extract from text if no existing refs
      const rawRefs = extractScriptureReferences(slideText);
      const textBasedRefs = rawRefs.map(ref => {
        let bookName = ref.book;
        if (bookName) {
          let localRawBook = bookName.replace(/\s/g, "").toLowerCase();
          bookName = bookAliases[localRawBook] || bookName;
        }
        let referenceString = buildScriptureReference({ ...ref, book: bookName });
        return {
          ...ref,
          book: bookName,
          reference: referenceString,
          sourceType: 'manual' as const,
          addedViaTag: false
        };
      });
      return textBasedRefs;
    });
    // Convert to object format and only update if there are changes
    const refsObject = refsBySlide.reduce((acc, refs, index) => {
      acc[index] = refs;
      return acc;
    }, {} as Record<number, any[]>);

    // Only update if different from current state
    if (JSON.stringify(refsObject) !== JSON.stringify(slideScriptureRefs)) {
      setSlideScriptureRefs(refsObject);
    }

    // Initialize slide titles if not set or slides changed
    setSlideTitles(prev => {
      if (!prev || prev.length !== slides.length) {
        return slides.map((_, idx) => `Page ${idx + 1}`);
      }
      return prev;
    });
  }, [slides, bookAliases]);
  // Editable sidebar title logic
  function handleTitleDoubleClick(idx: number) {
    setEditingTitleIdx(idx);
  }

  // Drag and drop functionality for reordering slides
  function handleDragStart(e: React.DragEvent, idx: number) {
    setDraggedSlideIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
    
    // Add visual feedback
    const dragTarget = e.currentTarget as HTMLElement;
    dragTarget.style.opacity = '0.5';
  }

  function handleDragEnd(e: React.DragEvent) {
    setDraggedSlideIndex(null);
    setDragOverIndex(null);
    
    // Remove visual feedback
    const dragTarget = e.currentTarget as HTMLElement;
    dragTarget.style.opacity = '';
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(idx);
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    const dragIndex = draggedSlideIndex;
    
    if (dragIndex === null || dragIndex === dropIndex) {
      setDraggedSlideIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder slides, slide titles, and scripture refs
    setSlides(prevSlides => {
      const newSlides = [...prevSlides];
      const draggedSlide = newSlides[dragIndex];
      newSlides.splice(dragIndex, 1);
      newSlides.splice(dropIndex, 0, draggedSlide);
      return newSlides;
    });

    setSlideTitles(prevTitles => {
      const newTitles = [...prevTitles];
      const draggedTitle = newTitles[dragIndex];
      newTitles.splice(dragIndex, 1);
      newTitles.splice(dropIndex, 0, draggedTitle);
      return newTitles;
    });

    // Reorder scripture references
    setSlideScriptureRefs(prevRefs => {
      const newRefs: Record<number, any[]> = {};
      const refsArray = Object.keys(prevRefs).sort((a, b) => Number(a) - Number(b)).map(key => prevRefs[Number(key)] || []);
      
      // Reorder the refs array
      const draggedRefs = refsArray[dragIndex] || [];
      refsArray.splice(dragIndex, 1);
      refsArray.splice(dropIndex, 0, draggedRefs);
      
      // Rebuild the refs object with new indices
      refsArray.forEach((refs, index) => {
        newRefs[index] = refs;
      });
      
      return newRefs;
    });

    // Update active slide if needed
    if (activeSlide === dragIndex) {
      setActiveSlide(dropIndex);
    } else if (activeSlide > dragIndex && activeSlide <= dropIndex) {
      setActiveSlide(activeSlide - 1);
    } else if (activeSlide < dragIndex && activeSlide >= dropIndex) {
      setActiveSlide(activeSlide + 1);
    }

    // Persist changes
    debouncedPersistSlides();

    setDraggedSlideIndex(null);
    setDragOverIndex(null);
  }  function handleTitleChange(idx: number, value: string) {
    setSlideTitles(titles => titles.map((t, i) => (i === idx ? value : t)));
  }
  function handleTitleBlur(idx: number) {
    setEditingTitleIdx(null);
    // Persist titles to backend
    debouncedPersistSlides();
  }
  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Enter') {
      setEditingTitleIdx(null);
      // Persist titles to backend
      debouncedPersistSlides();
    }
  }// Fix: Always use only text-based refs for each slide, and do not merge with existingRefs (which may contain stale or duplicate refs)
  useEffect(() => {
    // For each slide, extract all scripture refs from text
    const refsBySlide = slides.map((slideText) => {
      const rawRefs = extractScriptureReferences(slideText);
      return rawRefs.map(ref => {
        let bookName = ref.book;
        if (bookName) {
          let localRawBook = bookName.replace(/\s/g, "").toLowerCase();
          bookName = bookAliases[localRawBook] || bookName;
        }
        return {
          ...ref,
          book: bookName,
          reference: buildScriptureReference({ ...ref, book: bookName }),
          sourceType: 'manual' as const,
          addedViaTag: false
        };
      });
    });
    // Convert to object format and only update if there are changes
    const refsObject = refsBySlide.reduce((acc, refs, index) => {
      acc[index] = refs;
      return acc;
    }, {} as Record<number, any[]>);
    if (JSON.stringify(refsObject) !== JSON.stringify(slideScriptureRefs)) {
      setSlideScriptureRefs(refsObject);
    }
    setSlideTitles(prev => {
      if (!prev || prev.length !== slides.length) {
        return slides.map((_, idx) => `Page ${idx + 1}`);
      }
      return prev;
    });
  }, [slides, bookAliases]);

  // Function to remove a scripture reference from current slide
  const handleRemoveScriptureRef = useCallback((refToRemove: any) => {
    const currentRefs = slideScriptureRefs[activeSlide] || [];
    const updatedRefs = currentRefs.filter(ref => ref.reference !== refToRemove.reference);
    
    setSlideScriptureRefs(prev => ({
      ...prev,
      [activeSlide]: updatedRefs
    }));

    // Trigger persistence
    debouncedPersistSlides();
    
    console.log('[ExpositoryDetailPage] Removed scripture ref:', refToRemove.reference);
  }, [activeSlide, slideScriptureRefs, debouncedPersistSlides]);  const handleVerseSelectionFromTag = useCallback(async (verses: any[]) => {
    // Add selected verses to the current slide
    if (!verses.length) return;

    console.log('[ExpositoryDetailPage] ====== TAG VERSE SELECTION START ======');
    console.log('[ExpositoryDetailPage] Raw verses from tag:', JSON.stringify(verses, null, 2));
    console.log('[ExpositoryDetailPage] Sample verse structure:', verses[0]);
    console.log('[ExpositoryDetailPage] Active slide:', activeSlide);
    console.log('[ExpositoryDetailPage] Current slideScriptureRefs:', JSON.stringify(slideScriptureRefs, null, 2));

    // Mark verses as coming from tags and add sourceType
    const taggedVerses = verses.map(v => {
      console.log('[ExpositoryDetailPage] Processing verse:', v);
      const processedVerse = {
        ...v,
        addedViaTag: true,
        sourceType: 'tag' as const,
        // Ensure numeric verse numbers for proper sorting
        verse: typeof v.verse === 'string' ? parseInt(v.verse, 10) : v.verse,
        chapter: typeof v.chapter === 'string' ? parseInt(v.chapter, 10) : v.chapter
      };
      console.log('[ExpositoryDetailPage] Processed to:', processedVerse);
      return processedVerse;
    });

    console.log('[ExpositoryDetailPage] Tagged verses after processing:', JSON.stringify(taggedVerses, null, 2));

    // DON'T add to slide text content - just add to slideScriptureRefs
    // This prevents duplication when the useEffect extracts refs from text
      // Update scripture refs for the current slide immediately
    const existingRefs = slideScriptureRefs[activeSlide] || [];
    const combinedRefs = [...existingRefs, ...taggedVerses];
    
    // Sort all refs by their position in the text to maintain left-to-right order
    const currentSlideText = slides[activeSlide] || '';
    const updatedRefs = sortReferencesByTextPosition(combinedRefs, currentSlideText);
    
    console.log('[ExpositoryDetailPage] Existing refs for slide', activeSlide, ':', JSON.stringify(existingRefs, null, 2));
    console.log('[ExpositoryDetailPage] Combined and sorted refs for slide', activeSlide, ':', JSON.stringify(updatedRefs, null, 2));setSlideScriptureRefs(prev => {
      const newState = {
        ...prev,
        [activeSlide]: updatedRefs
      };
      console.log('[ExpositoryDetailPage] New slideScriptureRefs state:', JSON.stringify(newState, null, 2));
      return newState;
    });

    console.log('[ExpositoryDetailPage] Added verses from tag to slide', activeSlide, ':', taggedVerses);// Trigger persistence of slideScriptureRefs - commented out as we do immediate persistence above
    // console.log('[ExpositoryDetailPage] Calling debouncedPersistSlides...');
    // debouncedPersistSlides();

    // Auto-add the tag to the sermon's tags if not already present
    if (selectedTagFromDropdown && sermon) {
      const currentTags = sermon.tags || [];
      if (!currentTags.includes(selectedTagFromDropdown)) {
        try {
          const updatedTags = [...currentTags, selectedTagFromDropdown];
          await updateSermon(sermon.id.toString(), { tags: updatedTags });
          
          // Update local sermon state
          setSermon(prev => prev ? { ...prev, tags: updatedTags } : null);
        } catch (error) {
          console.error('Failed to add tag to sermon:', error);
        }
      }
    }    // Close the overlay after verse selection
    setTagOverlayOpen(false);
    setSelectedTagFromDropdown(null);
      console.log('[ExpositoryDetailPage] ====== TAG VERSE SELECTION END ======');
  }, [activeSlide, slideScriptureRefs, debouncedPersistSlides, selectedTagFromDropdown, sermon]);

  // Test function to manually add test verses for debugging
  const addTestVerses = useCallback(() => {
    console.log('[ExpositoryDetailPage] ====== ADDING TEST VERSES ======');
    const testVerses = [
      {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        reference: "Genesis 1:1",
        addedViaTag: true,
        sourceType: 'tag' as const,
        text: "In the beginning God created the heaven and the earth."
      },
      {
        book: "Genesis", 
        chapter: 1,
        verse: 2,
        reference: "Genesis 1:2",
        addedViaTag: true,
        sourceType: 'tag' as const,
        text: "And the earth was without form, and void..."
      },
      {
        book: "Genesis",
        chapter: 1, 
        verse: 3,
        reference: "Genesis 1:3",
        addedViaTag: true,
        sourceType: 'tag' as const,
        text: "And God said, Let there be light..."
      }
    ];

    const existingRefs = slideScriptureRefs[activeSlide] || [];
    const updatedRefs = [...existingRefs, ...testVerses];
    
    console.log('[ExpositoryDetailPage] Test verses:', testVerses);
    console.log('[ExpositoryDetailPage] Updated refs:', updatedRefs);
      setSlideScriptureRefs(prev => ({
      ...prev,
      [activeSlide]: updatedRefs
    }));

    console.log('[ExpositoryDetailPage] Test verses state updated, auto-persistence should trigger');
    console.log('[ExpositoryDetailPage] ====== TEST VERSES ADDED ======');
  }, [activeSlide, slideScriptureRefs]);

  // --- Tag management functions ---
  const handleTagSelect = useCallback((tagName: string) => {
    setSelectedTagFromDropdown(tagName);
    setTagOverlayOpen(true);
  }, []);
  const handleTagOverlayClose = useCallback(() => {
    setTagOverlayOpen(false);
    setSelectedTagFromDropdown(null);
  }, []);
  const handleTagClick = useCallback((tagName: string) => {
    setSelectedTagFromDropdown(tagName);
    setTagOverlayOpen(true);
  }, []);

  const currentSlideHtml = useMemo(() => {
    if (!Array.isArray(slides) || slides.length === 0) return "";
    if (activeSlide < 0 || activeSlide >= slides.length) return "";
    return slides[activeSlide] || "";
  }, [slides, activeSlide]);
  // Utility to sort scripture references by their position in the text
  const sortReferencesByTextPosition = useCallback((refs: any[], slideText: string): any[] => {
    // If we don't have slide text, return refs as-is
    if (!slideText) return refs;
    
    console.log('[sortReferencesByTextPosition] Input refs:', refs.map(r => buildScriptureReference(r)));
    console.log('[sortReferencesByTextPosition] Slide text:', slideText);
    
    // Extract all references from the text to get their actual positions in the text
    const textRefs = extractScriptureReferences(slideText);
    console.log('[sortReferencesByTextPosition] Text refs:', textRefs.map(r => r.reference));
    
    // Create a map of reference strings to their character positions in the text
    const positionMap = new Map<string, number>();
    
    // For each reference found in text, find its actual character position
    textRefs.forEach((ref) => {
      const refString = ref.reference;
      // Find the position of this reference in the original text
      const position = slideText.indexOf(refString);
      if (position !== -1) {
        positionMap.set(refString, position);
        console.log(`[sortReferencesByTextPosition] Found "${refString}" at position ${position}`);
      } else {
        // Try to find by looking for the original pattern in text
        // Look for book name + chapter pattern
        const bookPattern = ref.book.replace(/\s+/g, '\\s+');
        const regex = new RegExp(`\\b${bookPattern}\\s+${ref.chapter}(?::\\d+(?:-\\d+)?)?\\b`, 'i');
        const match = slideText.match(regex);
        if (match && match.index !== undefined) {
          positionMap.set(refString, match.index);
          console.log(`[sortReferencesByTextPosition] Found "${refString}" via pattern at position ${match.index}`);
        }
      }
    });
    
    // Sort the provided refs based on their position in text
    const sortedRefs = [...refs].sort((a, b) => {
      const aRef = buildScriptureReference(a);
      const bRef = buildScriptureReference(b);
      
      const aPos = positionMap.get(aRef) ?? Number.MAX_SAFE_INTEGER;
      const bPos = positionMap.get(bRef) ?? Number.MAX_SAFE_INTEGER;
      
      console.log(`[sortReferencesByTextPosition] Comparing "${aRef}" (pos: ${aPos}) vs "${bRef}" (pos: ${bPos})`);
      
      // If both have positions in text, sort by position
      if (aPos !== Number.MAX_SAFE_INTEGER && bPos !== Number.MAX_SAFE_INTEGER) {
        return aPos - bPos;
      }
      
      // If only one has a position, prioritize it
      if (aPos !== Number.MAX_SAFE_INTEGER) return -1;
      if (bPos !== Number.MAX_SAFE_INTEGER) return 1;
      
      // If neither has a position (both are tag-added), maintain original order
      // Or sort by book/chapter/verse
      if (a.book !== b.book) return a.book.localeCompare(b.book);
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      return (a.verse || 0) - (b.verse || 0);
    });
    
    console.log('[sortReferencesByTextPosition] Sorted refs:', sortedRefs.map(r => buildScriptureReference(r)));
    return sortedRefs;
  }, []);

  if (!sermon) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  }
  return (
    <div className="expository-detail-root">
      <div className="expository-bg-overlay" />
        {/* Action buttons above title banner */}      <div className="expository-action-buttons">
        <button 
          className="expository-action-btn edit-details-btn"
          onClick={() => navigate(`/edit-expository/${sermon.id}`)}
          title="Edit sermon details"
        >
          Edit Details
        </button>
        <button 
          className="expository-action-btn presentation-btn"
          onClick={() => navigate(`/presentation/${sermon.id}`)}
          title="View presentation"
        >
          Presentation
        </button>
        {/* Tags button removed for desktop layout as requested */}
      </div>

      <div className="expository-sticky-banner">
        <div className="expository-banner-row">
          {isEditingTitle ? (
            <input
              type="text"
              className="expository-banner-title-input"
              value={editableTitle}
              onChange={(e) => setEditableTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleMetadataTitleKeyDown}
              autoFocus
              placeholder="Enter sermon title"
            />
          ) : (            <h1 
              className="expository-banner-title editable" 
              onClick={handleTitleEdit}
              title="Click to edit title"
            >
              {sermon.title || "Untitled Sermon"}
              {!savingMetadata && <span className="edit-hint">&lt;</span>}
            </h1>
          )}
          
          {isEditingDate ? (
            <input
              type="text"
              className="expository-banner-date-input"
              value={editableDate}
              onChange={(e) => setEditableDate(e.target.value)}
              onBlur={handleDateSave}
              onKeyDown={handleMetadataDateKeyDown}
              autoFocus
              placeholder="Enter date"
            />
          ) : (            <span 
              className="expository-banner-date editable" 
              onClick={handleDateEdit}
              title="Click to edit date"
            >
              {sermon.date || "No date"}
              {!savingMetadata && <span className="edit-hint">&lt;</span>}
            </span>
          )}
        </div>
        
        <div className="expository-banner-desc-container">
          {isEditingDescription ? (
            <textarea
              className="expository-banner-desc-input"
              value={editableDescription}
              onChange={(e) => setEditableDescription(e.target.value)}
              onBlur={handleDescriptionSave}
              onKeyDown={handleMetadataDescriptionKeyDown}
              autoFocus
              placeholder="Enter sermon description"
              rows={2}
            />
          ) : (            <div 
              className="expository-banner-desc editable" 
              onClick={handleDescriptionEdit}
              title="Click to edit description (Ctrl+Enter to save)"
            >
              {sermon.description ? (
                sermon.description.length > 120 ? 
                  `${sermon.description.slice(0, 120)}...` : 
                  sermon.description
              ) : "No description"}
              {!savingMetadata && <span className="edit-hint">&lt;</span>}
            </div>
          )}
          
          {savingMetadata && (
            <div className="saving-indicator">
              <span className="saving-text">Saving...</span>
            </div>
          )}
        </div>
      </div>      {/* Scripture mini cards banner */}
      <div className="expository-scripture-banner">        {(() => {
          const currentSlideRefs = slideScriptureRefs[activeSlide] || [];
          
          // Sort references by their position in the text
          const currentSlideText = slides[activeSlide] || '';
          const sortedRefs = sortReferencesByTextPosition(currentSlideRefs, currentSlideText);
          
          // Normalize book name and reference for all refs before merging
          const normalizedRefs = sortedRefs.map(ref => {
            let bookName = ref.book;
            if (bookName) {
              let localRawBook = bookName.replace(/\s/g, "").toLowerCase();
              bookName = bookAliases[localRawBook] || (bookName.charAt(0).toUpperCase() + bookName.slice(1).toLowerCase());
            }
            return {
              ...ref,
              book: bookName,
              reference: buildScriptureReference({ ...ref, book: bookName })
            };
          });
          const mergedRefs = mergeConsecutiveVerses(normalizedRefs);
          return mergedRefs.map((ref, i) => {
            // Force reference normalization at render time
            let bookName = ref.book;
            if (bookName) {
              let localRawBook = bookName.replace(/\s/g, "").toLowerCase();
              bookName = bookAliases[localRawBook] || (bookName.charAt(0).toUpperCase() + bookName.slice(1).toLowerCase());
            }
            const normalizedRef = {
              ...ref,
              book: bookName,
              reference: buildScriptureReference({ ...ref, book: bookName })
            };
            return (
              <ScriptureMiniCard 
                key={`${normalizedRef.reference}-${normalizedRef.addedViaTag ? 'tag' : 'manual'}-${i}`} 
                verse={normalizedRef} 
                onRemove={() => handleRemoveScriptureRef(normalizedRef)}
              />
            );
          });
        })()}
      </div><div className="expository-main-layout">
        <div className="expository-page-list">
          {/* Page list navigation */}
          <nav style={{ display: 'contents' }}>            {slides.map((slide, idx) => (
              <div key={idx}>
                {editingTitleIdx === idx ? (
                  <input
                    className="expository-page-list-item editing"
                    value={slideTitles[idx] || `Page ${idx + 1}`}
                    autoFocus
                    onChange={e => handleTitleChange(idx, e.target.value)}
                    onBlur={() => handleTitleBlur(idx)}
                    onKeyDown={e => handleTitleKeyDown(e, idx)}
                    placeholder={`Enter title for Page ${idx + 1}`}
                    title={`Slide title input for Page ${idx + 1}`}
                  />                ) : (
                  <button
                    className={`expository-page-list-item${activeSlide === idx ? ' active' : ''}${dragOverIndex === idx ? ' drag-over' : ''}`}
                    onClick={() => setActiveSlide(idx)}
                    onDoubleClick={() => handleTitleDoubleClick(idx)}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    tabIndex={0}
                    title={`${slideTitles[idx] || `Page ${idx + 1}`} - Click to navigate, double-click to edit, drag to reorder`}
                  >
                    {slideTitles[idx] || `Page ${idx + 1}`}
                  </button>
                )}
              </div>
            ))}          </nav>
        </div>        <div className="expository-main-content">
          {overlayOpen && lockedOverlayRef && (
            (() => {
              console.log('[ExpositoryDetailPage] Rendering ScriptureOverlay with defaultTranslation:', defaultTranslation);
              return (
                <ScriptureOverlay
                  open={overlayOpen}
                  onClose={handleOverlayClose}
                  book={lockedOverlayRef.book}
                  chapter={lockedOverlayRef.chapter}
                  verseRange={lockedOverlayRef.verseRange}
                  reference={lockedOverlayRef.reference}
                  defaultTranslation={defaultTranslation}
                />
              );
            })()
          )}

          <div className="slide-editor-vertical-layout">
            <div className="slide-editor-notes-area">
              <CustomRichTextEditor
                html={currentSlideHtml}
                onHtmlChange={updateSlideContent}
                onRefsChange={handleRefsChange}
                activeSlide={activeSlide}
                onTagSelect={handleTagSelect}
                onCompositionStateChange={setIsComposing} // NEW
              />
              <div className="expository-slide-status">
                {saving ? <span className="saving">Saving...</span> : saveStatus && <span className="saved">{saveStatus}</span>}
              </div>
            </div>

            <div className="slide-editor-bottom-bar">
              <div className="slide-editor-bottom-controls">
                {activeSlide > 0 && (
                  <button className="nav-arrow left" onClick={goToPreviousSlide}>&lt;</button>
                )}
                <button className="add-slide-button left" onClick={addSlide} title="Add Slide Left">+</button>
                <button className="slide-delete-btn" onClick={deleteSlide} title="Delete Slide">🗑</button>
                <button className="add-slide-button right" onClick={addSlide} title="Add Slide Right">+</button>
                {activeSlide < slides.length - 1 && (
                  <button className="nav-arrow right" onClick={goToNextSlide}>&gt;</button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Only show TagsPanel on desktop/tablet */}
        {!isMobile && (
          <TagsPanel
            expositoryTags={sermon?.tags || []}
            onVerseSelect={handleVerseSelectionFromTag}
            onTagClick={handleTagClick}
          />
        )}
      </div>

      {/* TagOverlay for viewing verses for a tag (all devices) */}
      {tagOverlayOpen && (
        <TagOverlay
          tagName={selectedTagFromDropdown || ""}
          isOpen={tagOverlayOpen}
          onClose={handleTagOverlayClose}
          onVerseSelect={handleVerseSelectionFromTag}
        />
      )}
      {isMobile && tagOverlayOpen && selectedTagFromDropdown && (
        <TagOverlay
          tagName={selectedTagFromDropdown}
          isOpen={tagOverlayOpen}
          onClose={() => setTagOverlayOpen(false)}
          onVerseSelect={(verses) => {
            handleVerseSelectionFromTag(verses);
            setTagOverlayOpen(false);
          }}
        />
      )}
    </div>
  );
}
