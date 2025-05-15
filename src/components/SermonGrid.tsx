import React, { useState } from "react";
import SermonCard from "./SermonCard/SermonCard";

export type Sermon = {
  id: string | number;
  title: string;
  date: string;
  imageUrl?: string;
};

type SermonGridProps = {
  sermons: Sermon[];
  itemsPerPage?: number;
  columns?: number;
};

const SermonGrid: React.FC<SermonGridProps> = ({ sermons, itemsPerPage = 9, columns = 3 }) => {
  const [page, setPage] = useState(1);
  const start = (page - 1) * itemsPerPage;
  const paginatedSermons = sermons.slice(start, start + itemsPerPage);
  const totalPages = Math.ceil(sermons.length / itemsPerPage);

  const gridColsMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
  };

  const gridColsClass = gridColsMap[columns] || "grid-cols-3";

  return (
    <div className="sermon-grid-container max-w-screen-lg mx-auto px-6 py-8">
      <div className={`grid grid-cols-3 gap-8 w-full`}>
        {paginatedSermons.map((sermon) => (
          <SermonCard key={sermon.id} sermon={sermon} className="h-full w-full" />
        ))}
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          className="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={page === 1}
        >
          Previous
        </button>
        <button
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default SermonGrid;
