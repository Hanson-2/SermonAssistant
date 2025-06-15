// src/utils/smartParseScriptureInput.ts
// Utility to extract scripture references (full names or abbreviations) from text.

import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "./bookOrder.js";
import { bookAliases } from "../hooks/useScriptureAutocomplete.js";
import { buildScriptureReference } from "./scriptureReferenceUtils.js";

export type ScriptureReference = {
  book: string;
  chapter: number;
  verse?: number; // Make verse optional for chapter-only references
  endChapter?: number;
  endVerse?: number;
  reference: string; // Always include a properly formatted reference string
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

// Combined regex: full book names OR aliases, then chapter:verse (REQUIRED verse), optional ranges
// Added word boundaries (\b) to prevent matching abbreviations within other words
const scriptureRegex = new RegExp(
  `\\b((?:${bookPattern}|${aliasPattern}))\\s+(\\d+):(\\d+)(?:\\s*-\\s*(\\d+)(?::(\\d+))?)?`,
  "gi"
);

// Additional regex for chapter-only references (e.g., "Genesis 1", "Gen 1")
// Added word boundaries (\b) to prevent matching abbreviations within other words
const chapterOnlyRegex = new RegExp(
  `\\b((?:${bookPattern}|${aliasPattern}))\\s+(\\d+)(?!:)(?=\\s|$|[^\\d])`,
  "gi"
);

export function extractScriptureReferences(text: string): ScriptureReference[] {
  const allMatches: Array<{
    match: RegExpExecArray;
    type: 'verse' | 'chapter';
    index: number;
  }> = [];

  // Collect all verse-specific matches
  let match: RegExpExecArray | null;
  while ((match = scriptureRegex.exec(text))) {
    allMatches.push({
      match: [...match] as RegExpExecArray,
      type: 'verse',
      index: match.index
    });
  }

  // Reset regex for chapter-only references
  chapterOnlyRegex.lastIndex = 0;

  // Collect all chapter-only matches
  while ((match = chapterOnlyRegex.exec(text))) {
    allMatches.push({
      match: [...match] as RegExpExecArray,
      type: 'chapter',
      index: match.index
    });
  }

  // Sort all matches by their position in the text
  allMatches.sort((a, b) => a.index - b.index);

  const refs: ScriptureReference[] = [];
  // Process matches in order of appearance
  for (const { match, type } of allMatches) {
    if (type === 'verse') {
      const [, rawToken, chapStr, vsStr, endChapOrVsStr, endVsStr] = match;
      
      // Normalize alias key (strip dots/spaces, lowercase)
      const key = rawToken.replace(/[.\s]/g, "").toLowerCase();
      // Map to canonical book name, or clean up raw token
      const book = bookAliases[key] || rawToken.replace(/[.]/g, " ").trim();

      const chapter = parseInt(chapStr, 10);
      const verse = parseInt(vsStr, 10);      if (endChapOrVsStr && endVsStr) {
        const refObj = {
          book,
          chapter,
          verse,
          endChapter: parseInt(endChapOrVsStr, 10),
          endVerse: parseInt(endVsStr, 10),
        };
        refs.push({
          ...refObj,
          reference: buildScriptureReference(refObj)
        });
      } else if (endChapOrVsStr) {
        const refObj = {
          book,
          chapter,
          verse,
          endChapter: chapter,
          endVerse: parseInt(endChapOrVsStr, 10),
        };
        refs.push({
          ...refObj,
          reference: buildScriptureReference(refObj)
        });
      } else {
        const refObj = { book, chapter, verse };
        refs.push({
          ...refObj,
          reference: buildScriptureReference(refObj)
        });
      }    } else if (type === 'chapter') {
      const [, rawToken, chapStr] = match;

      // Fix: Only skip if the exact same chapter-only reference is already present
      const key = rawToken.replace(/[.\s]/g, "").toLowerCase();
      const book = bookAliases[key] || rawToken.replace(/[.]/g, " ").trim();
      const chapter = parseInt(chapStr, 10);
      const alreadyPresent = refs.some(ref =>
        ref.book === book && ref.chapter === chapter && ref.verse === undefined      );
      if (alreadyPresent) continue;
      
      const refObj = { book, chapter };
      refs.push({
        ...refObj,
        reference: buildScriptureReference(refObj)
      }); // Chapter-only reference with proper reference string
    }
  }

  return refs;
}
