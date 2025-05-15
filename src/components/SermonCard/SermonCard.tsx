import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { archiveSermon, deleteSermon } from "../../services/firebaseService";

export type Sermon = {
  id: string;
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
  imageOnly?: boolean;
  isArchived?: boolean;
};

type SermonCardProps = {
  sermon: Sermon;
};

export default function SermonCard({ sermon }: SermonCardProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  if (!sermon || !sermon.id || !sermon.title) return null;

  const handleCardClick = () => navigate(`/expository/${sermon.id}`);
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/edit-expository/${sermon.id}`);
  };

  const handleArchiveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveSermon(sermon.id);
    alert("Expository archived.");
    setShowMenu(false);
    window.location.reload();
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this expository?")) {
      await deleteSermon(sermon.id);
      alert("Expository deleted.");
      setShowMenu(false);
      window.location.reload();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="relative w-full h-full rounded-lg overflow-hidden shadow-lg cursor-pointer text-left"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-black opacity-80 z-0" />

      {/* Three-Dot Menu */}
      <div className="absolute top-2 right-2 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="text-white bg-black bg-opacity-50 rounded-full px-2"
        >
          ⋯
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 bg-gray-800 text-white rounded shadow">
            <button
              onClick={handleEditClick}
              className="block px-4 py-2 hover:bg-gray-700 w-full text-left"
            >
              Edit
            </button>
            <button
              onClick={handleArchiveClick}
              className="block px-4 py-2 hover:bg-gray-700 w-full text-left"
            >
              Archive
            </button>
            <button
              onClick={handleDeleteClick}
              className="block px-4 py-2 hover:bg-red-700 w-full text-left"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {sermon.imageOnly && sermon.imageUrl ? (
        <img
          src={sermon.imageUrl}
          alt={sermon.title}
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      ) : (
        <div className="relative p-4 z-10 flex flex-col h-full justify-between">
          <h2 className="text-xl font-bold text-white">{sermon.title}</h2>
          <p className="text-sm text-gray-300 mt-2">{sermon.description}</p>
          <p className="text-xs text-gray-400 mt-4">{sermon.date}</p>
        </div>
      )}
    </div>
  );
}
