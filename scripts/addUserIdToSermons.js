// Usage: node scripts/addUserIdToSermons.js <your-uid>
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (process.argv.length < 3) {
  console.error('Usage: node addUserIdToSermons.js <your-uid>');
  process.exit(1);
}

const userId = process.argv[2];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function addUserIdToAllSermons() {
  const sermonsRef = db.collection('sermons');
  const snapshot = await sermonsRef.get();
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.userID) {
      await doc.ref.update({ userID: userId });
      updated++;
      console.log(`Updated sermon ${doc.id}`);
    }
  }
  console.log(`Done. Updated ${updated} sermons.`);
}

addUserIdToAllSermons().catch(console.error);
