// src/utils/smartParseScriptureInput.ts
// Utility to extract scripture references (full names or abbreviations) from text.

import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "./bookOrder.js";
import { bookAliases } from "../hooks/useScriptureAutocomplete.js";

export type ScriptureReference = {
  book: string;
  chapter: number;
  verse?: number; // Make verse optional for chapter-only references
  endChapter?: number;
  endVerse?: number;
};

// Prepare full book names (longest first for greedy matching)
const BOOKS = [...CANONICAL_BOOKS, ...EXTRA_CANONICAL_BOOKS].sort((a, b) => b.length - a.length);
const bookPattern = BOOKS.map(b => b.replace(/ /g, "[ .]?")).join("|");

// Prepare abbreviation keys from bookAliases
const aliasPattern = Object
  .keys(bookAliases)
  .map(ab => ab.replace(/\s/g, "[ .]?"))   // allow spaces/dots in aliases
  .sort((a, b) => b.length - a.length)       // longest first
  .join("|");

// Combined regex: full book names OR aliases, then chapter:verse (optional verse), optional ranges
const scriptureRegex = new RegExp(
  `((?:${bookPattern}|${aliasPattern}))\\s+(\\d+)(?::(\\d+)(?:\\s*-\\s*(\\d+)(?::(\\d+))?)?)?`,
  "gi"
);

// Additional regex for chapter-only references (e.g., "Genesis 1", "Gen 1")
const chapterOnlyRegex = new RegExp(
  `((?:${bookPattern}|${aliasPattern}))\\s+(\\d+)(?!:)(?=\\s|$|[^\\d])`,
  "gi"
);

export function extractScriptureReferences(text: string): ScriptureReference[] {
  const refs: ScriptureReference[] = [];
  let match: RegExpExecArray | null;

  // First, extract chapter:verse references
  while ((match = scriptureRegex.exec(text))) {
    const [ , rawToken, chapStr, vsStr, endChapOrVsStr, endVsStr ] = match;
    // Normalize alias key (strip dots/spaces, lowercase)
    const key = rawToken.replace(/[.\s]/g, "").toLowerCase();
    // Map to canonical book name, or clean up raw token
    const book = bookAliases[key] || rawToken.replace(/[.]/g, " ").trim();

    const chapter = parseInt(chapStr, 10);
    const verse = vsStr ? parseInt(vsStr, 10) : undefined;

    if (verse !== undefined) {
      if (endChapOrVsStr && endVsStr) {
        refs.push({
          book,
          chapter,
          verse,
          endChapter: parseInt(endChapOrVsStr, 10),
          endVerse: parseInt(endVsStr, 10),
        });
      } else if (endChapOrVsStr) {
        refs.push({
          book,
          chapter,
          verse,
          endChapter: chapter,
          endVerse: parseInt(endChapOrVsStr, 10),
        });
      } else {
        refs.push({ book, chapter, verse });
      }
    }
  }

  // Reset regex for chapter-only references
  chapterOnlyRegex.lastIndex = 0;

  // Then, extract chapter-only references (but skip if overlapping with chapter:verse)
  while ((match = chapterOnlyRegex.exec(text))) {
    const [ fullMatch, rawToken, chapStr ] = match;
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;
      // Check if this overlaps with any existing chapter:verse reference
    const overlaps = refs.some(ref => {
      // Try to find the position of this reference in the text
      const possibleMatches = [];
      
      if (ref.verse !== undefined) {
        // Verse-specific reference
        possibleMatches.push(`${ref.book} ${ref.chapter}:${ref.verse}`);
        possibleMatches.push(`${ref.book} ${ref.chapter}:${ref.verse}-${ref.endVerse || ref.verse}`);
      } else {
        // Chapter-only reference
        possibleMatches.push(`${ref.book} ${ref.chapter}`);
      }
      
      return possibleMatches.some(refText => {
        const refIndex = text.indexOf(refText);
        if (refIndex === -1) return false;
        const refEnd = refIndex + refText.length;
        // Check for overlap
        return !(matchEnd <= refIndex || matchStart >= refEnd);
      });
    });
    
    if (overlaps) continue;
    
    // Normalize alias key (strip dots/spaces, lowercase)
    const key = rawToken.replace(/[.\s]/g, "").toLowerCase();
    // Map to canonical book name, or clean up raw token
    const book = bookAliases[key] || rawToken.replace(/[.]/g, " ").trim();
    
    const chapter = parseInt(chapStr, 10);
    
    refs.push({ book, chapter }); // No verse for chapter-only references
  }

  return refs;
}
