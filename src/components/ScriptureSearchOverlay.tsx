import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../lib/firebase';
import './ScriptureSearchOverlay.css';

const functions = getFunctions();

interface Translation {
  id: string;
  name: string;
  displayName: string;
}

interface SearchVerse {
  objectID: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  reference: string;
  tags?: string[];
}

interface ScriptureSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (insertions: { references?: string[]; verses?: SearchVerse[]; tags?: string[] }) => void;
  position: { top: number; left: number };
}

export default function ScriptureSearchOverlay({ 
  isOpen, 
  onClose, 
  onInsert, 
  position 
}: ScriptureSearchOverlayProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchVerse[]>([]);
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [selectedTranslations, setSelectedTranslations] = useState<string[]>(['kjv']);
  const [isLoading, setIsLoading] = useState(false);  const [error, setError] = useState<string | null>(null);
  const [insertReferences, setInsertReferences] = useState(true);
  const [insertFullText, setInsertFullText] = useState(false);
  const [includeVerseTags, setIncludeVerseTags] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Focus search input when overlay opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  // Load available translations
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    const loadTranslations = async () => {
      try {
        // First, get user's preferred translation from Firestore profile
        let userDefaultTranslation: string | null = null;
        try {
          console.log('[ScriptureSearchOverlay] Fetching user profile for default translation...');          
          const { getUserProfile } = await import('../services/firebaseService');
          const userProfile = await getUserProfile();
          userDefaultTranslation = userProfile?.preferences?.defaultBibleVersion || null;
          console.log('[ScriptureSearchOverlay] User default translation from Firestore:', userDefaultTranslation);
        } catch (profileError) {
          console.error('[ScriptureSearchOverlay] Error fetching user profile:', profileError);
          // Fallback to localStorage
          userDefaultTranslation = localStorage.getItem('defaultTranslation') || localStorage.getItem('defaultBibleVersion');
          console.log('[ScriptureSearchOverlay] Fallback to localStorage default translation:', userDefaultTranslation);
        }
        
        const getAllUniqueTranslationsCallable = httpsCallable<
          void,
          { uniqueTranslations: Translation[] }
        >(functions, "getAllUniqueTranslations");
        
        const result = await getAllUniqueTranslationsCallable();
        const fetchedTranslations = result.data.uniqueTranslations || [];
        
        console.log('[ScriptureSearchOverlay] Raw fetched translations:', fetchedTranslations.map(t => `${t.id}|${t.name}|${t.displayName}`));
        
        // Deduplicate translations by ID (case-insensitive)
        const deduplicatedTranslations = fetchedTranslations.reduce((acc: Translation[], current) => {
          const exists = acc.find(t => t.id.toLowerCase() === current.id.toLowerCase());
          if (!exists) {
            acc.push(current);
          } else {
            console.log('[ScriptureSearchOverlay] Skipping duplicate translation:', current.id);
          }
          return acc;
        }, []);
        
        console.log('[ScriptureSearchOverlay] Deduplicated translations:', deduplicatedTranslations.map(t => `${t.id}|${t.name}|${t.displayName}`));
        
        // Filter out EXB translation unless user is authorized
        const expectedUserId = "89UdurybrVSwbPmp4boEMeYdVzk1";
        console.log('[ScriptureSearchOverlay] Before EXB filtering - userId:', currentUserId, 'expected:', expectedUserId);
        console.log('[ScriptureSearchOverlay] User ID match:', currentUserId === expectedUserId, 'userId type:', typeof currentUserId, 'length:', currentUserId?.length);
        console.log('[ScriptureSearchOverlay] EXB translations before filter:', deduplicatedTranslations.filter(t => t.id.toUpperCase() === "EXB"));
        
        const filteredTranslations = deduplicatedTranslations.filter((translation) => {
          const isEXB = translation.id.toUpperCase() === "EXB";
          const isAuthorized = currentUserId === expectedUserId;
          const shouldInclude = !isEXB || isAuthorized;
          
          if (isEXB) {
            console.log(`[ScriptureSearchOverlay] EXB check: isEXB=${isEXB}, userId="${currentUserId}", expectedUserId="${expectedUserId}", isAuthorized=${isAuthorized}, shouldInclude=${shouldInclude}`);
          }
          
          return shouldInclude;
        });
        
        console.log('[ScriptureSearchOverlay] Filtered translations (EXB restricted):', filteredTranslations.map(t => `${t.id} (${t.displayName})`));
        console.log('[ScriptureSearchOverlay] EXB translations after filter:', filteredTranslations.filter(t => t.id.toUpperCase() === "EXB"));
        
        // Advanced prioritization system - prioritize translations based on user preferences and common usage
        const prioritizeTranslations = (translations: Translation[], userDefault: string | null): Translation[] => {
          // Define priority order based on common usage and user-friendly translations
          const priorityOrder = [
            'kjv',           // King James Version - most requested
            'nkjv',          // New King James Version
            'esv',           // English Standard Version  
            'niv',           // New International Version
            'nasb',          // New American Standard Bible
            'nlt',           // New Living Translation
            'csb',           // Christian Standard Bible
            'msg',           // The Message
            'amp',           // Amplified Bible
            'net_bible',     // NET Bible
            'rsv',           // Revised Standard Version
            'nasb95',        // NASB 1995
            'web',           // World English Bible
            'ylt',           // Young's Literal Translation
            'asv',           // American Standard Version
            'darby',         // Darby Translation
            'geneva'         // Geneva Bible
          ];
            
          // Check localStorage for user's previously selected translations (secondary preference)
          const userPreferredTranslations = JSON.parse(localStorage.getItem('preferredTranslations') || '[]');
          
          console.log('[ScriptureSearchOverlay] Prioritizing translations with user default:', userDefault);
          console.log('[ScriptureSearchOverlay] User preferred translations from localStorage:', userPreferredTranslations);
          
          // Sort translations: user's Firestore default first, then localStorage preferences, then priority order, then alphabetical
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
        console.log('[ScriptureSearchOverlay] Prioritized translations:', prioritizedTranslations.map(t => `${t.id} (${t.displayName})`));
        
        // Final deduplication to ensure no duplicate keys in React render
        const finalTranslations = prioritizedTranslations.reduce((acc: Translation[], current) => {
          const exists = acc.find(t => t.id === current.id);
          if (!exists) {
            acc.push(current);
          } else {
            console.warn('[ScriptureSearchOverlay] Final deduplication - removing duplicate:', current.id);
          }
          return acc;
        }, []);
          
        console.log('[ScriptureSearchOverlay] Final translations after deduplication:', finalTranslations.map(t => t.id));

        // Verify no duplicates before setting state
        const duplicateIds = finalTranslations.map(t => t.id).filter((id, index, arr) => arr.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
          console.error('[ScriptureSearchOverlay] DUPLICATE IDs DETECTED:', duplicateIds);
        }
          
        setAvailableTranslations(finalTranslations);

        // Immediately set the default translation when translations are loaded
        if (prioritizedTranslations.length > 0) {
          // Priority: 1) User's Firestore default, 2) localStorage default, 3) first prioritized translation
          let defaultTranslation = userDefaultTranslation;
          
          // Verify the user's default exists in available translations (case-insensitive)
          if (defaultTranslation && !prioritizedTranslations.find(t => t.id.toLowerCase() === defaultTranslation!.toLowerCase())) {
            console.log('[ScriptureSearchOverlay] User default translation not available, falling back to localStorage...');
            defaultTranslation = localStorage.getItem('defaultTranslation');
          }
          
          // Final fallback to first available translation (use consistent case-insensitive comparison)
          if (!defaultTranslation || !prioritizedTranslations.find(t => t.id.toLowerCase() === defaultTranslation!.toLowerCase())) {
            defaultTranslation = prioritizedTranslations[0].id;
            console.log('[ScriptureSearchOverlay] Using first prioritized translation as default:', defaultTranslation);
          }
          
          console.log('[ScriptureSearchOverlay] Setting initial default translation:', defaultTranslation);
          setSelectedTranslations([defaultTranslation]);
          
          // Save this as user's preference for future sessions (localStorage backup)
          localStorage.setItem('defaultTranslation', defaultTranslation);
        }
        
      } catch (err) {
        console.error('Error loading translations:', err);
      }
    };

    loadTranslations();
  }, [isOpen, currentUserId]);

  // Perform search
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim() || selectedTranslations.length === 0) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const universalScriptureSearch = httpsCallable<
        any,
        { results: SearchVerse[]; nbHits: number; page: number; nbPages: number }
      >(functions, 'universalScriptureSearch');

      const searchParams = {
        query: searchQuery.trim(),
        translations: selectedTranslations,
        page: 0,
        hitsPerPage: 50
      };

      const response = await universalScriptureSearch(searchParams);
      setSearchResults(response.data.results || []);
      
      if (response.data.results.length === 0) {
        setError('No verses found matching your search.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTranslations]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setSearchResults([]);
        setError(null);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedTranslations, performSearch]);

  // Handle verse selection
  const toggleVerseSelection = useCallback((verseId: string) => {
    setSelectedVerses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(verseId)) {
        newSet.delete(verseId);
      } else {
        newSet.add(verseId);
      }
      return newSet;
    });
  }, []);
  // Handle insertion
  const handleInsert = useCallback(() => {
    if (selectedVerses.size === 0) {
      setError('Please select at least one verse to insert.');
      return;
    }

    const selectedVersesData = searchResults.filter(v => selectedVerses.has(v.objectID));
    
    const insertions: { references?: string[]; verses?: SearchVerse[]; tags?: string[] } = {};
    
    if (insertReferences) {
      insertions.references = selectedVersesData.map(v => v.reference);
    }
    
    if (insertFullText) {
      insertions.verses = selectedVersesData;
    }
    
    if (includeVerseTags) {
      // Collect all unique tags from selected verses
      const allTags = new Set<string>();
      selectedVersesData.forEach(verse => {
        if (verse.tags && verse.tags.length > 0) {
          verse.tags.forEach(tag => allTags.add(tag));
        }
      });
      insertions.tags = Array.from(allTags).sort();
    }
    
    onInsert(insertions);
    onClose();
  }, [selectedVerses, searchResults, insertReferences, insertFullText, includeVerseTags, onInsert, onClose]);

  // Handle escape key and outside clicks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="scripture-search-overlay-backdrop">
      <div 
        ref={overlayRef}
        className="scripture-search-overlay"
      >
        <div className="scripture-search-header">
          <h3>Search Scripture</h3>
          <button 
            className="scripture-search-close"
            onClick={onClose}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="scripture-search-content">
          {/* Search Input */}
          <div className="scripture-search-input-section">
            <input
              ref={searchInputRef}
              type="text"
              className="scripture-search-input"
              placeholder="Search verse text, reference (e.g., John 3:16), or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  performSearch();
                }
              }}
            />
          </div>

          {/* Translation Selection */}
          <div className="scripture-search-translations">
            <label>Translations:</label>
            <div className="translation-checkboxes">
              {availableTranslations.slice(0, 8).map(translation => (
                <label key={translation.id} className="translation-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTranslations.includes(translation.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTranslations(prev => [...prev, translation.id]);
                      } else {
                        setSelectedTranslations(prev => prev.filter(id => id !== translation.id));
                      }
                    }}
                  />
                  {translation.displayName}
                </label>
              ))}
            </div>
          </div>          {/* Insert Options */}
          <div className="scripture-search-options">
            <label className="insert-option">
              <input
                type="checkbox"
                checked={insertReferences}
                onChange={(e) => setInsertReferences(e.target.checked)}
              />
              Insert references
            </label>
            <label className="insert-option">
              <input
                type="checkbox"
                checked={insertFullText}
                onChange={(e) => setInsertFullText(e.target.checked)}
              />
              Insert full text
            </label>
            <label className="insert-option">
              <input
                type="checkbox"
                checked={includeVerseTags}
                onChange={(e) => setIncludeVerseTags(e.target.checked)}
              />
              Include verse tags
            </label>
          </div>

          {/* Loading/Error States */}
          {isLoading && (
            <div className="scripture-search-loading">
              <div className="spinner"></div>
              Searching...
            </div>
          )}

          {error && (
            <div className="scripture-search-error">
              {error}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="scripture-search-results">
              <div className="results-header">
                <span>{searchResults.length} verse(s) found</span>
                <div className="results-actions">
                  <button
                    className="select-all-btn"
                    onClick={() => {
                      if (selectedVerses.size === searchResults.length) {
                        setSelectedVerses(new Set());
                      } else {
                        setSelectedVerses(new Set(searchResults.map(v => v.objectID)));
                      }
                    }}
                  >
                    {selectedVerses.size === searchResults.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="results-list">
                {searchResults.map(verse => (
                  <div
                    key={verse.objectID}
                    className={`search-result-item ${selectedVerses.has(verse.objectID) ? 'selected' : ''}`}
                    onClick={() => toggleVerseSelection(verse.objectID)}
                  >                    <div className="result-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedVerses.has(verse.objectID)}
                        onChange={(e) => {
                          e.stopPropagation(); // Prevent event bubbling
                          toggleVerseSelection(verse.objectID);
                        }}
                        onClick={(e) => e.stopPropagation()} // Also prevent click bubbling
                        aria-label={`Select verse ${verse.reference}`}
                      />
                    </div>
                    <div className="result-content">
                      <div className="result-reference">
                        {verse.reference} ({verse.translation.toUpperCase()})
                      </div>
                      <div className="result-text">
                        {verse.text}
                      </div>
                      {verse.tags && verse.tags.length > 0 && (
                        <div className="result-tags">
                          {verse.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="result-tag">
                              {tag.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {verse.tags.length > 3 && (
                            <span className="result-tag-more">+{verse.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insert Button */}
          <div className="scripture-search-footer">
            <button              className="scripture-search-insert"
              onClick={handleInsert}
              disabled={selectedVerses.size === 0 || (!insertReferences && !insertFullText && !includeVerseTags)}
            >
              Insert {selectedVerses.size > 0 ? `${selectedVerses.size} verse(s)` : 'Selected Verses'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
