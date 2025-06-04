import React, { useState, useEffect } from 'react';
import { 
  advancedSermonSearchFunc, 
  getSermonCategoriesFunc,
  getSermonSeriesFunc,
  fetchSermons 
} from '../services/firebaseService';
import { AdvancedSearchCriteria, Sermon, SermonCategory, SermonSeries } from '../services/firebaseService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import SermonCard from '../components/SermonCard/SermonCard';
import './AdvancedSearchPage.scss';

// Tag interface to match Firebase function response
interface Tag {
  id: string;
  name: string;
  displayName: string;
}

const AdvancedSearchPage: React.FC = () => {
  const [searchCriteria, setSearchCriteria] = useState<AdvancedSearchCriteria>({
    query: '',
    tags: [],
    books: []
  });
    const [searchResults, setSearchResults] = useState<{
    sermons: Sermon[];
    total: number;
    hasMore: boolean;
  }>({ sermons: [], total: 0, hasMore: false });
  const [categories, setCategories] = useState<SermonCategory[]>([]);
  const [series, setSeries] = useState<SermonSeries[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form input states
  const [textQuery, setTextQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');  const [endDate, setEndDate] = useState('');
  const [newBook, setNewBook] = useState('');

  // Available options
  const bibleBooks = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
    '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
    'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
    'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
    'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
    '1 John', '2 John', '3 John', 'Jude', 'Revelation'  ];

  useEffect(() => {
    loadInitialData();
    fetchTagsFromFirestore();
  }, []);

  const fetchTagsFromFirestore = async () => {
    setIsLoadingTags(true);
    try {
      const functions = getFunctions();
      const getAllUniqueTagsCallable = httpsCallable<void, { uniqueTags: Tag[] }>(
        functions, 
        'getAllUniqueTags'
      );
      const result = await getAllUniqueTagsCallable();
      const fetchedTags = result.data.uniqueTags || [];
      setAvailableTags(fetchedTags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setError('Failed to load tags. Please try again.');
    } finally {
      setIsLoadingTags(false);
    }
  };  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [categoriesData, seriesData] = await Promise.all([
        getSermonCategoriesFunc(),
        getSermonSeriesFunc()
      ]);
      setCategories(categoriesData);
      setSeries(seriesData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);
      const criteria: AdvancedSearchCriteria = {
      query: textQuery.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      books: selectedBooks.length > 0 ? selectedBooks : undefined,
      category: selectedCategories.length > 0 ? selectedCategories[0] : undefined, // Take first category since interface expects string
      seriesId: selectedSeries.length > 0 ? selectedSeries[0] : undefined, // Take first series since interface expects string
      dateRange: (startDate && endDate) ? {
        start: startDate,
        end: endDate
      } : undefined
    };

    setSearchCriteria(criteria);
      try {
      const results = await advancedSermonSearchFunc(criteria);
      setSearchResults(results);
      setHasSearched(true);
    } catch (error) {
      console.error('Error performing search:', error);
      setError('Failed to perform search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSearch = () => {
    setTextQuery('');
    setSelectedTags([]);
    setSelectedBooks([]);
    setSelectedCategories([]);
    setSelectedSeries([]);
    setStartDate('');
    setEndDate('');
    setSearchResults({ sermons: [], total: 0, hasMore: false });
    setHasSearched(false);
    setError(null);
  };  const addTagFromDropdown = (tagDisplayName: string) => {
    if (tagDisplayName && !selectedTags.includes(tagDisplayName)) {
      setSelectedTags([...selectedTags, tagDisplayName]);
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const addBook = () => {
    if (newBook && !selectedBooks.includes(newBook)) {
      setSelectedBooks([...selectedBooks, newBook]);
      setNewBook('');
    }
  };

  const removeBook = (book: string) => {
    setSelectedBooks(selectedBooks.filter(b => b !== book));
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSeries = (seriesId: string) => {
    setSelectedSeries(prev =>      prev.includes(seriesId)
        ? prev.filter(id => id !== seriesId)
        : [...prev, seriesId]
    );
  };

  const openSermonInNewWindow = (sermonId: string) => {
    const url = `/expository/${sermonId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div>
      {/* Background overlays for consistent theming */}
      <div className="universal-search-bg"></div>
      <div className="black-overlay"></div>
      
      <div className="advanced-search-page">
        <div className="page-header">
          <h1 className="analytics-dashboard-title">Advanced Search</h1>
          <p>Find sermons using powerful filters and search criteria</p>
        </div>

      {/* Error Message */}
      {error && (
        <div className="message error">
          {error}
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      {/* Search Form */}
      <div className="search-form">
        <div className="form-section">
          <h3>Text Search</h3>
          <div className="form-group">
            <label htmlFor="textQuery">Search in title, content, and notes</label>
            <input
              id="textQuery"
              type="text"
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              placeholder="Enter keywords to search for..."
            />
          </div>
        </div>        <div className="form-section">
          <h3>Tags</h3>
          <div className="form-group">
            <div className="tag-input-group">
              <label htmlFor="tagSelect">Select Tag</label>
              <select
                id="tagSelect"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    addTagFromDropdown(e.target.value);
                  }
                }}
                aria-label="Select Tag"
                disabled={isLoadingTags}
              >
                <option value="">
                  {isLoadingTags ? 'Loading tags...' : 'Select from existing tags'}
                </option>
                {availableTags
                  .filter(tag => !selectedTags.includes(tag.displayName))
                  .map(tag => (
                    <option key={tag.id} value={tag.displayName}>
                      {tag.displayName}
                    </option>
                  ))
                }
              </select>
              <button type="button" onClick={() => {
                const selectElement = document.getElementById('tagSelect') as HTMLSelectElement;
                if (selectElement && selectElement.value) {
                  addTagFromDropdown(selectElement.value);
                }
              }} className="btn export-btn">
                Add
              </button>
            </div>
            <div className="selected-items">
              {selectedTags.map(tag => (
                <span key={tag} className="selected-tag">
                  {tag}
                  <button onClick={() => removeTag(tag)}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>        <div className="form-section">
          <h3>Bible Books</h3>
          <div className="form-group">
            <div className="book-input-group">
              <label htmlFor="bibleBookSelect">Select Bible Book</label>
              <select
                id="bibleBookSelect"
                value={newBook}
                onChange={(e) => setNewBook(e.target.value)}
                aria-label="Select Bible Book"
              >
                <option value="">Select a Bible book</option>
                {bibleBooks.filter(book => !selectedBooks.includes(book)).map(book => (
                  <option key={book} value={book}>{book}</option>
                ))}
              </select>
              <button type="button" onClick={addBook} className="btn export-btn">
                Add
              </button>
            </div>
            <div className="selected-items">
              {selectedBooks.map(book => (
                <span key={book} className="selected-book">
                  {book}
                  <button onClick={() => removeBook(book)}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Categories</h3>
          <div className="form-group">
            <div className="categories-grid">
              {categories.map(category => (
                <label key={category.id} className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id!)}
                    onChange={() => toggleCategory(category.id!)}
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Sermon Series</h3>
          <div className="form-group">
            <div className="series-grid">
              {series.map(s => (
                <label key={s.id} className="series-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedSeries.includes(s.id!)}
                    onChange={() => toggleSeries(s.id!)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Date Range</h3>
          <div className="date-range-group">
            <div className="form-group">
              <label htmlFor="startDate">From</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="endDate">To</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleClearSearch}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="search-results">
          <div className="results-header">
            <h2>Search Results</h2>            <span className="results-count">
              {searchResults.sermons.length} sermon{searchResults.sermons.length !== 1 ? 's' : ''} found
            </span>
          </div>          {searchResults.sermons.length === 0 ? (
            <div className="no-results">
              <p>No sermons found matching your search criteria.</p>
              <p>Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <div className="results-grid">
              {searchResults.sermons.map(sermon => (
                <div key={sermon.id} className="sermon-result-wrapper">                  <SermonCard
                    sermon={{
                      id: sermon.id,
                      title: sermon.title,
                      description: sermon.description || '',
                      date: sermon.date ? new Date(sermon.date).toLocaleDateString() : '',
                      imageUrl: sermon.imageUrl
                    }}
                    hideActions={true}
                  /><div className="sermon-result-overlay">
                    <button 
                      onClick={() => openSermonInNewWindow(sermon.id.toString())}
                      className="btn btn-primary btn-sm"
                    >
                      Open in New Window
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="loading-indicator">        <div className="spinner"></div>
          <span>Searching...</span>
        </div>
      )}
      </div>
    </div>
  );
};

export default AdvancedSearchPage;
