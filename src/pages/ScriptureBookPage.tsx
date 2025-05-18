import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { listChaptersForBook, getScriptureVersesForChapter } from "../services/firebaseService";
import "./ScriptureBookPage.css";

export default function ScriptureBookPage() {
  const { book } = useParams<{ book: string }>();
  const [chapters, setChapters] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versesByTranslation, setVersesByTranslation] = useState<Record<string, { verse: string, text: string }[]>>({});
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [versesLoading, setVersesLoading] = useState(false);

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
        <div>Loading chapters...</div>
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
                  {Object.keys(versesByTranslation).map((tr) => (
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
                  {selectedTranslation && versesByTranslation[selectedTranslation]?.map((v) => (
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
