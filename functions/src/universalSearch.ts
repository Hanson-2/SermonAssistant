import * as functions from "firebase-functions";
import algoliasearch from "algoliasearch";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// Initialize Algolia
const ALGOLIA_APP_ID = functions.config().algolia?.appid || process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = functions.config().algolia?.apikey || process.env.ALGOLIA_API_KEY;
const ALGOLIA_INDEX_NAME = functions.config().algolia?.indexname || process.env.ALGOLIA_INDEX_NAME;

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY || !ALGOLIA_INDEX_NAME) {
  console.error("Algolia configuration is missing. Ensure ALGOLIA_APP_ID, ALGOLIA_API_KEY, and ALGOLIA_INDEX_NAME are set in Firebase config or environment variables.");
}

// Define commonBookGroups mapping, same as in the frontend
const commonBookGroups = {
    "Gospels": ["Matthew", "Mark", "Luke", "John"],
    "Pauline Epistles": ["Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon"],
    "Pentateuch": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
    // Add other groups if defined in the frontend
};

const algoliaClient = algoliasearch(ALGOLIA_APP_ID!, ALGOLIA_API_KEY!);
const index = algoliaClient.initIndex(ALGOLIA_INDEX_NAME!);

export interface Tag {
  id: string;
  name: string;
  displayName: string;
}

export interface Translation {
  id: string;
  name: string;
  displayName: string;
}

export interface AlgoliaVerse {
  objectID: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  tags?: string[];
  normalizedTags?: string[];
}

export interface SearchParams {
  query: string;
  translations: string[];
  books?: string[];
  tags?: string[];
  page?: number;
  hitsPerPage?: number;
  commonGroups?: string[]; // Added to explicitly define commonGroups in SearchParams
}

// Ensure context is typed with functions.https.CallableContext
export const getAllUniqueTagsHandler = async (data: any, context: functions.https.CallableContext): Promise<{ uniqueTags: Tag[] }> => {
  functions.logger.info("getAllUniqueTags called", { data, auth: context.auth });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  try {
    const tagsSnapshot = await db.collection("tags").get();
    const uniqueTags: Tag[] = tagsSnapshot.docs.map(doc => {
      const docData = doc.data();
      const name = (docData.name as string) || ""; // Ensure name is a string
      
      // Normalize the name to create the displayName
      const displayName = name
        .replace(/_/g, " ")
        .split(" ")
        .map(word => {
          if (word.length === 0) return "";
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
      
      return { 
        id: doc.id, 
        name: name, // Original name
        displayName: displayName // Normalized display name
      };
    });
    functions.logger.info(`Returning ${uniqueTags.length} unique tags.`, { tags: uniqueTags });
    return { uniqueTags };
  } catch (error) {
    functions.logger.error("Error fetching unique tags:", error);
    throw new functions.https.HttpsError("internal", "Error fetching unique tags.", error);
  }
};

export const getAllUniqueTranslationsHandler = async (data: any, context: functions.https.CallableContext): Promise<{ uniqueTranslations: Translation[] }> => {
  functions.logger.info("getAllUniqueTranslations called", { data, auth: context.auth });
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  try {
    const translationsSnapshot = await db.collection("translations").get();
    if (translationsSnapshot.empty) {
      functions.logger.warn("No translations found in 'translations' collection. Returning empty array.");
      return { uniqueTranslations: [] };
    }
    // Log the first document's data to inspect its structure
    if (translationsSnapshot.docs.length > 0) {
      functions.logger.info("First translation document data:", translationsSnapshot.docs[0].data());
    }
    const uniqueTranslations: Translation[] = translationsSnapshot.docs.map(doc => {
      const docData = doc.data();
      // Assuming docData contains 'name' and 'displayName' as per Translation interface
      return { 
        id: doc.id, 
        name: docData.name as string, 
        displayName: docData.displayName as string 
      };
    });
    functions.logger.info(`Returning ${uniqueTranslations.length} unique translations.`, { translations: uniqueTranslations });
    return { uniqueTranslations };
  } catch (error) {
    functions.logger.error("Error fetching unique translations:", error);
    throw new functions.https.HttpsError("internal", "Error fetching unique translations.", error);
  }
};

export const universalScriptureSearchHandler = async (data: SearchParams, context: functions.https.CallableContext): Promise<{ results: AlgoliaVerse[]; nbHits: number; page: number; nbPages: number; hitsPerPage: number; }> => {
  functions.logger.info("universalScriptureSearch called with data:", { data, auth: context.auth });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  if (!data.translations || data.translations.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Translation selection is mandatory.");
  }

  const { query, translations, books, tags, page = 0, hitsPerPage = 20, commonGroups } = data;

  let effectiveBooks = books ? [...books] : [];

  if (commonGroups && commonGroups.length > 0) {
    const booksFromGroups: string[] = [];
    commonGroups.forEach(groupName => {
      const groupBookList = (commonBookGroups as any)[groupName];
      if (groupBookList) {
        booksFromGroups.push(...groupBookList);
      }
    });
    // Add books from commonGroups to effectiveBooks, avoiding duplicates
    effectiveBooks = [...new Set([...effectiveBooks, ...booksFromGroups])];
  }

  let filters = `(${translations.map(t => `translation:${t}`).join(" OR ")})`;

  if (effectiveBooks.length > 0) {
    filters += ` AND (${effectiveBooks.map(b => `book:"${b}"`).join(" OR ")})`;
  }

  if (tags && tags.length > 0) {
    filters += ` AND (${tags.map(t => `normalizedTags:"${t}"`).join(" OR ")})`;
  }

  functions.logger.info("Algolia search with query:", { query, filters, page, hitsPerPage });

  try {
    const searchResults = await index.search<AlgoliaVerse>(query, {
      filters: filters,
      page: page,
      hitsPerPage: hitsPerPage,
      attributesToHighlight: [ // Request highlighting for these attributes
        'text',
        'reference',
        'book',
        // Add other attributes you might want to highlight, e.g., 'tags' if they are searchable text
      ],
      highlightPreTag: '<mark>', // HTML tag to wrap highlighted terms
      highlightPostTag: '</mark>',
    });
    functions.logger.info("Algolia search successful", { nbHits: searchResults.nbHits });
    return {
      results: searchResults.hits,
      nbHits: searchResults.nbHits,
      page: searchResults.page,
      nbPages: searchResults.nbPages,
      hitsPerPage: searchResults.hitsPerPage,
    };
  } catch (error) {
    functions.logger.error("Error performing Algolia search:", error);
    throw new functions.https.HttpsError("internal", "Error performing search.", error);
  }
};

// Helper function to normalize tags for display (consistent with client-side)
function normalizeTagForDisplay(tag: string): string {
  if (typeof tag !== 'string') return '';
  return tag
    .toLowerCase()
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper function to normalize tags for storage (consistent with client-side)
function normalizeTagForStorage(tag: string): string {
  if (typeof tag !== 'string') return '';
  return tag.toLowerCase().replace(/\s+/g, '_').trim();
}

interface BatchUpdateTagsByCriteriaData {
  criteria: SearchParams; // Re-use SearchParams from universalScriptureSearch
  tagsToAdd: string[];
  tagsToRemove: string[];
  applyToAllTranslationsInCriteria?: boolean;
}

export const batchUpdateTagsByCriteriaHandler = async (data: BatchUpdateTagsByCriteriaData, context: functions.https.CallableContext): Promise<{ success: boolean; updatedCount: number; message?: string }> => {
  functions.logger.info("batchUpdateTagsByCriteria called with data:", { data, auth: context.auth });

  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const { criteria, tagsToAdd, tagsToRemove, applyToAllTranslationsInCriteria } = data;

  if (!criteria || (!tagsToAdd || tagsToAdd.length === 0) && (!tagsToRemove || tagsToRemove.length === 0)) {
    throw new functions.https.HttpsError("invalid-argument", "Criteria and at least one tag to add or remove must be provided.");
  }

  const algoliaFilters: string[] = [];
  if (criteria.translations && criteria.translations.length > 0) {
    algoliaFilters.push(`(${criteria.translations.map(t => `translation:${t}`).join(" OR ")})`);
  }
  if (criteria.books && criteria.books.length > 0) {
    algoliaFilters.push(`(${criteria.books.map(b => `book:\\\"${b}\\\"`).join(" OR ")})`);
  }
  // Note: Algolia text query is separate from filters. Tags from criteria are not directly used for Algolia filtering here,
  // as the primary use case is text search + facets. If criteria.tags were meant for filtering, add them.

  const algoliaQuery = criteria.query || '';
  const finalAlgoliaFilters = algoliaFilters.join(" AND ");

  functions.logger.info("Algolia search for batch update with:", { query: algoliaQuery, filters: finalAlgoliaFilters });

  let allObjectIDs: string[] = [];
  try {
    // Fetch ALL hits from Algolia matching the criteria. This might require pagination if > 1000 hits.
    // For simplicity, fetching up to 1000. For more, implement Algolia pagination.
    const searchResults = await index.search<AlgoliaVerse>(algoliaQuery, {
      filters: finalAlgoliaFilters,
      hitsPerPage: 1000, // Max Algolia hits per page
      attributesToRetrieve: ['objectID', 'book', 'chapter', 'verse', 'translation'], // Only need these for processing
      attributesToHighlight: [], // No highlighting needed
    });
    allObjectIDs = searchResults.hits.map(hit => hit.objectID);
    functions.logger.info(`Found ${searchResults.nbHits} potential verses in Algolia. Processing ${allObjectIDs.length} of them.`);
  } catch (error) {
    functions.logger.error("Error performing Algolia search for batch update:", error);
    throw new functions.https.HttpsError("internal", "Error searching verses for batch update.", error);
  }

  if (allObjectIDs.length === 0) {
    return { success: true, updatedCount: 0, message: "No verses found matching the criteria." };
  }

  const firestoreBatch = db.batch();
  let updatedCount = 0;
  const allTagsMentionedInAddOps = new Set<string>();

  const normalizedTagsToAdd = tagsToAdd.map(tag => normalizeTagForDisplay(tag.trim())).filter(Boolean);
  const normalizedTagsToRemove = tagsToRemove.map(tag => normalizeTagForDisplay(tag.trim())).filter(Boolean);

  normalizedTagsToAdd.forEach(tag => allTagsMentionedInAddOps.add(tag)); // Use display version for consistency with verse docs

  // Process in chunks to stay within Firestore batch limits (500 operations)
  const chunkSize = 450; // Slightly less than 500 to be safe (reads + writes)
  for (let i = 0; i < allObjectIDs.length; i += chunkSize) {
    const chunkObjectIDs = allObjectIDs.slice(i, i + chunkSize);
    const verseDocsToUpdate: { ref: admin.firestore.DocumentReference, newTags: string[] }[] = [];

    // Step 1: Read current tags for the chunk
    const verseSnapshots = await db.getAll(...chunkObjectIDs.map(id => db.collection('verses').doc(id)));

    for (const verseSnap of verseSnapshots) {
      if (!verseSnap.exists) {
        functions.logger.warn(`Verse with objectID ${verseSnap.id} not found in Firestore. Skipping.`);
        continue;
      }
      const verseData = verseSnap.data() as AlgoliaVerse; // Assuming AlgoliaVerse is compatible enough
      const currentTags: string[] = verseData.tags || [];
      const newTagsSet = new Set(currentTags);

      normalizedTagsToAdd.forEach(tag => newTagsSet.add(tag));
      normalizedTagsToRemove.forEach(tag => newTagsSet.delete(tag));

      const finalTagsArray = Array.from(newTagsSet).sort();
      verseDocsToUpdate.push({ ref: verseSnap.ref, newTags: finalTagsArray });

      if (applyToAllTranslationsInCriteria && verseData.book && verseData.chapter && verseData.verse) {
        // If applyToAllTranslations, query for other translations of this specific verse
        const relatedVersesQuery = db.collection('verses')
          .where('book_lower', '==', verseData.book.toLowerCase())
          .where('chapter', '==', Number(verseData.chapter))
          .where('verse', '==', Number(verseData.verse));
        
        const relatedVersesSnap = await relatedVersesQuery.get();
        relatedVersesSnap.forEach(relatedDoc => {
          if (relatedDoc.id === verseSnap.id) return; // Skip self
          const relatedData = relatedDoc.data();
          const relatedCurrentTags: string[] = relatedData.tags || [];
          const relatedNewTagsSet = new Set(relatedCurrentTags);
          normalizedTagsToAdd.forEach(tag => relatedNewTagsSet.add(tag));
          normalizedTagsToRemove.forEach(tag => relatedNewTagsSet.delete(tag));
          const relatedFinalTags = Array.from(relatedNewTagsSet).sort();
          // Avoid duplicate updates if already processed via direct objectID
          if (!verseDocsToUpdate.find(op => op.ref.path === relatedDoc.ref.path)) {
             verseDocsToUpdate.push({ ref: relatedDoc.ref, newTags: relatedFinalTags });
          }
        });
      }
    }
    
    // Step 2: Add updates to batch
    const uniqueVerseUpdates = new Map<string, { ref: admin.firestore.DocumentReference, newTags: string[] }>();
    verseDocsToUpdate.forEach(op => {
        uniqueVerseUpdates.set(op.ref.path, op); // Ensure each verse is updated only once per batch
    });

    uniqueVerseUpdates.forEach(op => {
        firestoreBatch.update(op.ref, { tags: op.newTags });
        updatedCount++;
    });
  }

  // Update global tags collection
  allTagsMentionedInAddOps.forEach(displayTag => {
    const storageTag = normalizeTagForStorage(displayTag); // Use the display tag to derive storage tag
    if (storageTag) {
      const tagDocRef = db.collection('tags').doc(storageTag);
      firestoreBatch.set(tagDocRef, { 
          name: displayTag, // Store the display-normalized version as 'name'
          id: storageTag, 
          searchName: storageTag.toLowerCase() 
      }, { merge: true });
    }
  });

  try {
    await firestoreBatch.commit();
    functions.logger.info(`Batch update successful. Updated ${updatedCount} verses.`);
    return { success: true, updatedCount };
  } catch (error) {
    functions.logger.error("Error committing batch tag update to Firestore:", error);
    throw new functions.https.HttpsError("internal", "Error updating tags in Firestore.", error);
  }
};
