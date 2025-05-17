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

export type NewSermonData = Omit<Sermon, "id"> & { isArchived?: boolean; imageOnly?: boolean };
