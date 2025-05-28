import { db, storage, auth } from "../lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { Sermon } from "../components/SermonCard/SermonCard";
import type { Scripture } from "./scriptureParser";
import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "../utils/bookOrder";

const sermonsRef = collection(db, "sermons");
const scripturesRef = collection(db, "scriptures");

// Fetch all sermons for the current user
export async function fetchSermons(): Promise<Sermon[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(sermonsRef, where("userID", "==", user.uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Sermon));
}

// Get a single sermon by ID
export async function getSermon(id: string): Promise<Sermon | null> {
  const docRef = doc(db, "sermons", id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Sermon) : null;
}

// Create a new sermon, attaching the userID
export async function createSermon(data: NewSermonData) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return await addDoc(sermonsRef, { ...data, userID: user.uid });
}

// Update an existing sermon
export async function updateSermon(id: string, data: Partial<Sermon>) {
  const docRef = doc(sermonsRef, id);
  return await updateDoc(docRef, data);
}

// Delete a sermon
export async function deleteSermon(id: string) {
  const docRef = doc(sermonsRef, id);
  return await deleteDoc(docRef);
}

// Archive a sermon
export async function archiveSermon(id: string) {
  const docRef = doc(sermonsRef, id);
  return await updateDoc(docRef, { isArchived: true });
}

// Upload an image and return its URL
export async function uploadExpositoryImage(file: File): Promise<string> {
  const fileRef = ref(storage, `expositories/${file.name}-${Date.now()}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

// Get All Scriptures
export async function getAllScriptures() {
  const snapshot = await getDocs(scripturesRef);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Get Scriptures by Book and Chapter
export async function getScripturesByBookAndChapter(book: string, chapter: number) {
  const q = query(scripturesRef, where("book", "==", book), where("chapter", "==", chapter));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// List all expository images
export async function listExpositoryImages(): Promise<string[]> {
  const folderRef = ref(storage, "expositories/");
  const result = await listAll(folderRef);
  return Promise.all(result.items.map(getDownloadURL));
}

/**
 * Saves scripture verses under the structure: scriptures/{Book}/{Chapter}/{Verse}
 */
export async function saveScriptureVerses(verses: { book: string, chapter: string | number, verse: string | number, text: string, translation: string }[]) {
  for (const verse of verses) {
    const { book, chapter, verse: verseNumber, text, translation } = verse;
    const bookStr = String(book);
    const chapterStr = String(chapter);
    const verseStr = String(verseNumber);
    const verseDocRef = doc(db, 'scriptures', bookStr, chapterStr, verseStr);
    await setDoc(verseDocRef, {
      text,
      translation
    });
  }
}

// List all scripture book collection names (book IDs)
export async function listScriptureBooks(): Promise<string[]> {
  const versesRef = collection(db, 'verses');
  
  // Query all verses to find available books
  const snapshot = await getDocs(versesRef);
  console.log(`[listScriptureBooks] Found ${snapshot.docs.length} total verses in database`);
  
  // Extract unique books
  const bookSet = new Set<string>();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.book) {
      bookSet.add(data.book);
    }
  });
  
  const available = Array.from(bookSet).sort();
  console.log(`[listScriptureBooks] Available books:`, available);
  return available;
}

let cachedBooks: string[] | null = null;

export async function listCachedScriptureBooks(): Promise<string[]> {
  if (cachedBooks) return cachedBooks;
  const fetchedBooks = await listScriptureBooks();
  cachedBooks = fetchedBooks;
  return fetchedBooks;
}

// List all chapters for a given book
export async function listChaptersForBook(book: string): Promise<string[]> {
  const versesRef = collection(db, 'verses');
  const bookLower = String(book).toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Query to get all verses for this book
  const q = query(
    versesRef,
    where('book_lower', '==', bookLower)
  );
  
  const snapshot = await getDocs(q);
  console.log(`[listChaptersForBook] Found ${snapshot.docs.length} verses for ${book}`);
  
  // Extract unique chapter numbers
  const chapterSet = new Set<number>();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.chapter && typeof data.chapter === 'number') {
      chapterSet.add(data.chapter);
    }
  });
  
  // Convert to sorted string array
  const chapters = Array.from(chapterSet).sort((a, b) => a - b).map(ch => String(ch));
  console.log(`[listChaptersForBook] Available chapters for ${book}:`, chapters);
  return chapters;
}

// Get all verses for a book and chapter, grouped by translation
export async function getScriptureVersesForChapter(book: string, chapter: string): Promise<{ verse: string, text: string, translation: string }[]> {
  const versesRef = collection(db, 'verses');
  const chapterNum = Number(chapter);
  const bookLower = String(book).toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Query the verses collection with the correct structure
  const q = query(
    versesRef,
    where('book_lower', '==', bookLower),
    where('chapter', '==', chapterNum)
  );
  
  const snapshot = await getDocs(q);
  console.log(`[getScriptureVersesForChapter] Found ${snapshot.docs.length} verses for ${book} chapter ${chapter}`);
  
  // Each doc contains verse, text, translation, book, chapter, etc.
  return snapshot.docs.map(doc => {
    const data = doc.data();
    console.log(`[getScriptureVersesForChapter] Verse data:`, { verse: data.verse, translation: data.translation, text: data.text?.slice(0, 50) });
    return {
      verse: String(data.verse),
      text: data.text || "",
      translation: data.translation || "",
    };
  }).sort((a, b) => Number(a.verse) - Number(b.verse)); // Sort by verse number
}

export async function updateSermonNotes(sermonId: string, notes: Record<string, string>): Promise<void> {
  const sermonRef = doc(db, "sermons", sermonId);
  await updateDoc(sermonRef, { notes });
}

export type NewSermonData = Omit<Sermon, "id"> & { isArchived?: boolean; imageOnly?: boolean };
