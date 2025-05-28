// Canonical and extra-canonical book order utility
// This list is based on Protestant canon, with extra-canonicals at the end

export const CANONICAL_BOOKS = [
  // Old Testament
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
  "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalm", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  // New Testament
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
  "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

// Extra-canonical/Apocrypha/Deuterocanonical books (commonly found in Catholic, Orthodox, and some Protestant Bibles)
export const EXTRA_CANONICAL_BOOKS = [
  // Catholic/Orthodox Deuterocanon
  "Tobit", "Judith", "Additions to Esther", "Wisdom of Solomon", "Sirach", "Ecclesiasticus", "Baruch", "Letter of Jeremiah", "Prayer of Azariah", "Susanna", "Bel and the Dragon", "1 Maccabees", "2 Maccabees", "3 Maccabees", "4 Maccabees", "1 Esdras", "2 Esdras", "Prayer of Manasseh", "Psalm 151",
  // Greek Additions
  "Odes", "Psalms of Solomon",
  // Slavonic/Other Orthodox
  "3 Baruch", "4 Baruch", "2 Enoch", "1 Enoch", "Jubilees", "Testament of the Twelve Patriarchs",
  // Other Apocrypha (Protestant Apocrypha, Pseudepigrapha, etc.)
  "Book of Enoch", "Book of Jubilees", "Book of Tobit", "Book of Judith", "Book of Susanna", "Book of Baruch", "Book of Wisdom", "Book of Sirach", "Book of 1 Esdras", "Book of 2 Esdras", "Book of 3 Maccabees", "Book of 4 Maccabees", "Book of 3 Baruch", "Book of 4 Baruch", "Book of 2 Enoch", "Book of 1 Enoch", "Book of the Twelve Patriarchs", "Book of the Prayer of Manasseh", "Book of Psalms of Solomon", "Book of Odes"
];

export function getBookOrder(book: string): number {
  const idx = CANONICAL_BOOKS.indexOf(book);
  return idx === -1 ? 999 : idx;
}

export function splitBooksByCanon(books: string[]): { canonical: string[]; extraCanonical: string[] } {
  const canonical: string[] = [];
  const extraCanonical: string[] = [];
  for (const book of books) {
    if (CANONICAL_BOOKS.includes(book)) canonical.push(book);
    else extraCanonical.push(book);
  }
  canonical.sort((a, b) => getBookOrder(a) - getBookOrder(b));
  extraCanonical.sort();
  return { canonical, extraCanonical };
}
