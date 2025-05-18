import React, { useState, useEffect, useRef } from "react";
import SermonCard from "./SermonCard/SermonCard";

export type Sermon = {
  id: string | number;
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
};

type SermonGridProps = {
  sermons: Sermon[];
};

const ITEMS_PER_BATCH = 5;

const SermonGrid: React.FC<SermonGridProps> = ({ sermons }) => {
  const [visibleSermons, setVisibleSermons] = useState<Sermon[]>([]);
  const [page, setPage] = useState(1);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
          <SermonCard sermon={sermon} className="w-full" />
        </div>
      ))}

      <div ref={observerRef} className="h-10 flex justify-center items-center w-full">
        {isLoading && <span className="text-white">Loading more...</span>}
        {!isLoading && visibleSermons.length >= sermons.length && (
          <button
            className="add-expository-btn"
            onClick={() => window.location.href = '/new-sermon'}
          >
            + Add New Expository
          </button>
        )}
      </div>
    </div>
  );
};

export default SermonGrid;
