// deleteOldVerseDocs.mjs
// Deletes old verse documents with predictable IDs (containing underscores and/or PREPROCESSED)
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deleteOldVerseDocs() {
  const versesRef = db.collection("verses");
  const snapshot = await versesRef.get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const id = doc.id;
    // Delete if ID contains underscores (old format) or PREPROCESSED
    if (id.includes("_") || id.toUpperCase().includes("PREPROCESSED")) {
      await doc.ref.delete();
      count++;
      if (count % 100 === 0) console.log(`Deleted ${count} old verse docs...`);
    }
  }
  console.log(`✅ Deleted ${count} old verse docs.`);
}

deleteOldVerseDocs().catch(console.error);
