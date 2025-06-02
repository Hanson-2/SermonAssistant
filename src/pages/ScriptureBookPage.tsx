import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { listChaptersForBook, getScriptureVersesForChapter } from "../services/firebaseService";
import { auth } from "../lib/firebase";
import "./ScriptureBookPage.css";

export default function ScriptureBookPage() {
  // Correctly use 'bookName' from route params
  const { bookName } = useParams<{ bookName: string }>(); 
  const [chapters, setChapters] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versesByTranslation, setVersesByTranslation] = useState<Record<string, { verse: string, text: string }[]>>({});
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(null);
  const [versesLoading, setVersesLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const verseRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchChapters() {
      // Use bookName
      if (!bookName) return;
      console.log("[ScriptureBookPage] Fetching chapters for book:", bookName); // Added log
      setLoading(true);
      const fetchedChapters = await listChaptersForBook(bookName);
      console.log("[ScriptureBookPage] Fetched chapters:", fetchedChapters); // Added log
      setChapters(fetchedChapters);
      setLoading(false);
    }
    fetchChapters();
  }, [bookName]); // Depend on bookName

  useEffect(() => {
    async function fetchVerses() {
      // Use bookName
      if (!bookName || !selectedChapter) return;
      console.log("[ScriptureBookPage] Fetching verses for book:", bookName, "chapter:", selectedChapter); // Added log
      setVersesLoading(true);
      const verses = await getScriptureVersesForChapter(bookName, selectedChapter);
      console.log("[ScriptureBookPage] Fetched verses raw:", verses); // Added log
      // Group by translation
      const grouped: Record<string, { verse: string, text: string }[]> = {};
      for (const v of verses) {
        if (!grouped[v.translation]) grouped[v.translation] = [];
        // Assuming getScriptureVersesForChapter returns objects with 'verse' as verse number string
        grouped[v.translation].push({ verse: v.verse, text: v.text });
      }
      setVersesByTranslation(grouped);
      // Default to first translation
      const firstTranslation = Object.keys(grouped)[0] || null;
      console.log("[ScriptureBookPage] First translation:", firstTranslation, "All grouped:", grouped); // Added log
      setSelectedTranslation(firstTranslation);
      setVersesLoading(false);
    }
    if (selectedChapter) fetchVerses();
  }, [bookName, selectedChapter]); // Depend on bookName

  useEffect(() => {
    // Scroll fade-in/out for verse cards
    const items = verseRefs.current.filter(Boolean);
    if (!items.length) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target instanceof HTMLElement) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
            } else {
              entry.target.classList.remove("is-visible");
            }
          }
        });
      },
      { threshold: 0.15 }
    );
    items.forEach((item) => observer.observe(item!));
    return () => observer.disconnect();
  }, [selectedTranslation, versesByTranslation, selectedChapter]);

  return (
    <div className="scripture-book-layout">
      {/* Display bookName */}
      <h1 className="scripture-book-title gradient-gold-text">{bookName}</h1>
      {loading ? (
        // Updated loading indicator for chapters
        <div className="loading-indicator-container">
          <div className="loading-text">Loading Chapters...</div>
          <div className="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
        </div>
      ) : (
        <div className="chapter-nav">
          {chapters.map((ch) => (
            <button
              key={ch}
              className={`chapter-btn modern-chapter-btn${selectedChapter === ch ? " selected" : ""}`}
              onClick={() => setSelectedChapter(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}
      {/* Divider between chapters and translations */}
      {selectedChapter && <div className="chapter-translation-divider" />}
      {selectedChapter && (
        <div className="chapter-text-animate">
          {versesLoading ? (
            // Updated loading indicator for verses
            <div className="loading-indicator-container">
              <div className="loading-text">Loading Scripture...</div>
              <div className="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
            </div>
          ) : (
            Object.keys(versesByTranslation).length > 0 && (
              <>
                <div className="translation-toggle-group">
                  {Object.keys(versesByTranslation)
                    .filter(tr => tr !== "EXB" || userId === "89UdurybrVSwbPmp4boEMeYdVzk1")
                    .map((tr) => (
                      <button
                        key={tr}
                        className={`translation-toggle-btn modern-translation-btn${selectedTranslation === tr ? " selected" : ""}`}
                        onClick={() => setSelectedTranslation(tr)}
                      >
                        {tr}
                      </button>
                    ))}
                </div>
                <ul className="chapter-verse-list verse-card-list scroll-fade-list">
                  {selectedTranslation &&
                    (selectedTranslation !== "EXB" || userId === "89UdurybrVSwbPmp4boEMeYdVzk1") &&
                    versesByTranslation[selectedTranslation]?.map((v, idx) => (
                      <li
                        key={v.verse}
                        className="chapter-verse-item verse-card scroll-fade-item"
                        ref={el => { verseRefs.current[idx] = el; }}
                      >
                        <span className="chapter-verse-num verse-card-num">{v.verse}</span>
                        <span className="chapter-verse-text verse-card-text">{v.text}</span>
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
