import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon, uploadExpositoryImage } from "../services/firebaseService";
import '../styles/edit-expository.scss';
import MiniSermonList from '../components/MiniSermonList';

export default function NewExpositoryPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showExistingImages, setShowExistingImages] = useState(window.innerWidth > 768);
  const navigate = useNavigate();
  React.useEffect(() => {
    // Load existing images for selection
    import("../services/firebaseService").then(({ listExpositoryImages }) => {
      listExpositoryImages().then(setExistingImages).finally(() => setLoading(false));
    });
    
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
      // Remove dateAdded and all undefined fields
      // bibleBook, bibleChapter, bibleStartVerse, bibleEndVerse are omitted if not set
    });

    // Add a short delay to ensure Firestore indexes the new record before navigation
    setTimeout(() => {
      navigate("/dashboard");
    }, 500);
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
          </div>          <button type="submit" className="primary-action-button">Save Expository</button>
        </form>

        <div className="preview-label">Image Preview</div>
        <div className="large-preview-panel">
          {imageFile ? (
            <img src={URL.createObjectURL(imageFile)} alt="Selected preview" className="preview-image-large" />
          ) : selectedImageUrl ? (
            <img src={selectedImageUrl} alt="Selected preview" className="preview-image-large" />
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
            <img
              key={index}
              src={url}
              alt={`Thumbnail ${index + 1}`}
              className="thumbnail-item"
              onClick={() => {
                // Clear file input
                if (document.getElementById('imageUpload')) {
                  (document.getElementById('imageUpload') as HTMLInputElement).value = '';
                }
                
                // Store the selected URL in state
                setImageFile(null);
                
                // Set the selected image URL directly in the component state
                const newImageUrl = url;
                setSelectedImageUrl(newImageUrl);              }}
            />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
