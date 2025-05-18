import { db, storage } from "../lib/firebase";
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

// Fetch all sermons
export async function fetchSermons(): Promise<Sermon[]> {
  const snapshot = await getDocs(sermonsRef);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Sermon));
}

// Get a single sermon by ID
export async function getSermon(id: string): Promise<Sermon | null> {
  const docRef = doc(db, "sermons", id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Sermon) : null;
}

// Create a new sermon
export async function createSermon(data: NewSermonData) {
  return await addDoc(sermonsRef, data);
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
  // Firestore web SDK cannot list subcollections at root, so we check for at least one chapter in each known book
  const allBooks = [...CANONICAL_BOOKS, ...EXTRA_CANONICAL_BOOKS];
  const available: string[] = [];
  for (const book of allBooks) {
    // Try to get the first chapter (chapter 1) for each book
    const chapterCol = collection(db, 'scriptures', book, '1');
    try {
      const snapshot = await getDocs(chapterCol);
      if (!snapshot.empty) available.push(book);
    } catch (e) {
      // Ignore errors for books/chapters that don't exist
    }
  }
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
  // Each chapter is a subcollection under the book collection
  // Firestore web SDK does not support listing subcollections, so we fetch all chapter docs
  const chaptersCol = collection(db, 'scriptures', book);
  const snapshot = await getDocs(chaptersCol);
  // Chapter IDs are numbers as strings
  return snapshot.docs.map(doc => doc.id).sort((a, b) => Number(a) - Number(b));
}

// Get all verses for a book and chapter, grouped by translation
export async function getScriptureVersesForChapter(book: string, chapter: string): Promise<{ verse: string, text: string, translation: string }[]> {
  const versesCol = collection(db, 'scriptures', book, chapter);
  const snapshot = await getDocs(versesCol);
  // Each doc is a verse, with text and translation fields
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      verse: doc.id,
      text: data.text,
      translation: data.translation || "",
    };
  });
}

export async function updateSermonNotes(sermonId: string, notes: Record<string, string>): Promise<void> {
  const sermonRef = doc(db, "sermons", sermonId);
  await updateDoc(sermonRef, { notes });
}

export type NewSermonData = Omit<Sermon, "id"> & { isArchived?: boolean; imageOnly?: boolean };
