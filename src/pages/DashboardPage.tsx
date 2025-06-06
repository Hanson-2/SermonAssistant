import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SermonGrid from "../components/SermonGrid";
import { fetchSermons, fetchSermonsByFolder, getSermonFolders, SermonFolder } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";
import SermonFolderDropdown from "../components/SermonFolderDropdown";

import "../pages/DashboardPage.css";
import "../styles/shared-buttons.scss";
import "../styles/scss/main.scss";
import "../styles/custom-folder-dropdown.css";

export default function DashboardPage() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [folders, setFolders] = useState<SermonFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterOpen, setFilterOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  
  // Refs for the dropdown elements
  const filterRef = React.useRef<HTMLDivElement>(null);
  const filterButtonRef = React.useRef<HTMLButtonElement>(null);
  // Effect for click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Close filter panel when clicking outside
      if (filterOpen && filterRef.current && !filterRef.current.contains(event.target as Node) && 
          filterButtonRef.current && !filterButtonRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterOpen]);
  
  useEffect(() => {
    getSermonFolders().then(setFolders);
  }, []);
  useEffect(() => {
    if (selectedFolderId === undefined) return;
    if (selectedFolderId === null) {
      fetchSermons().then((data: any[]) => {
        const validSermons = data
          .filter(
            (sermon) =>
              sermon && sermon.id && sermon.title && sermon.description && sermon.date
          )
          .map((sermon) => sermon as Sermon);
        setSermons(validSermons);
      });
    } else if (selectedFolderId === "__unassigned__") {
      // Handle unassigned sermons (no folderId or empty folderId)
      fetchSermons().then((data: any[]) => {
        const validSermons = data
          .filter(
            (sermon) =>
              sermon && 
              sermon.id && 
              sermon.title && 
              sermon.description && 
              sermon.date && 
              (!sermon.folderId || sermon.folderId === "")
          )
          .map((sermon) => sermon as Sermon);
        setSermons(validSermons);
      });
    } else {
      fetchSermonsByFolder(selectedFolderId).then((data: any[]) => {
        const validSermons = data
          .filter(
            (sermon) =>
              sermon && sermon.id && sermon.title && sermon.description && sermon.date
          )
          .map((sermon) => sermon as Sermon);
        setSermons(validSermons);
      });
    }
  }, [selectedFolderId]);

  function applyFilters(sermons: Sermon[]): Sermon[] {
    return sermons.filter((sermon) => {
      const sermonDate = new Date(sermon.date);
      const matchesArchived = includeArchived || !(sermon as any).isArchived;
      const matchesMonth = selectedMonth
        ? sermonDate.getMonth() + 1 === Number(selectedMonth)
        : true;
      const matchesYear = selectedYear
        ? sermonDate.getFullYear() === Number(selectedYear)
        : true;
      return matchesArchived && matchesMonth && matchesYear;
    });
  }
  if (applyFilters(sermons).length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <div className="relative z-10">
          <h1 className="text-white text-2xl mb-4">
            {selectedFolderId === "__unassigned__" 
              ? "No unassigned expositories found" 
              : selectedFolderId 
                ? "No expositories in this folder" 
                : "No expositories available yet"}
          </h1>

          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={() => setSelectedFolderId(null)}
              className="add-expository-button-shared"
            >
              <span className="add-expository-button-shared-text">
                View All Expositories
              </span>
            </button>
            <button
              onClick={() => navigate("/new-sermon")}
              className="add-expository-button-shared"
            >
              <span className="add-expository-button-shared-text">
                Create New Expository
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-start p-8">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 pt-8 pb-4 w-full max-w-7xl relative">
          {/* Folder Filter Dropdown */}
          <div className="dashboard-filter mb-4 md:mb-0 mr-0 md:mr-4 w-full md:w-auto">
            <label 
              htmlFor="folder-filter" 
              className="folder-filter-label"
            >
              Folder:
            </label>
            <div className="select-container w-full md:w-auto">
              <SermonFolderDropdown
                folders={folders.filter(f => f.id && f.name).map(f => ({ id: f.id!, name: f.name }))}
                value={selectedFolderId}
                onChange={setSelectedFolderId}
              />
            </div>
          </div>
          <button
            ref={filterButtonRef}
            onClick={() => setFilterOpen(!filterOpen)}
            className="filter-button"
            aria-label="Filter"
            aria-expanded={!!filterOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 13.414V20a1 1 0 01-1.447.894l-4-2A1 1 0 009 18v-4.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
          </button>
          {filterOpen && (
            <div 
              ref={filterRef}
              className="absolute top-20 right-6 filter-panel z-50 w-72">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Filter Options</h3>
                <button className="close" onClick={() => setFilterOpen(false)}>&times;</button>
              </div>
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                  />
                  <span>Include Archived</span>
                </label>

                <label htmlFor="month-select" className="block">
                  Month
                </label>
                <select
                  id="month-select"
                  title="Month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {new Date(0, i).toLocaleString("default", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>

                <label htmlFor="year-select" className="block">
                  Year
                </label>
                <select
                  id="year-select"
                  title="Year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <option value="">Year</option>
                  {[2023, 2024, 2025].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        <SermonGrid
          sermons={applyFilters(sermons)}
          activeCardId={activeCardId}
          setActiveCardId={setActiveCardId}
        />
      </div>
    </>
  );
}
