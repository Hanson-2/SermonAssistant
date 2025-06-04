import React, { useState, useRef, useEffect, Dispatch, SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { archiveSermon, deleteSermon, createSermon, assignSermonToFolder, getSermonFolders } from "../../services/firebaseService";
import "../../styles/scss/main.scss";

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

// Extend SermonCardProps to include new functionality
interface SermonCardProps {
  sermon: Sermon;
  className?: string;
  hideActions?: boolean;
  activeCardId?: string | null;
  setActiveCardId?: Dispatch<SetStateAction<string | null>>;
  // Selection functionality
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  // Action buttons
  showAddButton?: boolean;
  onAdd?: () => void;
  showRemoveButton?: boolean;
  onRemove?: () => void;
  // Series selector
  showSeriesSelector?: boolean;
  seriesList?: Array<{ id: string; name: string }>;
  onSeriesSelect?: (seriesId: string) => void;
}

const SermonCard: React.FC<SermonCardProps> = ({ 
  sermon, 
  className, 
  hideActions, 
  activeCardId, 
  setActiveCardId,
  isSelectable = false,
  isSelected = false,
  onSelect,
  showAddButton = false,
  onAdd,
  showRemoveButton = false,
  onRemove,
  showSeriesSelector = false,
  seriesList = [],
  onSeriesSelect
}) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Add click outside handler to close card
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node) && 
          setActiveCardId && activeCardId === sermon.id.toString()) {
        setActiveCardId(null);
        setShowOverlay(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeCardId, sermon.id, setActiveCardId]);
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle selection mode
    if (isSelectable && onSelect) {
      onSelect();
      return;
    }
    
    // Handle normal card interaction
    if ((e.target as HTMLElement).tagName.toLowerCase() !== 'button' && 
        (e.target as HTMLElement).tagName.toLowerCase() !== 'select') {
      if (setActiveCardId) {
        setActiveCardId(prev => (prev === sermon.id.toString() ? null : sermon.id.toString()));
      }
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
        onClick={handleCardClick}        className={`sermon-card relative ${className || ''} ${
          activeCardId === sermon.id.toString() ? 'active' : ''
        } ${isSelectable ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
        style={{
          backgroundImage: sermon.imageUrl
            ? `url("${sermon.imageUrl}")`
            : 'linear-gradient(90deg, #1e293b 0%, #374151 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundBlendMode: 'overlay',
        }}
      >        <div className="sermon-card-gradient-overlay"></div>
        
        {/* Selection checkbox overlay */}
        {isSelectable && (
          <div className="selection-overlay">            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="selection-checkbox"
              title="Select sermon for bulk actions"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        <div className="sermon-card-content">
          <h2 className="sermon-card-title">{sermon.title}</h2>
          <p>{sermon.description}</p>
          <p className="sermon-card-date">{sermon.date}</p>
          
          {/* Action buttons */}
          {(showAddButton || showRemoveButton) && (
            <div className="card-actions">
              {showAddButton && onAdd && (
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                >
                  Add to Series
                </button>
              )}
              {showRemoveButton && onRemove && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )}
          
          {/* Series selector */}
          {showSeriesSelector && seriesList.length > 0 && onSeriesSelect && (
            <div className="series-selector-wrapper">              <select 
                className="series-selector"
                title="Assign sermon to a series"
                onChange={(e) => {
                  if (e.target.value) {
                    onSeriesSelect(e.target.value);
                    e.target.value = '';
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Assign to series...</option>
                {seriesList.map((series) => (
                  <option key={series.id} value={series.id}>{series.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>        {/* Slide-In Flyout - Only show on dashboard/main pages, not on series management */}
        {!hideActions && !isSelectable && !showAddButton && !showRemoveButton && !showSeriesSelector && (
          <div
            className={`absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end px-4 transition-transform duration-300 ${
              showOverlay ? "translate-x-0" : "translate-x-full"
            }`}
            style={{ zIndex: 1000 }} /* Increased z-index to ensure it's always on top */
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SermonCard;
