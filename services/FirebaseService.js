import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAWH6KZnxrRZfnmCA8116qbj_8uGjGliaU",
  authDomain: "sermon-notes-assistant.firebaseapp.com",
  projectId: "sermon-notes-assistant",
  storageBucket: "sermon-notes-assistant.firebasestorage.app",
  messagingSenderId: "741896945073",
  appId: "1:741896945073:web:00c666850aead6b4d89190",
  measurementId: "G-59CREPD9PF"
};

// ✅ Initialize Firebase and services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// ✅ Verse Lookup Functions
export async function getVerse(book, chapter, verse) {
  const docRef = doc(db, 'bible', book, chapter.toString(), verse.toString());
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().text : 'Verse not found';
}

export async function getRange(book, chapter, startVerse, endVerse) {
  const chapterRef = collection(db, 'bible', book, chapter.toString());
  const snapshot = await getDocs(chapterRef);
  const verses = [];

  snapshot.forEach(docSnap => {
    const verseNum = parseInt(docSnap.id);
    if (verseNum >= startVerse && verseNum <= endVerse) {
      verses.push({ verse: verseNum, text: docSnap.data().text });
    }
  });

  verses.sort((a, b) => a.verse - b.verse); // Ensure order
  return verses;
}

// ✅ Optional exports if you later use other Firebase features
export { db, analytics };
