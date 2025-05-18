// Utility to extract scripture references from a block of text
// Supports formats like: Genesis 1:1, Genesis 1:1-5, Genesis 1:1-2:3, etc.

import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "./bookOrder";

export type ScriptureReference = {
  book: string;
  chapter: number;
  verse: number;
  endChapter?: number;
  endVerse?: number;
};

const BOOKS = [...CANONICAL_BOOKS, ...EXTRA_CANONICAL_BOOKS].sort((a, b) => b.length - a.length); // Longest first for greedy match

const bookPattern = BOOKS.map(b => b.replace(/ /g, "[ .]?")) // allow for spaces/dots
  .join("|");

// Fix: Use \\s instead of \s in regex string for correct whitespace matching
const scriptureRegex = new RegExp(
  `((?:${bookPattern}))\\s+(\\d+):(\\d+)(?:\\s*-\\s*(\\d+)(?::(\\d+))?)?`,
  "gi"
);

export function extractScriptureReferences(text: string): ScriptureReference[] {
  const refs: ScriptureReference[] = [];
  let match: RegExpExecArray | null;
  while ((match = scriptureRegex.exec(text))) {
    const [_, book, chapter, verse, endChapterOrVerse, endVerse] = match;
    if (endChapterOrVerse && endVerse) {
      // Genesis 1:1-2:3
      refs.push({
        book: book.replace(/[.]/g, " ").trim(),
        chapter: parseInt(chapter),
        verse: parseInt(verse),
        endChapter: parseInt(endChapterOrVerse),
        endVerse: parseInt(endVerse),
      });
    } else if (endChapterOrVerse) {
      // Genesis 1:1-5
      refs.push({
        book: book.replace(/[.]/g, " ").trim(),
        chapter: parseInt(chapter),
        verse: parseInt(verse),
        endChapter: parseInt(chapter),
        endVerse: parseInt(endChapterOrVerse),
      });
    } else {
      // Genesis 1:1
      refs.push({
        book: book.replace(/[.]/g, " ").trim(),
        chapter: parseInt(chapter),
        verse: parseInt(verse),
      });
    }
  }
  return refs;
}
