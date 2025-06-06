import React, { useEffect, useState, ChangeEvent, JSX, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { listCachedScriptureBooks } from "../services/firebaseService";
import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "../utils/bookOrder";
import { getDisplayBookFull, getDisplayBookAbbrev, normalizeBookName } from "../utils/getDisplayBookAbbrev";
import "./CurrentlyAddedScripturePage.css";
import "../styles/shared-buttons.scss";

const CurrentlyAddedScripturePage: React.FC = () => {  const [availableBooks, setAvailableBooks] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Set the initial state for showOnlyAvailable to true
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);
  const navigate = useNavigate();
  const bookCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    async function fetchBooks(): Promise<void> {
      const fetchedBooks = await listCachedScriptureBooks();
      setAvailableBooks(fetchedBooks);
      setLoading(false);
    }
    fetchBooks();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.classList.add("currently-added-scripture-page");
    document.documentElement.classList.add("currently-added-scripture-page");
    const root = document.getElementById("root");
    if (root) root.classList.add("currently-added-scripture-page");
    return () => {
      document.documentElement.classList.remove("currently-added-scripture-page");
      document.body.classList.remove("currently-added-scripture-page");
      if (root) root.classList.remove("currently-added-scripture-page");
    };
  }, []);
  useEffect(() => {
    // Intersection Observer for rolling fade animation
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target instanceof HTMLElement) {
            if (entry.isIntersecting) {
              // Add a small delay for staggered effect if multiple cards enter at once
              setTimeout(() => {
                if (entry.target instanceof HTMLElement) {
                  entry.target.classList.add("fade-in-out");
                }
              }, Math.random() * 100); // Random delay 0-100ms for natural stagger
            } else {
              entry.target.classList.remove("fade-in-out");
            }
          }
        });
      },
      { 
        threshold: 0.1, // Trigger earlier for smoother effect
        rootMargin: "50px 0px" // Start animation 50px before element enters viewport
      }
    );
    Object.values(bookCardRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [availableBooks, searchTerm, showOnlyAvailable]);

  const filterBooks = (books: string[]): string[] => {
    return books.filter((book) =>
      book.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  const handleMiniCardClick = async (book: string) => {
    // Navigate to the proper ScriptureBookPage for chapter selection
    navigate(`/scripture/${encodeURIComponent(book)}`);
  };  const renderBookCard = (book: string): JSX.Element | null => {
    const isAvailable = availableBooks.includes(book);
    if (showOnlyAvailable && !isAvailable) return null;    // Use shared button classes for consistency with Dashboard
    const cardClass = isAvailable ? "add-expository-button-shared" : "add-expository-button-shared disabled";
    
    const handleClick = (): void => {
      if (isAvailable) handleMiniCardClick(book); // Navigate to book page
    };

    // Get the appropriate book name based on mobile/desktop and name length
    const fullBookName = getDisplayBookFull(normalizeBookName(book));
    const shouldAbbreviate = isMobile && fullBookName.length > 6;
    const displayName = shouldAbbreviate 
      ? getDisplayBookAbbrev(normalizeBookName(book))
      : fullBookName;
    
    return (
      <div
        key={book}
        className={cardClass}
        onClick={handleClick}
        ref={el => { bookCardRefs.current[book] = el; }}      >
        {/* Use shared button text class for consistency */}
        <span className="add-expository-button-shared-text">{displayName}</span>
      </div>
    );
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  return (
    <>
      <div className="currently-added-scripture-background" />
      <div className="currently-added-scripture-layout">
        <h1 className="currently-added-scripture-title">Available Scripture</h1>

        <div className="controls-panel">
          <input
            type="text"
            placeholder="Search books..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
          <label className="modern-toggle">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={() => setShowOnlyAvailable(!showOnlyAvailable)}
            />
            <span>Show Only Available</span>
          </label>
        </div>

        {loading ? (
          <div className="loading-indicator-container">
            <div className="lds-roller">
              <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
            </div>
            <span className="loading-text">Loading Books...</span>
          </div>
        ) : (
          <>
            <div className="section-banner">Old Testament</div>
            <div className="book-card-grid">
              {filterBooks(CANONICAL_BOOKS.slice(0, 39)).map(renderBookCard)}
            </div>

            <div className="section-banner">New Testament</div>
            <div className="book-card-grid">
              {filterBooks(CANONICAL_BOOKS.slice(39)).map(renderBookCard)}
            </div>            <div className="section-banner">Extra-Canonical Books</div>
            <div className="book-card-grid">
              {filterBooks(EXTRA_CANONICAL_BOOKS).map(renderBookCard)}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CurrentlyAddedScripturePage;
