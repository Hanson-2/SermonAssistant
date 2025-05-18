import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../firebase"; // Adjust path to your Firebase config

export const getScriptureBooks = async () => {
  const db = getFirestore(app);
  const scripturesRef = collection(db, "scriptures");
  const snapshot = await getDocs(scripturesRef);
  return snapshot.docs.map(doc => doc.id);
};
