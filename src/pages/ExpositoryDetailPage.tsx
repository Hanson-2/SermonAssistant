import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, updateSermonNotes, getScriptureVersesForChapter, getUserProfile } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";
import { extractScriptureReferences } from "../utils/smartParseScriptureInput";
import EditableRichText from "../components/EditableRichText";
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
  } | null>(null);
  // --- Debounce scripture reference extraction for stability ---
  const debouncedSetRefs = useCallback(
    debounce((rawRefsFromEffect: any[]) => {
      // Normalize refs immediately before setting state
      const normalizedRefsFromEffect = rawRefsFromEffect.map(ref => {
        let localRawBook = ref.book.replace(/\s/g, "").toLowerCase();
        let bookName = bookAliases[localRawBook] || ref.book;
        let referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
        if (ref.endVerse && ref.endVerse !== ref.verse) {
          referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
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
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [overlayTranslations, setOverlayTranslations] = useState<Array<{ code: string, label: string, text: string }>>([]);
  const [overlayOpen, setOverlayOpen] = useState(false);  // --- Get user's default translation from user profile ---
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
    const updatedSlides = [...slides];
    updatedSlides[activeSlide] = newHtml;
    setSlides(updatedSlides);
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
      // Build normalized reference string (with range if present)
      let referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
      if (ref.endVerse && ref.endVerse !== ref.verse) {
        referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
      }
      return { ...ref, book: bookName, reference: referenceString };
    });
    // console.log('[ExpositoryDetailPage] handleRefsChange: Directly setting scriptureRefs from EditableRichText', normalizedRefs);
    setScriptureRefs(normalizedRefs); // Directly update state with normalized refs
  }

  function addSlide() {
    const updatedSlides = [...slides];
    updatedSlides.splice(activeSlide + 1, 0, "");
    setSlides(updatedSlides);
    setActiveSlide(activeSlide + 1);
    debouncedPersistSlides();
  }

  function deleteSlide() {
    if (slides.length <= 1) return;
    const updatedSlides = slides.filter((_, idx) => idx !== activeSlide);
    setSlides(updatedSlides);
    setActiveSlide(Math.max(activeSlide - 1, 0));
    debouncedPersistSlides();
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
      }

      const detailBook = e.detail.book;
      const detailChapter = e.detail.chapter;
      const detailVerse = e.detail.verse;
      const detailEndVerse = e.detail.endVerse;

      const currentVerseRange = detailEndVerse && detailEndVerse !== detailVerse
        ? `${detailVerse}-${detailEndVerse}`
        : `${detailVerse}`;

      // Construct the reference string to accurately reflect the verse range
      const currentReference = `${detailBook} ${detailChapter}:${currentVerseRange}`;

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

  // --- Per-slide scripture refs ---
  const [slideScriptureRefs, setSlideScriptureRefs] = useState<any[][]>([]);
  // --- Per-slide titles ---
  const [slideTitles, setSlideTitles] = useState<string[]>([]);
  const [editingTitleIdx, setEditingTitleIdx] = useState<number | null>(null);
  useEffect(() => {
    // For each slide, extract and normalize scripture refs
    const refsBySlide = slides.map(slideText => {
      const rawRefs = extractScriptureReferences(slideText);
      return rawRefs.map(ref => {
        let localRawBook = ref.book.replace(/\s/g, "").toLowerCase();
        let bookName = bookAliases[localRawBook] || ref.book;
        let referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
        if (ref.endVerse && ref.endVerse !== ref.verse) {
          referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
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

  if (!sermon) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="expository-detail-root">
      <div className="expository-bg-overlay" />
      <div className="expository-sticky-banner">
        <div className="expository-banner-row">
          <h1 className="expository-banner-title">{sermon.title}</h1>
          <span className="expository-banner-date">{sermon.date}</span>
        </div>
        <div className="expository-banner-desc">{sermon.description?.slice(0, 120)}</div>
      </div>

      {/* Scripture mini cards banner */}
      <div className="expository-scripture-banner">
        {(slideScriptureRefs[activeSlide] || []).map((ref, i) => (
          <ScriptureMiniCard key={i} verse={ref} />
        ))}
      </div>

      <div className="expository-main-layout" style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', width: '100%' }}>
        <div style={{ minWidth: 180, maxWidth: 240, background: 'rgba(24,24,24,0.92)', borderRight: '1px solid #232b3e', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: 0, height: '100%', overflowY: 'auto' }}>
          {/* Sidebar page list, below mini cards */}
          <nav className="expository-page-list">
            {slides.map((slide, idx) => (
              <div key={idx} style={{ width: '100%' }}>
                {editingTitleIdx === idx ? (
                  <input
                    className="expository-page-list-item editing"
                    value={slideTitles[idx] || `Page ${idx + 1}`}
                    autoFocus
                    onChange={e => handleTitleChange(idx, e.target.value)}
                    onBlur={() => handleTitleBlur(idx)}
                    onKeyDown={e => handleTitleKeyDown(e, idx)}
                    style={{ width: '90%', fontSize: '1rem', padding: '0.5rem', borderRadius: 4, border: '1px solid #ffd700', background: '#232b3e', color: '#ffd700', fontWeight: 700 }}
                    placeholder={`Enter title for Page ${idx + 1}`}
                    title={`Slide title input for Page ${idx + 1}`}
                  />
                ) : (
                  <button
                    className={`expository-page-list-item${activeSlide === idx ? ' active' : ''}`}
                    style={{
                      background: activeSlide === idx ? 'linear-gradient(90deg,#ffd70022,#232b3e)' : 'none',
                      color: activeSlide === idx ? '#ffd700' : '#fff',
                      fontWeight: activeSlide === idx ? 700 : 400,
                      border: 'none',
                      borderLeft: activeSlide === idx ? '4px solid #ffd700' : '4px solid transparent',
                      textAlign: 'left',
                      padding: '0.7rem 1.2rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'background 0.18s, color 0.18s',
                      borderRadius: 0,
                      width: '100%',
                      borderBottom: '1px solid #232b3e',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onClick={() => setActiveSlide(idx)}
                    onDoubleClick={() => handleTitleDoubleClick(idx)}
                    onTouchStart={e => { e.preventDefault(); handleTitleDoubleClick(idx); }}
                    tabIndex={0}
                    title={slideTitles[idx] || `Page ${idx + 1}`}
                  >
                    {slideTitles[idx] || `Page ${idx + 1}`}
                  </button>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
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
              <EditableRichText
                html={slides[activeSlide]}
                onHtmlChange={updateSlideContent}
                onRefsChange={handleRefsChange}
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
