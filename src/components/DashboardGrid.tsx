import React, { useState } from "react";
import { useSwipeable } from "react-swipeable";
import PaginationControls from "./PaginationControls";

export default function DashboardGrid() {
  const TOTAL_ITEMS = 27;
  const ITEMS_PER_PAGE = 9;
  const allItems = [...Array(TOTAL_ITEMS)].map((_, i) => i + 1);
  const totalPages = Math.ceil(TOTAL_ITEMS / ITEMS_PER_PAGE);

  const [page, setPage] = useState(0);

  const goToPage = (targetPage: number) => {
    const clampedPage = Math.max(0, Math.min(targetPage, totalPages - 1));
    setPage(clampedPage);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => goToPage(page + 1),
    onSwipedRight: () => goToPage(page - 1),
  });

  const pagedItems = allItems.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between p-8">
      <div className="flex flex-col flex-grow justify-between max-w-7xl mx-auto w-full h-full">
        <div
          {...swipeHandlers}
          className="grid gap-6 px-4 w-full grid-cols-[repeat(auto-fit,minmax(250px,1fr))]"
        >
          {pagedItems.map((n) => (
            <div
              key={n}
              className="aspect-[16/9] flex items-center justify-center bg-green-500 text-black text-6xl font-extrabold rounded shadow"
            >
              {n}
            </div>
          ))}
        </div>

        <PaginationControls page={page} totalPages={totalPages} goToPage={goToPage} />
      </div>
    </div>
  );
}
