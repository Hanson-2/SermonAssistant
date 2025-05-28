import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const BIBLES_DIR = path.resolve("bibles");

async function uploadBible(fileName) {
  const filePath = path.join(BIBLES_DIR, fileName);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  let verses, metadata;
  if (Array.isArray(data)) {
    verses = data;
    metadata = undefined;
  } else {
    verses = data.verses;
    metadata = data.metadata;
  }
  if (!Array.isArray(verses) || verses.length === 0) {
    console.warn(`Skipping ${fileName}: no verses array found.`);
    return;
  }
  const translation =
    (metadata && (metadata.shortname || metadata.name)) ||
    fileName.split(".")[0].toUpperCase().replace("PREPROCESSED_", "");

  console.log(`Uploading: ${translation} (${verses.length} verses)`);

  let batch = db.batch();
  let count = 0;

  for (const v of verses) {
    const doc = {
      book: v.book,
      book_lower: v.book.toLowerCase(),
      chapter: v.chapter,
      verse: v.verse,
      reference: `${v.book} ${v.chapter}:${v.verse}`,
      text: v.text,
      translation,
      linkedSermonId: null,
      tags: [],
    };

    // Use Firestore auto-generated ID
    const docRef = db.collection("verses").doc();
    batch.set(docRef, doc);

    if (++count % 500 === 0) {
      await batch.commit();
      console.log(`Uploaded ${count}`);
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`✅ Finished ${translation}: ${count} verses`);
}

async function main() {
  const files = readdirSync(BIBLES_DIR).filter(f => f.endsWith(".json"));
  for (const file of files) {
    await uploadBible(file);
  }

  console.log("🚀 All Bible versions uploaded.");
}

main().catch(console.error);
