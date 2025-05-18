import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { archiveSermon, deleteSermon, createSermon } from "../../services/firebaseService";
import "./sermonCard.css";

export type Sermon = {
  id: string | number;
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
  notes?: Record<string, string>; // Add notes field for multi-slide support
};

type SermonCardProps = {
  sermon: Sermon;
  className?: string;
};

const SermonCard: React.FC<SermonCardProps> = ({ sermon, className }) => {
  const [showOverlay, setShowOverlay] = useState(false);
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

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() !== 'button') {
      setShowOverlay(!showOverlay);
    }
  };

  const handleView = () => navigate(`/expository/${sermon.id}`);
  const handleEdit = () => navigate(`/edit-expository/${sermon.id}`);
  const handleDuplicate = async () => {
    const { id, ...copyData } = sermon;
    await createSermon(copyData);
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
  };

  const actionButtons = [
    { label: "View", action: handleView },
    { label: "Edit", action: handleEdit },
    { label: "Duplicate", action: handleDuplicate },
    { label: "Archive", action: handleArchive },
    { label: "Delete", action: handleDelete },
  ];

  return (
    <div className="sermon-card-wrapper">
      <div
        ref={cardRef}
        onClick={handleCardClick}
        className={`sermon-card relative ${className || ''}`}
        style={{
          backgroundImage: sermon.imageUrl
            ? `url(${sermon.imageUrl})`
            : 'linear-gradient(90deg, #1e293b 0%, #374151 100%)',
        }}
      >
        <div className="sermon-card-gradient-overlay"></div>
        <div className="sermon-card-content">
          <h2 className="sermon-card-title">{sermon.title}</h2>
          <p>{sermon.description}</p>
          <p className="sermon-card-date">{sermon.date}</p>
        </div>

        {/* Slide-In Flyout */}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SermonCard;
