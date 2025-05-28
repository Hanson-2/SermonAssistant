// Adds the 'olivet_discourse' tag to all relevant verses in Firestore
// Usage: node scripts/add_olivet_discourse_tag.cjs

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

// Helper to check if a verse is in the Olivet Discourse range
function isOlivetDiscourseVerse(book, chapter, verse) {
  if (book === 'Matthew') {
    // Matthew 24:1–25:46
    if (chapter === 24) return verse >= 1;
    if (chapter === 25) return verse >= 1 && verse <= 46;
    if (chapter > 24 && chapter < 25) return true;
  } else if (book === 'Mark') {
    // Mark 13:1–13:37
    if (chapter === 13) return verse >= 1 && verse <= 37;
  } else if (book === 'Luke') {
    // Luke 21:5–21:36
    if (chapter === 21) return verse >= 5 && verse <= 36;
  }
  return false;
}

async function addOlivetDiscourseTag() {
  const snapshot = await db.collection('verses').get();
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.book || !data.chapter || !data.verse) continue;
    if (isOlivetDiscourseVerse(data.book, data.chapter, data.verse)) {
      const tags = Array.isArray(data.tags) ? data.tags : [];
      if (!tags.includes('olivet_discourse')) {
        tags.push('olivet_discourse');
        await doc.ref.update({ tags });
        updated++;
        if (updated % 50 === 0) console.log(`Updated ${updated} verses...`);
      }
    }
  }
  console.log(`Done. Updated ${updated} verses with 'olivet_discourse' tag.`);
}

addOlivetDiscourseTag().catch(err => {
  console.error('Error updating verses:', err);
  process.exit(1);
});
