import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon, uploadExpositoryImage } from "../services/firebaseService";

export default function NewExpositoryPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !date) {
      alert("Please fill in all fields.");
      return;
    }

    let imageUrl = "";
    if (imageFile) {
      imageUrl = await uploadExpositoryImage(imageFile);
    }

    await createSermon({
      title,
      description,
      date,
      imageUrl,
      isArchived: false,
      imageOnly: false,
    });

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
      <h1 className="text-white text-2xl mb-4">Create New Expository</h1>
      <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded shadow-md w-full max-w-md">
        <label className="block text-white mb-2">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
          />
        </label>

        <label className="block text-white mb-2 mt-4">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
          />
        </label>

        <label className="block text-white mb-4 mt-4">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
          />
        </label>

        <label className="block text-white mb-4 mt-4">
          Cover Image (Optional)
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
          />
        </label>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full"
        >
          Save Expository
        </button>
      </form>
    </div>
  );
}
