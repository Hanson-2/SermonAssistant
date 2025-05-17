import React from "react";

type PaginationProps = {
  page: number;
  totalPages: number;
  goToPage: (page: number) => void;
};

export default function PaginationControls({
  page,
  totalPages,
  goToPage,
}: PaginationProps) {
  return (
    <div className="flex flex-col items-center w-full mt-8 space-y-2">
      <div className="flex space-x-2">
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            onClick={() => goToPage(i)}
            className={`h-3 w-3 rounded-full ring-1 ring-white transition-all duration-200 cursor-pointer ${
              i === page ? "bg-blue-500 scale-125" : "bg-gray-400 hover:scale-110"
            }`}
            aria-label={`Go to page ${i + 1}`}
            title={`Go to page ${i + 1}`}
          />
        ))}
      </div>

      <div className="flex justify-between w-full max-w-xs mt-2">
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page === 0}
          className="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => goToPage(page + 1)}
          disabled={page === totalPages - 1}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
