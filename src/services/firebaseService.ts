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
  serverTimestamp, // Import serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import type { Scripture } from "./scriptureParser";
import { CANONICAL_BOOKS, EXTRA_CANONICAL_BOOKS } from "../utils/bookOrder";
import { httpsCallable } from "firebase/functions";
import { functions as fbFunctions } from "../lib/firebase";
import { ReactNode } from "react";
import { updateProfile } from "firebase/auth";

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
  
  console.log('[createSermon] Input data:', data);
  
  // Start with input data, then override with required fields
  const sermonData = { 
    ...data, 
    userID: user.uid
  };
  
  // Remove any undefined fields to prevent Firebase errors
  Object.keys(sermonData).forEach(key => {
    if (sermonData[key] === undefined) {
      console.log('[createSermon] Removing undefined field:', key);
      delete sermonData[key];
    }
  });
  
  // Set dateAdded after cleaning undefined fields
  sermonData.dateAdded = serverTimestamp();
  
  console.log('[createSermon] Final sermon data:', sermonData);
  
  return await addDoc(sermonsRef, sermonData);
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

// Upload a profile picture and return its URL
export async function uploadProfileImage(file: File, userId: string): Promise<string> {
  // Create a separate folder for profile images
  const fileExtension = file.name.split('.').pop();
  const fileName = `profile-${userId}-${Date.now()}.${fileExtension}`;
  const fileRef = ref(storage, `profile-images/${fileName}`);
  
  await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(fileRef);
  
  return downloadURL;
}

// Delete a profile image from storage
export async function deleteProfileImage(imageUrl: string): Promise<void> {
  try {
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error) {
    console.error('Error deleting profile image:', error);
    // Non-blocking error - continue even if deletion fails
  }
}

// Update user profile with new photoURL
export async function updateUserProfilePhoto(photoURL: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  
  // Update Firebase Auth profile
  await updateProfile(user, { photoURL });
  
  // Update Firestore profile
  await updateUserProfile({ photoURL });
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
 * Verses are stored globally but tag associations are user-specific
 */
export async function saveScriptureVerses(verses: { book: string, chapter: string | number, verse: string | number, text: string, translation: string, tags?: string[] }[]) {
  const batch = writeBatch(db);
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    throw new Error('User must be authenticated to save verses');
  }
  
  const userId = currentUser.uid;

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

    // Data to be saved for the verse (global, no user-specific tags here)
    const verseData = {
      book: bookStr,
      book_lower: bookStr.toLowerCase(),
      chapter: Number(chapterStr), // Store chapter as a number if appropriate
      verse: Number(verseStr),     // Store verse as a number if appropriate
      text,
      translation: String(translation).trim(), // Store the original translation string for display
      reference: `${bookStr} ${chapterStr}:${verseStr}`,
    };

    // Use set with merge: true to update if exists, or create if not.
    batch.set(verseDocRef, verseData, { merge: true });

    // Store user-specific tag associations in a separate collection
    if (tags && tags.length > 0) {
      // Create user-specific tags in the tags collection
      for (const tag of tags) {
        const storageTag = normalizeTagForStorage(tag); // Use storage-normalized tag for doc ID
        const displayTag = normalizeTagForDisplay(tag); // Use display-normalized tag for the 'name' field
        if (storageTag) {
          // Create a user-specific tag document
          const userTagId = `${userId}_${storageTag}`;
          const tagDocRef = doc(tagsRef, userTagId);
          batch.set(tagDocRef, { 
            name: displayTag, 
            original_tag: tag,
            userId: userId,
            createdAt: new Date(),
            updatedAt: new Date()
          }, { merge: true });
        }
      }
      
      // Store the user-specific tag association
      const userVerseTagRef = doc(db, 'user_verse_tags', `${userId}_${verseId}`);
      batch.set(userVerseTagRef, {
        userId: userId,
        verseId: verseId,
        tags: tags.map(tag => normalizeTagForDisplay(tag)),
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
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

// List all books from the 'books' collection in Firestore (not from verses)
export async function listCachedScriptureBooks(): Promise<string[]> {
  if (cachedBooks) return cachedBooks;
  const booksCol = collection(db, 'books');
  const snapshot = await getDocs(booksCol);
  const books: string[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.name) books.push(data.name);
  });
  cachedBooks = books.sort();
  return cachedBooks;
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
  
  // Use book_lower field like the original ScriptureOverlay did
  const bookLower = String(bookName).toLowerCase().replace(/\s+/g, ' ').trim();
  console.log("[firebaseService] Using book_lower:", bookLower);
  
  const q = query(versesRef, where("book_lower", "==", bookLower), where("chapter", "==", chapterNumber));
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

export async function updateSermonNotes(sermonId: string, notes: Record<string, string>, slideScriptureRefs?: Record<number, any[]>, slideTitles?: string[]): Promise<void> {
  const sermonRef = doc(db, "sermons", sermonId);
  const updateData: any = { notes };
  
  console.log('[firebaseService] ====== updateSermonNotes CALLED ======');
  console.log('[firebaseService] sermonId:', sermonId);
  console.log('[firebaseService] notes:', notes);
  console.log('[firebaseService] slideScriptureRefs provided:', slideScriptureRefs !== undefined);
  console.log('[firebaseService] slideTitles provided:', slideTitles !== undefined);
  
  // Include slideScriptureRefs if provided
  if (slideScriptureRefs !== undefined) {
    updateData.slideScriptureRefs = slideScriptureRefs;
    console.log('[firebaseService] updateSermonNotes saving slideScriptureRefs:', JSON.stringify(slideScriptureRefs, null, 2));
    
    // Log each slide's refs
    Object.entries(slideScriptureRefs).forEach(([key, refs]) => {
      console.log(`[firebaseService] Slide ${key} has ${refs.length} refs:`, refs);
    });
  } else {
    console.log('[firebaseService] updateSermonNotes called without slideScriptureRefs');
  }
  
  // Include slideTitles if provided
  if (slideTitles !== undefined) {
    updateData.slideTitles = slideTitles;
    console.log('[firebaseService] updateSermonNotes saving slideTitles:', slideTitles);
  } else {
    console.log('[firebaseService] updateSermonNotes called without slideTitles');
  }
  
  console.log('[firebaseService] Final updateData structure:', JSON.stringify(updateData, null, 2));
  
  try {
    await updateDoc(sermonRef, updateData);
    console.log('[firebaseService] updateSermonNotes successfully saved to Firestore');
    
    // Verify the save by reading it back immediately
    const savedDoc = await getDoc(sermonRef);
    if (savedDoc.exists()) {
      const savedData = savedDoc.data();
      console.log('[firebaseService] Verification: Data after save:', JSON.stringify(savedData.slideScriptureRefs, null, 2));
    }
  } catch (error) {
    console.error('[firebaseService] updateSermonNotes failed:', error);
    throw error;
  }
  
  console.log('[firebaseService] ====== updateSermonNotes COMPLETE ======');
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
  imagePosition?: string; // CSS object-position value for image positioning
  notes?: Record<string, string>;
  slideScriptureRefs?: Record<number, any[]>; // New: per-slide scripture references
  slideTitles?: string[]; // New: custom slide titles
  folderId?: string; // New: folder assignment
  seriesId?: string;
  category?: string;
  tags?: string[];
  books?: string[];
  isArchived?: boolean; // New: archived status
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

export type NewSermonData = Omit<Sermon, "id" | "dateAdded"> & { 
  isArchived?: boolean; 
  imageOnly?: boolean; 
  dateAdded?: any; // Optional since it will be auto-set by createSermon
};

// --- User Profile Management ---

export type UserProfile = {
  id?: string;
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  preferences: {
    // General Settings
    defaultBibleVersion: string;
    theme: 'light' | 'dark' | 'auto';
    language: string;
    emailNotifications: boolean;
    autoSave: boolean;
    sermonBackupFrequency: 'never' | 'daily' | 'weekly' | 'monthly';
    
    // App Preferences (from AppPreferencesPage)
    autoSaveInterval?: number; // in minutes
    defaultSermonTemplate?: string;
    pageSize?: number;
    pushNotifications?: boolean;
    showWelcomeScreen?: boolean;
    enableKeyboardShortcuts?: boolean;
    showPreviewPane?: boolean;
  };
    // Theme Settings (from ThemeSettingsPage)
  themeSettings?: {
    themeMode: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    accentColor?: string;
    backgroundImage?: string;
    fontFamily?: string;
    fontSize?: 'small' | 'medium' | 'large';
    compactMode?: boolean;
    highContrast?: boolean;
    reducedMotion?: boolean;
    largeClickTargets?: boolean;
    enhancedFocus?: boolean;
    dyslexiaFriendly?: boolean;
    lineHeight?: 'normal' | 'relaxed' | 'loose';
    letterSpacing?: 'normal' | 'wide' | 'wider';    customCSS?: string;
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
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  
  try {
    const userProfileDoc = doc(db, "userProfiles", user.uid);
    const userProfileSnap = await getDoc(userProfileDoc);
    
    if (!userProfileSnap.exists()) {      // Create a default user profile if it doesn't exist
      const defaultProfile: UserProfile = {
        userId: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        preferences: {
          defaultBibleVersion: "ESV",
          theme: "dark",
          language: "en",
          emailNotifications: true,
          autoSave: true,
          sermonBackupFrequency: "weekly",
          pushNotifications: true,
          showWelcomeScreen: true,
          enableKeyboardShortcuts: true,
          showPreviewPane: true
        },
        themeSettings: {
          themeMode: "dark",
          primaryColor: "#3b82f6",
          accentColor: "#10b981",
          fontFamily: "Inter",
          fontSize: "medium",
          compactMode: false,
          highContrast: false,          reducedMotion: false
        },
        statistics: {
          totalSermons: 0,
          totalVerses: 0,
          totalTags: 0,
          totalFolders: 0,
          totalVersions: 0,
          joinDate: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(userProfileDoc, defaultProfile);
      return { id: user.uid, ...defaultProfile };
    }
    
    return { id: userProfileSnap.id, ...userProfileSnap.data() } as UserProfile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

export async function updateUserProfile(profileData: {
  displayName?: string;
  photoURL?: string;
  preferences?: Partial<UserProfile['preferences']>;
  themeSettings?: Partial<UserProfile['themeSettings']>;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  
  try {
    const userProfileDoc = doc(db, "userProfiles", user.uid);
    const userProfileSnap = await getDoc(userProfileDoc);
    
    if (!userProfileSnap.exists()) {
      throw new Error("User profile not found. Please refresh the page.");
    }
    
    // Update the profile with the new data
    await updateDoc(userProfileDoc, {
      ...profileData,
      updatedAt: new Date()
    });
    
    // If displayName or photoURL is being updated, also update the auth profile
    if (profileData.displayName !== undefined || profileData.photoURL !== undefined) {
      await updateProfile(user, {
        displayName: profileData.displayName || user.displayName,
        photoURL: profileData.photoURL || user.photoURL
      });
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

export async function getUserStats(): Promise<UserProfile['statistics'] | null> {
  const getUserStatsFn = httpsCallable(fbFunctions, "getUserStats");
  try {
    const result = await getUserStatsFn({});
    return (result.data as UserProfile['statistics']) || null;
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

// Import user data
export async function importUserData(importData: any, replaceExisting: boolean = true): Promise<any> {
  const importUserDataFn = httpsCallable(fbFunctions, "importUserData");
  try {
    const result = await importUserDataFn({
      ...importData,
      replaceExisting
    });
    return (result.data as any) || null;
  } catch (error) {
    console.error("Error importing user data:", error);
    throw error;
  }
}

/**
 * Delete a verse from the 'verses' collection by its document ID (objectID)
 * Also cleans up user-specific tag associations for this verse
 */
export async function deleteVerseById(objectID: string): Promise<void> {
  if (!objectID) throw new Error("No verse ID provided");
  
  const batch = writeBatch(db);
  
  // Delete the verse document
  const verseDocRef = doc(versesRef, objectID);
  batch.delete(verseDocRef);
  
  // Clean up all user tag associations for this verse
  // Note: In a production system, you might want to query and delete these more efficiently
  // For now, we'll delete the current user's associations
  const currentUser = auth.currentUser;
  if (currentUser) {
    const userVerseTagRef = doc(db, 'user_verse_tags', `${currentUser.uid}_${objectID}`);
    batch.delete(userVerseTagRef);
  }
  
  await batch.commit();
}

/**
 * Update the text of a verse in the 'verses' collection by its document ID (objectID)
 */
export async function updateVerseTextById(objectID: string, newText: string): Promise<void> {
  if (!objectID) throw new Error("No verse ID provided");
  const verseDocRef = doc(versesRef, objectID);
  await updateDoc(verseDocRef, { text: newText });
}

/**
 * Delete an expository image from Firebase Storage by its download URL.
 * @param imageUrl The download URL of the image to delete.
 */
export async function deleteExpositoryImage(imageUrl: string): Promise<void> {
  // Firebase Storage URLs look like:
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/expositories%2Ffilename.jpg?alt=media&token=...
  // We need to extract the path after '/o/' and before '?' and decode it.
  try {
    const matches = imageUrl.match(/\/o\/([^?]+)/);
    if (!matches || !matches[1]) throw new Error('Invalid image URL');
    const filePath = decodeURIComponent(matches[1]); // e.g., 'expositories/filename.jpg'
    const imageRef = ref(storage, filePath);
    await deleteObject(imageRef);
  } catch (err) {
    console.error('Failed to delete expository image:', err);
    throw err;
  }
}

/**
 * Get all verses that contain a specific tag, organized by book and chapter
 */
export async function getVersesByTag(tagName: string): Promise<{ [book: string]: { [chapter: number]: Verse[] } }> {
  const normalizedTag = normalizeTagForDisplay(tagName);
  const q = query(versesRef, where("tags", "array-contains", normalizedTag));
  const snapshot = await getDocs(q);
  
  const versesByBookChapter: { [book: string]: { [chapter: number]: Verse[] } } = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const verse: Verse = {
      id: doc.id,
      verse: String(data.verse),
      text: data.text,
      translation: data.translation,
      book: data.book || '',
      chapter: data.chapter || 0,
    };
    
    const bookName = verse.book;
    const chapterNum = verse.chapter;
    
    if (bookName && chapterNum) {
      if (!versesByBookChapter[bookName]) {
        versesByBookChapter[bookName] = {};
      }
      
      if (!versesByBookChapter[bookName][chapterNum]) {
        versesByBookChapter[bookName][chapterNum] = [];
      }
      
      versesByBookChapter[bookName][chapterNum].push(verse);
    }
  });
  
  // Sort verses within each chapter
  Object.keys(versesByBookChapter).forEach(book => {
    Object.keys(versesByBookChapter[book]).forEach(chapterKey => {
      const chapter = Number(chapterKey);
      versesByBookChapter[book][chapter].sort((a, b) => parseInt(a.verse) - parseInt(b.verse));
    });
  });
  
  return versesByBookChapter;
}

/**
 * Upload a theme background image and return its URL
 */
export async function uploadThemeBackgroundImage(file: File, userId: string): Promise<string> {
  // Create a separate folder for theme background images
  const fileExtension = file.name.split('.').pop();
  const fileName = `background-${userId}-${Date.now()}.${fileExtension}`;
  const fileRef = ref(storage, `theme-backgrounds/${fileName}`);
  
  await uploadBytes(fileRef, file);
  const downloadURL = await getDownloadURL(fileRef);
  
  return downloadURL;
}

// Delete a theme background image from storage (only if owned by the user)
export async function deleteThemeBackgroundImage(imageUrl: string, userId: string): Promise<void> {
  try {
    // Only delete if it's a custom uploaded image (contains theme-backgrounds)
    if (imageUrl.includes('theme-backgrounds')) {
      // Extract filename from URL to verify ownership
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query parameters
      
      // Check if this file belongs to the current user
      if (fileName.includes(`background-${userId}-`)) {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
      } else {
        throw new Error('Unauthorized: You can only delete your own uploaded backgrounds.');
      }
    } else {
      throw new Error('Cannot delete default background images.');
    }
  } catch (error) {
    console.error('Error deleting theme background image:', error);
    throw error; // Re-throw so the UI can handle the error properly
  }
}

// Get all available theme background images for a specific user
export async function getThemeBackgroundImages(userId: string): Promise<Array<{name: string; path: string; url: string; isCustom: boolean}>> {
  try {
    const images: Array<{name: string; path: string; url: string; isCustom: boolean}> = [];
    
    // Ensure default backgrounds are in storage
    await ensureDefaultThemeBackgrounds();
    
    // Get all images from theme-backgrounds folder
    const themeBackgroundsRef = ref(storage, 'theme-backgrounds');
    try {
      const listResult = await listAll(themeBackgroundsRef);
      
      for (const itemRef of listResult.items) {
        const downloadURL = await getDownloadURL(itemRef);
        const fileName = itemRef.name;
        
        let displayName = 'Custom Background';
        let isCustom = true;
        let shouldInclude = false;
        
        // Check if this is a default background (available to all users)
        if (fileName.includes('default-blue-wall')) {
          displayName = 'Blue Wall';
          isCustom = false;
          shouldInclude = true;
        } else if (fileName.includes('default-red-wall')) {
          displayName = 'Red Wall';
          isCustom = false;
          shouldInclude = true;
        } else if (fileName.includes('default-texas-logo')) {
          displayName = 'Black Wall';
          isCustom = false;
          shouldInclude = true;
        } else if (fileName.includes(`background-${userId}-`)) {
          // This is a custom background uploaded by this specific user
          displayName = fileName.replace(/^background-.*?-\d+\./, '').replace(/\.[^.]+$/, '') || 'Custom Background';
          isCustom = true;
          shouldInclude = true;
        }
        // If it doesn't match any of the above conditions, it's another user's custom background - skip it
        
        if (shouldInclude) {
          images.push({
            name: displayName,
            path: downloadURL,
            url: downloadURL,
            isCustom: isCustom
          });
        }
      }
    } catch (error) {
      console.warn('Could not fetch theme backgrounds from storage:', error);
    }
    
    // Always add "None" option
    images.push({ name: 'None', path: '', url: '', isCustom: false });
    
    // If no images were found, add fallback defaults using public paths
    if (images.length === 1) { // Only "None" was added
      images.unshift(        { name: 'Blue Wall', path: '/Blue Wall Background.png', url: '/Blue Wall Background.png', isCustom: false },
        { name: 'Red Wall', path: '/Red Wall Background.png', url: '/Red Wall Background.png', isCustom: false },
        { name: 'Black Wall', path: '/Texas_Logo_Wallpaper.png', url: '/Texas_Logo_Wallpaper.png', isCustom: false }
      );
    }
    
    return images;
  } catch (error) {
    console.error('Error fetching theme background images:', error);
    // Return default images as fallback
    return [      { name: 'Blue Wall', path: '/Blue Wall Background.png', url: '/Blue Wall Background.png', isCustom: false },
      { name: 'Red Wall', path: '/Red Wall Background.png', url: '/Red Wall Background.png', isCustom: false },
      { name: 'Black Wall', path: '/Texas_Logo_Wallpaper.png', url: '/Texas_Logo_Wallpaper.png', isCustom: false },
      { name: 'None', path: '', url: '', isCustom: false },
    ];
  }
}

// Ensure default theme backgrounds are available in storage
export async function ensureDefaultThemeBackgrounds(): Promise<void> {
  try {
    const themeBackgroundsRef = ref(storage, 'theme-backgrounds');
    
    const defaultBackgrounds = [
      { name: 'Blue Wall Background', filename: 'default-blue-wall.png', publicPath: '/Blue Wall Background.png' },
      { name: 'Red Wall Background', filename: 'default-red-wall.png', publicPath: '/Red Wall Background.png' },
      { name: 'Texas Logo Wallpaper', filename: 'default-texas-logo.png', publicPath: '/Texas_Logo_Wallpaper.png' },
    ];

    for (const bg of defaultBackgrounds) {
      const defaultBgRef = ref(storage, `theme-backgrounds/${bg.filename}`);
      
      try {
        // Check if the file already exists
        await getDownloadURL(defaultBgRef);
        // If we get here, the file exists, so skip it
        continue;
      } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
          // File doesn't exist, so we should upload it
          try {
            // Fetch the file from the public folder
            const response = await fetch(bg.publicPath);
            if (response.ok) {
              const blob = await response.blob();
              await uploadBytes(defaultBgRef, blob);
              console.log(`Default background ${bg.name} uploaded to storage`);
            }
          } catch (uploadError) {
            console.warn(`Could not upload default background ${bg.name}:`, uploadError);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not ensure default theme backgrounds:', error);
  }
}

// Get user-specific tags for a verse
export async function getUserTagsForVerse(verseId: string, userId?: string): Promise<string[]> {
  const currentUser = userId || auth.currentUser?.uid;
  if (!currentUser) {
    return [];
  }
  
  try {
    const userVerseTagRef = doc(db, 'user_verse_tags', `${currentUser}_${verseId}`);
    const docSnap = await getDoc(userVerseTagRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.tags || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching user tags for verse:', error);
    return [];
  }
}

// Update user-specific tags for a verse
export async function updateUserTagsForVerse(verseId: string, tags: string[]): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to update verse tags');
  }
  
  const userId = currentUser.uid;
  const batch = writeBatch(db);
  
  // Create user-specific tags in the tags collection if they don't exist
  for (const tag of tags) {
    const storageTag = normalizeTagForStorage(tag);
    const displayTag = normalizeTagForDisplay(tag);
    if (storageTag) {
      const userTagId = `${userId}_${storageTag}`;
      const tagDocRef = doc(tagsRef, userTagId);
      batch.set(tagDocRef, { 
        name: displayTag, 
        original_tag: tag,
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    }
  }
  
  // Update the user-specific tag association
  const userVerseTagRef = doc(db, 'user_verse_tags', `${userId}_${verseId}`);
  if (tags.length > 0) {
    batch.set(userVerseTagRef, {
      userId: userId,
      verseId: verseId,
      tags: tags.map(tag => normalizeTagForDisplay(tag)),
      updatedAt: new Date()
    }, { merge: true });
  } else {
    // If no tags, delete the association document
    batch.delete(userVerseTagRef);
  }
  
  await batch.commit();
}

// Delete user-specific tag associations for a verse
export async function deleteUserTagsForVerse(verseId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User must be authenticated to delete verse tags');
  }
  
  const userId = currentUser.uid;
  const userVerseTagRef = doc(db, 'user_verse_tags', `${userId}_${verseId}`);
  await deleteDoc(userVerseTagRef);
}
