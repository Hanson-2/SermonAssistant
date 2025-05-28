import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
 */
export default function ScriptureOverlay({ open, onClose, book, chapter, verseRange, reference }) {
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
        });
        setTranslations(list);
        setCurrent(list[0]?.code || '');
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
  }, [open, effective]); // Depends on 'open' and the 'effective' (potentially locked) props

  const active = translations.find(t => t.code === current) || {};

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{zIndex: 9999}}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col md:flex-row"
            style={{zIndex: 10000, position: 'relative'}}
          >
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-700">
              <span className="text-white font-semibold text-lg">
                {getDisplayBookAbbrev(displayRef.book)} {displayRef.chapter}:{displayRef.verseRange}
              </span>
              <select
                value={current}
                onChange={e => setCurrent(e.target.value)}
                disabled={loading}
                className="bg-gray-800 text-white px-2 py-1 rounded"
              >
                {loading
                  ? <option>Loading…</option>
                  : translations.map(t => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
              </select>
              <button onClick={onClose} className="text-white ml-2">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar on Desktop */}
              <nav className="hidden md:flex flex-col w-40 bg-gray-800 p-4 border-r border-gray-700 space-y-2 overflow-auto">
                {loading
                  ? <div className="text-white">Loading…</div>
                  : translations.map(t => (
                      <button
                        key={t.code}
                        onClick={() => setCurrent(t.code)}
                        className={`text-left w-full px-3 py-2 rounded transition focus:outline-none ${
                          t.code === current
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-white hover:bg-gray-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
              </nav>

              {/* Content Area */}
              <div className="flex-1 p-6 overflow-auto max-h-[70vh]">
                {/* Desktop Header */}
                <div className="hidden md:flex justify-between items-center mb-4">
                  <span className="text-white font-semibold text-2xl">
                    {getDisplayBookAbbrev(displayRef.book)} {displayRef.chapter}:{displayRef.verseRange}
                  </span>
                  <button onClick={onClose} className="text-white">
                    <X size={24} />
                  </button>
                </div>

                {/* Verse Text */}
                <div className="prose prose-white space-y-4">
                  {loading
                    ? <p className="text-white">Loading verse…</p>
                    : (active.verses && active.verses.length > 0)
                        ? active.verses.map((v, i) => (
                            <p key={i} className="leading-relaxed">
                              <span className="font-bold">{v.verse}</span>. {v.text}
                            </p>
                          ))
                        : <p className="text-white">No verse found.</p>
                  }
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
