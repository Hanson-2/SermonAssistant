import { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Your Firebase config here
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function AdminUpload() {
  const [mode, setMode] = useState('text');
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');

  const uploadTextMode = async () => {
    const lines = content.trim().split('\n').map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const verseNum = (i + 1).toString();
      const verseRef = doc(db, 'bible', book, chapter, verseNum);
      await setDoc(verseRef, { text: lines[i] });
    }
    setStatus(`Uploaded ${lines.length} verses to ${book} ${chapter}`);
  };

  const uploadJsonMode = async () => {
    try {
      const data = JSON.parse(content);
      const { book: jsonBook, chapter: jsonChapter, verses } = data;
      for (const verseNum in verses) {
        const verseRef = doc(db, 'bible', jsonBook, jsonChapter.toString(), verseNum.toString());
        await setDoc(verseRef, { text: verses[verseNum] });
      }
      setStatus(`Uploaded ${Object.keys(verses).length} verses to ${jsonBook} ${jsonChapter}`);
    } catch (error) {
      console.error(error);
      setStatus('Invalid JSON format.');
    }
  };

  const handleUpload = async () => {
    if (mode === 'text') {
      if (!book || !chapter || !content.trim()) {
        setStatus('Please fill all fields.');
        return;
      }
      await uploadTextMode();
    } else {
      if (!content.trim()) {
        setStatus('Please paste JSON content.');
        return;
      }
      await uploadJsonMode();
    }
    setContent('');
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl mb-4">Admin Scripture Bulk Upload</h1>
      <div className="mb-4">
        <label className="mr-4">
          <input
            type="radio"
            checked={mode === 'text'}
            onChange={() => setMode('text')}
          /> Plain Text
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'json'}
            onChange={() => setMode('json')}
          /> JSON
        </label>
      </div>

      {mode === 'text' && (
        <>
          <input
            type="text"
            placeholder="Book Name (e.g., Genesis)"
            value={book}
            onChange={(e) => setBook(e.target.value)}
            className="border p-2 mb-2 w-full"
          />
          <input
            type="number"
            placeholder="Chapter Number (e.g., 1)"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="border p-2 mb-2 w-full"
          />
        </>
      )}

      <textarea
        rows="10"
        placeholder={mode === 'text' ? 'Paste verses line by line here...' : 'Paste JSON here...'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="border p-2 mb-2 w-full"
      />
      <button onClick={handleUpload} className="bg-blue-500 text-white px-4 py-2 rounded">
        Upload
      </button>
      {status && <p className="mt-2">{status}</p>}
    </div>
  );
}
