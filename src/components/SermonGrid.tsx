import React, { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import SermonCard from "./SermonCard/SermonCard";
import "./SermonGrid.css";
import "../styles/shared-buttons.scss";
import "../styles/scss/main.scss";

export type Sermon = {
  id: string | number;
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
};

type SermonGridProps = {
  sermons: Sermon[];
  activeCardId: string | null;
  setActiveCardId: Dispatch<SetStateAction<string | null>>;
};

const ITEMS_PER_BATCH = 5;

const SermonGrid: React.FC<SermonGridProps> = ({ sermons, activeCardId, setActiveCardId }) => {
  const [visibleSermons, setVisibleSermons] = useState<Sermon[]>([]);
  const [page, setPage] = useState(1);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setVisibleSermons(sermons.slice(0, ITEMS_PER_BATCH));
    setPage(1);
  }, [sermons]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleSermons.length < sermons.length) {
        setIsLoading(true);
        setTimeout(() => {
          const nextPage = page + 1;
          const nextBatch = sermons.slice(0, nextPage * ITEMS_PER_BATCH);
          setVisibleSermons(nextBatch);
          setPage(nextPage);
          setIsLoading(false);
        }, 500);
      }
    });

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [page, sermons, visibleSermons]);

  return (
    <div className="flex flex-col items-center w-full px-4 md:px-8 py-8 space-y-6 max-w-screen-xl mx-auto">
      {visibleSermons.map((sermon) => (
        <div key={sermon.id} className="w-full">
          <SermonCard
            sermon={sermon}
            className="w-full"
            activeCardId={activeCardId}
            setActiveCardId={setActiveCardId}
          />
        </div>
      ))}      <div ref={observerRef} className="h-10 flex justify-center items-center w-full">
        {isLoading && <span className="text-white">Loading more...</span>}
      </div>

      {/* Add Expository Button */}
      <div className="w-full max-w-xs mx-auto mt-8">
        <button 
          className="add-expository-button-shared"
          onClick={() => navigate("/new-sermon")}
          aria-label="Add New Expository"
        >
          <span className="add-expository-button-shared-text">Add Expository</span>
        </button>
      </div>
    </div>
  );
};

export default SermonGrid;
