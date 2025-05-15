import React from "react";

type PaginationProps = {
  page: number;
  totalPages: number;
  goToPage: (page: number) => void;
};

export default function PaginationControls({ page, totalPages, goToPage }: PaginationProps) {
  return (
    <div className="flex justify-between items-center w-full max-w-7xl px-4 mt-4">
      <button
        onClick={() => goToPage(page - 1)}
        disabled={page === 0}
        className="text-xs px-1.5 py-0.5 border border-gray-500 rounded hover:bg-gray-700 hover:text-white disabled:opacity-50"
      >
        Prev
      </button>

      <div className="flex space-x-1">
        {[...Array(totalPages)].map((_, i) => {
          const isActive = i === page;
          return (
            <button
              key={i}
              onClick={() => goToPage(i)}
              className={`rounded border border-gray-500 text-xs px-1.5 py-0.5 transition-all duration-200 cursor-pointer 
                ${isActive 
                  ? "bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow" 
                  : "bg-gradient-to-r from-gray-400 to-gray-300 hover:scale-110"
                }`}
              aria-label={`Go to page ${i + 1}`}
              title={`Go to page ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => goToPage(page + 1)}
        disabled={page === totalPages - 1}
        className="text-xs px-1.5 py-0.5 border border-gray-500 rounded hover:bg-gray-700 hover:text-white disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
