// filepath: c:\Users\steve\Custom-Apps\Sermon Notes Assistant\src\pages\EditExpositoryPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, updateSermon, uploadExpositoryImage, listExpositoryImages, deleteExpositoryImage } from "../services/firebaseService";
import "../styles/edit-expository.scss";
import MiniSermonList from '../components/MiniSermonList';
import SermonFolderDropdown from '../components/SermonFolderDropdown';
import { getSermonFolders, getSermonSeriesFunc } from '../services/firebaseService';
import { fetchTags, Tag } from '../services/tagService';

export default function EditExpositoryPage() {
  const { id: sermonId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showExistingImages, setShowExistingImages] = useState(window.innerWidth > 768);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [seriesId, setSeriesId] = useState<string | undefined>(undefined);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [seriesList, setSeriesList] = useState<{ id: string; name: string }[]>([]);
  
  // Tag management state
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

  useEffect(() => {
    if (!sermonId) {
      setError("No sermon selected. Redirecting to dashboard...");
      setTimeout(() => navigate("/dashboard"), 2000);
      listExpositoryImages().then(setExistingImages);
      setLoading(false);
      return;
    }
    
    // Handle window resize to adjust the visibility of the existing images section
    const handleResize = () => {
      setShowExistingImages(window.innerWidth > 768);
    };
    
    window.addEventListener('resize', handleResize);
    
    setLoading(true);    getSermon(sermonId)
      .then(sermon => {
        if (sermon) {
          setTitle(sermon.title || "");
          setDescription(sermon.description || "");
          setImagePreview(sermon.imageUrl || "");
          setFolderId(sermon.folderId);
          setSeriesId(sermon.seriesId);
          setSelectedTags(sermon.tags || []);
        } else {
          setError("Sermon not found. Redirecting to dashboard...");
          setTimeout(() => navigate("/dashboard"), 2000);
        }
      })
      .catch(() => {
        setError("Error loading sermon. Redirecting to dashboard...");
        setTimeout(() => navigate("/dashboard"), 2000);
      })
      .finally(() => {
        listExpositoryImages().then(setExistingImages);
        setLoading(false);
      });      
    getSermonFolders().then(folders => setFolders(folders.filter(f => f.id).map(f => ({ id: f.id!, name: f.name }))));
    getSermonSeriesFunc().then(series => setSeriesList(series.filter(s => s.id).map(s => ({ id: s.id!, name: s.name }))));
    fetchTags().then(tags => setAvailableTags(tags));

    // Clean up the event listener
    return () => window.removeEventListener('resize', handleResize);
  }, [sermonId, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setImagePreview(URL.createObjectURL(e.target.files[0]));
    }
  };
  const handleImageSelect = (url: string) => {
    setImageFile(null);
    setImagePreview(url);
  };
  // Helper function to normalize tag display
  const normalizeTagForDisplay = (tag: string): string => {
    if (typeof tag !== 'string') return '';
    return tag
      .toLowerCase()
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Tag management functions
  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleAddNewTag = async () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    
    try {
      const { addTag } = await import('../services/tagService');
      await addTag(trimmed);
      
      // Refresh available tags
      const updatedTags = await fetchTags();
      setAvailableTags(updatedTags);
      
      // Add to selected tags
      setSelectedTags(prev => [...prev, trimmed]);
      setNewTagInput("");
    } catch (error) {
      console.error('Failed to add new tag:', error);
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagName));
  };

  // Add handler for deleting an image
  const handleDeleteImage = async (url: string) => {
    try {
      await deleteExpositoryImage(url);
      setExistingImages((prev) => prev.filter((img) => img !== url));
      // If the deleted image was selected, clear preview
      if (imagePreview === url) setImagePreview("");
      if (imageFile && URL.createObjectURL(imageFile) === url) setImageFile(null);
    } catch (err) {
      alert('Failed to delete image.');
    }
  };  const handleSubmit = async () => {
    if (!sermonId) {
      setError("Invalid Sermon ID. Cannot save changes.");
      return;
    }
    let finalImageUrl = imagePreview;
    if (imageFile) {
      const uploadedUrl = await uploadExpositoryImage(imageFile);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      }
    }
    
    // Create update object with only defined values
    const updateData: any = {
      title: title.trim() || "Untitled Sermon",
      description: description.trim() || "No description provided.",
      imageUrl: finalImageUrl || "",
      tags: selectedTags,
    };
    
    // Only include folderId and seriesId if they have values
    if (folderId) {
      updateData.folderId = folderId;
    }
    if (seriesId) {
      updateData.seriesId = seriesId;
    }
    
    await updateSermon(sermonId, updateData);
    navigate("/dashboard");
  };
  if (loading) {
    return (
      <div className="edit-expository-page">
        <div className="edit-expository-layout">
          <div className="loading-message">Loading...</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="edit-expository-page">
        <div className="edit-expository-layout">
          <div className="error-message">{error}</div>
          <div className="existing-images-column">
            <div className="existing-images-header" onClick={() => setShowExistingImages(!showExistingImages)}>
              <h3>Select Existing Image</h3>
              <span className="toggle-icon">{showExistingImages ? '▼' : '►'}</span>
            </div>
            <div className="horizontal-divider"></div>
            <div className={`thumbnails-grid shifted-thumbnails ${showExistingImages ? 'show' : 'hide'}`}>
              {existingImages.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Thumbnail ${index + 1}`}
                  className="thumbnail-item"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );  }

  return (
    <div className="edit-expository-page">
      {/* Back Button */}
      <button 
        className="back-to-details-btn"
        onClick={() => navigate(`/expository/${sermonId}`)}
        title="Back to Expository Details"
      >
        ← Back to Expository
      </button>
      
      <div className="edit-expository-layout">
        <div className="mini-dashboard-panel">
          <MiniSermonList />
        </div>
        <div className="vertical-divider left-of-form blue-divider desktop-only-element"></div>
        <div className="form-and-preview-stack">
          <form className="edit-expository-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <label htmlFor="titleInput" className="form-label">Expository Title</label>
            <input
              id="titleInput"
              type="text"
              placeholder="Enter Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
            />

            <label htmlFor="descriptionInput" className="form-label">Expository Description</label>
            <textarea
              id="descriptionInput"
              placeholder="Enter Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
            />

            <div className="file-upload-wrapper">
              <label htmlFor="imageUpload" className="form-label">Upload Image</label>
              <input
                id="imageUpload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-upload-input"
              />
            </div>

            <label className="form-label">Assign to Folder</label>
            <SermonFolderDropdown
              folders={folders}
              value={folderId ?? null}
              onChange={id => setFolderId(id ?? undefined)}
            />            <label className="form-label" htmlFor="seriesSelect">Assign to Series</label>
            <select
              id="seriesSelect"
              className="form-input"
              value={seriesId || ''}
              onChange={e => setSeriesId(e.target.value || undefined)}
              aria-label="Assign to Series"
            >
              <option value="">No Series</option>
              {seriesList.map(series => (
                <option key={series.id} value={series.id}>{series.name}</option>
              ))}
            </select>

            {/* Tag Management Section */}
            <div className="tag-management-section">
              <label className="form-label">Tags</label>
              
              {/* Selected Tags Display */}
              {selectedTags.length > 0 && (
                <div className="selected-tags-container">                  {selectedTags.map(tag => (
                    <span key={tag} className="selected-tag">
                      {normalizeTagForDisplay(tag)}
                      <button
                        type="button"
                        className="remove-tag-btn"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove tag: ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add New Tag Input */}
              <div className="add-tag-container">
                <input
                  type="text"
                  className="form-input new-tag-input"
                  placeholder="Add new tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewTag();
                    }
                  }}
                />
                <button
                  type="button"
                  className="add-tag-btn"
                  onClick={handleAddNewTag}
                  disabled={!newTagInput.trim()}
                >
                  Add Tag
                </button>
              </div>

              {/* Available Tags Selection */}
              {availableTags.length > 0 && (
                <div className="available-tags-section">
                  <span className="available-tags-label">Available Tags:</span>
                  <div className="available-tags-container">                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        className={`available-tag ${selectedTags.includes(tag.name) ? 'selected' : ''}`}
                        onClick={() => handleTagToggle(tag.name)}
                      >
                        {normalizeTagForDisplay(tag.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="primary-action-button">Save Changes</button>
          </form>
          <div className="preview-label">Image Preview</div>
          <div className="large-preview-panel">
            {imagePreview ? (
              <img src={imagePreview} alt="Selected preview" className="preview-image-large" />
            ) : (
              <div className="empty-preview-placeholder">No Image Selected</div>
            )}        </div>
        </div>

        <div className="vertical-divider blue-divider desktop-only-element"></div><div className="existing-images-column mobile-no-border">
          <div className="existing-images-header" onClick={() => setShowExistingImages(!showExistingImages)}>
            <h3>Select Existing Image</h3>
            <span className="toggle-icon">{showExistingImages ? '▼' : '►'}</span>
          </div>
          <div className="horizontal-divider mobile-show"></div>
          <div className={`thumbnails-grid shifted-thumbnails ${showExistingImages ? 'show' : 'hide'}`}>
            {existingImages.map((url, index) => (
              <div key={url} className="thumbnail-item-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={url}
                  alt={`Thumbnail ${index + 1}`}
                  className="thumbnail-item"
                  onClick={() => handleImageSelect(url)}
                />
                <button
                  type="button"
                  className="delete-image-btn"
                  aria-label="Delete image"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'none',
                    border: 'none',
                    width: 22,
                    height: 22,
                    cursor: 'pointer',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    padding: 0,
                  }}
                  onClick={() => handleDeleteImage(url)}
                  tabIndex={0}
                >
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 18,
                      lineHeight: '18px',
                      userSelect: 'none',
                      background: 'linear-gradient(135deg, #ff3b3b 0%, #b80000 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      textShadow: '0 1px 2px #fff, 0 2px 6px #b80000',
                      letterSpacing: '0.02em',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      pointerEvents: 'none',
                    }}
                  >
                    ×
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
