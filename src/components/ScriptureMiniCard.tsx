import React from "react";
import { getDisplayBookAbbrev, normalizeBookName } from "../utils/getDisplayBookAbbrev";

interface ScriptureMiniCardProps {
  verse: any; // Accepts a verse object from the autocomplete
  onRemove?: () => void;
}

const ScriptureMiniCard: React.FC<ScriptureMiniCardProps> = ({ verse, onRemove }) => {
  // Show overlay on click if no onRemove
  const handleClick = () => {
    if (onRemove) return;

    const userDefaultTranslation = localStorage.getItem('defaultBibleVersion');

    // If only book and chapter are present, dispatch a reference for the whole chapter
    let detail = { ...verse, defaultTranslation: userDefaultTranslation }; // Add defaultTranslation
    if (verse.book && verse.chapter && (!verse.verse || verse.verse === 0)) {
      detail.reference = `${verse.book} ${verse.chapter}`;
    }
    const event = new CustomEvent("showScriptureOverlay", { detail });
    window.dispatchEvent(event);
  };  // Normalize and display abbreviated reference name
  let displayRef = "";
  if (verse.reference) {
    // Try to parse reference like "Genesis 1:1" or "Gen 1:1-2"
    const refMatch = verse.reference.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+):(\d+)(?:-(\d+))?$/i);
    if (refMatch) {
      const book = normalizeBookName(refMatch[1]);
      const chapter = refMatch[2];
      const verseStart = refMatch[3];
      const verseEnd = refMatch[4];
      displayRef = `${getDisplayBookAbbrev(book)} ${chapter}:${verseStart}${verseEnd ? "-" + verseEnd : ""}`;
    } else {
      displayRef = verse.reference;
    }
  } else if (verse.book && verse.chapter && verse.verse) {
    const book = normalizeBookName(verse.book);
    displayRef = `${getDisplayBookAbbrev(book)} ${verse.chapter}:${verse.verse}`;
  } else {
    displayRef = "";
  }  return (<div 
      className="scripture-mini-card p-2 rounded-lg shadow-md cursor-pointer
                 bg-gradient-to-br from-gray-900 to-black 
                 border border-transparent 
                 hover:border-yellow-500/70 transition-all duration-200 ease-in-out
                 relative group text-center flex flex-col justify-center items-center min-h-[80px]"
      onClick={handleClick} 
      tabIndex={0}
      style={{
        borderImageSlice: 1,
        borderImageSource: 'linear-gradient(to bottom right, #b8860b, #ffd700, #b8860b)',
        borderWidth: '2px', // Ensure border width is set for borderImage to be visible
      }}
    >      <span className="scripture-mini-card-title text-sm font-normal text-yellow-400 block mb-1">
        {displayRef}
      </span>
      <span className="scripture-mini-card-text text-xs text-gray-300 line-clamp-2">{verse.text}</span>
      {onRemove && (
        <button 
          className="scripture-mini-card-remove absolute top-1 right-1 text-gray-500 hover:text-red-500 
                     bg-gray-800/50 hover:bg-gray-700/70 rounded-full p-0.5 w-5 h-5 flex items-center justify-center
                     transition-colors text-xs"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove verse"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ScriptureMiniCard;
