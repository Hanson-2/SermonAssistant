import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, updateSermonNotes, updateSermon, getScriptureVersesForChapter, getUserProfile } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";
import { extractScriptureReferences } from "../utils/smartParseScriptureInput";
import { mergeConsecutiveVerses, ScriptureReference } from "../utils/mergeConsecutiveVerses";
import CustomRichTextEditor from "../components/CustomRichTextEditor";
import ScriptureMiniCard from "../components/ScriptureMiniCard";
import ScriptureOverlay from "../components/ScriptureOverlay";
import TagsPanel from "../components/TagsPanel";
import TagOverlay from "../components/TagOverlay";
import debounce from "lodash.debounce";
import "./ExpositoryDetailPage.css";
import { bookAliases } from "../hooks/useScriptureAutocomplete";

function splitSlides(notes: string): string[] {
  return notes.split(/\n\s*---+\s*\n/).map(s => s.trim());
}

// Utility to fetch scripture text from local JSON (KJV as default)
async function fetchScriptureText(reference: string): Promise<string> {
  try {
    const [bookAndChapter, verseStr] = reference.split(":");
    let [book, chapterStr] = bookAndChapter.trim().split(/\s+(?=\d+$)/);
    let lookupBook = bookAliases[book.toLowerCase()] || book.charAt(0).toUpperCase() + book.slice(1).toLowerCase();
    const chapter = parseInt(chapterStr, 10);
    const verse = verseStr ? parseInt(verseStr, 10) : null;
    const verses = await getScriptureVersesForChapter(lookupBook, String(chapter));
    if (!verses || verses.length === 0) return "No verses found.";
    if (verse) {
      // Prefer EXB translation, fallback to any
      let found = verses.find(v => Number(v.verse) === verse && v.translation === "EXB");
      if (!found) found = verses.find(v => Number(v.verse) === verse);
      return found ? `${lookupBook} ${chapter}:${verse} ${found.text}` : "Verse not found.";
    } else {
      // All verses in chapter, prefer EXB
      const exbVerses = verses.filter(v => v.translation === "EXB");
      const toShow = exbVerses.length > 0 ? exbVerses : verses;
      return toShow.map(v => `${lookupBook} ${chapter}:${v.verse} ${v.text}`).join("\n");
    }
  } catch (e) {
    return "Error loading scripture.";
  }
}

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
  } | null>(null);  // --- Debounce scripture reference extraction for stability ---
  const debouncedSetRefs = useCallback(
    debounce((rawRefsFromEffect: any[]) => {
      // Normalize refs immediately before setting state
      const normalizedRefsFromEffect = rawRefsFromEffect.map(ref => {
        let localRawBook = ref.book.replace(/\s/g, "").toLowerCase();
        let bookName = bookAliases[localRawBook] || ref.book;
        
        // Build normalized reference string (handle chapter-only vs verse-specific)
        let referenceString;
        if (ref.verse !== undefined) {
          // Verse-specific reference
          referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
          if (ref.endVerse && ref.endVerse !== ref.verse) {
            referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
          }
        } else {
          // Chapter-only reference
          referenceString = `${bookName} ${ref.chapter}`;
        }
        
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
    }, 900),
    [bookAliases] // bookAliases is stable, but good practice to list dependencies
  );
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [overlayContent, setOverlayContent] = useState<string>("");
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);  const [overlayTranslations, setOverlayTranslations] = useState<Array<{ code: string, label: string, text: string }>>([]);
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
  const [selectedTagFromDropdown, setSelectedTagFromDropdown] = useState<string | null>(null);  const [tagOverlayOpen, setTagOverlayOpen] = useState(false);
  // --- Per-slide Scripture Refs State ---
  const [slideScriptureRefs, setSlideScriptureRefs] = useState<Record<number, any[]>>({});
  
  const [slideTitles, setSlideTitles] = useState<string[]>([]);
  const [editingTitleIdx, setEditingTitleIdx] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);  useEffect(() => {
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
  }, []);  useEffect(() => {
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
          }, 1000);
        } else {
          // Initialize empty slideScriptureRefs if none in database
          console.log('[ExpositoryDetailPage] No slideScriptureRefs in database, initializing empty');
          console.log('[ExpositoryDetailPage] Available fields in sermon data:', Object.keys(data));
          setSlideScriptureRefs({});
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
    
    if (Object.keys(slideScriptureRefs).length > 0) {
      console.log('[ExpositoryDetailPage] persistSlides: Has scripture refs to save');
      Object.entries(slideScriptureRefs).forEach(([key, refs]) => {
        console.log(`[ExpositoryDetailPage] Slide ${key} has ${refs.length} refs:`, refs);
      });
    } else {
      console.log('[ExpositoryDetailPage] persistSlides: No scripture refs to save');
    }
    
    updateSermonNotes(sermon.id.toString(), newNotes, slideScriptureRefs)
      .then(() => {
        console.log('[ExpositoryDetailPage] Successfully persisted slides and scriptureRefs');
      })
      .catch((error) => {
        console.error("Failed to save slides", error);
      });
  }, [sermon, slides, slideScriptureRefs]);
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

  function updateSlideContent(newHtml: string) {
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
    // Normalize book names using bookAliases and create the reference string
    const normalizedRefs = rawRefsFromEditableRichText.map(ref => {
      let localRawBook = ref.book.replace(/\s/g, "").toLowerCase();
      let bookName = bookAliases[localRawBook] || ref.book;
      
      // Build normalized reference string (handle chapter-only vs verse-specific)
      let referenceString;
      if (ref.verse !== undefined) {
        // Verse-specific reference
        referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
        if (ref.endVerse && ref.endVerse !== ref.verse) {
          referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
        }
      } else {
        // Chapter-only reference
        referenceString = `${bookName} ${ref.chapter}`;
      }
      
      return { ...ref, book: bookName, reference: referenceString };
    });
    // console.log('[ExpositoryDetailPage] handleRefsChange: Directly setting scriptureRefs from EditableRichText', normalizedRefs);
    setScriptureRefs(normalizedRefs); // Directly update state with normalized refs
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
      console.log(`[ExpositoryDetailPage] handleShowScriptureOverlay: overlayOpen=${overlayOpen}, lockedOverlayRef exists=${!!lockedOverlayRef}, eventDetail=`, JSON.stringify(e.detail));
      // Prevent re-entry if overlay is already open AND we have a locked reference.
      // This allows updating the reference if it was somehow closed and an event comes in before state fully settles.
      if (overlayOpen && lockedOverlayRef) {
        console.log('[ExpositoryDetailPage] Overlay already open and locked, ignoring event.');
        return;
      }      const detailBook = e.detail.book;
      const detailChapter = e.detail.chapter;
      const detailVerse = e.detail.verse;
      const detailEndVerse = e.detail.endVerse;

      let currentVerseRange, currentReference;
      
      // Handle chapter-only references (when verse is undefined)
      if (detailVerse === undefined || detailVerse === null) {
        currentVerseRange = ""; // No verse range for chapter-only
        currentReference = `${detailBook} ${detailChapter}`;
      } else {
        // Handle verse-specific references
        currentVerseRange = detailEndVerse && detailEndVerse !== detailVerse
          ? `${detailVerse}-${detailEndVerse}`
          : `${detailVerse}`;
        currentReference = `${detailBook} ${detailChapter}:${currentVerseRange}`;
      }

      const refObj = {
        book: detailBook,
        chapter: detailChapter,
        verseRange: currentVerseRange,
        reference: currentReference // Use the correctly ranged reference
      };
      console.log('[ExpositoryDetailPage] Setting lockedOverlayRef and opening overlay with:', JSON.stringify(refObj));
      setLockedOverlayRef(refObj);
      setOverlayOpen(true); // Open overlay after setting the ref
    }

    console.log('[ExpositoryDetailPage] Adding showScriptureOverlay listener. Current overlayOpen:', overlayOpen, 'lockedOverlayRef exists:', !!lockedOverlayRef);
    window.addEventListener("showScriptureOverlay", handleShowScriptureOverlay);
    return () => {
      console.log('[ExpositoryDetailPage] Removing showScriptureOverlay listener. Current overlayOpen:', overlayOpen, 'lockedOverlayRef exists:', !!lockedOverlayRef);
      window.removeEventListener("showScriptureOverlay", handleShowScriptureOverlay);
    };
    // Re-run if overlayOpen changes, to ensure the listener's closure has the latest overlayOpen state.
    // Or if lockedOverlayRef changes from null to non-null or vice-versa while open is true (edge case).
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
        console.log(`[ExpositoryDetailPage] Slide ${slideIndex} already has refs, skipping text extraction`);
        return existingRefs;
      }

      // Only extract from text if no existing refs
      const rawRefs = extractScriptureReferences(slideText);
      const textBasedRefs = rawRefs.map(ref => {
        let localRawBook = ref.book.replace(/\s/g, "").toLowerCase();
        let bookName = bookAliases[localRawBook] || ref.book;
        let referenceString;
        
        // Handle chapter-only references (verse is undefined)
        if (ref.verse === undefined) {
          referenceString = `${bookName} ${ref.chapter}`;
        } else {
          referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
          if (ref.endVerse && ref.endVerse !== ref.verse) {
            referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
          }
        }
        
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
      console.log('[ExpositoryDetailPage] Updating slideScriptureRefs from text extraction:', refsObject);
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
  function handleTitleMouseDown(idx: number) {
    const timer = setTimeout(() => {
      setEditingTitleIdx(idx);
      setLongPressTimer(null);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  }
  function handleTitleMouseUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }
  function handleTitleTouchStart(idx: number) {
    const timer = setTimeout(() => {
      setEditingTitleIdx(idx);
      setLongPressTimer(null);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  }
  function handleTitleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }
  function handleTitleChange(idx: number, value: string) {
    setSlideTitles(titles => titles.map((t, i) => (i === idx ? value : t)));
  }
  function handleTitleBlur(idx: number) {
    setEditingTitleIdx(null);
    // Optionally: persist titles to backend here
  }
  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Enter') {
      setEditingTitleIdx(null);
      // Optionally: persist titles to backend here
    }
  }

  // Only update scriptureRefs if overlay is not open AND lockedOverlayRef is null
  useEffect(() => {
    if (overlayOpen || lockedOverlayRef) return; // Freeze mini-cards/refs while overlay is open or locked
    const allText = slides.join("\n\n");
    const rawRefs = extractScriptureReferences(allText);
    // console.log('[ExpositoryDetailPage] useEffect[slides]: Calling debouncedSetRefs with rawRefs', rawRefs);
    debouncedSetRefs(rawRefs); // debouncedSetRefs now handles normalization internally
  }, [slides, debouncedSetRefs, overlayOpen, lockedOverlayRef]);

  // Memoized html for the current slide, always valid
  const currentSlideHtml = useMemo(() => {
    if (!Array.isArray(slides) || slides.length === 0) return "";
    if (activeSlide < 0 || activeSlide >= slides.length) return "";
    return slides[activeSlide] || "";
  }, [slides, activeSlide]);

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
  }, []);  // Function to remove a scripture reference from current slide
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
    const updatedRefs = [...existingRefs, ...taggedVerses];
    
    console.log('[ExpositoryDetailPage] Existing refs for slide', activeSlide, ':', JSON.stringify(existingRefs, null, 2));
    console.log('[ExpositoryDetailPage] Updated refs for slide', activeSlide, ':', JSON.stringify(updatedRefs, null, 2));    setSlideScriptureRefs(prev => {
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
          console.log('[ExpositoryDetailPage] ====== RENDERING SCRIPTURE MINI CARDS ======');
          console.log('[ExpositoryDetailPage] Active slide:', activeSlide);
          console.log('[ExpositoryDetailPage] Raw currentSlideRefs:', JSON.stringify(currentSlideRefs, null, 2));
          console.log('[ExpositoryDetailPage] About to call mergeConsecutiveVerses with:', currentSlideRefs.length, 'verses');
          
          const mergedRefs = mergeConsecutiveVerses(currentSlideRefs);
          console.log('[ExpositoryDetailPage] Rendering scripture mini cards:', { 
            original: currentSlideRefs.length, 
            merged: mergedRefs.length,
            originalRefs: currentSlideRefs,
            mergedRefs: mergedRefs
          });
          console.log('[ExpositoryDetailPage] Final mergedRefs for rendering:', JSON.stringify(mergedRefs, null, 2));
          
          return mergedRefs.map((ref, i) => (
            <ScriptureMiniCard 
              key={`${ref.reference}-${ref.addedViaTag ? 'tag' : 'manual'}-${i}`} 
              verse={ref} 
              onRemove={() => handleRemoveScriptureRef(ref)}
            />
          ));
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
                    className={`expository-page-list-item${activeSlide === idx ? ' active' : ''}`}
                    onClick={() => setActiveSlide(idx)}
                    onDoubleClick={() => handleTitleDoubleClick(idx)}
                    onMouseDown={() => handleTitleMouseDown(idx)}
                    onMouseUp={handleTitleMouseUp}
                    onTouchStart={() => handleTitleTouchStart(idx)}
                    onTouchEnd={handleTitleTouchEnd}
                    tabIndex={0}
                    title={slideTitles[idx] || `Page ${idx + 1}`}
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
        </div>        {/* Tags Panel */}
        <TagsPanel
          expositoryTags={sermon?.tags || []}
          onVerseSelect={handleVerseSelectionFromTag}
          onTagClick={handleTagClick}
        />
      </div>

      {/* Tag Overlay - Moved outside main container for full-screen display */}
      {selectedTagFromDropdown && tagOverlayOpen && (
        <TagOverlay
          tagName={selectedTagFromDropdown}
          isOpen={tagOverlayOpen}
          onClose={handleTagOverlayClose}
          onVerseSelect={handleVerseSelectionFromTag}
        />
      )}
    </div>
  );
}
