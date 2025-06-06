// TagManagementPage.tsx
// Combines tag CRUD and tag assignment/removal for verses, using Firestore 'tags' collection only
import React, { useEffect, useState, useCallback } from 'react';
import { fetchTags, addTag, updateTag, deleteTag, Tag } from '../services/tagService';
import { batchUpdateVerseTags, BatchVerseTagUpdate } from '../services/firebaseService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './TagManagementPage.scss';

interface Verse {
  objectID: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tags: string[];
  translation: string;
  reference: string;
}

interface Translation {
  id: string;
  name: string;
  displayName: string;
}

interface UniversalSearchResponse {
  results: Verse[];
}

interface UniqueTranslationsResponse {
  uniqueTranslations: Translation[];
}

export default function TagManagementPage() {
  // Tag CRUD state
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Verse/tag assignment state
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Verse[]>([]);
  const [selectedVerses, setSelectedVerses] = useState<string[]>([]);
  const [batchTagsToAdd, setBatchTagsToAdd] = useState('');
  const [batchTagsToRemove, setBatchTagsToRemove] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Translation selection state
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [selectedTranslations, setSelectedTranslations] = useState<string[]>([]);
  const [translationLoadError, setTranslationLoadError] = useState<string | null>(null);

  const functions = getFunctions();
  const [activeOverlayTagId, setActiveOverlayTagId] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 700); // Threshold for mobile view

  // Fetch all tags from Firestore 'tags' collection
  const fetchTagsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tagsData = await fetchTags();
      // Normalize tags for display
      const normalizedTags = tagsData.map(tag => ({ ...tag, name: normalizeTagForDisplay(tag.name) }));
      setTags(normalizedTags);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch tags.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch available translations
  const fetchTranslations = useCallback(async () => {
    try {
      const getAllUniqueTranslationsCallable = httpsCallable<
        void,
        UniqueTranslationsResponse
      >(functions, 'getAllUniqueTranslations');
      const result = await getAllUniqueTranslationsCallable();
      const fetchedTranslations = result.data.uniqueTranslations || [];
      setAvailableTranslations(fetchedTranslations);
      if (fetchedTranslations.length > 0 && selectedTranslations.length === 0) {
        setSelectedTranslations([fetchedTranslations[0].id]);
      }
    } catch (err: any) {
      setTranslationLoadError(err.message || 'Failed to load translations.');
    }
  }, [functions, selectedTranslations.length]);

  useEffect(() => {
    fetchTagsList();
    fetchTranslations();

    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fetchTagsList, fetchTranslations]);

  // Helper to normalize tag display
  function normalizeTagForDisplay(tag: string): string {
    if (typeof tag !== 'string') return '';
    return tag
      .toLowerCase()
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Tag CRUD handlers
  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await addTag(newTagName.trim());
      setSuccess('Tag added successfully!');
      setNewTagName('');
      fetchTagsList();
    } catch (e: any) {
      setError(e.message || 'Failed to add tag.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteTag(tagId);
      setSuccess('Tag deleted successfully!');
      fetchTagsList();
    } catch (e: any) {
      setError(e.message || 'Failed to delete tag.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
  };

  const handleSaveEdit = async (tagId: string) => {
    if (!editTagName.trim()) {
      setError('Tag name cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateTag(tagId, editTagName.trim());
      setSuccess('Tag updated successfully!');
      setEditingTagId(null);
      setEditTagName('');
      fetchTagsList();
    } catch (e: any) {
      setError(e.message || 'Failed to update tag.');
    } finally {
      setLoading(false);
    }
  };

  // Verse search logic using Firebase callable function
  const handleSearch = async () => {
    if (selectedTranslations.length === 0) {
      setSearchError('Please select at least one translation before searching.');
      return;
    }
    setIsLoading(true);
    setSearchError(null);
    try {
      const universalScriptureSearch = httpsCallable<
        { query: string; translations: string[] },
        UniversalSearchResponse
      >(functions, 'universalScriptureSearch');
      const searchParams = {
        query: searchQuery,
        translations: selectedTranslations,
      };
      const response = await universalScriptureSearch(searchParams);
      const results = response.data.results;
      setSearchResults(results);
      setSelectedVerses([]);
      if (results.length === 0) {
        setSearchError('No verses found matching your search.');
      }
    } catch (e: any) {
      setSearchError(e.message || 'Search failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerseSelect = (verseId: string) => {
    setSelectedVerses(prev => prev.includes(verseId)
      ? prev.filter(id => id !== verseId)
      : [...prev, verseId]);
  };

  const handleBatchUpdateTags = async () => {
    if (!batchTagsToAdd.trim() && !batchTagsToRemove.trim()) {
      setError('Please enter tags to add or remove.');
      return;
    }
    if (selectedVerses.length === 0) {
      setError('No verses selected.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updates: BatchVerseTagUpdate[] = selectedVerses.map(docId => ({
        docId,
        tagsToAdd: batchTagsToAdd.split(',').map(t => t.trim()).filter(Boolean),
        tagsToRemove: batchTagsToRemove.split(',').map(t => t.trim()).filter(Boolean),
      }));
      await batchUpdateVerseTags(updates);
      setSuccess('Tags updated for selected verses!');
      setBatchTagsToAdd('');
      setBatchTagsToRemove('');
      setSelectedVerses([]);
      // Optionally re-run search to update results
      await handleSearch();
    } catch (e: any) {
      setError(e.message || 'Failed to update tags.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleTagClick = (tagId: string) => {
    setActiveOverlayTagId(prev => (prev === tagId ? null : tagId));
  };

  return (
    <div className="tag-management-page">
      <div className="page-header">
        <h1 className="analytics-dashboard-title">Tag Management</h1>
      </div>
      {error && <div className="tag-error">{error}</div>}
      {success && <div className="tag-success">{success}</div>}

      <div className="tag-crud-section">
        <h3>Add New Tag</h3>
        <div className="add-tag-form">
          <input
            type="text"
            aria-label="New tag name"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="Enter tag name"
          />
          <button onClick={handleAddTag} disabled={loading} className="add-tag-btn">Add Tag</button>
        </div>
      </div>

      {/* Section divider */}
      <div className="section-divider"></div>

      <div className="tag-list-section">
        <h3>Existing Tags</h3>
        <div className="tag-management-grid">
          {tags.map(tag => (
            <div key={tag.id} className="tag-button-wrapper">
              <div
                role="button"
                tabIndex={0}
                className={`tag-dashboard-btn ${activeOverlayTagId === tag.id ? 'active' : ''}`}
                onClick={() => handleTagClick(tag.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTagClick(tag.id);
                  }
                }}
                aria-label={`Tag ${tag.name}`}
                aria-expanded={activeOverlayTagId === tag.id}
              >
                <span className="tag-label">{tag.name}</span>
                {/* Desktop: Icon Overlay */}
                {!isMobileView && activeOverlayTagId === tag.id && (
                  <div className={`tag-overlay visible`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(tag); }}
                      disabled={loading}
                      title="Edit Tag"
                      className="icon-btn edit-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id); }}
                      disabled={loading}
                      title="Delete Tag"
                      className="icon-btn delete-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m3 6 3 0"/><path d="m19 6-1 0"/><path d="m8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m10 11 0 6"/><path d="m14 11 0 6"/><rect x="5" y="6" width="14" height="14" rx="2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              {/* Mobile: Text Buttons Below Tag */}
              {isMobileView && activeOverlayTagId === tag.id && (
                <div className="tag-mobile-actions">
                  <button 
                    onClick={() => handleStartEdit(tag)} 
                    disabled={loading} 
                    className="btn mobile-edit-btn"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteTag(tag.id)} 
                    disabled={loading} 
                    className="btn mobile-delete-btn"
                  >
                    Delete
                  </button>
                </div>
              )}
              {editingTagId === tag.id && ( // Edit form (remains the same)
                <div className="tag-edit-container">
                  <input
                    type="text"
                    aria-label="Edit tag name"
                    value={editTagName}
                    onChange={e => setEditTagName(e.target.value)}
                    placeholder="Edit tag name"
                    className="tag-edit-input"
                  />
                  <div className="tag-edit-buttons">
                    <button onClick={() => handleSaveEdit(tag.id)} disabled={loading} className="save-btn">Save</button>
                    <button onClick={() => setEditingTagId(null)} className="cancel-btn">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section divider */}
      <div className="section-divider"></div>      <div className="batch-tag-controls-section">
        <h3>Batch Tag Assignment/Removal</h3>
        
        {/* Translation Selection */}
        <div className="translation-selection">
          <h4>Select Bible Translations:</h4>
          {translationLoadError && <div className="add-tags-error">{translationLoadError}</div>}
          <div className="translation-checkboxes">
            {availableTranslations.map(translation => (
              <label key={translation.id} className="translation-checkbox-label">
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
                {translation.displayName || translation.name}
              </label>
            ))}
          </div>
        </div>

        <div className="search-bar-and-button">
          <input
            className="search-bar-tags"
            type="text"
            aria-label="Search verses"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search for verses (by reference, text, etc.)"
          />
          <button className="atp-button" onClick={handleSearch} disabled={isLoading}>Search</button>
        </div>
        {searchError && <div className="add-tags-error">{searchError}</div>}
        <div className="results-list-tags">
          {searchResults.map(verse => (
            <div key={verse.objectID} className={`result-item-tags${selectedVerses.includes(verse.objectID) ? ' selected-item' : ''}`}> 
              <input
                type="checkbox"
                id={`select-verse-${verse.objectID}`}
                checked={selectedVerses.includes(verse.objectID)}
                onChange={() => handleVerseSelect(verse.objectID)}
                className="verse-select-checkbox"
                aria-labelledby={`label-select-verse-${verse.objectID}`}
              />
              <label htmlFor={`select-verse-${verse.objectID}`} id={`label-select-verse-${verse.objectID}`} className="verse-info">
                <strong className="verse-reference-tags">{verse.reference} ({verse.translation})</strong>
                <span className="verse-text-preview-tags">{verse.text}</span>
                {verse.tags && verse.tags.length > 0 && (
                  <div className="current-tags-preview">
                    <strong>Tags:</strong> {verse.tags.join(', ')}
                  </div>
                )}
              </label>
            </div>
          ))}        </div>
        
        {/* Section divider */}
        <div className="section-divider"></div>
        
        <div className="tag-inputs-container">
          <div>
            <label htmlFor="tagsToAdd">Tags to Add (comma separated):</label>
            <input
              id="tagsToAdd"
              type="text"
              value={batchTagsToAdd}
              onChange={e => setBatchTagsToAdd(e.target.value)}
              placeholder="e.g. Faith, Hope"
              list="available-tags"
            />
          </div>
          <div>
            <label htmlFor="tagsToRemove">Tags to Remove (comma separated):</label>
            <input
              id="tagsToRemove"
              type="text"
              value={batchTagsToRemove}
              onChange={e => setBatchTagsToRemove(e.target.value)}
              placeholder="e.g. Love, Peace"
              list="available-tags"
            />
          </div>
          <datalist id="available-tags">
            {tags.map(tag => <option key={tag.id} value={tag.name} />)}
          </datalist>
        </div>
        <button className="batch-action-btn" onClick={handleBatchUpdateTags} disabled={isLoading || selectedVerses.length === 0}>
          Apply Tags to Selected Verses
        </button>
      </div>
    </div>
  );
}
