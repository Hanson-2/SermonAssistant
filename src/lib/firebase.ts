import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAWH6KZnxrRZfnmCA8116qbj_8uGjGliaU",
  authDomain: "sermon-notes-assistant.firebaseapp.com",
  projectId: "sermon-notes-assistant",
  storageBucket: "sermon-notes-assistant.firebasestorage.app",
  messagingSenderId: "741896945073",
  appId: "1:741896945073:web:00c666850aead6b4d89190",
  measurementId: "G-59CREPD9PF"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
