import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";

export default function ExpositoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState<Sermon | null>(null);

  useEffect(() => {
    if (!id) return;
    getSermon(id).then((data) => {
      if (data) setSermon(data);
      else navigate("/dashboard");
    });
  }, [id, navigate]);

  if (!sermon) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">{sermon.title}</h1>
        <p className="text-gray-400 mb-2">{sermon.date}</p>
        {sermon.imageUrl && (
          <img
            src={sermon.imageUrl}
            alt={sermon.title}
            className="mb-4 w-full rounded shadow"
          />
        )}
        <p className="text-lg">{sermon.description}</p>
      </div>
    </div>
  );
}
