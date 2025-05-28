// src/utils/smartParseScriptureInput.ts
// Utility to extract scripture references (full names or abbreviations) from text.

import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "./bookOrder";
import { bookAliases } from "../hooks/useScriptureAutocomplete";

export type ScriptureReference = {
  book: string;
  chapter: number;
  verse: number;
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

// Combined regex: full book names OR aliases, then chapter:verse, optional ranges
const scriptureRegex = new RegExp(
  `((?:${bookPattern}|${aliasPattern}))\\s+(\\d+):(\\d+)(?:\\s*-\\s*(\\d+)(?::(\\d+))?)?`,
  "gi"
);

export function extractScriptureReferences(text: string): ScriptureReference[] {
  const refs: ScriptureReference[] = [];
  let match: RegExpExecArray | null;

  while ((match = scriptureRegex.exec(text))) {
    const [ , rawToken, chapStr, vsStr, endChapOrVsStr, endVsStr ] = match;
    // Normalize alias key (strip dots/spaces, lowercase)
    const key = rawToken.replace(/[.\s]/g, "").toLowerCase();
    // Map to canonical book name, or clean up raw token
    const book = bookAliases[key] || rawToken.replace(/[.]/g, " ").trim();

    const chapter = parseInt(chapStr, 10);
    const verse = parseInt(vsStr, 10);

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

  return refs;
}
