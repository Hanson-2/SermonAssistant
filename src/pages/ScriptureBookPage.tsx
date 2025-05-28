import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { listChaptersForBook, getScriptureVersesForChapter } from "../services/firebaseService";
import { auth } from "../lib/firebase";
import "./ScriptureBookPage.css";

function AnimatedEllipsis() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(interval);
  }, []);
  return <span className="animated-ellipsis">{'.'.repeat(dots)}</span>;
}

export default function ScriptureBookPage() {
  const { book } = useParams<{ book: string }>();
  const [chapters, setChapters] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versesByTranslation, setVersesByTranslation] = useState<Record<string, { verse: string, text: string }[]>>({});
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [versesLoading, setVersesLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchChapters() {
      if (!book) return;
      setLoading(true);
      const fetchedChapters = await listChaptersForBook(book);
      setChapters(fetchedChapters);
      setLoading(false);
    }
    fetchChapters();
  }, [book]);

  useEffect(() => {
    async function fetchVerses() {
      if (!book || !selectedChapter) return;
      setVersesLoading(true);
      const verses = await getScriptureVersesForChapter(book, selectedChapter);
      // Group by translation
      const grouped: Record<string, { verse: string, text: string }[]> = {};
      for (const v of verses) {
        if (!grouped[v.translation]) grouped[v.translation] = [];
        grouped[v.translation].push({ verse: v.verse, text: v.text });
      }
      setVersesByTranslation(grouped);
      // Default to first translation
      setSelectedTranslation(Object.keys(grouped)[0] || null);
      setVersesLoading(false);
    }
    if (selectedChapter) fetchVerses();
  }, [book, selectedChapter]);

  return (
    <div className="scripture-book-layout">
      <h1 className="scripture-book-title">{book}</h1>
      {loading ? (
        <div className="loading-chapters-text">Loading chapters<AnimatedEllipsis /></div>
      ) : (
        <div className="chapter-nav">
          {chapters.map((ch) => (
            <button
              key={ch}
              className={`chapter-btn${selectedChapter === ch ? " selected" : ""}`}
              onClick={() => setSelectedChapter(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}
      {selectedChapter && (
        <div className="chapter-text-animate">
          {versesLoading ? (
            <div>Loading verses...</div>
          ) : (
            Object.keys(versesByTranslation).length > 0 && (
              <>
                <div className="translation-toggle-group">
                  {Object.keys(versesByTranslation)
                    .filter(tr => tr !== "EXB" || userId === "89UdurybrVSwbPmp4boEMeYdVzk1")
                    .map((tr) => (
                      <button
                        key={tr}
                        className={`translation-toggle-btn${selectedTranslation === tr ? " selected" : ""}`}
                        onClick={() => setSelectedTranslation(tr)}
                      >
                        {tr}
                      </button>
                    ))}
                </div>
                <ul className="chapter-verse-list">
                  {selectedTranslation &&
                    (selectedTranslation !== "EXB" || userId === "89UdurybrVSwbPmp4boEMeYdVzk1") &&
                    versesByTranslation[selectedTranslation]?.map((v) => (
                      <li key={v.verse} className="chapter-verse-item">
                        <span className="chapter-verse-num">{v.verse}</span>
                        <span className="chapter-verse-text">{v.text}</span>
                      </li>
                    ))}
                </ul>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
