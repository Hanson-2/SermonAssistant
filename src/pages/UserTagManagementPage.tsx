import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './UserTagManagementPage.css';

interface UserTag {
  id: string;
  name: string;
  color?: string;
}

export default function UserTagManagementPage() {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit/delete state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');

  const functions = getFunctions();

  const fetchTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const getUserTags = httpsCallable(functions, 'getUserTags');
      const result = await getUserTags();
      // Fix type error for result.data
      const tagsData = (result.data as any)?.tags || [];
      setTags(tagsData);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch tags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const addUserTag = httpsCallable(functions, 'addUserTag');
      await addUserTag({ name: newTagName.trim(), color: newTagColor.trim() });
      setSuccess('Tag added successfully!');
      setNewTagName('');
      setNewTagColor('');
      fetchTags();
    } catch (e: any) {
      setError(e.message || 'Failed to add tag.');
    } finally {
      setLoading(false);
    }
  };

  // Delete user tag
  const handleDeleteTag = async (tagId: string) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const deleteUserTag = httpsCallable(functions, 'deleteUserTag');
      await deleteUserTag({ tagId });
      setSuccess('Tag deleted successfully!');
      fetchTags();
    } catch (e: any) {
      setError(e.message || 'Failed to delete tag.');
    } finally {
      setLoading(false);
    }
  };

  // Start editing a tag
  const handleStartEdit = (tag: UserTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color || '');
  };

  // Save tag edit
  const handleSaveEdit = async (tagId: string) => {
    if (!editTagName.trim()) {
      setError('Tag name cannot be empty.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updateUserTag = httpsCallable(functions, 'updateUserTag');
      await updateUserTag({ tagId, name: editTagName.trim(), color: editTagColor.trim() });
      setSuccess('Tag updated successfully!');
      setEditingTagId(null);
      fetchTags();
    } catch (e: any) {
      setError(e.message || 'Failed to update tag.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('');
  };

  // Dynamically inject CSS for tag color dots
  useEffect(() => {
    // Remove any previous style tag
    const prev = document.getElementById('user-tag-dot-colors');
    if (prev) prev.remove();
    if (!tags || tags.length === 0) return;
    let css = '';
    tags.forEach(tag => {
      if (tag.color) {
        css += `.tag-color-dot-${tag.id} { --tag-dot-color: ${tag.color}; }\n`;
      }
    });
    if (css) {
      const style = document.createElement('style');
      style.id = 'user-tag-dot-colors';
      style.innerHTML = css;
      document.head.appendChild(style);
    }
  }, [tags]);

  return (
    <div className="user-tag-management-layout">
      <div className="user-tag-management-container">
        <h1>User Tag Management</h1>
        <div className="add-tag-form">
          <input
            type="text"
            placeholder="Tag name"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            className="tag-input"
            title="Tag name"
            aria-label="Tag name"
          />
          <input
            type="color"
            value={newTagColor}
            onChange={e => setNewTagColor(e.target.value)}
            className="color-input"
            title="Tag color"
            aria-label="Tag color"
          />
          <button onClick={handleAddTag} disabled={loading} className="add-tag-btn">
            {loading ? 'Adding...' : 'Add Tag'}
          </button>
        </div>
        {error && <div className="tag-error">{error}</div>}
        {success && <div className="tag-success">{success}</div>}
        <div className="tag-list-section">
          <h2>Your Tags</h2>
          {loading ? (
            <p>Loading tags...</p>
          ) : (
            <ul className="tag-list">
              {tags.length === 0 ? (
                <li>No tags found.</li>
              ) : (
                tags.map(tag => (
                  <li key={tag.id} className={`tag-list-item tag-color-dot-${tag.id}`}> // Add a unique class for color dot
                    <span className={`tag-color-dot tag-color-dot-${tag.id}`}></span>
                    {editingTagId === tag.id ? (
                      <>
                        <input
                          type="text"
                          value={editTagName}
                          onChange={e => setEditTagName(e.target.value)}
                          className="tag-input edit-input"
                          placeholder="Edit tag name"
                          title="Edit tag name"
                          aria-label="Edit tag name"
                        />
                        <input
                          type="color"
                          value={editTagColor}
                          onChange={e => setEditTagColor(e.target.value)}
                          className="color-input edit-color-input"
                          title="Edit tag color"
                          aria-label="Edit tag color"
                        />
                        <button onClick={() => handleSaveEdit(tag.id)} className="edit-save-btn" disabled={loading}>Save</button>
                        <button onClick={handleCancelEdit} className="edit-cancel-btn" disabled={loading}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="tag-name">{tag.name}</span>
                        <button onClick={() => handleStartEdit(tag)} className="edit-btn" disabled={loading}>Edit</button>
                        <button onClick={() => handleDeleteTag(tag.id)} className="delete-btn" disabled={loading}>Delete</button>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
