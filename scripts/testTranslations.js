/* eslint-disable no-undef */
// Simple test to check if translations collection is populated
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables from a `.env` file if present
dotenv.config();

// Firebase configuration is loaded from environment variables
const getEnv = (key) => (typeof process !== 'undefined' && process.env[key]) ? process.env[key] : '';

const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('FIREBASE_APP_ID'),
  measurementId: getEnv('FIREBASE_MEASUREMENT_ID')
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
