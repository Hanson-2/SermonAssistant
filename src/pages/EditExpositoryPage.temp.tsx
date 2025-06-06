// filepath: c:\Users\steve\Custom-Apps\Sermon Notes Assistant\src\pages\EditExpositoryPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, updateSermon, uploadExpositoryImage, listExpositoryImages } from "../services/firebaseService";
import "../styles/edit-expository.css";
import MiniSermonList from '../components/MiniSermonList';

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
    
    setLoading(true);
    getSermon(sermonId)
      .then(sermon => {
        if (sermon) {
          setTitle(sermon.title || "");
          setDescription(sermon.description || "");
          setImagePreview(sermon.imageUrl || "");
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

  const handleSubmit = async () => {
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
    await updateSermon(sermonId, {
      title: title.trim() || "Untitled Sermon",
      description: description.trim() || "No description provided.",
      imageUrl: finalImageUrl || "",
    });
    navigate("/dashboard");
  };

  if (loading) {
    return <div className="edit-expository-layout"><div className="loading-message">Loading...</div></div>;
  }

  if (error) {
    return (
      <div className="edit-expository-layout">
        <div className="error-message">{error}</div>
        <div className="existing-images-column">
          <div className="existing-images-header" onClick={() => setShowExistingImages(!showExistingImages)}>
            <h3>Select Existing Image</h3>
            <span className="toggle-icon">{showExistingImages ? '▼' : '►'}</span>
          </div>
          <div className="horizontal-divider"></div>
          <div className="inner-divider-line blue-divider"></div>
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
    );
  }

  return (
    <div className="edit-expository-layout">
      <div className="mini-dashboard-panel">
        <MiniSermonList />
      </div>
      <div className="vertical-divider left-of-form blue-divider"></div>
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

          <button type="submit" className="primary-action-button">Save Changes</button>
        </form>
        <div className="preview-label">Image Preview</div>
        <div className="large-preview-panel">
          {imagePreview ? (
            <img src={imagePreview} alt="Selected preview" className="preview-image-large" />
          ) : (
            <div className="empty-preview-placeholder">No Image Selected</div>
          )}
        </div>
      </div>
      <div className="vertical-divider blue-divider"></div>

      <div className="existing-images-column">
        <div className="existing-images-header" onClick={() => setShowExistingImages(!showExistingImages)}>
          <h3>Select Existing Image</h3>
          <span className="toggle-icon">{showExistingImages ? '▼' : '►'}</span>
        </div>
        <div className="horizontal-divider"></div>
        <div className="inner-divider-line blue-divider"></div>
        <div className={`thumbnails-grid shifted-thumbnails ${showExistingImages ? 'show' : 'hide'}`}>
          {existingImages.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`Thumbnail ${index + 1}`}
              className="thumbnail-item"
              onClick={() => handleImageSelect(url)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
