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
  writeBatch, // Import writeBatch
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import type { Scripture } from "./scriptureParser";
import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "../utils/bookOrder";
import { httpsCallable } from "firebase/functions";
import { functions as fbFunctions } from "../lib/firebase";
import { ReactNode } from "react";

const sermonsRef = collection(db, "sermons");
const scripturesRef = collection(db, "scriptures");
const versesRef = collection(db, "verses"); // Add a reference to the verses collection
const tagsRef = collection(db, "tags"); // Add a reference to the tags collection

// --- Sermon Folder Management ---

export type SermonFolder = {
  id?: string;
  userId: string;
  name: string;
  createdAt?: any;
  updatedAt?: any;
};

export async function createSermonFolder(name: string): Promise<string> {
  const addSermonFolder = httpsCallable(fbFunctions, "addSermonFolder");
  const result = await addSermonFolder({ name });
  return (result.data as any).folderId;
}

export async function getSermonFolders(): Promise<SermonFolder[]> {
  const getSermonFoldersFn = httpsCallable(fbFunctions, "getSermonFolders");
  const result = await getSermonFoldersFn({});
  return (result.data as any).folders || [];
}

export async function updateSermonFolder(folderId: string, name: string): Promise<void> {
  const updateSermonFolderFn = httpsCallable(fbFunctions, "updateSermonFolder");
  await updateSermonFolderFn({ folderId, name });
}

export async function deleteSermonFolder(folderId: string): Promise<void> {
  const deleteSermonFolderFn = httpsCallable(fbFunctions, "deleteSermonFolder");
  await deleteSermonFolderFn({ folderId });
}

// Helper function to normalize tags for display
function normalizeTagForDisplay(tag: string): string {
  if (typeof tag !== 'string') return '';
  return tag
    .toLowerCase() // First, to ensure consistency before replacing and capitalizing
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper function to normalize tags for storage (Firestore document ID)
function normalizeTagForStorage(tag: string): string {
  if (typeof tag !== 'string') return '';
  return tag.toLowerCase().replace(/\s+/g, '_').trim();
}

// Fetch all sermons for the current user
export async function fetchSermons(): Promise<Sermon[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(sermonsRef, where("userID", "==", user.uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as object) } as Sermon));
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
export async function saveScriptureVerses(verses: { book: string, chapter: string | number, verse: string | number, text: string, translation: string, tags?: string[] }[]) {
  const batch = writeBatch(db);

  for (const verse of verses) {
    const { book, chapter, verse: verseNumber, text, translation, tags } = verse;
    
    // Ensure all parts of the path are strings and valid
    const bookStr = String(book).trim();
    const chapterStr = String(chapter).trim();
    const verseStr = String(verseNumber).trim();
    const translationStr = String(translation).trim().toLowerCase(); // Normalize translation for ID

    if (!bookStr || !chapterStr || !verseStr || !translationStr) {
      console.error("Invalid verse data for path construction:", verse);
      throw new Error("Book, chapter, verse number, and translation must be provided and be valid strings.");
    }

    // Document ID for the verse in the 'verses' collection (e.g., "acts-2-1-kjv")
    // This includes the translation to ensure uniqueness for different translations of the same verse.
    const verseId = `${bookStr.toLowerCase().replace(/\s+/g, "-")}-${chapterStr}-${verseStr}-${translationStr}`;
    const verseDocRef = doc(versesRef, verseId);

    // Data to be saved for the verse
    const verseData = {
      book: bookStr,
      book_lower: bookStr.toLowerCase(),
      chapter: Number(chapterStr), // Store chapter as a number if appropriate
      verse: Number(verseStr),     // Store verse as a number if appropriate
      text,
      translation: String(translation).trim(), // Store the original translation string for display
      tags: tags ? tags.map(tag => normalizeTagForDisplay(tag)) : [], // Store display-normalized tags in the verse document
      reference: `${bookStr} ${chapterStr}:${verseStr}`,
    };

    // Use set with merge: true to update if exists, or create if not.
    // This will overwrite the document if the ID (including translation) matches.
    batch.set(verseDocRef, verseData, { merge: true });

    // Update the tags collection
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        const storageTag = normalizeTagForStorage(tag); // Use storage-normalized tag for doc ID
        const displayTag = normalizeTagForDisplay(tag); // Use display-normalized tag for the 'name' field
        if (storageTag) {
          const tagDocRef = doc(tagsRef, storageTag);
          batch.set(tagDocRef, { name: displayTag, original_tag: tag }, { merge: true });
        }
      }
    }
  }

  await batch.commit();
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
  console.log("[firebaseService] listChaptersForBook called with bookName:", book); // Added log
  const q = query(versesRef, where("book", "==", book));
  console.log("[firebaseService] listChaptersForBook query:", q); // Added log
  const snapshot = await getDocs(q);
  console.log("[firebaseService] listChaptersForBook snapshot empty:", snapshot.empty, "size:", snapshot.size); // Added log
  const chapters = new Set<string>();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // console.log("[firebaseService] listChaptersForBook doc data:", data); // Log individual doc if needed
    if (data.chapter) {
      chapters.add(String(data.chapter));
    }
  });
  const sortedChapters = Array.from(chapters).sort((a, b) => parseInt(a) - parseInt(b));
  console.log("[firebaseService] listChaptersForBook returning chapters:", sortedChapters); // Added log
  return sortedChapters;
}

// Define a basic Verse type for getScriptureVersesForChapter if not already defined
// This should match the structure of your verse documents in Firestore
interface Verse {
  id?: string; // Optional: if you need the document ID
  verse: string; // Or number, depending on your Firestore structure
  text: string;
  translation: string;
  // Add any other relevant fields from your Firestore documents
  book?: string; // Already filtered by book, but good for completeness
  chapter?: string | number; // Already filtered by chapter, but good for completeness
}

export async function getScriptureVersesForChapter(bookName: string, chapter: string): Promise<Verse[]> {
  console.log("[firebaseService] getScriptureVersesForChapter called with bookName:", bookName, "chapter:", chapter); // Added log
  // Determine if chapter in Firestore is stored as a string or number
  // Let's assume it could be a string, but if it's a number, we might need parseInt(chapter)
  // For now, keeping it as string as per component state. If issues persist, this is a key area to check.
  const chapterNumber = parseInt(chapter, 10);
  if (isNaN(chapterNumber)) {
    console.error("[firebaseService] Invalid chapter number provided:", chapter);
    return [];
  }
  const q = query(versesRef, where("book", "==", bookName), where("chapter", "==", chapterNumber));
  console.log("[firebaseService] getScriptureVersesForChapter query:", q); // Added log
  const snapshot = await getDocs(q);
  console.log("[firebaseService] getScriptureVersesForChapter snapshot empty:", snapshot.empty, "size:", snapshot.size); // Added log

  const versesData = snapshot.docs.map(doc => {
    const data = doc.data();
    // console.log("[firebaseService] getScriptureVersesForChapter doc data:", data); // Log individual doc if needed
    return {
      id: doc.id,
      verse: String(data.verse), // Ensure verse is a string for consistency in the app
      text: data.text,
      translation: data.translation,
      book: data.book, // Optional, for debugging or if needed by Verse type
      chapter: data.chapter, // Optional, for debugging or if needed by Verse type
    } as Verse;
  });
  const sortedVerses = versesData.sort((a, b) => parseInt(a.verse) - parseInt(b.verse));
  console.log("[firebaseService] getScriptureVersesForChapter returning verses:", sortedVerses.length > 0 ? sortedVerses[0] : 'No verses'); // Added log
  return sortedVerses;
}

// Fetch a specific verse by book, chapter, verse, and translation
export async function getVerseByDetails(book: string, chapter: string, verse: string, translation: string): Promise<any | null> {
  const bookStr = String(book).trim().toLowerCase().replace(/\s+/g, "-");
  const chapterStr = String(chapter).trim();
  const verseStr = String(verse).trim();
  const translationStr = String(translation).trim().toLowerCase();

  if (!bookStr || !chapterStr || !verseStr || !translationStr) {
    console.error("Invalid details for fetching verse:", { book, chapter, verse, translation });
    return null;
  }

  const verseId = `${bookStr}-${chapterStr}-${verseStr}-${translationStr}`;
  const verseDocRef = doc(versesRef, verseId);
  const docSnap = await getDoc(verseDocRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

// Update tags for a specific verse document
export async function updateVerseTags(verseDocId: string, tags: string[]): Promise<void> {
  const verseDocRef = doc(versesRef, verseDocId);
  const normalizedTags = tags.map(tag => normalizeTagForDisplay(tag)); // Normalize for display
  await updateDoc(verseDocRef, { tags: normalizedTags });

  // Also update the global tags collection
  const batch = writeBatch(db);
  for (const tag of tags) {
    const storageTag = normalizeTagForStorage(tag);
    const displayTag = normalizeTagForDisplay(tag);
    if (storageTag) {
      const tagDocRef = doc(tagsRef, storageTag);
      batch.set(tagDocRef, { name: displayTag, original_tag: tag }, { merge: true });
    }
  }
  await batch.commit();
}

// Interface for batch update items
export interface BatchVerseTagUpdate {
  docId?: string; // Firestore document ID of the verse (used when not applying to all translations)
  baseReference?: string; // Base reference like "john_3_16" (used when applying to all translations)
  tagsToAdd: string[];
  tagsToRemove: string[];
  // New fields for "select all by criteria"
  isSelectAllByCriteria?: boolean;
  criteria?: { // This structure should mirror StoredSearchParams from AddTagsPage.tsx
    query: string;
    translations: string[];
    books?: string[];
  };
  applyToAllTranslationsInCriteria?: boolean; // If true, applies to all translations matching the base reference derived from criteria hits
}

export async function batchUpdateVerseTags(updates: BatchVerseTagUpdate[]): Promise<void> {
  const batch = writeBatch(db);
  const allTagsMentionedInAddOperations = new Set<string>();

  const verseUpdateOperations: { ref: any; data: { tags: string[] } }[] = [];

  for (const update of updates) {
    const { docId, baseReference, tagsToAdd, tagsToRemove, isSelectAllByCriteria, criteria, applyToAllTranslationsInCriteria } = update;

    if (isSelectAllByCriteria && criteria) {
      // Placeholder for backend call logic
      // This client-side function is not equipped to handle a "select all by criteria" directly
      // as it would require querying all documents matching the criteria first.
      // This operation should be delegated to a Firebase Cloud Function.
      console.warn("Received 'isSelectAllByCriteria' update. This should be handled by a dedicated backend function.", criteria);
      // For now, we'll construct a special object that a future backend function would understand.
      // The actual implementation of iterating through all matching docs and updating them
      // needs to happen on the backend to avoid client-side limitations (performance, batch sizes).

      // Example of what might be sent to a backend function:
      // const backendUpdatePayload = {
      //   criteria: criteria,
      //   tagsToAdd: tagsToAdd.map(tag => normalizeTagForDisplay(tag.trim())).filter(Boolean),
      //   tagsToRemove: tagsToRemove.map(tag => normalizeTagForDisplay(tag.trim())).filter(Boolean),
      //   applyToAllTranslations: applyToAllTranslationsInCriteria
      // };
      // await callBackendFunctionToUpdateAllByCriteria(backendUpdatePayload);

      // Since we are not calling a backend function yet in this step,
      // we will add mentioned tags to the global collection if any tags are being added.
      // This part of the logic might be duplicated if the backend also handles global tag updates.
      for (const originalTag of tagsToAdd) {
        const trimmedOriginalTag = originalTag.trim();
        if (!trimmedOriginalTag) continue;
        allTagsMentionedInAddOperations.add(trimmedOriginalTag);
      }
      // Skip further client-side processing for this update item in the loop,
      // as it's meant for the backend.
      continue;
    } else if (docId) {
      // Logic for single verse update (docId is present)
      const verseDocRef = doc(versesRef, docId);
      try {
        const verseSnap = await getDoc(verseDocRef);
        if (!verseSnap.exists()) {
          console.warn(`Verse with docId ${docId} not found during batch update. Skipping.`);
          continue;
        }
        const verseData = verseSnap.data();
        const currentTags: string[] = verseData.tags || [];
        const newTagsSet = new Set(currentTags);

        for (const originalTag of tagsToAdd) {
          const trimmedOriginalTag = originalTag.trim();
          if (!trimmedOriginalTag) continue;
          const normalizedDisplayTag = normalizeTagForDisplay(trimmedOriginalTag);
          if (normalizedDisplayTag) {
            newTagsSet.add(normalizedDisplayTag);
            allTagsMentionedInAddOperations.add(trimmedOriginalTag);
          }
        }

        for (const originalTag of tagsToRemove) {
          const trimmedOriginalTag = originalTag.trim();
          if (!trimmedOriginalTag) continue;
          const normalizedDisplayTag = normalizeTagForDisplay(trimmedOriginalTag);
          if (normalizedDisplayTag) {
            newTagsSet.delete(normalizedDisplayTag);
          }
        }
        
        const finalTagsArray = Array.from(newTagsSet).sort();
        verseUpdateOperations.push({ ref: verseDocRef, data: { tags: finalTagsArray } });
      } catch (error) {
        console.error(`Failed to read or process verse ${docId} for batch update:`, error);
        throw new Error(`Processing failed for verse ${docId}: ${(error as Error).message}`);
      }
    } else if (baseReference) {
      // Logic for updating all translations of a verse (baseReference is present)
      // Example baseReference: "john_3_16"
      const parts = baseReference.split('_');
      if (parts.length < 3) {
        console.warn(`Invalid baseReference format: ${baseReference}. Skipping.`);
        continue;
      }
      // Reconstruct book name if it contained underscores originally, e.g., "1_corinthians"
      const bookName = parts.slice(0, parts.length - 2).join('_');
      const chapter = parts[parts.length - 2];
      const verse = parts[parts.length - 1];

      // Query for all verse documents matching the book_lower, chapter, and verse
      // Note: Firestore field names are book_lower, chapter, verse (as numbers)
      const q = query(versesRef, 
        where("book_lower", "==", bookName.toLowerCase()), 
        where("chapter", "==", Number(chapter)), 
        where("verse", "==", Number(verse))
      );

      try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          console.warn(`No verses found for baseReference ${baseReference}. Skipping.`);
          continue;
        }

        querySnapshot.forEach((docSnap) => {
          const verseData = docSnap.data();
          const currentTags: string[] = verseData.tags || [];
          const newTagsSet = new Set(currentTags);

          for (const originalTag of tagsToAdd) {
            const trimmedOriginalTag = originalTag.trim();
            if (!trimmedOriginalTag) continue;
            const normalizedDisplayTag = normalizeTagForDisplay(trimmedOriginalTag);
            if (normalizedDisplayTag) {
              newTagsSet.add(normalizedDisplayTag);
              allTagsMentionedInAddOperations.add(trimmedOriginalTag);
            }
          }

          for (const originalTag of tagsToRemove) {
            const trimmedOriginalTag = originalTag.trim();
            if (!trimmedOriginalTag) continue;
            const normalizedDisplayTag = normalizeTagForDisplay(trimmedOriginalTag);
            if (normalizedDisplayTag) {
              newTagsSet.delete(normalizedDisplayTag);
            }
          }
          const finalTagsArray = Array.from(newTagsSet).sort();
          verseUpdateOperations.push({ ref: docSnap.ref, data: { tags: finalTagsArray } });
        });
      } catch (error) {
        console.error(`Failed to query or process verses for baseReference ${baseReference}:`, error);
        throw new Error(`Processing failed for baseReference ${baseReference}: ${(error as Error).message}`);
      }
    } else {
      console.warn("Update skipped: Neither docId, baseReference, nor valid criteria provided.", update);
    }
  }

  // Phase 2: Add verse update operations to the batch (for docId and baseReference based updates)
  for (const op of verseUpdateOperations) {
    batch.update(op.ref, op.data);
  }

  // Phase 3: Add global tag collection update operations to the batch
  for (const originalTag of allTagsMentionedInAddOperations) {
    // originalTag is already trimmed here
    const storageTag = normalizeTagForStorage(originalTag);
    const displayTag = normalizeTagForDisplay(originalTag);

    if (storageTag && displayTag) { // Ensure both normalizations are valid
      const tagDocRef = doc(tagsRef, storageTag);
      batch.set(tagDocRef, { 
        name: displayTag,       // e.g., "God's Love"
        id: storageTag,         // e.g., "gods_love"
        searchName: storageTag.toLowerCase() // for querying, consistent with other parts
      }, { merge: true });
    } else {
      console.warn(`Skipping global tag update for '${originalTag}' due to invalid normalization.`);
    }
  }

  // Phase 4: Commit the batch
  try {
    await batch.commit();
  } catch (error) {
    console.error("Batch update for verse tags failed to commit:", error);
    throw error; // Rethrow to allow the caller to handle commit failures
  }
}

export async function updateSermonNotes(sermonId: string, notes: Record<string, string>): Promise<void> {
  const sermonRef = doc(db, "sermons", sermonId);
  await updateDoc(sermonRef, { notes });
}

// Update Sermon type to include folderId
export type Sermon = {
  dateAdded: any;
  bibleBook: ReactNode;
  bibleChapter: ReactNode;
  bibleStartVerse: ReactNode;
  bibleEndVerse: ReactNode;
  id: string | number;
  title: string;
  description: string;
  date: string;
  imageUrl?: string;
  notes?: Record<string, string>;
  folderId?: string; // New: folder assignment
  seriesId?: string;
  category?: string;
  tags?: string[];
  books?: string[];
  // ...other fields...
};

// Assign/move a sermon to a folder
export async function assignSermonToFolder(sermonId: string, folderId: string | null): Promise<void> {
  const docRef = doc(sermonsRef, sermonId);
  await updateDoc(docRef, { folderId: folderId || null });
}

// Fetch sermons by folderId (null for unassigned)
export async function fetchSermonsByFolder(folderId: string | null): Promise<Sermon[]> {
  const user = auth.currentUser;
  if (!user) return [];
  let q;
  if (folderId === null) {
    q = query(sermonsRef, where("userID", "==", user.uid), where("folderId", "==", null));
  } else {
    q = query(sermonsRef, where("userID", "==", user.uid), where("folderId", "==", folderId));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as object) } as Sermon));
}

export type NewSermonData = Omit<Sermon, "id"> & { isArchived?: boolean; imageOnly?: boolean };

// --- User Profile Management ---

export type UserProfile = {
  id?: string;
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  preferences: {
    defaultBibleVersion: string;
    theme: 'light' | 'dark' | 'auto';
    language: string;
    emailNotifications: boolean;
    autoSave: boolean;
    sermonBackupFrequency: 'never' | 'daily' | 'weekly' | 'monthly';
  };
  statistics: {
    totalSermons: number;
    totalVerses: number;
    totalTags: number;
    totalFolders: number;
    totalVersions: number;
    joinDate: string;
    lastActivity: string;
  };
  createdAt?: any;
  updatedAt?: any;
};

export async function getUserProfile(): Promise<UserProfile | null> {
  const getUserProfileFn = httpsCallable(fbFunctions, "getUserProfile");
  try {
    const result = await getUserProfileFn({});
    return (result.data as any).profile || null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function updateUserProfile(profileData: {
  displayName?: string;
  preferences?: Partial<UserProfile['preferences']>;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  
  const updateUserProfileFn = httpsCallable(fbFunctions, "updateUserProfile");
  await updateUserProfileFn({ 
    userId: user.uid, 
    profile: profileData 
  });
}

export async function getUserStats(): Promise<UserProfile['statistics'] | null> {
  const getUserStatsFn = httpsCallable(fbFunctions, "getUserStats");
  try {
    const result = await getUserStatsFn({});
    return (result.data as any).statistics || null;
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    return null;
  }
}

export async function exportUserData(): Promise<any> {
  const exportUserDataFn = httpsCallable(fbFunctions, "exportUserData");
  try {
    const result = await exportUserDataFn({});
    return (result.data as any).exportData || null;
  } catch (error) {
    console.error("Error exporting user data:", error);
    throw error;
  }
}

export async function deleteUserAccount(): Promise<void> {
  const deleteUserAccountFn = httpsCallable(fbFunctions, "deleteUserAccount");
  await deleteUserAccountFn({});
}

// ============================================================================
// ADVANCED SERMON ORGANIZATION FEATURES
// ============================================================================

// Advanced Search Criteria Interface
export interface AdvancedSearchCriteria {
  query?: string;
  tags?: string[];
  books?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  folderId?: string;
  seriesId?: string;
  category?: string;
  sortBy?: 'date' | 'title' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Sermon Series Interface
export interface SermonSeries {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  sermonIds: string[];
  tags?: string[];
  imageUrl?: string;
  isComplete: boolean;
  createdAt?: any;
  updatedAt?: any;
}

// Sermon Category Interface
export interface SermonCategory {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  keywords: string[];
  color?: string;
  createdAt?: any;
  updatedAt?: any;
}

// Auto-categorization result interface
export interface AutoTagResult {
  sermonId: string;
  suggestedTags: string[];
  suggestedCategory?: string;
  confidence: number;
}

// Sermon Analytics Interface
export interface SermonAnalytics {
  insights: any;
  totalSermons: number;
  sermonsByMonth: { [key: string]: number };
  mostUsedTags: { [key: string]: number };
  categoryDistribution: { [key: string]: number };
  seriesCounts: { [key: string]: number };
  averageSermonLength: number;
  booksReferenceMost: { [key: string]: number };
}

// ============================================================================
// 1. SMART CATEGORIZATION AND AUTO-TAGGING
// ============================================================================

// Auto-categorize sermons
export async function autoCategorizeSermonsFunc(sermonIds?: string[]): Promise<AutoTagResult[]> {
  try {
    const autoCategorizeSermonsCloud = httpsCallable(fbFunctions, 'autoCategorizeSermonsFunc');
    const result = await autoCategorizeSermonsCloud({ sermonIds });
    return (result.data as any).results || [];
  } catch (error) {
    console.error('Error auto-categorizing sermons:', error);
    throw new Error('Failed to auto-categorize sermons');
  }
}

// Apply auto-categorization results
export async function applyAutoCategorizationFunc(results: AutoTagResult[]): Promise<{ success: boolean; applied: number }> {
  try {
    const applyAutoCategorizationCloud = httpsCallable(fbFunctions, 'applyAutoCategorizationFunc');
    const result = await applyAutoCategorizationCloud({ results });
    return result.data as { success: boolean; applied: number };
  } catch (error) {
    console.error('Error applying auto-categorization:', error);
    throw new Error('Failed to apply categorization');
  }
}

// ============================================================================
// 2. ADVANCED FILTERING AND SEARCH
// ============================================================================

// Advanced sermon search
export async function advancedSermonSearchFunc(criteria: AdvancedSearchCriteria): Promise<{
  sermons: Sermon[];
  total: number;
  hasMore: boolean;
}> {
  try {
    const advancedSermonSearchCloud = httpsCallable(fbFunctions, 'advancedSermonSearchFunc');
    const result = await advancedSermonSearchCloud(criteria);
    return result.data as { sermons: Sermon[]; total: number; hasMore: boolean };
  } catch (error) {
    console.error('Error in advanced sermon search:', error);
    throw new Error('Failed to search sermons');
  }
}

// Get sermon analytics
export async function getSermonAnalyticsFunc(selectedTimeframe: string): Promise<SermonAnalytics> {
  try {
    const getSermonAnalyticsCloud = httpsCallable(fbFunctions, 'getSermonAnalyticsFunc');
    const result = await getSermonAnalyticsCloud();
    return (result.data as any).analytics;
  } catch (error) {
    console.error('Error getting sermon analytics:', error);
    throw new Error('Failed to get analytics');
  }
}

// ============================================================================
// 3. SERMON SERIES AND COLLECTION MANAGEMENT
// ============================================================================

// Create sermon series
export async function createSermonSeriesFunc(seriesData: {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  imageUrl?: string;
}): Promise<string> {
  try {
    const createSermonSeriesCloud = httpsCallable(fbFunctions, 'createSermonSeriesFunc');
    const result = await createSermonSeriesCloud(seriesData);
    return (result.data as any).seriesId;
  } catch (error) {
    console.error('Error creating sermon series:', error);
    throw new Error('Failed to create sermon series');
  }
}

// Get all sermon series
export async function getSermonSeriesFunc(): Promise<SermonSeries[]> {
  try {
    const getSermonSeriesCloud = httpsCallable(fbFunctions, 'getSermonSeriesFunc');
    const result = await getSermonSeriesCloud();
    return (result.data as any).series || [];
  } catch (error) {
    console.error('Error getting sermon series:', error);
    throw new Error('Failed to get sermon series');
  }
}

// Add sermon to series
export async function addSermonToSeriesFunc(seriesId: string, sermonId: string): Promise<boolean> {
  try {
    const addSermonToSeriesCloud = httpsCallable(fbFunctions, 'addSermonToSeriesFunc');
    const result = await addSermonToSeriesCloud({ seriesId, sermonId });
    return (result.data as any).success;
  } catch (error) {
    console.error('Error adding sermon to series:', error);
    throw new Error('Failed to add sermon to series');
  }
}

// Remove sermon from series
export async function removeSermonFromSeriesFunc(seriesId: string, sermonId: string): Promise<boolean> {
  try {
    const removeSermonFromSeriesCloud = httpsCallable(fbFunctions, 'removeSermonFromSeriesFunc');
    const result = await removeSermonFromSeriesCloud({ seriesId, sermonId });
    return (result.data as any).success;
  } catch (error) {
    console.error('Error removing sermon from series:', error);
    throw new Error('Failed to remove sermon from series');
  }
}

// Delete sermon series
export async function deleteSermonSeriesFunc(seriesId: string): Promise<boolean> {
  try {
    const deleteSermonSeriesCloud = httpsCallable(fbFunctions, 'deleteSermonSeriesFunc');
    const result = await deleteSermonSeriesCloud({ seriesId });
    return (result.data as any).success;
  } catch (error) {
    console.error('Error deleting sermon series:', error);
    throw new Error('Failed to delete sermon series');
  }
}

// ============================================================================
// SERMON CATEGORY MANAGEMENT
// ============================================================================

// Create sermon category
export async function createSermonCategoryFunc(categoryData: {
  name: string;
  description?: string;
  keywords: string[];
  color?: string;
}): Promise<string> {
  try {
    const createSermonCategoryCloud = httpsCallable(fbFunctions, 'createSermonCategoryFunc');
    const result = await createSermonCategoryCloud(categoryData);
    return (result.data as any).categoryId;
  } catch (error) {
    console.error('Error creating sermon category:', error);
    throw new Error('Failed to create sermon category');
  }
}

// Get all sermon categories
export async function getSermonCategoriesFunc(): Promise<SermonCategory[]> {
  try {
    const getSermonCategoriesCloud = httpsCallable(fbFunctions, 'getSermonCategoriesFunc');
    const result = await getSermonCategoriesCloud();
    return (result.data as any).categories || [];
  } catch (error) {
    console.error('Error getting sermon categories:', error);
    throw new Error('Failed to get sermon categories');
  }
}

// Delete sermon category
export async function deleteSermonCategoryFunc(categoryId: string): Promise<boolean> {
  try {
    const deleteSermonCategoryCloud = httpsCallable(fbFunctions, 'deleteSermonCategoryFunc');
    const result = await deleteSermonCategoryCloud({ categoryId });
    return (result.data as any).success;
  } catch (error) {
    console.error('Error deleting sermon category:', error);
    throw new Error('Failed to delete sermon category');
  }
}
