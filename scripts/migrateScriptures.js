import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

if (typeof process === 'undefined' || typeof process.env === 'undefined') {
  console.error('process or process.env is not defined!');
  throw new Error('process.env is not available. Make sure to run this script with Node.js.');
}

// Construct service account from environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};

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
