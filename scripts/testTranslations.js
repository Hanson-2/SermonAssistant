// Simple test to check if translations collection is populated
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const dotenv = require('dotenv');

// Load environment variables from a `.env` file if present
dotenv.config();

// Firebase configuration is loaded from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTranslations() {
  try {
    console.log('Checking translations collection...');
    
    const translationsRef = collection(db, 'translations');
    const snapshot = await getDocs(translationsRef);
    
    console.log(`Found ${snapshot.size} documents in translations collection`);
    
    if (snapshot.size > 0) {
      console.log('\nTranslations found:');
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, Name: ${data.name}, DisplayName: ${data.displayName}`);
      });
      process.exit(0);
    } else {
      console.log('No translations found in collection');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTranslations();
