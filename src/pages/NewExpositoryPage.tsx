import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon, uploadExpositoryImage } from "../services/firebaseService";
import '../styles/edit-expository.css';
import MiniSermonList from '../components/MiniSermonList';

export default function NewExpositoryPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    // Load existing images for selection
    import("../services/firebaseService").then(({ listExpositoryImages }) => {
      listExpositoryImages().then(setExistingImages).finally(() => setLoading(false));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !date) {
      alert("Please fill in all fields.");
      return;
    }

    let imageUrl = "";
    if (imageFile) {
      imageUrl = await uploadExpositoryImage(imageFile);
    }

    await createSermon({
      title,
      description,
      date,
      imageUrl,
      isArchived: false,
      imageOnly: false,
    });

    navigate("/dashboard");
  };

  return (
    <div className="edit-expository-layout">
      <div className="mini-dashboard-panel">
        <MiniSermonList />
      </div>
      {/* Divider between mini-dashboard and form */}
      <div className="vertical-divider left-of-form blue-divider" style={{ minHeight: '400px', height: '100vh', alignSelf: 'stretch', position: 'relative' }}></div>
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

          <button type="submit" className="primary-action-button">Save Expository</button>
        </form>

        <div className="large-preview-panel">
          {imageFile ? (
            <img src={URL.createObjectURL(imageFile)} alt="Selected preview" className="preview-image-large" />
          ) : (
            <div className="empty-preview-placeholder">No Image Selected</div>
          )}
        </div>
      </div>
      <div className="vertical-divider blue-divider"></div>
      <div className="existing-images-column">
        <h3>Select Existing Image</h3>
        <div className="horizontal-divider"></div>
        <div className="inner-divider-line blue-divider"></div>
        <div className="thumbnails-grid shifted-thumbnails">
          {existingImages.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`Thumbnail ${index + 1}`}
              className="thumbnail-item"
              onClick={() => {
                setImageFile(null);
                // Set preview to selected image
                (document.getElementById('imageUpload') as HTMLInputElement).value = '';
                // Optionally, you could store the selected URL in a separate state if needed
                // For now, just show in preview and use for submission
                (document.getElementById('previewImage') as HTMLImageElement).src = url;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
