import React, { useState, useEffect, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { deleteVerseById, updateVerseTextById } from "../services/firebaseService";
import "./UniversalSearchPage.scss";

// REMOVE OLD STATIC TRANSLATION DATA
// const ADD_SCRIPTURE_TRANSLATION_GROUPS = [...];
// const AVAILABLE_TRANSLATIONS = ...;

interface Translation {
  id: string; // e.g., "kjv", "net_bible"
  name: string; // e.g., "kjv", "net"
  displayName: string; // e.g., "KJV", "NET Bible"
}

// Interface for data structure in Algolia (from your cloud function)
interface AlgoliaVerse {
  objectID: string;
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
  translation: string; // Added from previous step
  tags?: string[];
}

// Update Verse interface to match AlgoliaVerse for consistency
interface Verse {
    objectID: string; // Replaced 'id' with 'objectID' to match Algolia data for unique keys.
    book: string;
    chapter: number;
    verse: number;
    text: string;
    tags: string[];
    translation: string;
    reference: string; 
    _highlightResult?: { // Added to support Algolia highlighting
      text?: { value: string };
      reference?: { value: string };
      book?: { value: string };
      // Add other fields if they are configured for highlighting in the backend
    };
}

interface Tag {
    id: string;
    name: string; // This should be the display-friendly name from the collection
    displayName: string; // Add this if you have a separate display name
}

interface PaginationData {
    nbHits: number;
    page: number;
    nbPages: number;
    hitsPerPage: number;
}

// Placeholder for book metadata - this should be more comprehensive and ideally centrally managed
// This is a simplified list for UI demonstration.
const ALL_BOOKS = [
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

const bookOrder: { [key: string]: number } = ALL_BOOKS.reduce((obj, book, index) => {
    obj[book] = index + 1;
    return obj;
}, {} as { [key: string]: number });

const commonBookGroups = {
    "Gospels": ["Matthew", "Mark", "Luke", "John"],
    "Pauline Epistles": ["Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon"],
    "Pentateuch": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"]
};



const UniversalSearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false); // Added for tags loading
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(false); // Added for translations loading
  const [error, setError] = useState<string | null>(null);
  const [selectedTestaments, setSelectedTestaments] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTranslations, setSelectedTranslations] = useState<string[]>([]);
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [translationLoadError, setTranslationLoadError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagLoadError, setTagLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalHits, setTotalHits] = useState(0);  const [currentResults, setCurrentResults] = useState<Verse[]>([]);
  const [sortOrder, setSortOrder] = useState<string>("chronological");   const [userId, setUserId] = useState<string | null>(null);
  const [isExbAuthorized, setIsExbAuthorized] = useState<boolean>(false);
  const [defaultBibleVersion, setDefaultBibleVersion] = useState<string | null>(null);

  // New state for collapsible sections and hits per page
  const [isTranslationsCollapsed, setIsTranslationsCollapsed] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [selectedHitsPerPage, setSelectedHitsPerPage] = useState(50); // Default 50
  const [deletingVerseId, setDeletingVerseId] = useState<string | null>(null);
  const [editingVerseId, setEditingVerseId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const functions = getFunctions();  // Auth state listener with authorization check and default Bible version
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {      setUserId(user ? user.uid : null);
      if (user) {
        // Check authorization and default Bible version in Firestore
        try {
          const userDoc = await getDoc(doc(db, "userProfiles", user.uid));          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            setIsExbAuthorized(userData.exbAuthorized === true);
              // Check for defaultBibleVersion in both root and preferences
            const defaultVersion = userData.defaultBibleVersion || userData.preferences?.defaultBibleVersion || null;
            setDefaultBibleVersion(defaultVersion);
          } else {
            // User document doesn't exist, default to false
            setIsExbAuthorized(false);
            setDefaultBibleVersion(null);
          }
        } catch (error) {
          console.error("UniversalSearch - Error checking user profile:", error);
          setIsExbAuthorized(false);
          setDefaultBibleVersion(null);
        }
      } else {
        setIsExbAuthorized(false);
        setDefaultBibleVersion(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const sortVerses = useCallback((verses: Verse[]) => {
    if (sortOrder === "chronological") {
      return [...verses].sort((a, b) => {
        const bookAOrder = bookOrder[a.book] || 999;
        const bookBOrder = bookOrder[b.book] || 999;
        if (bookAOrder !== bookBOrder) return bookAOrder - bookBOrder;
        if (a.chapter !== b.chapter) return a.chapter - b.chapter;
        return a.verse - b.verse;
      });
    }
    return verses;
  }, [sortOrder]);
  // Fetch initial data (tags and translations)
  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch Tags
      setIsLoadingTags(true);
      try {
        const getAllUniqueTagsCallable = httpsCallable<
          void,
          { uniqueTags: Tag[] }
        >(functions, "getAllUniqueTags");
        const result = await getAllUniqueTagsCallable();
        const fetchedTags = result.data.uniqueTags || []; 
        setAvailableTags(fetchedTags.map(tag => ({ ...tag, displayName: tag.displayName || tag.name })));
      } catch (err: any) {
        console.error("Error fetching tags:", err);
        setTagLoadError(`Failed to load tags: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoadingTags(false);
      }

      // Fetch Translations
      setIsLoadingTranslations(true);
      try {
        const getAllUniqueTranslationsCallable = httpsCallable<
          void,
          { uniqueTranslations: Translation[] }
        >(functions, "getAllUniqueTranslations");        const result = await getAllUniqueTranslationsCallable();
        let fetchedTranslations = result.data.uniqueTranslations || [];
        
        // Filter out restricted translations for non-authorized users
        const filteredTranslations = fetchedTranslations.filter(tr => 
          tr.id.toUpperCase() !== "EXB" || isExbAuthorized
        );
        
        // Sort translations to prioritize user's preferred translation first if available
        const sortedTranslations = [...filteredTranslations].sort((a, b) => {
          // Prioritize user's default Bible version first
          if (defaultBibleVersion) {
            if (a.id.toUpperCase() === defaultBibleVersion.toUpperCase() && 
                b.id.toUpperCase() !== defaultBibleVersion.toUpperCase()) return -1;
            if (b.id.toUpperCase() === defaultBibleVersion.toUpperCase() && 
                a.id.toUpperCase() !== defaultBibleVersion.toUpperCase()) return 1;
          }          return a.displayName.localeCompare(b.displayName);
        });
        
        setAvailableTranslations(sortedTranslations);
      } catch (err: any) {
        console.error("Error fetching translations:", err);
        setTranslationLoadError(`Failed to load translations: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoadingTranslations(false);
      }
    };    fetchInitialData();
  }, [functions, userId, isExbAuthorized, defaultBibleVersion]);  // Set default translation when translations are loaded and user auth is established
  useEffect(() => {
    if (availableTranslations.length > 0) {
      let shouldUpdateSelection = selectedTranslations.length === 0;
      
      // Also update if preferred translation becomes available
      if (defaultBibleVersion && selectedTranslations.length > 0) {
        const hasPreferredSelected = selectedTranslations.some(id => id.toUpperCase() === defaultBibleVersion.toUpperCase());
        const preferredIsAvailable = availableTranslations.some(tr => tr.id.toUpperCase() === defaultBibleVersion.toUpperCase());        if (!hasPreferredSelected && preferredIsAvailable) {
          shouldUpdateSelection = true;
        }
      }
        if (shouldUpdateSelection) {
        let defaultTranslationId = availableTranslations[0].id;
        
        // Use user's preferred translation if available
        if (defaultBibleVersion) {
          const preferredTranslation = availableTranslations.find(tr => tr.id.toUpperCase() === defaultBibleVersion.toUpperCase());
          if (preferredTranslation) {
            defaultTranslationId = preferredTranslation.id;
          }
        }
        
        setSelectedTranslations([defaultTranslationId]);
      }
    }
  }, [availableTranslations, defaultBibleVersion]);

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  const handleSearch = useCallback(async (pageToFetch = 0) => {
    if (selectedTranslations.length === 0) {
      setError("Please select at least one translation to search.");
      setCurrentResults([]);
      setTotalPages(0);
      setTotalHits(0);
      return;
    }
    // Keep existing check or adjust if only translation is enough
    if (!searchQuery.trim() && selectedBooks.length === 0 && selectedTags.length === 0 && selectedTestaments.length === 0 && selectedGroups.length === 0) {
      setError("Please enter a search term or select at least one filter (in addition to translation)." );
      setCurrentResults([]);
      setTotalPages(0);
      setTotalHits(0);
      return;
    }
    setIsLoading(true);
    setError(null);
    // setCurrentResults([]); // Clear previous results for a new search, but not for pagination
    if (pageToFetch === 0) { // Reset results only if it's a new search (page 0)
      setCurrentResults([]);
      setTotalHits(0);
      setTotalPages(0);
      setIsTranslationsCollapsed(true); // Auto-collapse on new search
      setIsFiltersCollapsed(true);     // Auto-collapse on new search
    }

    try {
      const universalScriptureSearch = httpsCallable<
        any,
        // Update the expected return type to match the flat structure
        { results: Verse[]; nbHits: number; page: number; nbPages: number; hitsPerPage: number }
      >(functions, 'universalScriptureSearch');
      
      const searchParams: any = {
        query: searchQuery,
        translations: selectedTranslations,
        page: pageToFetch,
        hitsPerPage: selectedHitsPerPage, // Use state variable for hitsPerPage
      };      if (selectedTestaments.length > 0) searchParams.testaments = selectedTestaments;
      if (selectedGroups.length > 0) searchParams.commonGroups = selectedGroups; // Ensure backend expects commonGroups
      if (selectedBooks.length > 0) searchParams.books = selectedBooks;
      if (selectedTags.length > 0) searchParams.tags = selectedTags;

      const response = await universalScriptureSearch(searchParams);
      // Adjust destructuring to match the flat structure from the function
      const { results, nbHits, page, nbPages } = response.data as { results: Verse[]; nbHits: number; page: number; nbPages: number; hitsPerPage: number };

      if (results && results.length > 0) {
        const sortedResults = sortVerses(results);
        setCurrentResults(pageToFetch === 0 ? sortedResults : prev => sortVerses([...prev, ...sortedResults]));
        // Use directly destructured pagination fields
        setTotalHits(nbHits);
        setCurrentPage(page);
        setTotalPages(nbPages);
      } else {
        setCurrentResults([]);
        setTotalHits(0);
        setCurrentPage(0);
        setTotalPages(0);
        setError("No results match your criteria.");
      }

    } catch (e: any) {
      setError(e.message || "Search failed. Please try again.");
      console.error("Error calling Firebase Function:", e);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedTranslations, selectedTestaments, selectedGroups, selectedBooks, selectedTags, functions, sortVerses, selectedHitsPerPage]); // Added selectedHitsPerPage

  const handleBookClick = (book: string) => {
    toggleFilter(setSelectedBooks, book);
  };

  const handleTagClick = (tagId: string) => { // Changed parameter to tagId
    toggleFilter(setSelectedTags, tagId);
  };

  const handleTranslationSelect = (translationId: string) => {
    toggleFilter(setSelectedTranslations, translationId);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTestaments([]);
    setSelectedGroups([]);
    setSelectedBooks([]);
    setSelectedTags([]);
    // setSelectedTranslations(AVAILABLE_TRANSLATIONS.length > 0 ? [AVAILABLE_TRANSLATIONS[0].id] : []); // Reset to default
    if (availableTranslations.length > 0) {
      setSelectedTranslations([availableTranslations[0].id]);
    } else {
      setSelectedTranslations([]);
    }
    setCurrentResults([]);
    setError(null);
    setCurrentPage(0);
    setTotalPages(0);
    setTotalHits(0);
    setSelectedHitsPerPage(50); // Reset hits per page
    setIsTranslationsCollapsed(false); // Expand on clear
    setIsFiltersCollapsed(false);     // Expand on clear
  };

  // Delete verse handler
  const handleDeleteVerse = async (objectID: string) => {
    if (!window.confirm("Are you sure you want to delete this verse? This cannot be undone.")) return;
    setDeletingVerseId(objectID);
    try {
      await deleteVerseById(objectID);
      setCurrentResults(prev => prev.filter(v => v.objectID !== objectID));
      setTotalHits(h => h - 1);
    } catch (err: any) {
      alert("Failed to delete verse: " + (err.message || err));
    } finally {
      setDeletingVerseId(null);
    }
  };

  // Edit verse handler
  const handleEditVerse = (verse: Verse) => {
    setEditingVerseId(verse.objectID);
    setEditText(verse.text);
  };
  const handleCancelEdit = () => {
    setEditingVerseId(null);
    setEditText("");
  };
  const handleSaveEdit = async (verse: Verse) => {
    setSavingEdit(true);
    try {
      await updateVerseTextById(verse.objectID, editText);
      setCurrentResults(prev => prev.map(v => v.objectID === verse.objectID ? { ...v, text: editText } : v));
      setEditingVerseId(null);
      setEditText("");
    } catch (err: any) {
      alert("Failed to update verse: " + (err.message || err));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="universal-search-page">
      <div className="universal-search-content">
        <h1 className="universal-search-title">Universal Scripture Search</h1>

        <div className="search-controls-container">
          <div className="search-bar-wrapper">
            <input
              type="text"
              className="search-bar"
              placeholder="Search verse text, reference (e.g., John 3:16), or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch(0)} // Search page 0 on new search
            />
          </div>
          <button onClick={() => handleSearch(0)} disabled={isLoading || selectedTranslations.length === 0} className="search-button">
            {isLoading && currentPage === 0 ? 'Searching...' : 'Search'}
          </button>
          <button onClick={clearFilters} disabled={isLoading} className="clear-filters-btn">
            Clear Filters
          </button>
          <div className="hits-per-page-selector">
            <label htmlFor="hitsPerPage">Results:</label>
            <select
              id="hitsPerPage"
              value={selectedHitsPerPage}
              onChange={(e) => {
                setSelectedHitsPerPage(Number(e.target.value));
                // Optionally, trigger a new search immediately when this changes
                // if (currentResults.length > 0) handleSearch(0); 
              }}
              className="hits-per-page-dropdown" // Add a class for styling if needed
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={1000}>All (Max 1000)</option> {/* Algolia's default max is 1000 */}
            </select>
          </div>
        </div>

        <div className="translations-filter">
          <h3 className="filter-title clickable" onClick={() => setIsTranslationsCollapsed(!isTranslationsCollapsed)}>
            Translations (Required) {isTranslationsCollapsed ? '+' : '−'}
          </h3>
          {!isTranslationsCollapsed && (
            <>
              {translationLoadError && <p className="search-error">{translationLoadError}</p>}
              {isLoadingTranslations ? <p className="loading-indicator">Loading translations...</p> : (
                <div className="translation-buttons">
                  {availableTranslations.map((translation) => (
                    <button
                      key={translation.id}
                      onClick={() => handleTranslationSelect(translation.id)}
                      className={`translation-btn ${selectedTranslations.includes(translation.id) ? "selected" : ""}`}
                      title={translation.displayName}
                    >
                      {translation.name.toUpperCase()} 
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="search-error">{error}</p>}

        <div className="filter-section">
          <h3 className="filter-title clickable" onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)} >
            Filters {isFiltersCollapsed ? '+' : '−'}
          </h3>
          {!isFiltersCollapsed && (
            <div className="filter-grid-layout">
              <div className="filter-column">
                <div className="filter-group">
                  <strong>Testament:</strong>
                  <label><input type="checkbox" onChange={() => toggleFilter(setSelectedTestaments, "Old Testament")} checked={selectedTestaments.includes("Old Testament")} /> Old Testament</label>
                  <label><input type="checkbox" onChange={() => toggleFilter(setSelectedTestaments, "New Testament")} checked={selectedTestaments.includes("New Testament")} /> New Testament</label>
                </div>
                <div className="filter-group">
                  <strong>Common Groups:</strong>
                  {Object.entries(commonBookGroups).map(([groupName]) => (
                    <label key={groupName}>
                      <input 
                        type="checkbox" 
                        onChange={() => toggleFilter(setSelectedGroups, groupName)} 
                        checked={selectedGroups.includes(groupName)} 
                      /> {groupName}
                    </label>
                  ))}
                </div>
              </div>
              <div className="filter-column">
                <div className="filter-group">
                  <strong>Books:</strong>
                  <ul className="filter-scrollable-list">
                    {ALL_BOOKS.map(book => (
                      <li 
                        key={book} 
                        onClick={() => handleBookClick(book)} 
                        className={selectedBooks.includes(book) ? 'selected' : ''}
                      >
                        {book}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="filter-group">
                  <strong>Tags:</strong>
                  {tagLoadError ? (
                    <p className="search-error">{tagLoadError}</p>
                  ) : isLoadingTags ? <p className="loading-indicator">Loading tags...</p> : availableTags.length > 0 ? (
                    <ul className="filter-scrollable-list">
                      {availableTags.map(tag => (
                        <li 
                          key={tag.id} 
                          onClick={() => handleTagClick(tag.id)}
                          className={selectedTags.includes(tag.id) ? 'selected' : ''}
                        >
                          {tag.displayName} {/* Use displayName for tags */}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-results-message">No tags available.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {isLoading && currentResults.length === 0 && <div className="loading-indicator">Loading results...</div>}
        {!isLoading && currentResults.length === 0 && !error && (searchQuery || selectedBooks.length > 0 || selectedTags.length > 0 || selectedTestaments.length > 0 || selectedGroups.length > 0) && <p className="no-results-message">No results found. Try adjusting your search or filters.</p>}
        {!isLoading && currentResults.length === 0 && !error && !searchQuery && selectedBooks.length === 0 && selectedTags.length === 0 && selectedTestaments.length === 0 && selectedGroups.length === 0 && selectedTranslations.length > 0 && <p className="no-results-message">Enter a search term or select filters to begin.</p>}
        
        {currentResults.length > 0 && (
          <>
            <div className="results-title-with-icon">
              <h2 className="results-title" style={{ display: 'inline', verticalAlign: 'middle', margin: 0 }}>
                Search Results ({totalHits})
              </h2>
              <img src="/Algolia-mark-blue.png" alt="Results Icon" style={{ height: 32, width: 32, marginLeft: 10, verticalAlign: 'middle', display: 'inline-block' }} />
            </div>
            <ul className="search-results-list">
              {currentResults.map((verse) => (
                <li key={verse.objectID} className="search-result-item">
                  {/* Removed logo image from each result */}
                  <h3 
                    className="result-reference" 
                    dangerouslySetInnerHTML={{
                      __html: verse._highlightResult?.reference?.value || `${verse.reference} (${verse.translation})`
                    }}
                    style={{ display: 'inline', marginLeft: 0 }}
                  />
                  {editingVerseId === verse.objectID ? (
                    <>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        style={{ width: '100%', marginBottom: 8 }}
                        disabled={savingEdit}
                        placeholder="Edit verse text"
                        title="Edit verse text"
                      />
                      <button onClick={() => handleSaveEdit(verse)} disabled={savingEdit} style={{ marginRight: 8 }}>
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={handleCancelEdit} disabled={savingEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <p 
                        className="result-text" 
                        dangerouslySetInnerHTML={{
                          __html: verse._highlightResult?.text?.value || verse.text
                        }}
                      />
                      <button
                        className="edit-verse-btn"
                        onClick={() => handleEditVerse(verse)}
                        style={{ marginLeft: 8, color: '#e0c97f', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Edit this verse text"
                      >
                        Edit
                      </button>
                    </>
                  )}
                  {verse.tags && verse.tags.length > 0 && (
                    <div className="result-tags">
                      <strong>Tags:</strong> {verse.tags.join(', ')}
                    </div>
                  )}
                  <button
                    className="delete-verse-btn"
                    onClick={() => handleDeleteVerse(verse.objectID)}
                    disabled={deletingVerseId === verse.objectID}
                    style={{ marginLeft: 12, color: '#ff4040', background: 'none', border: 'none', cursor: 'pointer' }}
                    title="Delete this verse from Firestore"
                  >
                    {deletingVerseId === verse.objectID ? 'Deleting...' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="pagination-container">
                <button
                  onClick={() => handleSearch(currentPage - 1)}
                  disabled={currentPage === 0 || isLoading}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="pagination-info">Page {currentPage + 1} of {totalPages}</span>
                <button
                  onClick={() => handleSearch(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1 || isLoading}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UniversalSearchPage;
