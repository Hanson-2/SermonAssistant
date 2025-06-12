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
  const allMatches: Array<{
    match: RegExpExecArray;
    type: 'verse' | 'chapter';
    start: number;
    end: number;
  }> = [];

  // Find all verse-specific matches
  let match: RegExpExecArray | null;
  while ((match = scriptureRegex.exec(text))) {
    allMatches.push({
      match,
      type: 'verse',
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Reset regex and find all chapter-only matches
  chapterOnlyRegex.lastIndex = 0;
  while ((match = chapterOnlyRegex.exec(text))) {
    allMatches.push({
      match,
      type: 'chapter',
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Sort all matches by their position in the text
  allMatches.sort((a, b) => a.start - b.start);
  // Process matches in order, checking for overlaps
  for (const { match, type, start, end } of allMatches) {
    // Check if this match overlaps with any already processed reference
    const overlaps = refs.some(ref => {
      const possibleMatches: string[] = [];
      
      if (ref.verse !== undefined) {
        // Verse-specific reference
        possibleMatches.push(buildScriptureReference(ref));
        possibleMatches.push(buildScriptureReference({...ref, endVerse: ref.endVerse || ref.verse}));
      } else {
        // Chapter-only reference
        possibleMatches.push(buildScriptureReference(ref));
      }
      
      return possibleMatches.some(refText => {
        const refIndex = text.indexOf(refText);
        if (refIndex === -1) return false;
        const refEnd = refIndex + refText.length;
        // Check for overlap
        return !(end <= refIndex || start >= refEnd);
      });
    });
    
    if (overlaps) continue;

    if (type === 'verse') {
      // Process verse-specific reference
      const [, rawToken, chapStr, vsStr, endChapOrVsStr, endVsStr] = match;
      // Normalize alias key (strip dots/spaces, lowercase)
      const key = rawToken.replace(/[.\s]/g, "").toLowerCase();
      // Map to canonical book name, or clean up raw token
      const book = bookAliases[key] || rawToken.replace(/[.]/g, " ").trim();

      const chapter = parseInt(chapStr, 10);
      const verse = vsStr ? parseInt(vsStr, 10) : undefined;

      if (verse !== undefined) {        if (endChapOrVsStr && endVsStr) {
          const ref = {
            book,
            chapter,
            verse,
            endChapter: parseInt(endChapOrVsStr, 10),
            endVerse: parseInt(endVsStr, 10),
          };
          refs.push({
            ...ref,
            reference: buildScriptureReference(ref)
          });
        } else if (endChapOrVsStr) {
          const ref = {
            book,
            chapter,
            verse,
            endChapter: chapter,
            endVerse: parseInt(endChapOrVsStr, 10),
          };
          refs.push({
            ...ref,
            reference: buildScriptureReference(ref)
          });
        } else {
          const ref = { book, chapter, verse };
          refs.push({
            ...ref,
            reference: buildScriptureReference(ref)
          });
        }
      }
    } else {
      // Process chapter-only reference
      const [, rawToken, chapStr] = match;
      // Normalize alias key (strip dots/spaces, lowercase)
      const key = rawToken.replace(/[.\s]/g, "").toLowerCase();
      // Map to canonical book name, or clean up raw token
      const book = bookAliases[key] || rawToken.replace(/[.]/g, " ").trim();
        const chapter = parseInt(chapStr, 10);
      
      const ref = { book, chapter };
      refs.push({
        ...ref,
        reference: buildScriptureReference(ref)
      }); // No verse for chapter-only references
    }
  }

  return refs;
}
