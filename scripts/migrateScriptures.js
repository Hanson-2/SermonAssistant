import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Load Service Account (Cross-Platform Compatible)
const __filename = decodeURIComponent(new URL(import.meta.url).pathname);
const __dirname = path.dirname(__filename).replace(/^\/([A-Za-z]:)/, '$1');
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function flattenVersesStructure() {
  // Get all book documents under 'scriptures'
  const booksSnapshot = await db.collection('scriptures').get();

  for (const bookDoc of booksSnapshot.docs) {
    const bookId = bookDoc.id;
    // List all subcollections for this book (chapters, or chapter numbers)
    const subcollections = await bookDoc.ref.listCollections();
    for (const subcol of subcollections) {
      if (subcol.id === 'chapters') {
        // Old structure: chapters subcollection
        const chaptersSnapshot = await subcol.get();
        for (const chapterDoc of chaptersSnapshot.docs) {
          const chapterId = chapterDoc.id;
          // List all subcollections for this chapter (should be only 'verses')
          const chapterSubcollections = await chapterDoc.ref.listCollections();
          for (const versesCol of chapterSubcollections) {
            if (versesCol.id !== 'verses') continue;
            const versesSnapshot = await versesCol.get();
            for (const verseDoc of versesSnapshot.docs) {
              const verseId = verseDoc.id;
              const data = verseDoc.data();
              const targetDocRef = db
                .collection('scriptures')
                .doc(bookId)
                .collection(chapterId)
                .doc(verseId);
              await targetDocRef.set(data, { merge: true });
              console.log(`✅ Migrated (old): ${bookId}/chapters/${chapterId}/verses/${verseId} -> ${bookId}/${chapterId}/${verseId}`);
            }
          }
        }
      } else {
        // New structure: chapter number as subcollection
        const versesSnapshot = await subcol.get();
        for (const verseDoc of versesSnapshot.docs) {
          const verseId = verseDoc.id;
          const data = verseDoc.data();
          const targetDocRef = db
            .collection('scriptures')
            .doc(bookId)
            .collection(subcol.id)
            .doc(verseId);
          await targetDocRef.set(data, { merge: true });
          console.log(`✅ Verified/Migrated (new): ${bookId}/${subcol.id}/${verseId}`);
        }
      }
    }
  }
  console.log('✅ Migration complete.');
}

flattenVersesStructure().catch(console.error);
