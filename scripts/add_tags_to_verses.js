// scripts/add_tags_to_verses.js

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// ── make __dirname work in ESM ────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── scoped require ────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);

// ── load your service account key from scripts/ ───────────────────────────────
const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── load your tags JSON from scripts/ ─────────────────────────────────────────
const tagsFile = path.join(__dirname, "scripture_tags_fixed.json");
const tagsData = JSON.parse(fs.readFileSync(tagsFile, "utf8"));

function parseRef(ref) {
  const match = ref.match(
    /^([1-3]?\s*[A-Za-z .]+)\s+(\d+)(?::(\d+)(?:[-–](\d+))?)?$/i
  );
  if (!match) return null;
  const [, book, chapter, startVerse, endVerse] = match;
  return {
    book: book.trim(),
    chapter: Number(chapter),
    startVerse: startVerse ? Number(startVerse) : 1,
    endVerse: endVerse
      ? Number(endVerse)
      : startVerse
      ? Number(startVerse)
      : null,
  };
}

async function tagVerse(book, chapter, verse, tag, skipIfMissing = false) {
  const snapshot = await db
    .collection("verses")
    .where("book", "==", book)
    .where("chapter", "==", chapter)
    .where("verse", "==", verse)
    .get();

  if (snapshot.empty) {
    if (!skipIfMissing)
      console.warn(`Verse not found: ${book} ${chapter}:${verse}`);
    return;
  }

  for (const doc of snapshot.docs) {
    const existing = doc.data().tags || [];
    if (!existing.includes(tag)) {
      await doc.ref.update({
        tags: Array.from(new Set([...existing, tag])),
      });
      console.log(`Tagged ${book} ${chapter}:${verse} ➔ [${tag}]`);
    }
  }
}

async function addTags() {
  for (const [tag, refs] of Object.entries(tagsData)) {
    for (const ref of refs) {
      const parsed = parseRef(ref);
      if (!parsed) {
        console.warn("Could not parse:", ref);
        continue;
      }
      const { book, chapter, startVerse, endVerse } = parsed;

      // handle ranges or single verses
      if (endVerse) {
        for (let v = startVerse; v <= endVerse; v++) {
          await tagVerse(book, chapter, v, tag);
        }
      } else {
        await tagVerse(book, chapter, startVerse, tag);
      }
    }
  }
  console.log("✅ All tags added!");
}

addTags().catch(console.error);
