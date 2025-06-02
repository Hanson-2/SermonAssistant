import React, { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, User } from 'firebase/auth';
import './UserScripturePage.css';

interface UserScripture {
  id?: string;
  userId: string;
  versionId: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tags?: string[];
}

export default function UserScripturePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userScriptures, setUserScriptures] = useState<UserScripture[]>([]);
  const [versionId, setVersionId] = useState('');
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const functions = getFunctions();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user || null);
    });
    return () => unsubscribe();
  }, [auth]);

  const fetchUserScriptures = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const getUserScripturesCallable = httpsCallable<any, { scriptures: UserScripture[] }>(functions, 'getUserScriptures');
      const result = await getUserScripturesCallable({ versionId: versionId || undefined });
      setUserScriptures(result.data.scriptures || []);
      setSuccessMessage(null);
    } catch (err: any) {
      setError(`Failed to load scriptures: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, functions, versionId]);

  useEffect(() => {
    if (currentUser) fetchUserScriptures();
  }, [currentUser, fetchUserScriptures]);

  const handleAddScripture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError("You must be logged in to add scripture.");
      return;
    }
    if (!versionId || !book || !chapter || !verse || !text) {
      setError("All fields except tags are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const addUserScriptureCallable = httpsCallable<any, { scriptureId: string }>(functions, 'addUserScripture');
      await addUserScriptureCallable({
        versionId,
        book,
        chapter: Number(chapter),
        verse: Number(verse),
        text,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setSuccessMessage('Scripture added successfully.');
      setBook('');
      setChapter('');
      setVerse('');
      setText('');
      setTags('');
      fetchUserScriptures();
    } catch (err: any) {
      setError(`Failed to add scripture: ${err.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="user-scripture-page">
      <h1>My Custom Scriptures</h1>
      {error && <p className="user-scripture-error">{error}</p>}
      {successMessage && <p className="user-scripture-success">{successMessage}</p>}
      <div className="add-scripture-form">
        <h2>Add New Scripture</h2>
        <form onSubmit={handleAddScripture}>
          <div className="form-row">
            <label htmlFor="versionId">Version ID:</label>
            <input type="text" id="versionId" value={versionId} onChange={e => setVersionId(e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="book">Book:</label>
            <input type="text" id="book" value={book} onChange={e => setBook(e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="chapter">Chapter:</label>
            <input type="number" id="chapter" value={chapter} onChange={e => setChapter(e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="verse">Verse:</label>
            <input type="number" id="verse" value={verse} onChange={e => setVerse(e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="text">Text:</label>
            <textarea id="text" value={text} onChange={e => setText(e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="tags">Tags (comma-separated):</label>
            <input type="text" id="tags" value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <button type="submit" disabled={isLoading}>{isLoading ? 'Adding...' : 'Add Scripture'}</button>
        </form>
      </div>
      <div className="user-scripture-list">
        <h2>My Scriptures</h2>
        {isLoading && userScriptures.length === 0 && <p>Loading scriptures...</p>}
        {!isLoading && userScriptures.length === 0 && !error && <p>You have not added any custom scriptures yet.</p>}
        {userScriptures.length > 0 && (
          <ul>
            {userScriptures.map(s => (
              <li key={s.id}>
                <strong>{s.book} {s.chapter}:{s.verse}</strong> — {s.text}
                {s.tags && s.tags.length > 0 && (
                  <div className="user-scripture-tags"><strong>Tags:</strong> {s.tags.join(', ')}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
