const admin = require('firebase-admin');

// Initialize Firebase Admin (same as before)
const serviceAccount = {
  // ... your service account config
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "sermon-notes-assistant"
});

const db = admin.firestore();

async function setUserTranslationPreferences() {
  const userId = "89UdurybrVSwbPmp4boEMeYdVzk1";
  
  try {
    await db.collection('userProfiles').doc(userId).update({
      preferredTranslation: "EXB",  // Set your preferred translation
      authorizedTranslations: ["EXB", "NASB", "ESV"],  // Set authorized translations
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("✅ Translation preferences updated!");
    console.log("Preferred: EXB");
    console.log("Authorized: EXB, NASB, ESV");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
  
  process.exit(0);
}

setUserTranslationPreferences();
