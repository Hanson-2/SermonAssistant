// filepath: c:\\Users\\steve\\Custom-Apps\\Sermon Notes Assistant\\src\\pages\\AddTagsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './AddTagsPage.css';
import { batchUpdateVerseTags, BatchVerseTagUpdate } from '../services/firebaseService';

// UserTag interface for user-specific tags
interface UserTag {
  id: string;
  name: string;
  color?: string;
}

// Import ALL_BOOKS from a shared location or define it here if not already available
// For now, let's define a simplified version. Ideally, this comes from a shared constants file.
const ALL_BOOKS: string[] = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
    "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", 
    "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", 
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", 
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", 
    "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", 
    "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", 
    "Revelation"
];

// Interfaces based on UniversalSearchPage.tsx
interface Translation {
  id: string;
  name: string;
  displayName: string;
}

interface Verse {
  objectID: string; // Firestore document ID for verses
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tags: string[];
  translation: string;
  reference: string;
  // Optional: If using Algolia-like highlighting from universalScriptureSearch
  _highlightResult?: {
    text?: { value: string };
    reference?: { value: string };
  };
}

// const TRANSLATION_OPTIONS = [ ... ]; // This will be fetched dynamically

// Define the type for search parameters to be stored
interface StoredSearchParams {
  query: string;
  translations: string[];
  books?: string[];
}

export default function AddTagsPage() {
  // States for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [currentResults, setCurrentResults] = useState<Verse[]>([]);
  const [selectedVerseDocIds, setSelectedVerseDocIds] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Translation states
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [selectedTranslations, setSelectedTranslations] = useState<string[]>([]);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(false);
  const [translationLoadError, setTranslationLoadError] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [selectedHitsPerPage, setSelectedHitsPerPage] = useState(25); // Default for this page

  // States for batch tag inputs
  const [tagsToAddInput, setTagsToAddInput] = useState('');
  const [tagsToRemoveInput, setTagsToRemoveInput] = useState('');
  const [applyToAllTranslations, setApplyToAllTranslations] = useState(false);

  // New states for "Select All" functionality
  const [isSelectAllActive, setIsSelectAllActive] = useState(false);
  const [lastSuccessfulSearchParams, setLastSuccessfulSearchParams] = useState<StoredSearchParams | null>(null);

  // State for collapsing sections
  const [isTranslationsCollapsed, setIsTranslationsCollapsed] = useState(false);
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);

  // User tags state
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [isLoadingUserTags, setIsLoadingUserTags] = useState(false);
  const [userTagLoadError, setUserTagLoadError] = useState<string | null>(null);
  const [userTagFilter, setUserTagFilter] = useState('');

  // Tag suggestions for user tags (based on filter input)
  const tagSuggestionListRef = React.useRef<HTMLUListElement>(null);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState<number>(-1);

  const functions = getFunctions();

  // Fetch available translations on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoadingTranslations(true);
      try {
        const getAllUniqueTranslationsCallable = httpsCallable<
          void,
          { uniqueTranslations: Translation[] }
        >(functions, "getAllUniqueTranslations");
        const result = await getAllUniqueTranslationsCallable();
        const fetchedTranslations = result.data.uniqueTranslations || [];
        setAvailableTranslations(fetchedTranslations);
        if (fetchedTranslations.length > 0 && selectedTranslations.length === 0) {
          // setSelectedTranslations([fetchedTranslations[0].id]); // Optionally pre-select one
        }
      } catch (err: any) {
        console.error("Error fetching translations:", err);
        setTranslationLoadError(`Failed to load translations: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoadingTranslations(false);
      }
    };
    fetchInitialData();
  }, [functions]); // Removed selectedTranslations.length from deps for this page

  // Fetch user tags on mount
  useEffect(() => {
    const fetchUserTags = async () => {
      setIsLoadingUserTags(true);
      setUserTagLoadError(null);
      try {
        const getUserTags = httpsCallable(functions, 'getUserTags');
        const result = await getUserTags();
        const tagsData = (result.data as any)?.tags || [];
        setUserTags(tagsData);
      } catch (e: any) {
        setUserTagLoadError(e.message || 'Failed to load your tags.');
      } finally {
        setIsLoadingUserTags(false);
      }
    };
    fetchUserTags();
  }, [functions]);

  const handleTranslationSelect = (translationId: string) => {
    setSelectedTranslations(prev => 
      prev.includes(translationId) 
        ? prev.filter(id => id !== translationId) 
        : [...prev, translationId]
    );
  };
  
  const sortVersesChronologically = useCallback((verses: Verse[]): Verse[] => {
    // Basic sort, assuming book names are standard and can be string compared for now
    // For a more robust sort, a predefined book order map is needed (like in UniversalSearchPage)
    return [...verses].sort((a, b) => {
        if (a.book !== b.book) return a.book.localeCompare(b.book);
        if (a.chapter !== b.chapter) return a.chapter - b.chapter;
        return a.verse - b.verse;
    });
  }, []);


  const handleSearch = useCallback(async (pageToFetch = 0) => {
    // Clear previous success/error messages and tag inputs on new search
    setSuccessMessage(null);
    setError(null);
    // setTagsToAddInput(''); // Keep inputs for now, user might want to re-apply same tags to new search
    // setTagsToRemoveInput(''); // Keep inputs for now
    // setIsSelectAllActive(false); // This is already reset later on successful search or error

    if (selectedTranslations.length === 0 && !searchQuery.trim()) {
      setError("Please select at least one translation or enter a search query.");
      setCurrentResults([]);
      setTotalPages(0);
      setTotalHits(0);
      return;
    }
    setIsLoading(true);
    // setError(null); // Already set above
    if (pageToFetch === 0) {
      setCurrentResults([]);
      setTotalHits(0);
      setTotalPages(0);
      setSelectedVerseDocIds([]); // Clear selected verses on new search
      setIsSelectAllActive(false); // Reset select all on new search
    }

    try {
      const universalScriptureSearch = httpsCallable<
        any,
        { results: Verse[]; nbHits: number; page: number; nbPages: number; hitsPerPage: number }
      >(functions, 'universalScriptureSearch');
      
      // Logic to extract book names from searchQuery
      let currentQuery = searchQuery.trim();
      const identifiedBooks: string[] = [];
      const remainingQueryParts: string[] = [];

      // Create a regex to find book names (case-insensitive, allows for multi-word books)
      // This is a simple approach; more sophisticated parsing might be needed for edge cases.
      const bookRegex = new RegExp(ALL_BOOKS.join("|"), "ig");
      let match;
      const queryWords = currentQuery.split(/\s+|,\s*/); // Split by space or comma
      const matchedBookStrings = new Set<string>();

      // First pass: exact matches for multi-word books, then single words
      ALL_BOOKS.sort((a, b) => b.length - a.length); // Prioritize longer matches (e.g., "1 Corinthians" before "Corinthians")

      let tempQuery = currentQuery;
      for (const book of ALL_BOOKS) {
        const regex = new RegExp(book.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "ig"); // Escape special characters for regex
        if (regex.test(tempQuery)) {
          identifiedBooks.push(book); // Add the canonical book name
          // Remove all occurrences of this book name from tempQuery to avoid re-matching parts
          tempQuery = tempQuery.replace(regex, '').trim();
        }
      }
      
      // The remaining tempQuery can be considered the text search part
      const cleanedQuery = tempQuery.replace(/,\s*$/, '').trim(); // Remove trailing commas and trim

      const searchParams: any = {
        query: cleanedQuery, // Use the query after extracting book names
        translations: selectedTranslations,
        page: pageToFetch,
        hitsPerPage: selectedHitsPerPage,
      };

      if (identifiedBooks.length > 0) {
        searchParams.books = identifiedBooks;
      }

      const response = await universalScriptureSearch(searchParams);
      const { results, nbHits, page, nbPages } = response.data as { results: Verse[]; nbHits: number; page: number; nbPages: number; hitsPerPage: number };

      if (results && results.length > 0) {
        const sortedResults = sortVersesChronologically(results);
        setCurrentResults(pageToFetch === 0 ? sortedResults : prev => sortVersesChronologically([...prev, ...sortedResults]));
        setTotalHits(nbHits);
        setCurrentPage(page);
        setTotalPages(nbPages);
        // Store the successful search parameters
        setLastSuccessfulSearchParams({
          query: searchParams.query,
          translations: searchParams.translations,
          books: searchParams.books,
        });
        setIsSelectAllActive(false); // Reset select all on new search
      } else {
        setCurrentResults([]);
        setTotalHits(0);
        setCurrentPage(0);
        setTotalPages(0);
        setError("No verses found matching your criteria.");
        setLastSuccessfulSearchParams(null); // Clear on no results
        setIsSelectAllActive(false); // Reset select all
      }
    } catch (e: any) {
      setError(e.message || "Search failed. Please try again.");
      console.error("Error calling universalScriptureSearch:", e);
      setLastSuccessfulSearchParams(null); // Clear on error
      setIsSelectAllActive(false); // Reset select all
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTranslations, functions, selectedHitsPerPage, sortVersesChronologically]);

  const handleVerseSelectionChange = (verseDocId: string) => {
    if (isSelectAllActive) return; // Do nothing if select all is active
    setSelectedVerseDocIds(prevSelectedIds =>
      prevSelectedIds.includes(verseDocId)
        ? prevSelectedIds.filter(id => id !== verseDocId)
        : [...prevSelectedIds, verseDocId]
    );
  };

  const handleBatchUpdateTags = async () => {
    if (isSelectAllActive && totalHits === 0) {
      setError("No results to apply tags to. Perform a search first.");
      return;
    }
    if (!isSelectAllActive && selectedVerseDocIds.length === 0) {
      setError("No verses selected. Please select verses to update.");
      return;
    }
    if (!tagsToAddInput.trim() && !tagsToRemoveInput.trim()) {
      setError("Please enter tags to add or remove.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const tagsToAddArray = tagsToAddInput.split(',').map(tag => tag.trim()).filter(tag => tag);
    const tagsToRemoveArray = tagsToRemoveInput.split(',').map(tag => tag.trim()).filter(tag => tag);

    try {
      if (isSelectAllActive) {
        if (!lastSuccessfulSearchParams) {
          setError("Please perform a successful search before using 'Select All Results'.");
          setIsLoading(false);
          return;
        }
        // Call the new cloud function for "select all"
        const batchUpdateByCriteriaCallable = httpsCallable(functions, 'batchUpdateTagsByCriteria');
        const payload = {
          criteria: {
            query: lastSuccessfulSearchParams.query || '',
            translations: lastSuccessfulSearchParams.translations || [],
            books: lastSuccessfulSearchParams.books, // Can be undefined
          },
          tagsToAdd: tagsToAddArray,
          tagsToRemove: tagsToRemoveArray,
          applyToAllTranslationsInCriteria: applyToAllTranslations,
        };
        await batchUpdateByCriteriaCallable(payload);
        setSuccessMessage("Tags updated successfully for all matching results!");
        // Optionally, refresh search results or clear selections
        // For now, we'll just show a success message.
        // Consider if a re-search or clearing is needed.
        // handleSearch(currentPage); // Example: re-run search for current page
        // setIsSelectAllActive(false); // Reset select all
        // setSelectedVerseDocIds([]);

      } else {
        // Existing logic for individual selections using client-side batchUpdateVerseTags
        const updates: BatchVerseTagUpdate[] = [];
        if (applyToAllTranslations) {
          const uniqueBaseReferences = new Set<string>();
          // Corrected logic to derive baseReference from objectID (Firestore doc ID)
          // Example objectID: "genesis-1-1-kjv" -> baseReference: "genesis_1_1"
          // The cloud function expects book_chapter_verse.
          // The objectID format is book-chapter-verse-translation.
          // We need to convert book-chapter-verse part to book_chapter_verse.
          selectedVerseDocIds.forEach(docId => {
            const parts = docId.split('-'); // e.g., ["genesis", "1", "1", "kjv"]
            if (parts.length >= 4) { // Ensure book, chapter, verse, and translation are present
              const book = parts.slice(0, parts.length - 3).join('-'); // Handles books like "1-kings"
              const chapter = parts[parts.length - 3];
              const verse = parts[parts.length - 2];
              uniqueBaseReferences.add(`${book.replace(/-/g, '_')}_${chapter}_${verse}`);
            } else {
              console.warn(`Could not derive base reference from docId: ${docId}. Skipping.`);
            }
          });

          if (uniqueBaseReferences.size === 0 && selectedVerseDocIds.length > 0) {
            setError("Could not determine base references for selected verses when 'Apply to all translations' is checked. Please check verse data or unselect the option.");
            setIsLoading(false);
            return;
          }
          uniqueBaseReferences.forEach(baseRef => {
            updates.push({
              baseReference: baseRef,
              tagsToAdd: tagsToAddArray,
              tagsToRemove: tagsToRemoveArray,
            });
          });
        } else {
          selectedVerseDocIds.forEach(docId => {
            updates.push({
              docId: docId,
              tagsToAdd: tagsToAddArray,
              tagsToRemove: tagsToRemoveArray,
            });
          });
        }

        if (updates.length === 0) {
            setError("No valid update operations could be prepared for individual selections.");
            setIsLoading(false);
            return;
        }
        await batchUpdateVerseTags(updates); // Call client-side service
        setSuccessMessage("Tags updated successfully for selected verses!");
      }
      // Common success actions
      // Optionally, refresh the current results or navigate away
      // For example, re-fetch current search to show updated tags:
      if (currentResults.length > 0 && lastSuccessfulSearchParams) {
        // Re-run the search to reflect updated tags
        // Use a temporary state to hold current page to avoid issues with useCallback dependencies
        const currentPageBeforeUpdate = currentPage;
        handleSearch(currentPageBeforeUpdate); 
      }
      // Clear tag input fields after successful update
      setTagsToAddInput('');
      setTagsToRemoveInput('');
      setSelectedVerseDocIds([]); // Clear selections
      setIsSelectAllActive(false); // Reset select all

    } catch (err: any) {
      setError(`Failed to update tags: ${err.message || "Unknown error"}`);
      console.error("Error in handleBatchUpdateTags:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Tag picker for batch add/remove
  const handleTagChipClick = (tagName: string, mode: 'add' | 'remove') => {
    if (mode === 'add') {
      let tags = tagsToAddInput.split(',').map(t => t.trim()).filter(Boolean);
      tags = tags.filter(t => t.toLowerCase() !== tagName.toLowerCase()); // Remove if already present
      tags.push(tagName); // Add to end
      setTagsToAddInput(tags.join(', '));
    } else {
      let tags = tagsToRemoveInput.split(',').map(t => t.trim()).filter(Boolean);
      tags = tags.filter(t => t.toLowerCase() !== tagName.toLowerCase());
      tags.push(tagName);
      setTagsToRemoveInput(tags.join(', '));
    }
  };

  // Inject CSS for user tag chip colors
  useEffect(() => {
    const prev = document.getElementById('user-tag-chip-colors');
    if (prev) prev.remove();
    if (!userTags || userTags.length === 0) return;
    let css = '';
    userTags.forEach(tag => {
      if (tag.color) {
        css += `.user-tag-chip[data-color="${tag.color}"] { background-color: ${tag.color} !important; }\n`;
        css += `.user-tag-chip.remove[data-color="${tag.color}"] { background-color: #ffe0e0 !important; color: #b91c1c !important; }\n`;
      }
    });
    if (css) {
      const style = document.createElement('style');
      style.id = 'user-tag-chip-colors';
      style.innerHTML = css;
      document.head.appendChild(style);
    }
  }, [userTags]);

  // Filtered user tags for display
  const filteredUserTags = userTagFilter.trim().length === 0
    ? userTags
    : userTags.filter(tag => tag.name.toLowerCase().includes(userTagFilter.trim().toLowerCase()));

  // Keyboard navigation for tag suggestions
  const handleUserTagFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredUserTags.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSuggestionIdx(idx => (idx + 1) % filteredUserTags.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSuggestionIdx(idx => (idx - 1 + filteredUserTags.length) % filteredUserTags.length);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && highlightedSuggestionIdx >= 0) {
      // Add the highlighted tag to batch add
      handleTagChipClick(filteredUserTags[highlightedSuggestionIdx].name, 'add');
      setHighlightedSuggestionIdx(-1);
      e.preventDefault();
    }
  };

  // Auto-focus filter input after tag add from suggestion
  const userTagFilterInputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (userTagFilterInputRef.current && highlightedSuggestionIdx === -1) {
      userTagFilterInputRef.current.focus();
    }
  }, [highlightedSuggestionIdx]);

  return (
    <div className="add-tags-layout"> {/* Changed from add-tags-page */}
      <div className="add-tags-container"> {/* Added container */}
        <h1 className="add-tags-title">Add or Remove Tags from Verses</h1>
        
        {/* Wrap the two top-level section divs in a React Fragment */}
        <>
          <div className="search-controls-section"> {/* Section for translations checklist */}
            <h2 className="clickable" onClick={() => setIsTranslationsCollapsed(!isTranslationsCollapsed)}>
              Select Translations {isTranslationsCollapsed ? '+' : '−'}
            </h2>
            {!isTranslationsCollapsed && (
              <>
                {isLoadingTranslations ? (
                  <p className="loading-indicator">Loading translations...</p>
                ) : translationLoadError ? (
                  <p className="add-tags-error">{translationLoadError}</p>
                ) : (
                  <div className="translation-options"> {/* Keep or adapt this based on desired styling */}
                    {availableTranslations.map(translation => (
                      <div key={translation.id} className="translation-option">
                        <input
                          type="checkbox"
                          id={`translation-${translation.id}`}
                          checked={selectedTranslations.includes(translation.id)}
                          onChange={() => handleTranslationSelect(translation.id)}
                          className="atp-checkbox" // Added class for styling
                        />
                        <label htmlFor={`translation-${translation.id}`}>{translation.displayName}</label>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="search-controls-section"> {/* Section for search bar */}
            {/* The h2 and the conditional block are children of the div above and siblings to each other. This is fine. */}
            <h2 className="clickable" onClick={() => setIsSearchCollapsed(!isSearchCollapsed)}>
              Search Verses {isSearchCollapsed ? '+' : '−'}
            </h2>
            {!isSearchCollapsed && (
              <div className="search-bar-and-button"> {/* Wrapper for input and button */}
                <input
                  type="text"
                  className="search-bar-tags" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Enter verse text, reference, or tags"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch(0)}
                />
                <button onClick={() => handleSearch(0)} disabled={isLoading} className="atp-button search-action-btn">
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            )}
          </div>
        </> {/* Closing the fragment that wraps the two sections */}

        {/* Error or success messages */}
        {error && <div className="add-tags-error">{error}</div>} {/* Use specific error class */}
        {successMessage && <div className="add-tags-success">{successMessage}</div>} {/* Use specific success class */}

        {/* Batch Tagging Controls Section - MOVED UP & UNIFIED */}
        {/* This section will now always be visible if search controls are, but button enabled based on results */}
        <div className="batch-tag-controls-section">
          <h2>Batch Tagging</h2>
          {/* User tag picker UI */}
          <div className="user-tag-picker-section">
            <div className="user-tag-picker-label">Your Tags:</div>
            <input
              type="text"
              className="user-tag-filter-input"
              placeholder="Filter tags by name..."
              value={userTagFilter}
              onChange={e => setUserTagFilter(e.target.value)}
              aria-label="Filter your tags"
              onKeyDown={handleUserTagFilterKeyDown}
              ref={userTagFilterInputRef}
            />
            {filteredUserTags.length > 0 && userTagFilter.trim() && (
              <ul className="user-tag-suggestion-list" ref={tagSuggestionListRef}>
                {filteredUserTags.map((tag, idx) => (
                  <li
                    key={tag.id + '-suggestion'}
                    className={
                      'user-tag-suggestion-item' + (idx === highlightedSuggestionIdx ? ' highlighted' : '')
                    }
                    onMouseDown={() => handleTagChipClick(tag.name, 'add')}
                    tabIndex={-1}
                  >
                    {tag.name}
                  </li>
                ))}
              </ul>
            )}
            {isLoadingUserTags ? (
              <span className="loading-indicator">Loading your tags...</span>
            ) : userTagLoadError ? (
              <span className="add-tags-error">{userTagLoadError}</span>
            ) : filteredUserTags.length === 0 ? (
              <span className="no-results-message">No user tags found.</span>
            ) : (
              <div className="user-tag-chips-row">
                {filteredUserTags.map(tag => (
                  <span
                    key={tag.id}
                    className="user-tag-chip"
                    data-color={tag.color || ''}
                    onClick={() => handleTagChipClick(tag.name, 'add')}
                    title={`Add '${tag.name}' to batch add`}
                  >
                    + {tag.name}
                  </span>
                ))}
                {filteredUserTags.map(tag => (
                  <span
                    key={tag.id + '-remove'}
                    className="user-tag-chip remove"
                    data-color={tag.color || ''}
                    onClick={() => handleTagChipClick(tag.name, 'remove')}
                    title={`Add '${tag.name}' to batch remove`}
                  >
                    – {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="tag-inputs-container"> {/* Renamed from batch-tag-inputs-form for clarity */}
            <div className="tag-input-group">
              <label htmlFor="tagsToAddGlobal">Tags to Add (comma-separated):</label>
              <input
                type="text"
                id="tagsToAddGlobal"
                className="batch-tags-add"
                value={tagsToAddInput}
                onChange={e => setTagsToAddInput(e.target.value)}
                placeholder="e.g., faith, hope, love"
              />
            </div>
            <div className="tag-input-group">
              <label htmlFor="tagsToRemoveGlobal">Tags to Remove (comma-separated):</label>
              <input
                type="text"
                id="tagsToRemoveGlobal"
                className="batch-tags-remove"
                value={tagsToRemoveInput}
                onChange={e => setTagsToRemoveInput(e.target.value)}
                placeholder="e.g., old_tag, another_tag"
              />
            </div>
          </div>
          <div className="apply-all-checkbox-container">
            <input
              type="checkbox"
              id="applyToAllTranslationsCheckboxGlobal"
              checked={applyToAllTranslations}
              onChange={e => setApplyToAllTranslations(e.target.checked)}
              className="atp-checkbox"
            />
            <label htmlFor="applyToAllTranslationsCheckboxGlobal">Apply tag changes to all translations of the selected verse(s)/criteria</label>
          </div>

          {/* Select All Results Checkbox - Conditionally shown if there are results */}
          {totalHits > 0 && (
            <div className="select-all-container">
              <input
                type="checkbox"
                id="selectAllResultsCheckboxGlobal"
                checked={isSelectAllActive}
                onChange={(e) => {
                  setIsSelectAllActive(e.target.checked);
                  if (e.target.checked) {
                    setSelectedVerseDocIds([]); // Clear individual selections
                  }
                }}
                className="atp-checkbox"
              />
              <label htmlFor="selectAllResultsCheckboxGlobal">
                Select all {totalHits} results for this batch update
              </label>
            </div>
          )}

          <button 
            onClick={handleBatchUpdateTags} 
            disabled={isLoading || totalHits === 0 || (!isSelectAllActive && selectedVerseDocIds.length === 0) || (!tagsToAddInput.trim() && !tagsToRemoveInput.trim())} 
            className="atp-button batch-action-btn"
          >
            {isLoading ? 'Updating...' : 'Apply Tags to Selected'}
          </button>
        </div>
        
        {/* Results and pagination */}
        {(currentResults.length > 0 || isLoading) && ( // Show results section if loading or results exist
          <div className="results-section-tags">
            <h2>Search Results ({totalHits})</h2>
            {isLoading && currentResults.length === 0 ? ( // Show loading only if no results yet
              <p className="loading-indicator">Loading results...</p>
            ) : (
              <>
                {currentResults.length === 0 && !isLoading ? ( // Ensure !isLoading here
                  <p className="no-results-message">No results found. Try adjusting your search criteria.</p>
                ) : (
                  <div className="results-list-tags">
                    {currentResults.map(verse => (
                      <div key={verse.objectID} className={`result-item-tags ${ (isSelectAllActive || selectedVerseDocIds.includes(verse.objectID)) ? 'selected-item' : ''}`}>
                        <input
                          type="checkbox"
                          id={`verse-${verse.objectID}`}
                          checked={isSelectAllActive || selectedVerseDocIds.includes(verse.objectID)}
                          onChange={() => handleVerseSelectionChange(verse.objectID)}
                          disabled={isSelectAllActive} // Disable individual selection when "Select All" is active
                          className="verse-select-checkbox" 
                        />
                        <label htmlFor={`verse-${verse.objectID}`} className="verse-info"> {/* Added verse-info for label content */}
                          <strong className="verse-reference-tags">{verse.reference} ({verse.translation})</strong> {/* Added translation */}
                          <span className="verse-text-preview-tags">{verse.text}</span>
                          {verse.tags && verse.tags.length > 0 && (
                            <div className="current-tags-preview">
                                <strong>Tags:</strong> {verse.tags.join(', ')}
                            </div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="pagination-tags"> {/* Use existing class */}
                    <button
                      onClick={() => handleSearch(currentPage - 1)}
                      disabled={currentPage === 0 || isLoading}
                      className="atp-button" // Use base button class
                    >
                      Previous
                    </button>
                    <span className="pagination-info">Page {currentPage + 1} of {totalPages}</span>
                    <button
                      onClick={() => handleSearch(currentPage + 1)}
                      disabled={currentPage + 1 >= totalPages || isLoading} // Corrected condition
                      className="atp-button" // Use base button class
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Batch tag update section */}
        {/* THIS ENTIRE SECTION IS NOW REMOVED as its functionality is merged above */}
        {/* <div className="batch-tag-inputs-container"> ... </div> */}
      </div>
    </div>
  );
}
