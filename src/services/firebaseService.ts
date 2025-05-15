import { db } from "../lib/firebase";
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Sermon } from "../components/SermonCard/SermonCard";
import type { Scripture } from "./scriptureParser";

const sermonsRef = collection(db, "sermons");

export async function fetchSermons() {
  const snapshot = await getDocs(sermonsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getSermon(id: string): Promise<Sermon | null> {
  const docRef = doc(db, "sermons", id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return { id: docSnap.id, ...data } as Sermon;
  } else {
    return null;
  }
}

export async function createSermon(data) {
  return await addDoc(sermonsRef, data);
}

export async function updateSermon(id, data) {
  const docRef = doc(sermonsRef, id);
  return await updateDoc(docRef, data);
}

export async function deleteSermon(id) {
  const docRef = doc(sermonsRef, id);
  return await deleteDoc(docRef);
}

export async function archiveSermon(id) {
  const docRef = doc(sermonsRef, id);
  return await updateDoc(docRef, { isArchived: true });
}

export async function uploadExpositoryImage(file: File): Promise<string> {
  const fileRef = ref(storage, `expositories/${file.name}-${Date.now()}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}

// Add Scripture Entry
export async function addScripture(scripture: Omit<Scripture, "id">) {
  const ref = collection(db, "scriptures");
  const docRef = await addDoc(ref, scripture);
  return docRef.id;
}

// Get All Scriptures
export async function getAllScriptures() {
  const ref = collection(db, "scriptures");
  const snapshot = await getDocs(ref);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Get Scriptures by Book and Chapter
export async function getScripturesByBookAndChapter(book: string, chapter: number) {
  const ref = collection(db, "scriptures");
  const q = query(ref, where("book", "==", book), where("chapter", "==", chapter));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
