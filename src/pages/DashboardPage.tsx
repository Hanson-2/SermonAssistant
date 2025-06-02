import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SermonGrid from "../components/SermonGrid";
import { fetchSermons, fetchSermonsByFolder, getSermonFolders, SermonFolder } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";

import "../pages/DashboardPage.css";

export default function DashboardPage() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [folders, setFolders] = useState<SermonFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterOpen, setFilterOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

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
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-white mb-4">No expositories available yet.</h1>
        <button
          onClick={() => navigate("/new-sermon")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Create Your First Expository
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-background" />
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-start p-8">
        <div className="flex justify-between items-center px-6 pt-8 pb-4 w-full max-w-7xl relative">
          {/* Folder Filter Dropdown */}
          <div className="mr-4">
            <label htmlFor="folder-filter" className="text-white mr-2">Folder:</label>
            <select
              id="folder-filter"
              value={selectedFolderId || ""}
              onChange={e => setSelectedFolderId(e.target.value || null)}
              className="bg-gray-700 text-white p-2 rounded"
            >
              <option value="">All Folders</option>
              <option value="__unassigned__">Unassigned</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setFilterOpen(true)}
            className="p-2 rounded hover:bg-gray-700 transition"
            aria-label="Filter"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 13.414V20a1 1 0 01-1.447.894l-4-2A1 1 0 019 18v-4.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
          </button>

          {filterOpen && (
            <div className="absolute top-20 right-6 bg-gray-800 text-white rounded-lg shadow-lg p-4 z-50 w-72">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Filter Options</h3>
                <button onClick={() => setFilterOpen(false)}>&times;</button>
              </div>
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                    className="accent-blue-600"
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
                  className="w-full bg-gray-700 text-white p-2 rounded"
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
                  className="w-full bg-gray-700 text-white p-2 rounded"
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
        <SermonGrid sermons={applyFilters(sermons)} />
      </div>
    </>
  );
}
