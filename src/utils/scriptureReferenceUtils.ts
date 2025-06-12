// Utility for robust scripture reference string construction and validation
import { bookAliases } from '../hooks/useScriptureAutocomplete.js';

export function isValidVerseNumber(val: any) {
  // Accepts string or number, only positive integers
  const n = Number(val);
  return Number.isInteger(n) && n > 0;
}

export function buildScriptureReference(ref: any) {
  let bookName = ref.book;
  if (bookName) {
    let localRawBook = bookName.replace(/\s/g, "").toLowerCase();
    bookName = bookAliases[localRawBook] || bookName;
  }
  const verse = isValidVerseNumber(ref.verse) ? Number(ref.verse) : null;
  const endVerse = isValidVerseNumber(ref.endVerse) ? Number(ref.endVerse) : null;
  if (verse) {
    if (endVerse && endVerse !== verse) {
      return `${bookName} ${ref.chapter}:${verse}-${endVerse}`;
    } else {
      return `${bookName} ${ref.chapter}:${verse}`;
    }
  } else {
    // Chapter-only reference
    return `${bookName} ${ref.chapter}`;
  }
}
