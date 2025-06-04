import React, { useState, useEffect } from 'react';
import { 
  autoCategorizeSermonsFunc, 
  applyAutoCategorizationFunc, 
  getSermonCategoriesFunc,
  createSermonCategoryFunc,
  deleteSermonCategoryFunc,
  fetchSermons 
} from '../services/firebaseService';
import { AutoTagResult, SermonCategory, Sermon } from '../services/firebaseService';
import './SmartCategorizationPage.scss';

const SmartCategorizationPage: React.FC = () => {
  const [categories, setCategories] = useState<SermonCategory[]>([]);
  const [autoTagResults, setAutoTagResults] = useState<AutoTagResult[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSermons, setSelectedSermons] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKeywords, setNewCategoryKeywords] = useState('');
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {      const [categoriesData, sermonsData] = await Promise.all([
        getSermonCategoriesFunc(),
        fetchSermons()
      ]);
      setCategories(categoriesData);
      setSermons(sermonsData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoCategorizeSingle = async (sermonId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await autoCategorizeSermonsFunc([sermonId]);
      setAutoTagResults(results);
      setSuccess('Auto-categorization complete! Review suggestions below.');
    } catch (error) {
      console.error('Error auto-categorizing sermon:', error);
      setError('Failed to auto-categorize sermon. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoCategorizeSelected = async () => {
    if (selectedSermons.length === 0) {
      setError('Please select at least one sermon to categorize.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const results = await autoCategorizeSermonsFunc(selectedSermons);
      setAutoTagResults(results);
      setSuccess(`Auto-categorization complete for ${selectedSermons.length} sermons! Review suggestions below.`);
    } catch (error) {
      console.error('Error auto-categorizing sermons:', error);
      setError('Failed to auto-categorize sermons. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAutoTag = async (result: AutoTagResult) => {
    setIsLoading(true);
    setError(null);
    try {
      await applyAutoCategorizationFunc([result]);
      setSuccess('Auto-categorization applied successfully!');
      
      // Remove the applied result from the list
      setAutoTagResults(prev => prev.filter(r => r.sermonId !== result.sermonId));
        // Refresh sermons to show updated data
      const updatedSermons = await fetchSermons();
      setSermons(updatedSermons);
    } catch (error) {
      console.error('Error applying auto-categorization:', error);
      setError('Failed to apply auto-categorization. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('Please enter a category name.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await createSermonCategoryFunc({
        name: newCategoryName.trim(),
        keywords: newCategoryKeywords.split(',').map(k => k.trim()).filter(k => k)
      });
      
      setSuccess('Category created successfully!');
      setNewCategoryName('');
      setNewCategoryKeywords('');      setShowCreateCategory(false);
      
      // Refresh categories
      const updatedCategories = await getSermonCategoriesFunc();
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Error creating category:', error);
      setError('Failed to create category. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await deleteSermonCategoryFunc(categoryId);      setSuccess('Category deleted successfully!');
      
      // Refresh categories
      const updatedCategories = await getSermonCategoriesFunc();
      setCategories(updatedCategories);
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSermonSelection = (sermonId: string) => {
    setSelectedSermons(prev => 
      prev.includes(sermonId) 
        ? prev.filter(id => id !== sermonId)
        : [...prev, sermonId]
    );
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };  return (
    <div className="smart-categorization-page">
      <div className="universal-search-bg"></div>
      <div className="black-overlay"></div>
      <div className="page-header">
        <h1 className="analytics-dashboard-title">Smart Categorization</h1>
        <p>Automatically categorize your sermons using AI-powered content analysis</p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="message error">
          {error}
          <button onClick={clearMessages} className="close-btn">×</button>
        </div>
      )}
      {success && (
        <div className="message success">
          {success}
          <button onClick={clearMessages} className="close-btn">×</button>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}

      {/* Categories Management Section */}
      <div className="section">
        <div className="section-header">
          <h2>Categories</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateCategory(!showCreateCategory)}
          >
            {showCreateCategory ? 'Cancel' : 'Create Category'}
          </button>
        </div>

        {/* Create Category Form */}
        {showCreateCategory && (
          <div className="create-category-form">
            <div className="form-group">
              <label htmlFor="categoryName">Category Name</label>
              <input
                id="categoryName"
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Prayer, Faith, Worship"
              />
            </div>
            <div className="form-group">
              <label htmlFor="categoryKeywords">Keywords (comma-separated)</label>
              <input
                id="categoryKeywords"
                type="text"
                value={newCategoryKeywords}
                onChange={(e) => setNewCategoryKeywords(e.target.value)}
                placeholder="e.g., prayer, intercession, petition"
              />
              <small>Keywords help the AI categorize sermons automatically</small>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCreateCategory}>
                Create Category
              </button>
            </div>
          </div>
        )}

        {/* Categories List */}
        <div className="categories-grid">
          {categories.map((category) => (
            <div key={category.id} className="category-card">
              <div className="category-header">
                <h3>{category.name}</h3>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteCategory(category.id!)}
                >
                  Delete
                </button>
              </div>
              <div className="category-keywords">
                <strong>Keywords:</strong>
                <div className="keywords-list">
                  {category.keywords.map((keyword, index) => (
                    <span key={index} className="keyword-tag">{keyword}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}        </div>
      </div>

      <div className="section-divider"></div>

      {/* Sermon Selection Section */}
      <div className="section">
        <div className="section-header">
          <h2>Sermon Auto-Categorization</h2>
          <div className="section-actions">
            <button 
              className="btn btn-secondary"
              onClick={handleAutoCategorizeSelected}
              disabled={selectedSermons.length === 0}
            >
              Categorize Selected ({selectedSermons.length})
            </button>
          </div>
        </div>

        <div className="sermons-grid">
          {sermons.map((sermon) => (
            <div key={sermon.id} className="sermon-card">
              <div className="sermon-header">
                <input
                  type="checkbox"
                  checked={selectedSermons.includes(String(sermon.id))}
                  onChange={() => toggleSermonSelection(String(sermon.id))}
                  aria-label={`Select sermon: ${sermon.title}`}
                />
                <h3>{sermon.title}</h3>
              </div>
              <div className="sermon-details">
                <p><strong>Description:</strong> {sermon.description}</p>
                <p><strong>Date:</strong> {sermon.date}</p>
                {sermon.category && (
                  <p><strong>Current Category:</strong> <span className="current-category">{sermon.category}</span></p>
                )}
              </div>
              <div className="sermon-actions">                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAutoCategorizeSingle(String(sermon.id))}
                >
                  Auto-Categorize
                </button>
              </div>
            </div>
          ))}
        </div>      </div>      {/* Auto-Tag Results Section */}
      {autoTagResults.length > 0 && (
        <>
          <div className="section-divider"></div>
          <div className="section">
          <h2>Categorization Suggestions</h2>
          <div className="auto-tag-results">
            {autoTagResults.map((result) => {
              const sermon = sermons.find(s => s.id === result.sermonId);
              return (
                <div key={result.sermonId} className="auto-tag-result">
                  <div className="result-header">
                    <h3>{sermon?.title}</h3>
                    <div className="confidence-score">
                      Confidence: {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="suggestions">
                    <div className="suggestion-group">
                      <strong>Suggested Category:</strong>
                      <span className="suggested-category">{result.suggestedCategory}</span>
                    </div>
                    
                    <div className="suggestion-group">
                      <strong>Suggested Tags:</strong>
                      <div className="suggested-tags">
                        {result.suggestedTags.map((tag, index) => (
                          <span key={index} className="suggested-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                      <div className="suggestion-group">
                      <strong>Suggested Tags:</strong>
                      <div className="biblical-themes">
                        {result.suggestedTags.map((theme, index) => (
                          <span key={index} className="biblical-theme">{theme}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="result-actions">
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleApplyAutoTag(result)}
                    >
                      Apply Suggestions
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setAutoTagResults(prev => prev.filter(r => r.sermonId !== result.sermonId))}
                    >
                      Dismiss
                    </button>                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SmartCategorizationPage;
