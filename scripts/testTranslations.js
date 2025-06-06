// Simple test to check if translations collection is populated
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBj4EKhM7aZC3VfOEF3zjmMx8xnUxnEIhM",
  authDomain: "sermon-notes-assistant.firebaseapp.com", 
  projectId: "sermon-notes-assistant",
  storageBucket: "sermon-notes-assistant.appspot.com",
  messagingSenderId: "111602120623602939751",
  appId: "1:111602120623602939751:web:84c2b825ad9b7eb86cbbb9",
  measurementId: "G-CCVS1DTFR6"
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
    } else {
      console.log('No translations found in collection');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTranslations();
