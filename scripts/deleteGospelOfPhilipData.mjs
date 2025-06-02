import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises'; // Changed to fs/promises for async/await
import { fileURLToPath } from 'url';
import path from 'path';

// Construct path to serviceAccountKey.json relative to this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Read and parse the service account key JSON file
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf-8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function deleteGospelOfPhilipData() {
  console.log('Starting deletion of "The Gospel of Philip" data...');

  // 1. Delete from 'translations' collection
  const translationDocId = 'the_gospel_of_philip'; // Document ID for "The Gospel of Philip" in translations
  const translationRef = db.collection('translations').doc(translationDocId);
  try {
    const doc = await translationRef.get();
    if (doc.exists) {
      await translationRef.delete();
      console.log(`Deleted "${translationDocId}" from translations collection.`);
    } else {
      console.log(`"${translationDocId}" not found in translations collection.`);
    }
  } catch (error) {
    console.error('Error deleting from translations collection:', error);
  }

  // 2. Delete verses from 'verses' collection
  //    We'll query for verses where the 'translation' field is 'the_gospel_of_philip' (lowercase)
  //    OR where the 'book' field is 'The Gospel of Philip' (title case)
  //    OR where the 'translation' field is 'The Gospel of Philip' (title case - just in case)

  const translationValueLower = 'the_gospel_of_philip';
  const translationValueTitle = 'The Gospel of Philip'; // Used for 'book' field and potentially 'translation'
  const bookValueTitle = 'The Gospel of Philip';

  let totalDeletedVerses = 0;
  const batchSize = 500; // Firestore batch limit

  // Function to delete documents in batches for a given query
  async function batchDelete(query, description) {
    console.log(`Starting batch deletion for: ${description}`);
    let deletedInThisQuery = 0;
    let snapshot = await query.limit(batchSize).get();
    
    while (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedInThisQuery++;
      });
      await batch.commit();
      console.log(`Batch deleted ${snapshot.size} verses for "${description}". Total for this query: ${deletedInThisQuery}`);
      
      if (snapshot.size < batchSize) break; // Last batch

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      snapshot = await query.startAfter(lastDoc).limit(batchSize).get();
    }
    if (deletedInThisQuery === 0) {
      console.log(`No verses found for "${description}".`);
    }
    return deletedInThisQuery;
  }

  // Query 1: translation == 'the_gospel_of_philip'
  const versesQuery1 = db.collection('verses').where('translation', '==', translationValueLower);
  totalDeletedVerses += await batchDelete(versesQuery1, `translation == "${translationValueLower}"`);

  // Query 2: book == 'The Gospel of Philip'
  // We need to be careful not to re-process documents if they match multiple queries.
  // However, Firestore doesn't provide a simple way to exclude already processed documents in subsequent queries
  // without fetching all IDs first, which can be inefficient for large datasets.
  // Given the batching approach, if a document is deleted by query 1, query 2 won't find it.
  // If the `translation` and `book` fields are consistently different for the same entries, this should be fine.
  const versesQuery2 = db.collection('verses').where('book', '==', bookValueTitle);
  totalDeletedVerses += await batchDelete(versesQuery2, `book == "${bookValueTitle}"`);
  
  // Query 3: translation == 'The Gospel of Philip' (just in case the casing is different)
  const versesQuery3 = db.collection('verses').where('translation', '==', translationValueTitle);
  totalDeletedVerses += await batchDelete(versesQuery3, `translation == "${translationValueTitle}"`);


  console.log(`Total verses documents deleted: ${totalDeletedVerses}.`);
  console.log('Deletion process finished.');
}

deleteGospelOfPhilipData().catch(console.error);
