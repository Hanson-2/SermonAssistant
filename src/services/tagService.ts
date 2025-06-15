// tagService.ts
// Utility functions for tag CRUD and fetching tags from Firestore 'tags' collection
import { db, auth } from "../lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";

export interface Tag {
  id: string;
  name: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
}

// Get the current user's ID or throw an error
function getCurrentUserId(): string {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to perform tag operations');
  }
  return currentUser.uid;
}

export async function fetchTags(): Promise<Tag[]> {
  try {
    const userId = getCurrentUserId();
    const tagsRef = collection(db, "tags");

    // Query for global tags (no userId field)
    const globalTagsQuery = query(tagsRef, where("userId", "==", null));
    const globalTagsSnapshot = await getDocs(globalTagsQuery);
    const globalTags = globalTagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));

    // Query for user-specific tags
    const userTagsQuery = query(tagsRef, where("userId", "==", userId));
    const userTagsSnapshot = await getDocs(userTagsQuery);
    const userTags = userTagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));

    // Combine global and user tags
    const combinedTags = [...globalTags, ...userTags];

    console.log('[fetchTags] Loaded global tags:', globalTags.length);
    console.log('[fetchTags] Loaded user tags:', userTags.length);
    console.log('[fetchTags] Combined tags:', combinedTags.length);

    return combinedTags;
  } catch (error) {
    console.error('[fetchTags] Error:', error);
    throw error;
  }
}

export async function addTag(name: string): Promise<void> {
  const userId = getCurrentUserId();
  const tagsRef = collection(db, "tags");
  await addDoc(tagsRef, { 
    name,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

export async function updateTag(id: string, name: string): Promise<void> {
  const userId = getCurrentUserId();
  const tagsRef = collection(db, "tags");
  const tagDoc = doc(tagsRef, id);
  
  // First verify the tag belongs to the current user
  const tagSnapshot = await getDocs(query(tagsRef, where("userId", "==", userId)));
  const userTagIds = tagSnapshot.docs.map(doc => doc.id);
  
  if (!userTagIds.includes(id)) {
    throw new Error('Unauthorized: You can only update your own tags');
  }
  
  await updateDoc(tagDoc, { 
    name,
    updatedAt: new Date()
  });
}

export async function deleteTag(id: string): Promise<void> {
  const userId = getCurrentUserId();
  const tagsRef = collection(db, "tags");
  const tagDoc = doc(tagsRef, id);
  
  // First verify the tag belongs to the current user
  const tagSnapshot = await getDocs(query(tagsRef, where("userId", "==", userId)));
  const userTagIds = tagSnapshot.docs.map(doc => doc.id);
  
  if (!userTagIds.includes(id)) {
    throw new Error('Unauthorized: You can only delete your own tags');
  }
  
  await deleteDoc(tagDoc);
}
