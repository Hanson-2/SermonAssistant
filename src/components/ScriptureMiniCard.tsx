import React from "react";
import { getDisplayBookFull, normalizeBookName } from "../utils/getDisplayBookAbbrev";

interface ScriptureMiniCardProps {
  verse: any; // Accepts a verse object from the autocomplete
  onRemove?: () => void;
}

const ScriptureMiniCard: React.FC<ScriptureMiniCardProps> = ({ verse, onRemove }) => {
  // Show overlay on click if no onRemove
  const handleClick = () => {
    if (onRemove) return;
    // Custom event for parent to handle overlay
    const event = new CustomEvent("showScriptureOverlay", { detail: verse });
    window.dispatchEvent(event);
  };
  // Normalize and display full reference name (not abbreviated)
  let displayRef = "";
  if (verse.reference) {
    // Try to parse reference like "Genesis 1:1" or "Gen 1:1-2"
    const refMatch = verse.reference.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+):(\d+)(?:-(\d+))?$/i);
    if (refMatch) {
      const book = normalizeBookName(refMatch[1]);
      const chapter = refMatch[2];
      const verseStart = refMatch[3];
      const verseEnd = refMatch[4];
      displayRef = `${getDisplayBookFull(book)} ${chapter}:${verseStart}${verseEnd ? "-" + verseEnd : ""}`;
    } else {
      displayRef = verse.reference;
    }
  } else if (verse.book && verse.chapter && verse.verse) {
    const book = normalizeBookName(verse.book);
    displayRef = `${getDisplayBookFull(book)} ${verse.chapter}:${verse.verse}`;
  } else {
    displayRef = "";
  }

  return (
    <div className="scripture-mini-card" onClick={handleClick} tabIndex={0}>
      <span className="scripture-mini-card-title">
        <strong>{displayRef}</strong>
      </span>
      <span className="scripture-mini-card-text">{verse.text}</span>
      {onRemove && (
        <button className="scripture-mini-card-remove" onClick={e => { e.stopPropagation(); onRemove(); }}>
          ×
        </button>
      )}
    </div>
  );
};

export default ScriptureMiniCard;
