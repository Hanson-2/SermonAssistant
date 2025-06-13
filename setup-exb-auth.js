// Setup EXB Authorization for User
// Run this once to set up your EXB authorization in Firestore

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Your Firebase config (copy from your firebase config file)
const firebaseConfig = {
  // Add your Firebase config here if you want to run this script independently
  // Or just run the commands manually in the Firebase console
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupExbAuthorization() {
  const userId = "89UdurybrVSwbPmp4boEMeYdVzk1"; // Your user ID
  
  try {
    await setDoc(doc(db, "users", userId), {
      exbAuthorized: true,
      email: "your-email@example.com", // Replace with your actual email
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true }); // merge: true will only update these fields without overwriting existing data
    
    console.log("EXB authorization set successfully!");
  } catch (error) {
    console.error("Error setting EXB authorization:", error);
  }
}

setupExbAuthorization();
