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

const VARIANTS = [
  "Book-of-Jasher",
  "Book of Jasher",
  "book-of-jasher",
  "book of jasher",
  "Jasher",
  "jasher"
];

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

async function deleteByFieldVariants(field, variants) {
  let total = 0;
  for (const value of variants) {
    // Case-insensitive search: Firestore does not support case-insensitive queries directly.
    // So, we check for each variant as-is and also try lower/upper case.
    total += await deleteByField(field, value);
    total += await deleteByField(field, value.toLowerCase());
    total += await deleteByField(field, value.toUpperCase());
    // Also try capitalized
    total += await deleteByField(field, value.charAt(0).toUpperCase() + value.slice(1).toLowerCase());
  }
  return total;
}

async function main() {
  let total = 0;
  total += await deleteByFieldVariants("book", VARIANTS);
  total += await deleteByFieldVariants("translation", VARIANTS);
  console.log(`Total deleted: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
