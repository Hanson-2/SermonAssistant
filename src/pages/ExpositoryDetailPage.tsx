import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, updateSermonNotes, updateSermon, getScriptureVersesForChapter, getUserProfile } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";
import { extractScriptureReferences } from "../utils/smartParseScriptureInput";
import CustomRichTextEditor from "../components/CustomRichTextEditor";
import ScriptureMiniCard from "../components/ScriptureMiniCard";
import ScriptureOverlay from "../components/ScriptureOverlay";
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
  const [savingMetadata, setSavingMetadata] = useState(false);// --- Get user's default translation from user profile ---
  const [defaultTranslation, setDefaultTranslation] = useState<string>('');
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
        }
      } else {
        navigate("/dashboard");
      }
    });
  }, [id, navigate]);

  const persistSlides = useCallback(() => {
    if (!sermon) return;
    const newNotes: Record<string, string> = slides.reduce((acc, slideContent, idx) => {
      acc[String(idx)] = slideContent;
      return acc;
    }, {} as Record<string, string>);
    updateSermonNotes(sermon.id.toString(), newNotes).catch((error) =>
      console.error("Failed to save slides", error)
    );
  }, [sermon, slides]);

  const debouncedPersistSlides = useCallback(debounce(persistSlides, 500), [persistSlides]);

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
    }
  };

  // --- Per-slide scripture refs ---
  const [slideScriptureRefs, setSlideScriptureRefs] = useState<any[][]>([]);
  // --- Per-slide titles ---
  const [slideTitles, setSlideTitles] = useState<string[]>([]);
  const [editingTitleIdx, setEditingTitleIdx] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);  useEffect(() => {
    // For each slide, extract and normalize scripture refs
    const refsBySlide = slides.map(slideText => {
      const rawRefs = extractScriptureReferences(slideText);
      return rawRefs.map(ref => {
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
        
        return { ...ref, book: bookName, reference: referenceString };
      });
    });
    setSlideScriptureRefs(refsBySlide);
    // Initialize slide titles if not set or slides changed
    setSlideTitles(prev => {
      if (!prev || prev.length !== slides.length) {
        return slides.map((_, idx) => `Page ${idx + 1}`);
      }
      return prev;
    });
  }, [slides]);

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

  if (!sermon) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="expository-detail-root">
      <div className="expository-bg-overlay" />      <div className="expository-sticky-banner">
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
      </div>

      {/* Scripture mini cards banner */}
      <div className="expository-scripture-banner">
        {(slideScriptureRefs[activeSlide] || []).map((ref, i) => (
          <ScriptureMiniCard key={i} verse={ref} />
        ))}
      </div>      <div className="expository-main-layout">
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
        </div>

        <div className="expository-main-content">
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
      </div>
    </div>
  );
}
