const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK with environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "sermon-notes-assistant",
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL)}`,
  universe_domain: "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "sermon-notes-assistant"
});

const db = admin.firestore();

async function addExbAuthorization() {
  const userId = "89UdurybrVSwbPmp4boEMeYdVzk1";
  
  try {
    console.log("Adding EXB authorization to user profile...");
    
    // Update the userProfiles document
    await db.collection('userProfiles').doc(userId).update({
      exbAuthorized: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("✅ EXB authorization added successfully!");
    console.log("User ID:", userId);
    console.log("Collection: userProfiles");
    console.log("Field added: exbAuthorized = true");
    
    // Verify the update
    const userDoc = await db.collection('userProfiles').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log("Verification - EXB Authorized:", userData.exbAuthorized);
    }
    
  } catch (error) {
    console.error("❌ Error adding EXB authorization:", error.message);
  }
  
  process.exit(0);
}

addExbAuthorization();
