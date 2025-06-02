import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { archiveSermon, deleteSermon, createSermon, assignSermonToFolder, getSermonFolders } from "../../services/firebaseService";
import "./sermonCard.css";

// Add SermonFolder type
export type SermonFolder = {
  id?: string;
  userId: string;
  name: string;
  createdAt?: any;
  updatedAt?: any;
};

// Add folderId to Sermon type
export type Sermon = {
  id: string | number;
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
  notes?: Record<string, string>;
  folderId?: string;
};

type SermonCardProps = {
  sermon: Sermon;
  className?: string;
  hideActions?: boolean;
};

const SermonCard: React.FC<SermonCardProps> = ({ sermon, className, hideActions }) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const [folders, setFolders] = useState<SermonFolder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setShowOverlay(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setFolderLoading(true);
    getSermonFolders()
      .then(setFolders)
      .catch(e => setFolderError(e.message || "Failed to load folders"))
      .finally(() => setFolderLoading(false));
  }, []);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() !== 'button') {
      setShowOverlay(!showOverlay);
    }
  };

  const handleView = () => navigate(`/expository/${sermon.id}`);
  const handleEdit = () => navigate(`/edit-expository/${sermon.id}`);
  const handleDuplicate = async () => {
    const { id, ...copyData } = sermon;
    // Ensure required fields for NewSermonData are present
    await createSermon({
      ...copyData,
      bibleBook: (sermon as any).bibleBook || "",
      bibleChapter: (sermon as any).bibleChapter || "",
      bibleStartVerse: (sermon as any).bibleStartVerse || "",
      bibleEndVerse: (sermon as any).bibleEndVerse || "",
      dateAdded: undefined
    });
    alert("Duplicated successfully.");
  };
  const handleArchive = async () => {
    await archiveSermon(sermon.id.toString());
    alert("Archived successfully.");
  };
  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this sermon?")) {
      await deleteSermon(sermon.id.toString());
      alert("Deleted successfully.");
    }
  };  const actionButtons = [
    { label: "View", action: handleView },
    { label: "Edit", action: handleEdit },
    { label: "Duplicate", action: handleDuplicate },
    { label: "Archive", action: handleArchive },
    { label: "Delete", action: handleDelete },
  ];

  return (
    <div className="sermon-card-wrapper">      <div
        ref={cardRef}
        onClick={handleCardClick}        className={`sermon-card relative ${className || ''}`}
        style={{
          backgroundImage: sermon.imageUrl
            ? `url("${sermon.imageUrl}")`
            : 'linear-gradient(90deg, #1e293b 0%, #374151 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="sermon-card-gradient-overlay"></div>
        <div className="sermon-card-content">
          <h2 className="sermon-card-title">{sermon.title}</h2>
          <p>{sermon.description}</p>
          <p className="sermon-card-date">{sermon.date}</p>
        </div>

        {/* Slide-In Flyout */}
        {!hideActions && (
          <div
            className={`absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end px-4 transition-transform duration-300 ${
              showOverlay ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flyout-actions flex gap-2 p-2">
              {actionButtons.map(({ label, action }) => (
                <button
                  key={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    action();
                  }}
                  className={`sermon-action-button sermon-action-${label.toLowerCase()}`}
                >
                  {label}
                </button>
              ))}

              {/* Folder assignment dropdown */}
              {!folderLoading && folders.length > 0 && (
                <select
                  value={sermon.folderId || ""}
                  onChange={async (e) => {
                    const newFolderId = e.target.value === "__unassigned__" ? null : e.target.value;
                    await assignSermonToFolder(sermon.id.toString(), newFolderId);
                    window.location.reload(); // Quick way to refresh, or trigger a prop/state update if possible
                  }}
                  className="sermon-folder-select"
                  aria-label="Move to folder"
                >
                  <option value="">All Folders</option>
                  <option value="__unassigned__">Unassigned</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SermonCard;
