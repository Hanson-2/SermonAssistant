import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSermon, updateSermon } from "../services/firebaseService";
import { uploadExpositoryImage } from "../services/firebaseService";

export default function EditExpositoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getSermon(id).then((sermon) => {
      if (sermon) {
        setTitle(sermon.title);
        setDescription(sermon.description);
        setDate(sermon.date);
      }
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let imageUrl = "";
    if (imageFile) {
      imageUrl = await uploadExpositoryImage(imageFile);
    }

    const updatedData: any = {
      title,
      description,
      date,
    };

    if (imageUrl) {
      updatedData.imageUrl = imageUrl;
    }

    await updateSermon(id!, updatedData);
    navigate("/dashboard");
  };

  if (loading) {
    return <p className="text-white text-center">Loading expository data...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
      <h1 className="text-white text-2xl mb-4">Edit Expository</h1>
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
          Replace Cover Image (Optional)
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
          Save Changes
        </button>
      </form>
    </div>
  );
}
