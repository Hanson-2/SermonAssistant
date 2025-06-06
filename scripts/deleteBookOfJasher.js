// scripts/deleteBookOfJasher.js
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // or use cert() if you have a service account key
  });
}

const db = admin.firestore();
const COLLECTION = "verses"; // Change if your collection is named differently
const JASHER = "Book-of-Jasher";

async function deleteByField(field, value) {
  const snapshot = await db.collection(COLLECTION).where(field, "==", value).get();
  if (snapshot.empty) {
    console.log(`No documents found with ${field} == "${value}"`);
    return 0;
  }
  let count = 0;
  const batchSize = 400; // Firestore batch limit is 500
  let batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % batchSize !== 0) {
    await batch.commit();
  }
  console.log(`Deleted ${count} documents where ${field} == "${value}"`);
  return count;
}

async function main() {
  let total = 0;
  total += await deleteByField("book", JASHER);
  total += await deleteByField("translation", JASHER);
  console.log(`Total deleted: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
