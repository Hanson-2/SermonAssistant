// migrateBookLower.mjs
// Adds a 'book_lower' field to every verse document in the 'verses' collection, set to the lowercase value of the 'book' field.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrateBookLower() {
  const versesRef = db.collection('verses');
  const snapshot = await versesRef.get();
  let count = 0;
  let batch = db.batch();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (typeof data.book === 'string') {
      const bookLower = data.book.toLowerCase();
      batch.update(doc.ref, { book_lower: bookLower });
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Updated ${count}`);
      }
    }
  }
  if (count % 400 !== 0) {
    await batch.commit();
  }
  console.log(`✅ Finished updating ${count} verse docs with book_lower.`);
}

migrateBookLower().catch(console.error);
