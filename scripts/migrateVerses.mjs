// migrateVerses.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
// Use require to import JSON in Node.js ESM
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function migrateScriptures() {
  const scripturesRef = db.collection("scriptures");
  const versesRef = db.collection("verses");

  const booksSnapshot = await scripturesRef.listDocuments();

  for (const bookDoc of booksSnapshot) {
    const bookName = bookDoc.id;
    const chaptersSnapshot = await bookDoc.listCollections();

    for (const chapterColl of chaptersSnapshot) {
      const chapterNumber = parseInt(chapterColl.id, 10);
      const versesSnapshot = await chapterColl.get();

      for (const verseDoc of versesSnapshot.docs) {
        const verseNumber = parseInt(verseDoc.id, 10);
        const data = verseDoc.data();

        const flatVerse = {
          book: bookName,
          chapter: chapterNumber,
          verse: verseNumber,
          reference: `${bookName} ${chapterNumber}:${verseNumber}`,
          text: data.text || "",
          translation: data.translation || "EXB",
          linkedSermonId: null,
          tags: [],
        };

        await versesRef.add(flatVerse);
        console.log(`✅ Migrated ${flatVerse.reference}`);
      }
    }
  }

  console.log("🚀 Migration complete.");
}

migrateScriptures().catch(console.error);
