// tagService.ts
// Utility functions for tag CRUD and fetching tags from Firestore 'tags' collection
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

const tagsRef = collection(db, "tags");

export interface Tag {
  id: string;
  name: string;
}

export async function fetchTags(): Promise<Tag[]> {
  const snapshot = await getDocs(tagsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
}

export async function addTag(name: string): Promise<void> {
  await addDoc(tagsRef, { name });
}

export async function updateTag(id: string, name: string): Promise<void> {
  await updateDoc(doc(tagsRef, id), { name });
}

export async function deleteTag(id: string): Promise<void> {
  await deleteDoc(doc(tagsRef, id));
}
