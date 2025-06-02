// filepath: c:\\Users\\steve\\Custom-Apps\\Sermon Notes Assistant\\scripts\\populateTagsCollection.mjs
import admin from 'firebase-admin';
import { createRequire } from 'module';

// Use createRequire to import JSON (ESM workaround)
const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully for script.");
  }
} catch (e) {
  console.error("CRITICAL: Failed to initialize Firebase Admin SDK for script:", e);
  process.exit(1); // Exit if SDK fails to initialize
}

const db = admin.firestore();

// Helper function to normalize tags
function normalizeTagForStorage(tag) {
  if (typeof tag !== 'string') return '';
  // For storage in Firestore document IDs, keep it simple: lowercase and use underscores
  // This is because document IDs have restrictions (e.g., no spaces, certain characters).
  // The display normalization (capitalization, spaces) will be handled when retrieving.
  return tag.toLowerCase().replace(/\s+/g, '_').trim();
}

async function populateTags() {
  console.log("Starting to populate 'tags' collection...");
  const versesCollectionRef = db.collection('verses');
  const tagsCollectionRef = db.collection('tags');
  const allTags = new Set();
  let documentsProcessed = 0;

  try {
    console.log("Fetching all documents from 'verses' collection. This might take a while...");
    const snapshot = await versesCollectionRef.get();

    if (snapshot.empty) {
      console.log("No documents found in 'verses' collection. Nothing to populate.");
      return;
    }

    console.log(`Processing ${snapshot.size} documents from 'verses' collection...`);

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data && data.tags && Array.isArray(data.tags)) {
        data.tags.forEach(tag => {
          if (typeof tag === 'string' && tag.trim() !== '') {
            // Add the original tag form to the set for processing
            allTags.add(tag.trim()); 
          }
        });
      }
      documentsProcessed++;
      if (documentsProcessed % 500 === 0) {
        console.log(`Processed ${documentsProcessed} documents so far...`);
      }
    });

    console.log(`Found ${allTags.size} unique tags to populate.`);

    if (allTags.size === 0) {
      console.log("No unique tags found. 'tags' collection will not be populated.");
      return;
    }

    const batchArray = [];
    let currentBatch = db.batch();
    let operationsInCurrentBatch = 0;
    const MAX_OPERATIONS_PER_BATCH = 499; // Firestore batch limit is 500

    for (const originalTag of allTags) {
      // Normalize the tag for use as a document ID
      const normalizedId = normalizeTagForStorage(originalTag);
      if (!normalizedId) continue; // Skip if the normalized ID is empty

      const tagDocRef = tagsCollectionRef.doc(normalizedId); 
      // Store the original tag (or a display-friendly version) in a 'name' field
      // For now, let's store the originalTag, display normalization happens on read.
      currentBatch.set(tagDocRef, { name: originalTag, original_tag: originalTag }, { merge: true }); 
      operationsInCurrentBatch++;

      if (operationsInCurrentBatch >= MAX_OPERATIONS_PER_BATCH) {
        batchArray.push(currentBatch);
        currentBatch = db.batch();
        operationsInCurrentBatch = 0;
      }
    }

    // Add the last batch if it has pending operations
    if (operationsInCurrentBatch > 0) {
      batchArray.push(currentBatch);
    }

    console.log(`Committing ${batchArray.length} batch(es) to create/update tag documents...`);
    await Promise.all(batchArray.map(batch => batch.commit()));

    console.log(`Successfully populated/updated ${allTags.size} tags in the 'tags' collection.`);

  } catch (error) {
    console.error("Error populating 'tags' collection:", error);
  }
}

populateTags().then(() => {
  console.log("Script finished.");
  process.exit(0);
}).catch((error) => {
  console.error("Script failed with error:", error);
  process.exit(1);
});
