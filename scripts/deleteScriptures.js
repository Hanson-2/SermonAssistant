import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Load your service account JSON here (Windows/ESM compatible)
const __filename = decodeURIComponent(new URL(import.meta.url).pathname);
const __dirname = path.dirname(__filename).replace(/^\/([A-Za-z]:)/, '$1'); // Windows fix
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'serviceAccountKey.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteAllExcept(docToKeepId) {
  const collectionRef = db.collection('scriptures');
  const snapshot = await collectionRef.get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    if (doc.id !== docToKeepId) {
      batch.delete(doc.ref);
    }
  });

  await batch.commit();
  console.log('Deletion completed.');
}

// Replace 'Genesis' with your doc ID to keep
deleteAllExcept('Genesis');
