import React, { useState, useRef, useEffect, Dispatch, SetStateAction } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  imagePosition?: string;
  notes?: Record<string, string>;
  folderId?: string;
  tags?: string[];
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
}) => {  const [showOverlay, setShowOverlay] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const prevLocationRef = useRef(location.pathname);

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
    };  }, [activeCardId, sermon.id, setActiveCardId]);
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle selection mode
    if (isSelectable && onSelect) {
      onSelect();
      return;
    }
    
    // Don't handle clicks on buttons, selects, or flyout elements
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'button' || 
        target.tagName.toLowerCase() === 'select' ||
        target.closest('.flyout-actions') ||
        target.closest('.desktop-flyout')) {
      return;
    }
    
    // Handle normal card interaction
    // Check if we're on mobile (screen width <= 768px)
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // On mobile, toggle embossed buttons below card (no flyout)
      if (setActiveCardId) {
        const newActiveId = activeCardId === sermon.id.toString() ? null : sermon.id.toString();
        setActiveCardId(newActiveId);
      }
    } else {
      // On desktop, show the flyout overlay (no embossed buttons)
      if (setActiveCardId) {
        setActiveCardId(prev => (prev === sermon.id.toString() ? null : sermon.id.toString()));
      }
      setShowOverlay(!showOverlay);
    }
  };  const handleEdit = () => navigate(`/expository/${sermon.id}`);
  const handlePresentation = () => navigate(`/presentation/${sermon.id}`);
  const handleDuplicate = async () => {    const { id, ...copyData } = sermon;
    // Ensure required fields for NewSermonData are present
    await createSermon({
      ...copyData,
      bibleBook: (sermon as any).bibleBook || "",
      bibleChapter: (sermon as any).bibleChapter || "",
      bibleStartVerse: (sermon as any).bibleStartVerse || "",
      bibleEndVerse: (sermon as any).bibleEndVerse || "",
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
    { label: "Edit", action: handleEdit },
    { label: "Presentation", action: handlePresentation },
    { label: "Duplicate", action: handleDuplicate },
    { label: "Archive", action: handleArchive },
    { label: "Delete", action: handleDelete },
  ];
  
  // Utility: detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;  // Native DOM mobile action bar positioned under the card
  useEffect(() => {
    if (!hideActions && !isSelectable && !showAddButton && !showRemoveButton && !showSeriesSelector &&
        isMobile && activeCardId === sermon.id.toString() && cardRef.current) {
      
      // Create the action bar container
      const actionBar = document.createElement('div');
      actionBar.className = 'mobile-embossed-actions';      actionBar.style.cssText = `
        position: relative;
        left: 0;
        right: 0;
        width: 100%;
        display: flex;
        background: #23232b;
        border-top: 1px solid #ffe082;
        border-bottom: 3px solid #c2410c;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 1000;
        pointer-events: auto;
        margin-top: 0;
      `;      // Define specific colors for each action button
      const buttonColors = {
        'view': '#10b981',    // green
        'edit': '#3b82f6',    // blue  
        'presentation': '#8b5cf6', // purple
        'duplicate': '#f59e0b', // amber
        'archive': '#6b7280',   // gray
        'delete': '#ef4444'     // red
      };

      // Separate buttons into main actions and presentation
      const mainButtons = actionButtons.filter(btn => btn.label !== 'Presentation');
      const presentationButton = actionButtons.find(btn => btn.label === 'Presentation');

      // Create main action buttons
      mainButtons.forEach((buttonData, idx) => {
        const button = document.createElement('button');
        button.textContent = buttonData.label;
        button.className = `mobile-embossed-button mobile-embossed-${buttonData.label.toLowerCase()}`;
        
        const buttonColor = buttonColors[buttonData.label.toLowerCase() as keyof typeof buttonColors] || '#ffe082';
        
        button.style.cssText = `
          flex: 1;
          border: none;
          background: transparent;
          color: ${buttonColor};
          padding: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          pointer-events: auto;
          z-index: 1001;
          ${idx !== mainButtons.length - 1 ? 'border-right: 1px solid #444;' : ''}
        `;
        
        // Add hover/active states with the specific button color
        button.addEventListener('mouseenter', () => {
          button.style.background = `${buttonColor}20`; // 20% opacity
        });
        button.addEventListener('mouseleave', () => {
          button.style.background = 'transparent';
        });
        button.addEventListener('mousedown', () => {
          button.style.background = `${buttonColor}40`; // 40% opacity
        });
        button.addEventListener('mouseup', () => {
          button.style.background = `${buttonColor}20`; // 20% opacity
        });
        
        // Add click handler
        const handleClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          buttonData.action();
        };
        
        button.addEventListener('click', handleClick);
        button.addEventListener('touchstart', handleClick);
        
        actionBar.appendChild(button);
      });
      
      // Create presentation button on separate row
      const presentationBar = document.createElement('div');
      presentationBar.className = 'mobile-embossed-actions';
      presentationBar.style.cssText = `
        position: relative;
        left: 0;
        right: 0;
        width: 100%;
        display: flex;
        background: #23232b;
        border-top: 1px solid #ffe082;
        border-bottom: 3px solid #c2410c;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 1000;
        pointer-events: auto;
        margin-top: 0.5rem;
      `;

      if (presentationButton) {
        const button = document.createElement('button');
        button.textContent = presentationButton.label;
        button.className = `mobile-embossed-button mobile-embossed-presentation`;
        
        const buttonColor = buttonColors['presentation'];
        
        button.style.cssText = `
          flex: 1;
          border: none;
          background: transparent;
          color: ${buttonColor};
          padding: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          pointer-events: auto;
          z-index: 1001;
        `;
        
        // Add hover/active states
        button.addEventListener('mouseenter', () => {
          button.style.background = `${buttonColor}20`;
        });
        button.addEventListener('mouseleave', () => {
          button.style.background = 'transparent';
        });
        button.addEventListener('mousedown', () => {
          button.style.background = `${buttonColor}40`;
        });
        button.addEventListener('mouseup', () => {
          button.style.background = `${buttonColor}20`;
        });
        
        // Add click handler
        const handleClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          presentationButton.action();
        };
        
        button.addEventListener('click', handleClick);
        button.addEventListener('touchstart', handleClick);
        
        presentationBar.appendChild(button);
      }      
      // Always append to the card wrapper to maintain document flow
      const cardWrapper = cardRef.current.parentElement;
      if (cardWrapper && cardWrapper.classList.contains('sermon-card-wrapper')) {
        // Append main action bar to the card wrapper
        cardWrapper.appendChild(actionBar);
        // Append presentation bar to the card wrapper
        cardWrapper.appendChild(presentationBar);
      } else {
        // Fallback: append to the card itself
        cardRef.current.appendChild(actionBar);
        cardRef.current.appendChild(presentationBar);
      }
      
      // Cleanup function
      return () => {
        if (actionBar.parentNode) {
          actionBar.parentNode.removeChild(actionBar);
        }
        if (presentationBar.parentNode) {
          presentationBar.parentNode.removeChild(presentationBar);
        }
      };
    }
  }, [isMobile, activeCardId, sermon.id, hideActions, isSelectable, showAddButton, showRemoveButton, showSeriesSelector]);
  return (
    <div className="sermon-card-wrapper">
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className={`sermon-card relative ${className || ''} ${
          activeCardId === sermon.id.toString() ? 'active' : ''
        } ${isSelectable ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}        style={{
          backgroundImage: sermon.imageUrl
            ? `url("${sermon.imageUrl}")`
            : 'linear-gradient(90deg, #1e293b 0%, #374151 100%)',
          backgroundSize: 'cover',
          backgroundPosition: sermon.imagePosition || 'center',
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
          </div>        )}
          {/* Presentation button moved out of the card - will be rendered below */}
        
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
          )}        </div>
  
          {/* Slide-In Flyout - Only show on desktop, hidden on mobile */}
        {!hideActions && !isSelectable && !showAddButton && !showRemoveButton && !showSeriesSelector && (
          <div
            className={`absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end px-4 transition-transform duration-300 desktop-flyout ${
              showOverlay ? "translate-x-0" : "translate-x-full"
            }`}
            style={{ zIndex: 1000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flyout-actions desktop-actions flex gap-2 p-2">
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
                </button>              ))}
            </div>          </div>        )}</div>    </div>
  );
};

export default SermonCard;
