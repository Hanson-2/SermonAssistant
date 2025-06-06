import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDisplayBookAbbrev, normalizeBookName } from '../utils/getDisplayBookAbbrev';

function parseReference(ref, fallbackBook, fallbackChapter) {
  // Log the raw ref for debugging
  console.log('[parseReference] raw ref:', ref);
  // Match e.g. "1 Cor 1:1", "Genesis 1:1-3", "Genesis 1:1", "Genesis 1:1-2", etc.
  // Accepts: Book Chapter:Verse or Book Chapter:StartVerse-EndVerse
  // Updated regex to robustly handle verse ranges
  const match = ref.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+):(\d+)(?:-(\d+))?$/i);
  if (match) {
    const [, book, chapter, startVerse, endVerse] = match;
    return {
      book: normalizeBookName(book),
      chapter: parseInt(chapter, 10),
      startVerse: parseInt(startVerse, 10),
      endVerse: endVerse ? parseInt(endVerse, 10) : parseInt(startVerse, 10),
    };
  }
  // NEW: Match just book and chapter (e.g. 'John 3')
  const bookChapter = ref.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+)$/i);
  if (bookChapter) {
    const [, book, chapter] = bookChapter;
    return {
      book: normalizeBookName(book),
      chapter: parseInt(chapter, 10),
      startVerse: 1,
      endVerse: 999, // Will be filtered by actual verses in Firestore
    };
  }
  // Fallback: if ref is just a chapter and verse range (e.g. '2:1-6')
  const chapterRange = ref.match(/^([1-3]?\s*[A-Za-z .]+)?\s*(\d+):(\d+)-(\d+)$/i);
  if (chapterRange) {
    const [, book, chapter, startVerse, endVerse] = chapterRange;
    return {
      book: normalizeBookName(book || fallbackBook),
      chapter: parseInt(chapter || fallbackChapter, 10),
      startVerse: parseInt(startVerse, 10),
      endVerse: parseInt(endVerse, 10),
    };
  }
  // Fallback: if verseRange contains a dash, parse as range using fallback book/chapter
  const dashRange = ref.match(/^(?:[A-Za-z .]+)?\s*\d*:?\s*(\d+)-(\d+)$/);
  if (dashRange && fallbackBook && fallbackChapter) {
    return {
      book: normalizeBookName(fallbackBook),
      chapter: parseInt(fallbackChapter, 10),
      startVerse: parseInt(dashRange[1], 10),
      endVerse: parseInt(dashRange[2], 10),
    };
  }
  // If ref is just a single verse (e.g. '5'), use fallback book/chapter
  const singleMatch = ref.match(/^(\d+)$/);
  if (singleMatch && fallbackBook && fallbackChapter) {
    const v = parseInt(singleMatch[1], 10);
    return {
      book: normalizeBookName(fallbackBook),
      chapter: parseInt(fallbackChapter, 10),
      startVerse: v,
      endVerse: v,
    };
  }
  return null;
}

/**
 * ScriptureOverlay
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - book: string
 *  - chapter: number|string
 *  - verseRange: string ("1" or "1-3")
 *  - defaultTranslation?: string // NEW: user's preferred translation
 */
export default function ScriptureOverlay({ open, onClose, book, chapter, verseRange, reference, defaultTranslation }) {
  console.log('[ScriptureOverlay] Component rendered with props:', {
    open,
    book,
    chapter,
    verseRange,
    reference,
    defaultTranslation: defaultTranslation || 'undefined/empty'
  });

  const [lockedProps, setLockedProps] = useState(null);
  const hasOpenedAndLocked = useRef(false); // Tracks if initial props have been locked for the current "open" session

  useEffect(() => {
    console.log(`[ScriptureOverlay] LockEffect: open=${open}, hasOpenedAndLocked=${hasOpenedAndLocked.current}, lockedPropsPresent=${!!lockedProps}, Incoming:`, { book, chapter, verseRange, reference });
    if (open && !hasOpenedAndLocked.current) {
      console.log("[ScriptureOverlay] LockEffect: Locking props on initial open:", { book, chapter, verseRange, reference });
      setLockedProps({ book, chapter, verseRange, reference });
      hasOpenedAndLocked.current = true;
    } else if (!open) {
      if (hasOpenedAndLocked.current || lockedProps) { // If it was open and locked, or if lockedProps exist
        console.log("[ScriptureOverlay] LockEffect: Clearing locked props and reset flag due to close.");
        setLockedProps(null);
        hasOpenedAndLocked.current = false; // Reset for next open
      }
    } else if (open && hasOpenedAndLocked.current) {
      console.log("[ScriptureOverlay] LockEffect: Already open and locked. Current lockedProps:", lockedProps, "Incoming props:", { book, chapter, verseRange, reference });
      // Potentially, if you want to allow updates if parent props change *while* locked, you could compare
      // and decide to update lockedProps here, but current goal is to lock initial props.
    }
    // This effect's job is to manage the lockedProps state based on the open signal and initial props.
    // It should react if 'open' changes, or if the initial set of props to be locked changes before first lock.
  }, [open, book, chapter, verseRange, reference, lockedProps]); // Include lockedProps to handle reset if it becomes null externally

  const effective = useMemo(() => {
    // Prioritize lockedProps if they exist, otherwise use current props.
    // This ensures that once locked, those props are used until cleared.
    return lockedProps || { book, chapter, verseRange, reference };
  }, [lockedProps, book, chapter, verseRange, reference]);

  const [translations, setTranslations] = useState([]);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayRef, setDisplayRef] = useState({ book: effective.book, chapter: effective.chapter, verseRange: effective.verseRange });

  useEffect(() => {
    console.log("[ScriptureOverlay] Effective props updated:", effective);
  }, [effective]);

  useEffect(() => {
    // Guard against running if not open or essential 'effective' props are missing
    if (!open || !effective.book || !effective.reference) {
      console.log('[ScriptureOverlay] FetchEffect: Bailing out. Conditions not met.', { open, book: effective.book, ref: effective.reference });
      if (open) { // If it's supposed to be open but essential data is missing
        setLoading(false);
        setTranslations([]);
        setCurrent('');
      }
      return;
    }

    setLoading(true);
    const refString = effective.reference; // This should now be correctly ranged
    console.log('[ScriptureOverlay] FetchEffect: Attempting to parse refString:', refString, 'from effective:', effective);

    let parsed = parseReference(refString, effective.book, effective.chapter);

    if (!parsed) {
      console.error('[ScriptureOverlay] FetchEffect: Failed to parse reference string:', refString, 'Using effective props:', effective);
      setTranslations([]);
      setCurrent('');
      setLoading(false);
      setDisplayRef({
        book: normalizeBookName(effective.book || 'Unknown'), // Fallback for display
        chapter: parseInt(String(effective.chapter || '0'), 10),
        verseRange: String(effective.verseRange || '0')
      });
      return;
    }

    const { book: normBook, chapter: normChapter, startVerse, endVerse } = parsed;
    console.log('[ScriptureOverlay] FetchEffect: Parsed successfully:', { normBook, normChapter, startVerse, endVerse });
    setDisplayRef({ book: normBook, chapter: normChapter, verseRange: startVerse === endVerse ? `${startVerse}` : `${startVerse}-${endVerse}` });

    // --- DEBUG: Log types and values for Firestore query ---
    console.log('DEBUG types:', {
      normBook, normChapter, startVerse, endVerse,
      typeof_normBook: typeof normBook,
      typeof_normChapter: typeof normChapter,
      typeof_startVerse: typeof startVerse,
      typeof_endVerse: typeof endVerse,
    });
    // --- END DEBUG ---
    const fetchVerses = async () => {
      try {
        // Query the correct 'verses' collection for this book/chapter
        const versesRef = collection(db, 'verses');
        const chapterNum = Number(normChapter);
        const startV = Number(startVerse);
        const endV = Number(endVerse);
        const bookLower = String(normBook).toLowerCase().replace(/\s+/g, ' ').trim();
        // Use Firestore query() and where() for all conditions
        const { query, where } = await import('firebase/firestore');
        const qRef = query(
          versesRef,
          where('book_lower', '==', bookLower),
          where('chapter', '==', chapterNum),
          where('verse', '>=', startV),
          where('verse', '<=', endV)
        );
        const snap = await getDocs(qRef);
        console.log('[Overlay] Firestore returned', snap.docs.length, 'docs');
        // Robust: force verse to number, log type, and filter in JS for range
        const docs = snap.docs
          .map(doc => {
            const data = doc.data();
            const verseNum = Number(data.verse);
            console.log('Verse type:', typeof data.verse, data.verse, data.translation, data.text);
            return { ...data, verse: verseNum };
          })
          .filter(d => d.verse >= startV && d.verse <= endV);
        console.log('[Overlay] After filter, docs:', docs.map(d => ({ verse: d.verse, translation: d.translation, text: d.text })));
        console.log('[Overlay] Raw docs from Firestore:', docs);
        if (docs.length === 0) {
          console.warn('[Overlay] No verses found for query:', { bookLower, chapterNum, startV, endV });
        }
        console.log('Query:', { bookLower, chapterNum, startVerse: startV, endVerse: endV });
        console.log('Fetched verses:', docs.map(d => `${d.book} ${d.chapter}:${d.verse} ${d.text?.slice(0,20)}`));
        console.log('Docs:', docs.map(d => ({ book: d.book, chapter: d.chapter, verse: d.verse })));
        docs.sort((a, b) => a.verse - b.verse);
        const translationMap = {};
        for (const d of docs) {
          const code = d.translation;
          if (!translationMap[code]) {
            translationMap[code] = { code, label: code, text: '', verses: [] };
          }
          translationMap[code].verses.push({ verse: d.verse, text: d.text.trim() });
        }
        const list = Object.values(translationMap).map(t => {
          t.verses.sort((a, b) => a.verse - b.verse);
          return {
            code: t.code,
            label: t.label,
            text: t.verses.map(v => v.text).join('\n'), // legacy
            verses: t.verses,
          };
        });        setTranslations(list);
        // Use defaultTranslation if provided and available, else fallback
        console.log('[ScriptureOverlay] Setting translations and initial current:', {
          translationsList: list.map(t => t.code),
          defaultTranslation,
          willUseDefault: defaultTranslation && list.some(t => t.code === defaultTranslation),
          fallbackToFirst: list[0]?.code
        });
        
        if (defaultTranslation && list.some(t => t.code === defaultTranslation)) {
          console.log('[ScriptureOverlay] Using defaultTranslation:', defaultTranslation);
          setCurrent(defaultTranslation);
        } else {
          console.log('[ScriptureOverlay] Falling back to first translation:', list[0]?.code || 'none');
          setCurrent(list[0]?.code || '');
        }
        // Debug: show what will be rendered
        console.log('[Overlay] Translations list:', list);
        if (list.length > 0) {
          console.log('[Overlay] Active translation verses:', list[0].verses);
        }
      } catch (err) {
        console.error('Error fetching verses:', err);
        setTranslations([]);
        setCurrent('');
      } finally {
        setLoading(false);
      }
    };
    fetchVerses();
  }, [open, effective, defaultTranslation]);  // Ensure default translation is set on mount and when translations change
  useEffect(() => {
    console.log('[ScriptureOverlay] Translation selection effect triggered:', {
      defaultTranslation,
      translationsLength: translations.length,
      translationCodes: translations.map(t => t.code),
      currentSelected: current
    });
    
    if (translations.length > 0) {
      if (defaultTranslation && translations.some(t => t.code === defaultTranslation)) {
        console.log('[ScriptureOverlay] Setting current translation to defaultTranslation:', defaultTranslation);
        setCurrent(defaultTranslation);
      } else if (translations[0]?.code && !current) { 
        // Fallback to the first available translation if default is not found or not provided
        console.log('[ScriptureOverlay] No valid defaultTranslation, falling back to first translation:', translations[0].code);
        setCurrent(translations[0].code);
      }
    } else {
      // If translations become empty (e.g., new reference has no data yet), clear current.
      console.log('[ScriptureOverlay] No translations available, clearing current');
      setCurrent('');
    }
  }, [defaultTranslation, translations, current]);

  const active = translations.find(t => t.code === current) || { verses: [] }; // Ensure active.verses is always an array
  const displayBook = displayRef.book ? getDisplayBookAbbrev(displayRef.book) : 'Scripture';

  return (
    <AnimatePresence>
      {open && (
        <div 
          className="scripture-overlay-modern fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={onClose} // Close on backdrop click
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.2 }}
            className="scripture-overlay-card flex flex-col w-full max-w-3xl rounded-xl shadow-2xl 
                       bg-gradient-to-br from-gray-900 to-black overflow-hidden"
            style={{
              zIndex: 10000, 
              position: 'relative', 
              maxHeight: 'calc(100vh - 3rem)',
              borderWidth: '2px', // Crucial for borderImage to show
              borderStyle: 'solid',
              borderColor: 'transparent', // Fallback if borderImage isn't supported or while loading
              borderImageSlice: 1,
              borderImageSource: 'linear-gradient(to bottom right, #b8860b, #ffd700, #b8860b)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent click inside from closing
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-yellow-400/20 flex-shrink-0 bg-black/20">
              <h2 className="text-lg md:text-xl font-semibold text-yellow-400 truncate pr-2">
                {displayRef.book ? `${displayBook} ${displayRef.chapter}:${displayRef.verseRange}` : 'Loading Reference...'}
              </h2>
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-yellow-400 p-1 rounded-full hover:bg-gray-700/50 transition-colors"
                aria-label="Close scripture overlay"
              >
                <X size={22} />
              </button>
            </div>

            {/* Content Wrapper (for consistent padding and scroll handling) */}
            <div className="flex-grow overflow-y-auto">
              {/* Translation Selector - Placed above scripture text */}
              {!loading && translations.length > 1 && (
                <div className="p-3 md:p-4 border-b border-gray-800/60 bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">                  <div className="flex flex-wrap gap-2 justify-center">
                    {translations.map(t => (
                      <button
                        key={t.code}
                        onClick={() => setCurrent(t.code)}
                        className={`px-3 py-1.5 text-xs md:text-sm rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500/70 shadow-sm font-semibold
                          ${
                          current === t.code
                            ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold border border-yellow-600/80 shadow-lg transform scale-105' // Active style
                            : 'bg-[#23232b] text-[#ffd700] border border-[#e0c97f] hover:bg-[#1a1a20] hover:text-[#fffbe6] hover:border-[#ffe082] hover:shadow-lg' // Black styling to match Universal Search
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scripture Text Area */}
              <div className="p-3 md:p-4">
                {loading ? (
                  <div className="flex flex-col justify-center items-center h-48 text-gray-400">
                    {/* You can add a spinner component here */}
                    <svg className="animate-spin h-8 w-8 text-yellow-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading scripture...
                  </div>
                ) : (
                  <>
                    {active.verses && active.verses.length > 0 ? (
                      <div className="space-y-3 text-gray-200">
                        {active.verses.map((verse) => (
                          <div key={verse.verse} className="flex items-start text-sm md:text-base leading-relaxed">
                            <span className="font-semibold text-yellow-500/90 mr-2 w-7 text-right flex-shrink-0 pt-px">{verse.verse}</span>
                            <p className="flex-1">{verse.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center py-10">
                        {translations.length === 0 && !loading ? 'No scripture text found for this reference.' :
                         (translations.length > 0 && (!active || !active.verses || active.verses.length === 0)) ? 'No text available for the selected translation.' :
                         'Please select a translation to view the text.'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
