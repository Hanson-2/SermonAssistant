import admin from 'firebase-admin';
import { readFile } from 'fs/promises'; // Changed to fs/promises for async/await
import { fileURLToPath } from 'url';
import path from 'path';

// Construct path to serviceAccountKey.json relative to this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Read and parse the service account key JSON file
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteVersesByTranslation(translationValue) {
  console.log(`Starting deletion of verses with translation: "${translationValue}"...`);

  const versesQuery = db.collection('verses').where('translation', '==', translationValue);
  let deletedCount = 0;
  const batchSize = 500; // Firestore batch limit

  try {
    let snapshot = await versesQuery.limit(batchSize).get();
    
    while (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      await batch.commit();
      console.log(`Batch deleted ${snapshot.size} verses with translation "${translationValue}". Total deleted so far: ${deletedCount}`);
      
      // Get the next batch
      if (snapshot.size < batchSize) { // Last batch was smaller than batchSize, so no more documents
        break;
      }
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      snapshot = await versesQuery.startAfter(lastDoc).limit(batchSize).get();
    }

    if (deletedCount === 0) {
      console.log(`No verses found with translation "${translationValue}".`);
    } else {
      console.log(`Finished deleting. Total ${deletedCount} verses with translation "${translationValue}" were deleted.`);
    }

  } catch (error) {
    console.error(`Error deleting verses with translation "${translationValue}":`, error);
  }
}

// Specify the exact translation value to delete
const translationToDelete = 'gospel of philip'; 

deleteVersesByTranslation(translationToDelete).catch(console.error);
