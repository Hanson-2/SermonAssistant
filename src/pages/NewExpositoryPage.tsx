import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon, uploadExpositoryImage, getSermonFolders, getSermonSeriesFunc, deleteExpositoryImage } from "../services/firebaseService";
import '../styles/edit-expository.scss';
import MiniSermonList from '../components/MiniSermonList';
import SermonFolderDropdown from '../components/SermonFolderDropdown';

export default function NewExpositoryPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showExistingImages, setShowExistingImages] = useState(window.innerWidth > 768);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [seriesId, setSeriesId] = useState<string | undefined>(undefined);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [seriesList, setSeriesList] = useState<{ id: string; name: string }[]>([]);
  const navigate = useNavigate();
  React.useEffect(() => {
    // Load existing images for selection
    import("../services/firebaseService").then(({ listExpositoryImages }) => {
      listExpositoryImages().then(setExistingImages).finally(() => setLoading(false));
    });
    
    // Fetch folders and series
    getSermonFolders().then(folders => setFolders(folders.filter(f => f.id).map(f => ({ id: f.id!, name: f.name }))));
    getSermonSeriesFunc().then(series => setSeriesList(series.filter(s => s.id).map(s => ({ id: s.id!, name: s.name }))));

    // Handle window resize to adjust the visibility of the existing images section
    const handleResize = () => {
      setShowExistingImages(window.innerWidth > 768);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up the event listener
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description) {
      alert("Please fill in title and description.");
      return;
    }

    // Use either uploaded file or selected existing image
    let imageUrl = selectedImageUrl;
    if (imageFile) {
      imageUrl = await uploadExpositoryImage(imageFile);
    }

    const currentDate = new Date().toISOString().split('T')[0]; // Generate date in YYYY-MM-DD format

    await createSermon({
      title,
      description,
      date: currentDate, // Add generated date
      imageUrl,
      isArchived: false,
      imageOnly: false,
      dateAdded: undefined,
      bibleBook: undefined,
      bibleChapter: undefined,
      bibleStartVerse: undefined,
      bibleEndVerse: undefined,
      folderId: folderId,
      seriesId: seriesId,
    });

    // Add a short delay to ensure Firestore indexes the new record before navigation
    setTimeout(() => {
      navigate("/dashboard");
    }, 500);
  };

  // Add handler for deleting an image
  const handleDeleteImage = async (url: string) => {
    try {
      await deleteExpositoryImage(url);
      setExistingImages((prev) => prev.filter((img) => img !== url));
      if (selectedImageUrl === url) setSelectedImageUrl("");
      if (imageFile && URL.createObjectURL(imageFile) === url) setImageFile(null);
    } catch (err) {
      alert('Failed to delete image.');
    }
  };

  return (
    <div className="edit-expository-page">
      <div className="edit-expository-layout">
        <div className="mini-dashboard-panel">
          <MiniSermonList />
        </div>
        {/* Divider only visible on desktop */}
        <div className="vertical-divider left-of-form blue-divider desktop-only-element"></div>
        <div className="form-and-preview-stack">
          <form className="edit-expository-form" onSubmit={handleSubmit}>
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
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="file-upload-input"
              />
            </div>
            <label className="form-label">Assign to Folder</label>
            <SermonFolderDropdown
              folders={folders}
              value={folderId ?? null}
              onChange={id => setFolderId(id ?? undefined)}
            />
            <label className="form-label" htmlFor="seriesSelect">Assign to Series</label>
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
            <button type="submit" className="primary-action-button">Add Expository</button>
          </form>

          <div className="preview-label">Image Preview</div>
          <div className="large-preview-panel">
            {imageFile ? (
              <img src={URL.createObjectURL(imageFile)} alt="Selected preview" className="preview-image-large" />
            ) : selectedImageUrl ? (
              <img src={selectedImageUrl} alt="Selected preview" className="preview-image-large" />
            ) : (
              <div className="empty-preview-placeholder">No Image Selected</div>
            )}
          </div>
        </div>

        <div className="vertical-divider blue-divider desktop-only-element"></div>
        <div className="existing-images-column mobile-no-border">
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
                  onClick={() => setSelectedImageUrl(url)}
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
