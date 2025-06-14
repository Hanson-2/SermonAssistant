import React, { useState, useEffect, useCallback, useRef } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { deleteVerseById, updateVerseTextById, getUserProfile } from "../services/firebaseService";
import { auth } from "../lib/firebase";
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
  const [userDefaultTranslation, setUserDefaultTranslation] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagLoadError, setTagLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);  const [totalHits, setTotalHits] = useState(0);
  const [currentResults, setCurrentResults] = useState<Verse[]>([]);
  // Removed sortOrder state - we always sort chronologically now
  
  // New state for collapsible sections and hits per page
  const [isTranslationsCollapsed, setIsTranslationsCollapsed] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [selectedHitsPerPage, setSelectedHitsPerPage] = useState(50); // Default 50
  const [deletingVerseId, setDeletingVerseId] = useState<string | null>(null);
  const [editingVerseId, setEditingVerseId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const translationsLoadedRef = useRef(false);

  const functions = getFunctions();

  // Auth listener to get current user ID for EXB restriction
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      const newUserId = user ? user.uid : null;
      console.log('[UniversalSearch] Auth state changed. User:', user?.email, 'UID:', newUserId);
      setUserId(newUserId);
      setAuthLoaded(true); // Mark auth as loaded regardless of whether user is signed in
      translationsLoadedRef.current = false; // Reset to allow re-fetching with new auth state
    });
    return () => unsubscribe();
  }, []);
  const sortVerses = useCallback((verses: Verse[]) => {
    // ALWAYS sort chronologically - removed sortOrder check for guaranteed chronological order
    return [...verses].sort((a, b) => {
      // Primary sort: Book order (chronological order in Bible)
      const bookAOrder = bookOrder[a.book] || 999;
      const bookBOrder = bookOrder[b.book] || 999;
      if (bookAOrder !== bookBOrder) return bookAOrder - bookBOrder;
      
      // Secondary sort: Chapter number
      if (a.chapter !== b.chapter) return a.chapter - b.chapter;
      
      // Tertiary sort: Verse number
      return a.verse - b.verse;
    });
  }, []); // Removed sortOrder dependency since we always sort chronologically

  // Helper function to group verses by book for sectioned display
  const groupVersesByBook = useCallback((verses: Verse[]) => {
    const grouped: { [book: string]: Verse[] } = {};
    
    verses.forEach(verse => {
      if (!grouped[verse.book]) {
        grouped[verse.book] = [];
      }
      grouped[verse.book].push(verse);
    });
    
    // Sort the books themselves chronologically and return as array of [book, verses] pairs
    return Object.entries(grouped).sort(([bookA], [bookB]) => {
      const orderA = bookOrder[bookA] || 999;
      const orderB = bookOrder[bookB] || 999;
      return orderA - orderB;
    });
  }, []);

  // Fetch translations and tags when auth state loads
  useEffect(() => {
    const fetchInitialData = async () => {
      // Don't fetch until auth state has loaded
      if (!authLoaded) {
        console.log('[UniversalSearch] Waiting for auth to load before fetching translations...');
        return;
      }
      
      // Don't fetch if we've already loaded translations (unless auth changed)
      if (translationsLoadedRef.current && availableTranslations.length > 0) {
        console.log('[UniversalSearch] Translations already loaded, skipping fetch...');
        return;
      }
      
      console.log('[UniversalSearch] Fetching translations with userId:', userId, 'authLoaded:', authLoaded);
      
      // Fetch Tags
      setIsLoadingTags(true); // Set loading true for tags
      try {
        const getAllUniqueTagsCallable = httpsCallable<
          void,
          { uniqueTags: Tag[] } // Updated to expect uniqueTags
        >(functions, "getAllUniqueTags");
        const result = await getAllUniqueTagsCallable();
        // Ensure result.data.uniqueTags is used, matching the backend
        const fetchedTags = result.data.uniqueTags || []; 
        setAvailableTags(fetchedTags.map(tag => ({ ...tag, displayName: tag.displayName || tag.name })));
      } catch (err: any) {
        console.error("Error fetching tags:", err);
        setTagLoadError(`Failed to load tags: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoadingTags(false); // Set loading false for tags
      }      // Fetch Translations with intelligent prioritization
      setIsLoadingTranslations(true);
      try {        // First, get user's preferred translation from Firestore profile
        let userDefaultTranslation: string | null = null;
        try {
          console.log('[UniversalSearch] Fetching user profile for default translation...');          const userProfile = await getUserProfile();
          userDefaultTranslation = userProfile?.preferences?.defaultBibleVersion || null;
          console.log('[UniversalSearch] User default translation from Firestore:', userDefaultTranslation);
          setUserDefaultTranslation(userDefaultTranslation); // Store in state for UI display
        } catch (profileError) {
          console.error('[UniversalSearch] Error fetching user profile:', profileError);
          userDefaultTranslation = localStorage.getItem('defaultTranslation') || localStorage.getItem('defaultBibleVersion');
          console.log('[UniversalSearch] Fallback to localStorage default translation:', userDefaultTranslation);
          setUserDefaultTranslation(userDefaultTranslation); // Store in state for UI display
        }

        const getAllUniqueTranslationsCallable = httpsCallable<
          void,
          { uniqueTranslations: Translation[] }
        >(functions, "getAllUniqueTranslations");
        const result = await getAllUniqueTranslationsCallable();
        const fetchedTranslations = result.data.uniqueTranslations || [];
        
        console.log('[UniversalSearch] Raw fetched translations:', fetchedTranslations.map(t => `${t.id}|${t.name}|${t.displayName}`));
        
        // Deduplicate translations by ID (case-insensitive)
        const deduplicatedTranslations = fetchedTranslations.reduce((acc: Translation[], current) => {
          const exists = acc.find(t => t.id.toLowerCase() === current.id.toLowerCase());
          if (!exists) {
            acc.push(current);
          } else {
            console.log('[UniversalSearch] Skipping duplicate translation:', current.id);
          }
          return acc;
        }, []);
          console.log('[UniversalSearch] Deduplicated translations:', deduplicatedTranslations.map(t => `${t.id}|${t.name}|${t.displayName}`));
          // Filter out EXB translation unless user is authorized
        const expectedUserId = "89UdurybrVSwbPmp4boEMeYdVzk1";
        console.log('[UniversalSearch] Before EXB filtering - userId:', userId, 'expected:', expectedUserId);
        console.log('[UniversalSearch] User ID match:', userId === expectedUserId, 'userId type:', typeof userId, 'length:', userId?.length);
        console.log('[UniversalSearch] EXB translations before filter:', deduplicatedTranslations.filter(t => t.id.toUpperCase() === "EXB"));
        
        const filteredTranslations = deduplicatedTranslations.filter((translation) => {
          const isEXB = translation.id.toUpperCase() === "EXB";
          const isAuthorized = userId === expectedUserId;
          const shouldInclude = !isEXB || isAuthorized;
          
          if (isEXB) {
            console.log(`[UniversalSearch] EXB check: isEXB=${isEXB}, userId="${userId}", expectedUserId="${expectedUserId}", isAuthorized=${isAuthorized}, shouldInclude=${shouldInclude}`);
          }
          
          return shouldInclude;
        });
        
        console.log('[UniversalSearch] Filtered translations (EXB restricted):', filteredTranslations.map(t => `${t.id} (${t.displayName})`));
        console.log('[UniversalSearch] EXB translations after filter:', filteredTranslations.filter(t => t.id.toUpperCase() === "EXB"));
        
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
          
          console.log('[UniversalSearch] Prioritizing translations with user default:', userDefault);
          console.log('[UniversalSearch] User preferred translations from localStorage:', userPreferredTranslations);
          
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
          });        };        const prioritizedTranslations = prioritizeTranslations(filteredTranslations, userDefaultTranslation);
        console.log('[UniversalSearch] Prioritized translations:', prioritizedTranslations.map(t => `${t.id} (${t.displayName})`));
        
        // Final deduplication to ensure no duplicate keys in React render
        const finalTranslations = prioritizedTranslations.reduce((acc: Translation[], current) => {
          const exists = acc.find(t => t.id === current.id);
          if (!exists) {
            acc.push(current);
          } else {
            console.warn('[UniversalSearch] Final deduplication - removing duplicate:', current.id);
          }
          return acc;
        }, []);
          console.log('[UniversalSearch] Final translations after deduplication:', finalTranslations.map(t => t.id));
        
        // Verify no duplicates before setting state
        const duplicateIds = finalTranslations.map(t => t.id).filter((id, index, arr) => arr.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
          console.error('[UniversalSearch] DUPLICATE IDs DETECTED:', duplicateIds);
        }
          setAvailableTranslations(finalTranslations);
        translationsLoadedRef.current = true; // Mark as loaded to prevent re-fetching

        // Immediately set the default translation when translations are loaded
        if (prioritizedTranslations.length > 0) {
          // Priority: 1) User's Firestore default, 2) localStorage default, 3) first prioritized translation
          let defaultTranslation = userDefaultTranslation;
          
          // Verify the user's default exists in available translations (case-insensitive)
          if (defaultTranslation && !prioritizedTranslations.find(t => t.id.toLowerCase() === defaultTranslation!.toLowerCase())) {
            console.log('[UniversalSearch] User default translation not available, falling back to localStorage...');
            defaultTranslation = localStorage.getItem('defaultTranslation');
          }
          
          // Final fallback to first available translation (use consistent case-insensitive comparison)
          if (!defaultTranslation || !prioritizedTranslations.find(t => t.id.toLowerCase() === defaultTranslation!.toLowerCase())) {
            defaultTranslation = prioritizedTranslations[0].id;
            console.log('[UniversalSearch] Using first prioritized translation as default:', defaultTranslation);
          }
          
          console.log('[UniversalSearch] Setting initial default translation:', defaultTranslation);
          setSelectedTranslations([defaultTranslation]);
          
          // Save this as user's preference for future sessions (localStorage backup)
          localStorage.setItem('defaultTranslation', defaultTranslation);
        }
        
      } catch (err: any) {        console.error("Error fetching translations:", err);
        setTranslationLoadError(`Failed to load translations: ${err.message || "Unknown error"}`);
      } finally {
        setIsLoadingTranslations(false);
      }
    };
    
    fetchInitialData();
  }, [functions, userId, authLoaded]); // Re-run when userId changes (auth loads) to get user's default translation
  // Additional effect to ensure default translation is maintained
  useEffect(() => {
    // If no translations are selected but we have available translations and auth is loaded, set the default
    if (availableTranslations.length > 0 && selectedTranslations.length === 0 && authLoaded) {
      const defaultTranslation = getUserDefaultTranslation();
      if (defaultTranslation) {
        console.log('[UniversalSearch] Restoring default translation on load:', defaultTranslation);
        setSelectedTranslations([defaultTranslation]);
      }
    }
  }, [availableTranslations, selectedTranslations.length, authLoaded, userDefaultTranslation]);
  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  // Helper function to get the user's default translation
  const getUserDefaultTranslation = (): string | null => {
    // Priority: 1) User's Firestore default, 2) localStorage default, 3) first prioritized translation
    let defaultTranslation = userDefaultTranslation;
    
    // Verify the user's default exists in available translations (case-insensitive)
    if (defaultTranslation && !availableTranslations.find(t => t.id.toLowerCase() === defaultTranslation!.toLowerCase())) {
      defaultTranslation = localStorage.getItem('defaultTranslation');
    }
    
    // Final fallback to first available translation
    if (!defaultTranslation || !availableTranslations.find(t => t.id.toLowerCase() === defaultTranslation!.toLowerCase())) {
      defaultTranslation = availableTranslations.length > 0 ? availableTranslations[0].id : null;
    }
    
    return defaultTranslation;
  };

  // Enhanced translation toggle with preference saving
  const toggleTranslation = (translationId: string) => {
    setSelectedTranslations(prev => {
      const newSelection = prev.includes(translationId) 
        ? prev.filter(id => id !== translationId) 
        : [...prev, translationId];
      
      // Save user's translation preferences
      localStorage.setItem('preferredTranslations', JSON.stringify(newSelection));
      
      // If this is the only selected translation, make it the default
      if (newSelection.length === 1) {
        localStorage.setItem('defaultTranslation', newSelection[0]);
      }
      
      return newSelection;
    });
  };

  const handleSearch = useCallback(async (pageToFetch = 0) => {
    if (selectedTranslations.length === 0) {
      setError("Please select at least one translation to search.");
      setCurrentResults([]);
      setTotalPages(0);
      setTotalHits(0);
      return;
    }    // Check if we have any meaningful search criteria
    const hasGroupFilters = selectedGroups.length > 0;
    const hasIndividualBookFilters = selectedBooks.length > 0;
    const hasBookFilters = hasGroupFilters || hasIndividualBookFilters;
    
    if (!searchQuery.trim() && !hasBookFilters && selectedTags.length === 0 && selectedTestaments.length === 0) {
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
      >(functions, 'universalScriptureSearch');      // Intelligent hits per page based on search type
      let intelligentHitsPerPage = selectedHitsPerPage;
      
      // If user is filtering by specific books (either individual books or groups), 
      // they likely want to see all results from those books
      if (hasBookFilters && !searchQuery.trim()) {
        // When filtering by books without a search term, use max results
        intelligentHitsPerPage = 1000;
        console.log('[UniversalSearch] Book-only filter detected, using max results (1000)');
      } else if (hasBookFilters && searchQuery.trim()) {
        // When searching within specific books, use a higher limit
        intelligentHitsPerPage = Math.max(selectedHitsPerPage, 200);
        console.log('[UniversalSearch] Book filter + search term detected, using enhanced limit:', intelligentHitsPerPage);
      }

      const searchParams: any = {
        query: searchQuery,
        translations: selectedTranslations,
        page: pageToFetch,
        hitsPerPage: intelligentHitsPerPage,
      };
      
      // Expand selected groups into individual books and combine with selected books
      let allSelectedBooks = [...selectedBooks];
      if (selectedGroups.length > 0) {
        selectedGroups.forEach(groupName => {
          const booksInGroup = commonBookGroups[groupName as keyof typeof commonBookGroups];
          if (booksInGroup) {
            allSelectedBooks = [...allSelectedBooks, ...booksInGroup];
          }
        });
        // Remove duplicates
        allSelectedBooks = [...new Set(allSelectedBooks)];
      }
      
      if (selectedTestaments.length > 0) searchParams.testaments = selectedTestaments;
      if (allSelectedBooks.length > 0) searchParams.books = allSelectedBooks; // Use expanded book list
      if (selectedTags.length > 0) searchParams.tags = selectedTags;

      console.log("Calling Firebase Function with params:", searchParams);
      console.log("Selected groups:", selectedGroups);
      console.log("Expanded books from groups:", allSelectedBooks);

      const response = await universalScriptureSearch(searchParams);
      // Adjust destructuring to match the flat structure from the function
      const { results, nbHits, page, nbPages } = response.data as { results: Verse[]; nbHits: number; page: number; nbPages: number; hitsPerPage: number };

      console.log("Received response from Firebase Function:", response.data);

      if (results && results.length > 0) {
        const sortedResults = sortVerses(results);
        setCurrentResults(pageToFetch === 0
          ? sortedResults
          : prev => [...prev, ...sortedResults] // Assume backend returns sorted results for each page
        );
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
    toggleTranslation(translationId);
  };  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTestaments([]);
    setSelectedGroups([]);
    setSelectedBooks([]);
    setSelectedTags([]);
    
    // Reset to user's default translation
    const defaultTranslation = getUserDefaultTranslation();
    if (defaultTranslation) {
      setSelectedTranslations([defaultTranslation]);
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

  // Helper function to detect if search query matches a book name
  const detectBookNameSearch = useCallback((query: string): string | null => {
    if (!query.trim()) return null;
    
    const queryLower = query.toLowerCase().trim();
    const matchedBook = ALL_BOOKS.find(book => 
      book.toLowerCase() === queryLower || 
      book.toLowerCase().includes(queryLower) ||
      queryLower.includes(book.toLowerCase())
    );
    
    return matchedBook || null;
  }, []);

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
          </button>          <div className="hits-per-page-selector">
            <label htmlFor="hitsPerPage">Results per page:</label>
            <select
              id="hitsPerPage"
              value={selectedHitsPerPage}
              onChange={(e) => {
                setSelectedHitsPerPage(Number(e.target.value));
                // Trigger a new search immediately when this changes
                if (currentResults.length > 0) {
                  console.log('[UniversalSearch] Results limit changed, re-running search...');
                  handleSearch(0);
                }
              }}
              className="hits-per-page-dropdown"
              title="Change how many results are shown per page. Use 'All' for complete book searches."
            >
              <option value={25}>25</option>
              <option value={50}>50 (Default)</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>All (Max 1000)</option>
            </select>
            <div className="hits-per-page-hint" style={{
              fontSize: '0.8rem',
              color: '#cccccc',
              marginTop: '0.3rem',
              fontStyle: 'italic'
            }}>
              💡 Use "All" when searching entire books
            </div>
          </div>
        </div>

        <div className="translations-filter">
          <h3 className="filter-title clickable" onClick={() => setIsTranslationsCollapsed(!isTranslationsCollapsed)}>
            Translations {isTranslationsCollapsed ? '+' : '−'}
          </h3>
          {!isTranslationsCollapsed && (            <>
              {translationLoadError && <p className="search-error">{translationLoadError}</p>}
              {isLoadingTranslations ? <p className="loading-indicator">Loading translations...</p> : (
                <>
                  <p className="translation-help-text">Translations are ordered by your preferences and popularity. Your selections are saved for future sessions.</p>
                  <div className="translation-buttons">{availableTranslations.map((translation, index) => {
                    const isUserDefault = userDefaultTranslation && translation.id.toLowerCase() === userDefaultTranslation.toLowerCase();
                    return (
                      <button
                        key={`translation-${translation.id}-${index}`}
                        onClick={() => handleTranslationSelect(translation.id)}
                        className={`translation-btn ${selectedTranslations.includes(translation.id) ? "selected" : ""} ${isUserDefault ? "user-default" : ""}`}
                        title={`${translation.displayName}${isUserDefault ? ' (Your Default)' : ''}`}
                      >
                        {translation.name.toUpperCase()} 
                        {isUserDefault && <span className="default-indicator">★</span>}
                      </button>
                    );
                  })}
                  </div>
                </>
              )}
            </>
          )}
        </div>        {error && <p className="search-error">{error}</p>}
        
        {/* Smart suggestion for book name searches */}
        {searchQuery && selectedBooks.length === 0 && selectedGroups.length === 0 && detectBookNameSearch(searchQuery) && (
          <div className="book-search-suggestion" style={{
            margin: '1rem 0',
            padding: '1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '0.5rem',
            color: '#60a5fa'
          }}>
            <strong>💡 Smart Suggestion:</strong> It looks like you're searching for "{detectBookNameSearch(searchQuery)}". 
            For better results, try using the <strong>Books filter</strong> below instead of the search box, 
            or <button 
              onClick={() => {
                setSelectedBooks([detectBookNameSearch(searchQuery)!]);
                setSearchQuery('');
                setSelectedHitsPerPage(1000);
              }}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#ffd700', 
                textDecoration: 'underline', 
                cursor: 'pointer',
                fontSize: 'inherit'
              }}
            >
              click here to auto-select it
            </button>.
          </div>
        )}

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
                </div>                <div className="filter-group">
                  <strong>Common Groups:</strong>
                  {Object.entries(commonBookGroups).map(([groupName, books]) => (
                    <div key={groupName} className="group-filter-item">
                      <label>
                        <input 
                          type="checkbox" 
                          onChange={() => toggleFilter(setSelectedGroups, groupName)} 
                          checked={selectedGroups.includes(groupName)} 
                        /> {groupName}
                      </label>
                      {selectedGroups.includes(groupName) && (
                        <div className="group-books-preview">
                          <small>Includes: {books.join(', ')}</small>
                        </div>
                      )}
                    </div>
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

        {isLoading && currentResults.length === 0 && <div className="loading-indicator">Loading results...</div>}        {!isLoading && currentResults.length === 0 && !error && (searchQuery || selectedBooks.length > 0 || selectedTags.length > 0 || selectedTestaments.length > 0 || selectedGroups.length > 0) && <p className="no-results-message">No results found. Try adjusting your search or filters.</p>}
        {!isLoading && currentResults.length === 0 && !error && !searchQuery && selectedBooks.length === 0 && selectedTags.length === 0 && selectedTestaments.length === 0 && selectedGroups.length === 0 && selectedTranslations.length > 0 && <p className="no-results-message">Enter a search term or select filters to begin.</p>}
          {currentResults.length > 0 && (
          <>            <div className="results-title-with-icon">
              <h2 className="results-title" style={{ display: 'inline', verticalAlign: 'middle', margin: 0 }}>
                Search Results ({totalHits})
              </h2>
              <img src="/Algolia-mark-blue.png" alt="Results Icon" style={{ height: 32, width: 32, marginLeft: 10, verticalAlign: 'middle', display: 'inline-block' }} />
              
              {/* Result limit notification */}
              {totalHits > currentResults.length && (
                <div className="result-limit-notice" style={{ 
                  marginTop: '0.5rem', 
                  padding: '0.5rem 1rem', 
                  background: 'rgba(255, 165, 0, 0.1)', 
                  border: '1px solid rgba(255, 165, 0, 0.3)', 
                  borderRadius: '0.5rem',
                  color: '#ffa500',
                  fontSize: '0.9rem'
                }}>
                  📋 Showing {currentResults.length} of {totalHits} results. 
                  {totalPages > 1 && ` Use pagination below or `}
                  <button 
                    onClick={() => setSelectedHitsPerPage(1000)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#ffd700', 
                      textDecoration: 'underline', 
                      cursor: 'pointer',
                      fontSize: 'inherit'
                    }}
                  >
                    change results limit
                  </button> to see more.
                </div>
              )}
            </div>
            
            {/* Enhanced results display with book sectioning */}
            <div className="search-results-sectioned">
              {groupVersesByBook(currentResults).map(([bookName, verses]) => (
                <div key={bookName} className="book-section">
                  <h3 className="book-section-title gradient-gold-text">
                    📖 {bookName} ({verses.length} verse{verses.length === 1 ? '' : 's'})
                  </h3>
                  <ul className="search-results-list book-verses">
                    {verses.map((verse) => (
                      <li key={verse.objectID} className="search-result-item">
                        <h4 
                          className="result-reference" 
                          dangerouslySetInnerHTML={{
                            __html: verse._highlightResult?.reference?.value || `${verse.reference} (${verse.translation})`
                          }}
                        />                        {editingVerseId === verse.objectID ? (
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
                </div>
              ))}
            </div>
            
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
