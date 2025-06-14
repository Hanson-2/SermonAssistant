import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listChaptersForBook, getScriptureVersesForChapter, getUserProfile } from "../services/firebaseService";
import { auth } from "../lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import "./ScriptureBookPage.css";

interface Translation {
  id: string;
  name: string;
  displayName: string;
}

export default function ScriptureBookPage() {
  // Correctly use 'bookName' from route params
  const { bookName } = useParams<{ bookName: string }>(); 
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versesByTranslation, setVersesByTranslation] = useState<Record<string, { verse: string, text: string }[]>>({});
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [versesLoading, setVersesLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [userDefaultTranslation, setUserDefaultTranslation] = useState<string | null>(null);
  const verseRefs = useRef<(HTMLLIElement | null)[]>([]);
  const functions = getFunctions();
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  // Fetch translations with prioritization (same as Universal Search)
  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        // First, get user's preferred translation from Firestore profile
        let userDefaultTranslation: string | null = null;
        try {
          console.log('[ScriptureBookPage] Fetching user profile for default translation...');
          const userProfile = await getUserProfile();
          userDefaultTranslation = userProfile?.preferences?.defaultBibleVersion || null;
          console.log('[ScriptureBookPage] User default translation from Firestore:', userDefaultTranslation);
          setUserDefaultTranslation(userDefaultTranslation);
        } catch (profileError) {
          console.error('[ScriptureBookPage] Error fetching user profile:', profileError);
          userDefaultTranslation = localStorage.getItem('defaultTranslation') || localStorage.getItem('defaultBibleVersion');
          console.log('[ScriptureBookPage] Fallback to localStorage default translation:', userDefaultTranslation);
          setUserDefaultTranslation(userDefaultTranslation);
        }

        const getAllUniqueTranslationsCallable = httpsCallable<
          void,
          { uniqueTranslations: Translation[] }
        >(functions, "getAllUniqueTranslations");
        const result = await getAllUniqueTranslationsCallable();
        const fetchedTranslations = result.data.uniqueTranslations || [];
        
        console.log('[ScriptureBookPage] Raw fetched translations:', fetchedTranslations.map(t => `${t.id}|${t.name}|${t.displayName}`));
        
        // Deduplicate translations by ID (case-insensitive)
        const deduplicatedTranslations = fetchedTranslations.reduce((acc: Translation[], current) => {
          const exists = acc.find(t => t.id.toLowerCase() === current.id.toLowerCase());
          if (!exists) {
            acc.push(current);
          } else {
            console.log('[ScriptureBookPage] Skipping duplicate translation:', current.id);
          }
          return acc;
        }, []);
        
        console.log('[ScriptureBookPage] Deduplicated translations:', deduplicatedTranslations.map(t => `${t.id}|${t.name}|${t.displayName}`));
        
        // Filter out EXB translation unless user is authorized
        const filteredTranslations = deduplicatedTranslations.filter((translation) => 
          translation.id.toUpperCase() !== "EXB" || userId === "89UdurybrVSwbPmp4boEMeYdVzk1"
        );
        
        console.log('[ScriptureBookPage] Filtered translations (EXB restricted):', filteredTranslations.map(t => `${t.id} (${t.displayName})`));
        
        // Advanced prioritization system - same as Universal Search
        const prioritizeTranslations = (translations: Translation[], userDefault: string | null): Translation[] => {
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
            if (aUserPref !== -1 && bUserPref === -1) return -1;
            if (aUserPref === -1 && bUserPref !== -1) return 1;
            
            // Third priority: predefined priority order
            const aPriority = priorityOrder.indexOf(a.id.toLowerCase());
            const bPriority = priorityOrder.indexOf(b.id.toLowerCase());
            const aIndex = aPriority === -1 ? 999 : aPriority;
            const bIndex = bPriority === -1 ? 999 : bPriority;
            if (aIndex !== bIndex) return aIndex - bIndex;
            
            // Fourth priority: alphabetical by display name
            return (a.displayName || a.name).localeCompare(b.displayName || b.name);
          });
        };
        
        console.log('[ScriptureBookPage] Prioritizing translations with user default:', userDefaultTranslation);
        const prioritizedTranslations = prioritizeTranslations(filteredTranslations, userDefaultTranslation);
        console.log('[ScriptureBookPage] Prioritized translations:', prioritizedTranslations.map(t => `${t.id} (${t.displayName})`));
        
        setAvailableTranslations(prioritizedTranslations);
      } catch (error) {
        console.error('[ScriptureBookPage] Error fetching translations:', error);
      }
    };

    fetchTranslations();
  }, [functions, userId]);

  useEffect(() => {
    async function fetchChapters() {
      // Use bookName
      if (!bookName) return;
      console.log("[ScriptureBookPage] Fetching chapters for book:", bookName); // Added log
      setLoading(true);
      const fetchedChapters = await listChaptersForBook(bookName);
      console.log("[ScriptureBookPage] Fetched chapters:", fetchedChapters); // Added log
      setChapters(fetchedChapters);
      setLoading(false);
    }
    fetchChapters();
  }, [bookName]); // Depend on bookName

  useEffect(() => {
    async function fetchVerses() {
      // Use bookName
      if (!bookName || !selectedChapter) return;
      console.log("[ScriptureBookPage] Fetching verses for book:", bookName, "chapter:", selectedChapter); // Added log
      setVersesLoading(true);
      const verses = await getScriptureVersesForChapter(bookName, selectedChapter);      console.log("[ScriptureBookPage] Fetched verses raw:", verses); // Added log
      // Group by translation
      const grouped: Record<string, { verse: string, text: string }[]> = {};
      for (const v of verses) {
        if (!grouped[v.translation]) grouped[v.translation] = [];
        // Assuming getScriptureVersesForChapter returns objects with 'verse' as verse number string
        grouped[v.translation].push({ verse: v.verse, text: v.text });
      }
      setVersesByTranslation(grouped);
      
      // Debug: log the translation keys in the data
      console.log("[ScriptureBookPage] Translation keys in verse data:", Object.keys(grouped));
      console.log("[ScriptureBookPage] Available translations from API:", availableTranslations.map(t => `${t.id}|${t.name}|${t.displayName}`));
      
      // Find the best default translation using prioritization and case-insensitive matching
      const availableTranslationKeys = Object.keys(grouped);
      console.log("[ScriptureBookPage] Available translations in data:", availableTranslationKeys);
      
      let defaultTranslation: string | null = null;
      
      // First priority: user's default translation if available in data (case-insensitive)
      if (userDefaultTranslation) {
        const userDefaultAvailable = availableTranslationKeys.find(
          key => key.toLowerCase() === userDefaultTranslation.toLowerCase()
        );
        if (userDefaultAvailable) {
          defaultTranslation = userDefaultAvailable;
          console.log("[ScriptureBookPage] Using user default translation:", defaultTranslation);
        }
      }
      
      // Second priority: find first available from prioritized list (case-insensitive)
      if (!defaultTranslation && availableTranslations.length > 0) {
        for (const translation of availableTranslations) {
          const availableKey = availableTranslationKeys.find(
            key => key.toLowerCase() === translation.id.toLowerCase() ||
                   key.toLowerCase() === translation.name.toLowerCase() ||
                   key.toLowerCase() === (translation.displayName || '').toLowerCase()
          );
          if (availableKey) {
            defaultTranslation = availableKey;
            console.log("[ScriptureBookPage] Using prioritized translation:", defaultTranslation);
            break;
          }
        }
      }
      
      // Fallback: first available translation
      if (!defaultTranslation && availableTranslationKeys.length > 0) {
        defaultTranslation = availableTranslationKeys[0];
        console.log("[ScriptureBookPage] Falling back to first available translation:", defaultTranslation);
      }
      
      console.log("[ScriptureBookPage] Final selected translation:", defaultTranslation, "All grouped:", grouped); // Added log
      setSelectedTranslation(defaultTranslation);
      setVersesLoading(false);
    }
    if (selectedChapter) fetchVerses();
  }, [bookName, selectedChapter, userDefaultTranslation, availableTranslations]); // Added dependencies

  useEffect(() => {
    // Scroll fade-in/out for verse cards
    const items = verseRefs.current.filter(Boolean);
    if (!items.length) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target instanceof HTMLElement) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
            } else {
              entry.target.classList.remove("is-visible");
            }
          }
        });
      },
      { threshold: 0.15 }
    );
    items.forEach((item) => observer.observe(item!));
    return () => observer.disconnect();
  }, [selectedTranslation, versesByTranslation, selectedChapter]);
  return (
    <div className="scripture-book-layout">      {/* Back button */}
      <button 
        onClick={() => navigate('/currently-added-scripture')}
        className="back-to-books-btn"
        title="Back to Books"
      >
        ← Back to Books
      </button>
      
      {/* Display bookName */}
      <h1 className="scripture-book-title gradient-gold-text">{bookName}</h1>      {loading ? (
        // Enhanced biblical-themed loading indicator for chapters
        <div className="loading-indicator-container">
          <div className="loading-text">Loading Chapters...</div>
          <div className="biblical-scroll-loader">
            <div className="scroll-body"></div>
            <div className="scroll-ends">
              <div className="scroll-end"></div>
              <div className="scroll-end"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="chapter-nav">
          {chapters.map((ch) => (
            <button
              key={ch}
              className={`chapter-btn modern-chapter-btn${selectedChapter === ch ? " selected" : ""}`}
              onClick={() => setSelectedChapter(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}
      {/* Divider between chapters and translations */}
      {selectedChapter && <div className="chapter-translation-divider" />}
      {selectedChapter && (
        <div className="chapter-text-animate">          {versesLoading ? (
            // Enhanced biblical-themed loading indicator for verses
            <div className="loading-indicator-container">
              <div className="loading-text">Loading Scripture...</div>
              <div className="christian-cross-loader">
                <div className="cross-radiance"></div>
                <div className="cross-vertical"></div>
                <div className="cross-horizontal"></div>
              </div>
            </div>
          ) : (            Object.keys(versesByTranslation).length > 0 && (              <>                <div className="translation-buttons">
                  {availableTranslations
                    .filter(translation => {
                      // Normalize translation matching - check if this translation has data
                      const translationDataKeys = Object.keys(versesByTranslation);
                      const hasData = translationDataKeys.some(key => 
                        key.toLowerCase() === translation.id.toLowerCase() ||
                        key.toLowerCase() === translation.name.toLowerCase() ||
                        key.toLowerCase() === (translation.displayName || '').toLowerCase()
                      );
                      
                      // Apply EXB restriction
                      const isEXBAllowed = translation.id.toUpperCase() !== "EXB" || userId === "89UdurybrVSwbPmp4boEMeYdVzk1";
                      
                      console.log(`[ScriptureBookPage] Translation ${translation.id}/${translation.name}: hasData=${hasData}, isEXBAllowed=${isEXBAllowed}`);
                      
                      return hasData && isEXBAllowed;
                    })
                    .map((translation) => {
                      // Find the actual translation key that exists in the data (case-insensitive)
                      const translationDataKeys = Object.keys(versesByTranslation);
                      const translationKey = translationDataKeys.find(key => 
                        key.toLowerCase() === translation.id.toLowerCase() ||
                        key.toLowerCase() === translation.name.toLowerCase() ||
                        key.toLowerCase() === (translation.displayName || '').toLowerCase()
                      ) || translation.id;
                      
                      const isUserDefault = userDefaultTranslation && translation.id.toLowerCase() === userDefaultTranslation.toLowerCase();
                      
                      return (
                        <button
                          key={translation.id}
                          className={`translation-btn${selectedTranslation === translationKey ? " selected" : ""} ${isUserDefault ? "user-default" : ""}`}
                          onClick={() => setSelectedTranslation(translationKey)}
                          title={`${translation.displayName}${isUserDefault ? ' (Your Default)' : ''}`}
                        >
                          {translation.name.toUpperCase()}
                          {isUserDefault && <span className="default-indicator">★</span>}
                        </button>
                      );
                    })}
                </div>
                <ul className="chapter-verse-list verse-card-list scroll-fade-list">
                  {selectedTranslation &&
                    (selectedTranslation !== "EXB" || userId === "89UdurybrVSwbPmp4boEMeYdVzk1") &&
                    versesByTranslation[selectedTranslation]?.map((v, idx) => (
                      <li
                        key={v.verse}
                        className="chapter-verse-item verse-card scroll-fade-item"
                        ref={el => { verseRefs.current[idx] = el; }}
                      >
                        <span className="chapter-verse-num verse-card-num">{v.verse}</span>
                        <span className="chapter-verse-text verse-card-text">{v.text}</span>
                      </li>
                    ))}
                </ul>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
