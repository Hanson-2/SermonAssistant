import React from "react";
import { getDisplayBookAbbrev, normalizeBookName } from "../utils/getDisplayBookAbbrev";

interface ScriptureMiniCardProps {
  verse: any; // Accepts a verse object from the autocomplete
  onRemove?: () => void;
}

const ScriptureMiniCard: React.FC<ScriptureMiniCardProps> = ({ verse, onRemove }) => {
  // Determine if this verse was added via tag
  const isFromTag = verse.addedViaTag === true || verse.sourceType === 'tag';
    // Show overlay on click (allow both removal and overlay functionality)
  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger overlay if clicking on the remove button
    if ((e.target as HTMLElement).closest('.scripture-mini-card-remove')) {
      return;
    }

    const userDefaultTranslation = localStorage.getItem('defaultBibleVersion');

    // If only book and chapter are present, dispatch a reference for the whole chapter
    let detail = { ...verse, defaultTranslation: userDefaultTranslation }; // Add defaultTranslation
    if (verse.book && verse.chapter && (!verse.verse || verse.verse === 0)) {
      detail.reference = `${verse.book} ${verse.chapter}`;
    }
    const event = new CustomEvent("showScriptureOverlay", { detail });
    window.dispatchEvent(event);
  };// Normalize and display abbreviated reference name
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
      // Try to parse chapter-only reference like "Genesis 1"
      const chapterMatch = verse.reference.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+)$/i);
      if (chapterMatch) {
        const book = normalizeBookName(chapterMatch[1]);
        const chapter = chapterMatch[2];
        displayRef = `${getDisplayBookAbbrev(book)} ${chapter}`;
      } else {
        displayRef = verse.reference;
      }
    }
  } else if (verse.book && verse.chapter) {
    const book = normalizeBookName(verse.book);
    if (verse.verse) {
      displayRef = `${getDisplayBookAbbrev(book)} ${verse.chapter}:${verse.verse}`;
    } else {
      // Chapter-only display when no verse is specified
      displayRef = `${getDisplayBookAbbrev(book)} ${verse.chapter}`;
    }
  } else {
    displayRef = "";
  }  return (<div 
      className={`scripture-mini-card p-2 rounded-lg shadow-md cursor-pointer
                 bg-gradient-to-br ${isFromTag ? 'from-blue-900 to-indigo-900' : 'from-gray-900 to-black'}
                 border border-transparent 
                 hover:border-yellow-500/70 transition-all duration-200 ease-in-out
                 relative group text-center flex flex-col justify-center items-center min-h-[80px]`}
      onClick={handleClick} 
      tabIndex={0}
      style={{
        borderImageSlice: 1,
        borderImageSource: isFromTag 
          ? 'linear-gradient(to bottom right, #3b82f6, #6366f1, #3b82f6)' 
          : 'linear-gradient(to bottom right, #b8860b, #ffd700, #b8860b)',
        borderWidth: '2px', // Ensure border width is set for borderImage to be visible
      }}
    >      <span className={`scripture-mini-card-title text-sm font-normal ${isFromTag ? 'text-blue-300' : 'text-yellow-400'} block mb-1`}>
        {displayRef}
      </span>
      <span className="scripture-mini-card-text text-xs text-gray-300 line-clamp-2">{verse.text}</span>      {isFromTag && (        <div className="absolute top-0.5 left-0.5 w-4 h-4 flex items-center justify-center" title="Added via tag">
          {/* Tag icon that looks like a label/tag */}
          <svg 
            className="w-3 h-3 text-blue-400" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M17.707 9.293l-5-5A.997.997 0 0012 4H2a2 2 0 00-2 2v8a2 2 0 002 2h10a.997.997 0 00.707-.293l5-5a.999.999 0 000-1.414zM13 13H2V7h11.586l3 3-3.586 3z" clipRule="evenodd"/>
            <circle cx="6.5" cy="10" r="1.5"/>
          </svg>
        </div>
      )}      {onRemove && (
        <div 
          className="absolute top-0 right-0 w-0 h-0 cursor-pointer z-10
                     border-l-[12px] border-l-transparent
                     border-b-[12px] border-b-transparent  
                     border-t-[12px] border-t-red-600/80
                     border-r-[12px] border-r-red-600/80
                     hover:border-t-red-700/90 hover:border-r-red-700/90
                     transition-all duration-200"
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="Remove verse"
          style={{
            clipPath: 'polygon(100% 0%, 0% 0%, 100% 100%)'
          }}
        />
      )}
    </div>
  );
};

export default ScriptureMiniCard;
