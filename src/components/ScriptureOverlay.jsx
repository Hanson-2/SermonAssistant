import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { getScriptureVersesForChapter } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import { getDisplayBookAbbrev, normalizeBookName } from '../utils/getDisplayBookAbbrev';
import { buildScriptureReference } from '../utils/scriptureReferenceUtils';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getUserProfile } from '../services/firebaseService';

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
  const [lockedProps, setLockedProps] = useState(null);
  const hasOpenedAndLocked = useRef(false);
  const [translations, setTranslations] = useState([]);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayRef, setDisplayRef] = useState({ book: '', chapter: '', verseRange: '' });
  
  // Add state for managing available translations (like Universal Search)
  const [availableTranslations, setAvailableTranslations] = useState([]);
  const [userDefaultTranslation, setUserDefaultTranslation] = useState(null);
  
  const functions = getFunctions();

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
  useEffect(() => {
    console.log("[ScriptureOverlay] Effective props updated:", effective);
  }, [effective]);

  // Load available translations and user preferences (like Universal Search)
  useEffect(() => {
    const loadTranslationsAndUserPrefs = async () => {
      try {
        // First, get user's preferred translation from Firestore profile
        let userDefaultTranslation = null;
        try {
          console.log('[ScriptureOverlay] Fetching user profile for default translation...');
          const userProfile = await getUserProfile();
          userDefaultTranslation = userProfile?.preferences?.defaultBibleVersion || null;
          console.log('[ScriptureOverlay] User default translation from Firestore:', userDefaultTranslation);
          setUserDefaultTranslation(userDefaultTranslation);
        } catch (profileError) {
          console.error('[ScriptureOverlay] Error fetching user profile:', profileError);
          userDefaultTranslation = localStorage.getItem('defaultTranslation') || localStorage.getItem('defaultBibleVersion');
          console.log('[ScriptureOverlay] Fallback to localStorage default translation:', userDefaultTranslation);
          setUserDefaultTranslation(userDefaultTranslation);
        }        // Get all unique translations using Firebase Functions (like Universal Search)
        let allTranslations = [];
        try {
          const getAllUniqueTranslationsCallable = httpsCallable(functions, "getAllUniqueTranslations");
          const result = await getAllUniqueTranslationsCallable();
          const fetchedTranslations = result.data.uniqueTranslations || [];
          console.log('[ScriptureOverlay] Fetched translations from Firebase Functions:', fetchedTranslations);
          allTranslations = fetchedTranslations;
        } catch (functionsError) {
          console.error('[ScriptureOverlay] Error calling Firebase Functions:', functionsError);
          allTranslations = [];
        }
        
        // If no translations from Firebase Functions, create a fallback list
        if (allTranslations.length === 0) {
          console.log('[ScriptureOverlay] No translations from Firebase Functions, using fallback list');
          allTranslations = [
            { id: 'kjv', name: 'kjv', displayName: 'King James Version' },
            { id: 'niv', name: 'niv', displayName: 'New International Version' },
            { id: 'esv', name: 'esv', displayName: 'English Standard Version' },
            { id: 'nkjv', name: 'nkjv', displayName: 'New King James Version' },
            { id: 'nasb', name: 'nasb', displayName: 'New American Standard Bible' },
            { id: 'nlt', name: 'nlt', displayName: 'New Living Translation' },
            { id: 'csb', name: 'csb', displayName: 'Christian Standard Bible' },
            { id: 'msg', name: 'msg', displayName: 'The Message' },
            { id: 'amp', name: 'amp', displayName: 'Amplified Bible' },
            { id: 'net_bible', name: 'net_bible', displayName: 'NET Bible' },
            { id: 'rsv', name: 'rsv', displayName: 'Revised Standard Version' },
            { id: 'nasb95', name: 'nasb95', displayName: 'NASB 1995' },
            { id: 'web', name: 'web', displayName: 'World English Bible' },
            { id: 'ylt', name: 'ylt', displayName: 'Young\'s Literal Translation' },
            { id: 'asv', name: 'asv', displayName: 'American Standard Version' },
            { id: 'darby', name: 'darby', displayName: 'Darby Translation' },
            { id: 'geneva', name: 'geneva', displayName: 'Geneva Bible' },
            { id: 'exb', name: 'exb', displayName: 'Expanded Bible' }
          ];
        }
        
        // Apply EXB authorization logic (same as Universal Search and ScriptureBookPage)
        const currentUser = auth.currentUser;
        const userId = currentUser?.uid;
        const expectedUserId = "89UdurybrVSwbPmp4boEMeYdVzk1"; // Authorized EXB user
        const isAuthorized = userId === expectedUserId;
        
        // Filter out EXB translation unless user is authorized
        const filteredTranslations = allTranslations.filter(translation => {
          const isEXB = translation.id.toUpperCase() === "EXB";
          const shouldInclude = !isEXB || isAuthorized;
          
          if (isEXB) {
            console.log(`[ScriptureOverlay] EXB check: isEXB=${isEXB}, userId="${userId}", expectedUserId="${expectedUserId}", isAuthorized=${isAuthorized}, shouldInclude=${shouldInclude}`);
          }
          
          return shouldInclude;
        });
        
        console.log('[ScriptureOverlay] Filtered translations (EXB restricted):', filteredTranslations.map(t => `${t.id} (${t.displayName})`));
        
        // Use the same prioritization logic as Universal Search
        const prioritizeTranslations = (translations, userDefault) => {
          const priorityOrder = [
            'kjv', 'nkjv', 'esv', 'niv', 'nasb', 'nlt', 'csb', 'msg', 'amp', 
            'net_bible', 'rsv', 'nasb95', 'web', 'ylt', 'asv', 'darby', 'geneva'
          ];
          
          const userPreferredTranslations = JSON.parse(localStorage.getItem('preferredTranslations') || '[]');
          
          return [...translations].sort((a, b) => {
            // First priority: user's Firestore default translation
            if (userDefault) {
              const aIsDefault = a.id.toLowerCase() === userDefault.toLowerCase();
              const bIsDefault = b.id.toLowerCase() === userDefault.toLowerCase();
              if (aIsDefault && !bIsDefault) return -1;
              if (bIsDefault && !aIsDefault) return 1;
            }
            
            // Second priority: user's previous selections from localStorage
            const aUserPref = userPreferredTranslations.indexOf(a.id);
            const bUserPref = userPreferredTranslations.indexOf(b.id);
            if (aUserPref !== -1 && bUserPref !== -1) return aUserPref - bUserPref;
            if (aUserPref !== -1) return -1;
            if (bUserPref !== -1) return 1;
            
            // Third priority: predefined priority order
            const aPriority = priorityOrder.indexOf(a.id.toLowerCase());
            const bPriority = priorityOrder.indexOf(b.id.toLowerCase());
            if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
            if (aPriority !== -1) return -1;
            if (bPriority !== -1) return 1;
            
            // Final fallback: alphabetical by display name
            return a.displayName.localeCompare(b.displayName);
          });
        };
        
        const prioritizedTranslations = prioritizeTranslations(filteredTranslations, userDefaultTranslation);
        console.log('[ScriptureOverlay] Prioritized translations:', prioritizedTranslations.map(t => `${t.id} (${t.displayName})`));
        setAvailableTranslations(prioritizedTranslations);
        
      } catch (error) {
        console.error('[ScriptureOverlay] Error loading translations:', error);
        setAvailableTranslations([]);
      }
    };
      loadTranslationsAndUserPrefs();
  }, [functions]); // Include functions in dependencies

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
    }    const { book: normBook, chapter: normChapter, startVerse, endVerse } = parsed;
    console.log('[ScriptureOverlay] FetchEffect: Parsed successfully:', { normBook, normChapter, startVerse, endVerse });
    
    // Determine if this is a chapter-only reference
    const isChapterOnly = startVerse === 1 && endVerse === 999;
    const displayVerseRange = isChapterOnly ? 
      '' : // Don't show verse range for chapter-only references
      (startVerse === endVerse ? `${startVerse}` : `${startVerse}-${endVerse}`);
    
    setDisplayRef({ 
      book: normBook, 
      chapter: normChapter, 
      verseRange: displayVerseRange,
      isChapterOnly 
    });    // --- DEBUG: Log types and values for Firestore query ---
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
        // Only proceed if we have available translations loaded
        if (availableTranslations.length === 0) {
          console.log('[ScriptureOverlay] Waiting for available translations to load...');
          setLoading(false);
          return;
        }

        // Use the same function that works in other pages
        const verses = await getScriptureVersesForChapter(normBook, String(normChapter));
        console.log('[ScriptureOverlay] Firestore returned', verses.length, 'docs');
        
        // Filter verses by the range we need
        const filteredVerses = verses.filter(v => {
          const verseNum = Number(v.verse);
          const isChapterOnly = endVerse === 999;
          return isChapterOnly ? verseNum >= startVerse : (verseNum >= startVerse && verseNum <= endVerse);
        });
        
        console.log('[ScriptureOverlay] Filtered verses:', filteredVerses.length, 'docs');
          // Build translation map from verse data (same logic as before)
        const translationMap = {};
        for (const v of filteredVerses) {
          const code = v.translation;
          if (!translationMap[code]) {
            translationMap[code] = { code, label: code.toUpperCase(), verses: [] };
          }
          translationMap[code].verses.push({ verse: Number(v.verse), text: v.text.trim() });
        }
          console.log('[ScriptureOverlay] Translation map keys (what we found in Firestore):', Object.keys(translationMap));
        console.log('[ScriptureOverlay] Available translations from Firebase Functions:', availableTranslations.map(t => `${t.id}/${t.name}`));
        
        // Filter and order translations based on availableTranslations (like Universal Search)
        const availableTranslationsWithData = availableTranslations
          .filter(t => {
            // Case-insensitive matching - check if any Firestore translation matches this one
            const hasData = Object.keys(translationMap).some(firestoreCode => 
              firestoreCode.toLowerCase() === t.id.toLowerCase() || 
              firestoreCode.toLowerCase() === t.name.toLowerCase()
            );
            console.log(`[ScriptureOverlay] Translation ${t.id}/${t.name} (${t.displayName}): hasData=${hasData}`);
            return hasData;
          })
          .map(t => {
            // Find the matching Firestore translation code (case-insensitive)
            const translationCode = Object.keys(translationMap).find(firestoreCode => 
              firestoreCode.toLowerCase() === t.id.toLowerCase() || 
              firestoreCode.toLowerCase() === t.name.toLowerCase()
            );
            
            const translationData = translationMap[translationCode];
            if (translationData) {
              translationData.verses.sort((a, b) => a.verse - b.verse);
              return {
                code: translationCode, // Use the actual Firestore code
                label: t.displayName || t.name.toUpperCase(),
                text: translationData.verses.map(v => v.text).join('\n'),
                verses: translationData.verses,
                isUserDefault: userDefaultTranslation && (
                  t.id.toLowerCase() === userDefaultTranslation.toLowerCase() ||
                  t.name.toLowerCase() === userDefaultTranslation.toLowerCase()
                )
              };
            }
            return null;
          })
          .filter(Boolean);
        
        console.log('[ScriptureOverlay] Available translations with data:', availableTranslationsWithData.map(t => `${t.code} (${t.label})`));        
        // Set translations in the prioritized order
        setTranslations(availableTranslationsWithData);
        
        // Set current translation (prefer user default, then first available)
        if (availableTranslationsWithData.length > 0) {
          const defaultTranslation = availableTranslationsWithData.find(t => t.isUserDefault);
          const currentTranslation = defaultTranslation || availableTranslationsWithData[0];
          setCurrent(currentTranslation.code);
          console.log('[ScriptureOverlay] Setting current translation:', currentTranslation.code, 
                     defaultTranslation ? '(user default)' : '(first available)');
        } else {
          setCurrent('');
          console.log('[ScriptureOverlay] No translations with data available');
        }
          } catch (err) {
        console.error('[ScriptureOverlay] Error fetching verses:', err);
        setTranslations([]);
        setCurrent('');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVerses();
  }, [open, effective, availableTranslations, userDefaultTranslation]); // Dependencies for the fetchVerses effect
  
  useEffect(() => {
    console.log('[ScriptureOverlay] Translation selection effect triggered:', {
      defaultTranslation,
      translationsLength: translations.length,
      translationCodes: translations.map(t => t.code),
      currentSelected: current
    });
    
    if (translations.length > 0) {
      // Normalize for comparison
      const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '');
      
      // Only set current if it's not already set or invalid
      if (!current || !translations.some(t => norm(t.code) === norm(current))) {
        // Try to set to preferred translation first
        if (defaultTranslation) {
          const preferredTranslation = translations.find(t => norm(t.code) === norm(defaultTranslation));
          if (preferredTranslation) {
            console.log('[ScriptureOverlay] Setting current translation to preferred (fallback):', preferredTranslation.code);
            setCurrent(preferredTranslation.code);
            return;
          }
        }
        
        // Fallback to first translation if no preferred or current translation is invalid
        if (translations[0]?.code) {
          console.log('[ScriptureOverlay] Falling back to first translation:', translations[0].code);
          setCurrent(translations[0].code);
        }
      } else {
        console.log('[ScriptureOverlay] Current translation is valid, keeping:', current);
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
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-yellow-400/20 flex-shrink-0 bg-black/20">              <h2 className="text-lg md:text-xl font-semibold text-yellow-400 truncate pr-2">
                {displayRef.book ? 
                  buildScriptureReference({
                    book: displayBook,
                    chapter: displayRef.chapter,
                    verse: displayRef.verseRange ? displayRef.verseRange.split('-')[0] : undefined,
                    endVerse: displayRef.verseRange && displayRef.verseRange.includes('-') ? displayRef.verseRange.split('-')[1] : undefined
                  }) :
                  'Loading Reference...'}
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
            <div className="flex-grow overflow-y-auto">              {/* Translation Selector - Placed above scripture text */}
              {!loading && translations.length > 1 && (
                <div className="p-3 md:p-4 border-b border-gray-800/60 sticky top-0 z-10 backdrop-blur-sm bg-gray-900/50">                  {/* Desktop: flex-wrap, Mobile: horizontal scroll */}
                  <div className="hidden md:flex flex-wrap gap-2 justify-center">
                    {translations.map(t => (
                      <button
                        key={t.code}
                        onClick={() => setCurrent(t.code)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500/70 shadow-sm font-semibold
                          ${
                          current === t.code
                            ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold border border-yellow-600/80 shadow-lg transform scale-105' // Active style
                            : `bg-[#23232b] text-[#ffd700] border border-[#e0c97f] hover:bg-[#1a1a20] hover:text-[#fffbe6] hover:border-[#ffe082] hover:shadow-lg ${t.isUserDefault ? 'user-default' : ''}` // Black styling to match Universal Search
                        }`}
                        title={`${t.label}${t.isUserDefault ? ' (Your Default)' : ''}`}
                      >
                        {t.label}
                        {t.isUserDefault && <span className="text-yellow-400 ml-1">★</span>}
                      </button>
                    ))}
                  </div>
                  
                  {/* Mobile: horizontal scrollable container */}
                  <div className="flex md:hidden overflow-x-auto gap-2 pb-2 scrollbar-hide">
                    <div className="flex gap-2 min-w-max px-1">
                      {translations.map(t => (
                        <button
                          key={t.code}
                          onClick={() => setCurrent(t.code)}
                          className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-yellow-500/70 shadow-sm font-semibold whitespace-nowrap flex-shrink-0
                            ${
                            current === t.code
                              ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold border border-yellow-600/80 shadow-lg transform scale-105' // Active style
                              : `bg-[#23232b] text-[#ffd700] border border-[#e0c97f] hover:bg-[#1a1a20] hover:text-[#fffbe6] hover:border-[#ffe082] hover:shadow-lg ${t.isUserDefault ? 'user-default' : ''}` // Black styling to match Universal Search
                          }`}
                          title={`${t.label}${t.isUserDefault ? ' (Your Default)' : ''}`}
                        >
                          {t.label}
                          {t.isUserDefault && <span className="text-yellow-400 ml-1">★</span>}
                        </button>
                      ))}
                    </div>
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
                  <>                    {active.verses && active.verses.length > 0 ? (
                      <div className="space-y-3 text-gray-200">
                        {active.verses.map((verse, index) => (
                          <div key={`${current}-${verse.verse}-${index}-${displayRef.book}-${displayRef.chapter}`} className="flex items-start text-sm md:text-base leading-relaxed">
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
