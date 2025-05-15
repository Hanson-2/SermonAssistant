import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SermonGrid from "../components/SermonGrid";
import { fetchSermons } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";

export default function DashboardPage() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const viewArchived = searchParams.get("view") === "archived";

  useEffect(() => {
    fetchSermons().then((data: any[]) => {
      const validSermons = data
        .filter(
          (sermon) =>
            sermon &&
            sermon.id &&
            sermon.title &&
            sermon.description &&
            sermon.date
        )
        .map((sermon) => sermon as Sermon);
      setSermons(validSermons);
    });
  }, []);

  const filteredSermons = sermons.filter((sermon) =>
    viewArchived ? sermon.isArchived : !sermon.isArchived
  );

  const toggleView = () => {
    setSearchParams({ view: viewArchived ? "active" : "archived" });
  };

  if (filteredSermons.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-white mb-4">
          {viewArchived ? "No archived expositories available." : "No expositories available yet."}
        </h1>
        {!viewArchived && (
          <button
            onClick={() => navigate("/new-sermon")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Create Your First Expository
          </button>
        )}
        <button
          onClick={toggleView}
          className="mt-4 bg-gray-700 text-white px-4 py-2 rounded"
        >
          {viewArchived ? "View Active" : "View Archived"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-start p-8">
      <div className="flex justify-between w-full max-w-7xl mb-4">
        <h1 className="text-white text-xl">
          {viewArchived ? "Archived Expositories" : "Active Expositories"}
        </h1>
        <button
          onClick={toggleView}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          {viewArchived ? "View Active" : "View Archived"}
        </button>
      </div>

      <SermonGrid sermons={filteredSermons} />
    </div>
  );
}
