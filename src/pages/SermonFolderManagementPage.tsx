import React, { useEffect, useState } from "react";
import {
  createSermonFolder,
  getSermonFolders,
  updateSermonFolder,
  deleteSermonFolder,
  SermonFolder,
} from "../services/firebaseService";
import "./SermonFolderManagementPage.css";

const SermonFolderManagementPage: React.FC = () => {
  const [folders, setFolders] = useState<SermonFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadFolders = async () => {
    setLoading(true);
    try {
      const data = await getSermonFolders();
      setFolders(data);
    } catch (e: any) {
      setError(e.message || "Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const handleAdd = async () => {
    if (!newFolderName.trim()) return;
    setLoading(true);
    try {
      await createSermonFolder(newFolderName.trim());
      setNewFolderName("");
      await loadFolders();
    } catch (e: any) {
      setError(e.message || "Failed to add folder");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    setLoading(true);
    try {
      await updateSermonFolder(id, editingName.trim());
      setEditingId(null);
      setEditingName("");
      await loadFolders();
    } catch (e: any) {
      setError(e.message || "Failed to update folder");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this folder?")) return;
    setLoading(true);
    try {
      await deleteSermonFolder(id);
      await loadFolders();
    } catch (e: any) {
      setError(e.message || "Failed to delete folder");
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      {/* Background overlay */}
      <div className="universal-search-bg"></div>
      
      <div className="sermon-folder-management-page">
        <div className="folder-management-container">
          <h1>Sermon Folders</h1>
          <div className="add-folder-row">
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              aria-label="New folder name"
            />
            <button onClick={handleAdd} disabled={loading || !newFolderName.trim()}>
              Add Folder
            </button>          </div>
          {error && <div className="error-message">{error}</div>}
          
          {/* Section divider */}
          <div className="section-divider"></div>
          
          <ul className="folder-list">
            {folders.map(folder => (
              <li key={folder.id} className="folder-list-item">
                {editingId === folder.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      aria-label="Edit folder name"
                    />
                    <button onClick={() => handleUpdate(folder.id!)} disabled={loading || !editingName.trim()}>
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} disabled={loading}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span>{folder.name}</span>
                    <button onClick={() => handleEdit(folder.id!, folder.name)} disabled={loading}>
                      Rename
                    </button>
                    <button onClick={() => handleDelete(folder.id!)} disabled={loading}>
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {loading && <div className="loading-message">Loading...</div>}
        </div>
      </div>
    </>
  );
};

export default SermonFolderManagementPage;
