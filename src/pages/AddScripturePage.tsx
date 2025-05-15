import React, { useState } from "react";
import { addScripture } from "../services/firebaseService";
import { parseScriptureChapterInput } from "../services/scriptureParser";


export default function AddScripturePage() {
  const [input, setInput] = useState("");
  const [parsedVerses, setParsedVerses] = useState<any[]>([]);
  const [error, setError] = useState("");

  const handleParse = () => {
    try {
      const results = parseScriptureChapterInput(input);
      setParsedVerses(results);
      setError("");
    } catch (err: any) {
      setError(err.message);
      setParsedVerses([]);
    }
  };

  const handleSubmit = async () => {
    for (const verse of parsedVerses) {
      await addScripture(verse);
    }
    alert("Scriptures added successfully.");
    setInput("");
    setParsedVerses([]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl mb-4">Add Scripture</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste scripture lines here, e.g.:\nJohn 3:16 For God so loved the world..."
        rows={10}
        className="w-full p-2 rounded bg-gray-800 mb-4"
      />

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <button
        onClick={handleParse}
        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mb-4"
      >
        Parse Scripture
      </button>

      {parsedVerses.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl mb-2">Preview</h2>
          <ul className="list-disc pl-5">
            {parsedVerses.map((verse, index) => (
              <li key={index}>
                {verse.book} {verse.chapter}:{verse.verse} - {verse.text}
              </li>
            ))}
          </ul>
          <button
            onClick={handleSubmit}
            className="mt-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Submit All to Firebase
          </button>
        </div>
      )}
    </div>
  );
}
