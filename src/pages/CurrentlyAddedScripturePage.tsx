import React, { useEffect, useState, ChangeEvent, JSX } from "react";
import { useNavigate } from "react-router-dom";
import { listCachedScriptureBooks } from "../services/firebaseService";
import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "../utils/bookOrder";
import "./CurrentlyAddedScripturePage.css";

const CurrentlyAddedScripturePage: React.FC = () => {
  const [availableBooks, setAvailableBooks] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Set the initial state for showOnlyAvailable to true
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchBooks(): Promise<void> {
      const fetchedBooks = await listCachedScriptureBooks();
      setAvailableBooks(fetchedBooks);
      setLoading(false);
    }
    fetchBooks();
  }, []);

  const filterBooks = (books: string[]): string[] => {
    return books.filter((book) =>
      book.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const renderBookCard = (book: string): JSX.Element | null => {
    const isAvailable = availableBooks.includes(book);
    if (showOnlyAvailable && !isAvailable) return null;

    const cardClass = isAvailable ? "book-card" : "book-card disabled";
    const handleClick = (): void => {
      if (isAvailable) navigate(`/scripture/${encodeURIComponent(book)}`);
    };

    return (
      <div key={book} className={cardClass} onClick={handleClick}>
        <span className="book-card-title">{book}</span>
      </div>
    );
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className="currently-added-scripture-layout">
      <h1 className="currently-added-scripture-title">Currently Added Scripture</h1>

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
          </div>

          <div className="section-banner">Extra-Canonical Books</div>
          <div className="book-card-grid">
            {filterBooks(EXTRA_CANONICAL_BOOKS).map(renderBookCard)}
          </div>
        </>
      )}
    </div>
  );
};

export default CurrentlyAddedScripturePage;
