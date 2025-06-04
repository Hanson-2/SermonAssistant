// Script to populate a Firestore 'books' collection with canonical and extra-canonical books
// Run this with Node.js (after setting up Firebase Admin SDK)

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// Book lists (copy from src/utils/bookOrder.ts)
const CANONICAL_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
  "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalm", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
  "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const EXTRA_CANONICAL_BOOKS = [
  "Tobit", "Judith", "Additions to Esther", "Wisdom of Solomon", "Sirach", "Ecclesiasticus", "Baruch", "Letter of Jeremiah", "Prayer of Azariah", "Susanna", "Bel and the Dragon", "1 Maccabees", "2 Maccabees", "3 Maccabees", "4 Maccabees", "1 Esdras", "2 Esdras", "Prayer of Manasseh", "Psalm 151",
  "Odes", "Psalms of Solomon",
  "3 Baruch", "4 Baruch", "2 Enoch", "1 Enoch", "Jubilees", "Testament of the Twelve Patriarchs",
  "Book of Enoch", "Book of Jubilees", "Book of Tobit", "Book of Judith", "Book of Susanna", "Book of Baruch", "Book of Wisdom", "Book of Sirach", "Book of 1 Esdras", "Book of 2 Esdras", "Book of 3 Maccabees", "Book of 4 Maccabees", "Book of 3 Baruch", "Book of 4 Baruch", "Book of 2 Enoch", "Book of 1 Enoch", "Book of the Twelve Patriarchs", "Book of the Prayer of Manasseh", "Book of Psalms of Solomon", "Book of Odes"
];

async function main() {
  const booksCol = db.collection('books');

  // 1. Delete all existing docs in 'books' collection
  const existing = await booksCol.listDocuments();
  for (const docRef of existing) {
    await docRef.delete();
  }
  console.log(`Deleted ${existing.length} existing books.`);

  // 2. Query all verses and extract unique book names
  const versesCol = db.collection('verses');
  const snapshot = await versesCol.get();
  const verseBookSet = new Set();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.book) verseBookSet.add(data.book);
  });

  // 3. Merge canonical, extra-canonical, and verse-referenced books, deduplicate
  const allBooksSet = new Set([
    ...CANONICAL_BOOKS,
    ...EXTRA_CANONICAL_BOOKS,
    ...verseBookSet
  ]);
  const allBooks = Array.from(allBooksSet);

  // 4. Write all unique books to Firestore
  let count = 0;
  for (const book of allBooks) {
    await booksCol.doc(book).set({ name: book });
    count++;
  }
  console.log(`Added ${count} unique books (canonical, extra-canonical, and verse-referenced) to Firestore 'books' collection.`);
}

main().catch(console.error);
