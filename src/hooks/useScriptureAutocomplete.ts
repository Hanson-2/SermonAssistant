import { useState, useEffect } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../lib/firebase.js"; // adjust path for explicit file extension
import debounce from "lodash.debounce";

// Export bookAliases from useScriptureAutocomplete for use in other files
export type BookAliasesType = { [key: string]: string };
export const bookAliases: BookAliasesType = {
  gen: "Genesis", ge: "Genesis", gn: "Genesis",
  ex: "Exodus", exo: "Exodus",
  lev: "Leviticus", lv: "Leviticus",
  num: "Numbers", nm: "Numbers", nu: "Numbers",
  deut: "Deuteronomy", dt: "Deuteronomy",

  josh: "Joshua", jos: "Joshua",
  judg: "Judges", jdg: "Judges", jg: "Judges",
  ruth: "Ruth", ru: "Ruth",
  "1sam": "1 Samuel", "1 sa": "1 Samuel", "i sam": "1 Samuel",
  "2sam": "2 Samuel", "2 sa": "2 Samuel", "ii sam": "2 Samuel",
  "1kgs": "1 Kings", "1 ki": "1 Kings",
  "2kgs": "2 Kings", "2 ki": "2 Kings",
  "1chr": "1 Chronicles", "1 ch": "1 Chronicles",
  "2chr": "2 Chronicles", "2 ch": "2 Chronicles",
  ezra: "Ezra", ezr: "Ezra",
  neh: "Nehemiah", ne: "Nehemiah",
  esth: "Esther", es: "Esther",
  job: "Job",
  ps: "Psalms", psa: "Psalms", pslm: "Psalms",
  prov: "Proverbs", pr: "Proverbs", pv: "Proverbs",
  ecc: "Ecclesiastes", ec: "Ecclesiastes",
  song: "Song of Solomon", sos: "Song of Solomon",

  isa: "Isaiah", is: "Isaiah",
  jer: "Jeremiah",
  lam: "Lamentations",
  ezek: "Ezekiel", ez: "Ezekiel",
  dan: "Daniel", dn: "Daniel",
  hos: "Hosea", ho: "Hosea",
  joel: "Joel",
  amos: "Amos", am: "Amos",
  obad: "Obadiah", ob: "Obadiah",
  jonah: "Jonah", jon: "Jonah",
  mic: "Micah", mi: "Micah",
  nah: "Nahum",
  hab: "Habakkuk",
  zeph: "Zephaniah", zep: "Zephaniah",
  hag: "Haggai",
  zech: "Zechariah", zec: "Zechariah",
  mal: "Malachi",

  matt: "Matthew", mt: "Matthew",
  mark: "Mark", mk: "Mark",
  luke: "Luke", lk: "Luke",
  john: "John", jn: "John",
  acts: "Acts", ac: "Acts",
  rom: "Romans", ro: "Romans",
  "1cor": "1 Corinthians", "1 co": "1 Corinthians", "i cor": "1 Corinthians",
  "2cor": "2 Corinthians", "2 co": "2 Corinthians", "ii cor": "2 Corinthians",
  gal: "Galatians",
  eph: "Ephesians",
  phil: "Philippians", php: "Philippians",
  col: "Colossians",
  "1thess": "1 Thessalonians", "1 th": "1 Thessalonians",
  "2thess": "2 Thessalonians", "2 th": "2 Thessalonians",
  "1tim": "1 Timothy", "1 ti": "1 Timothy",
  "2tim": "2 Timothy", "2 ti": "2 Timothy",
  titus: "Titus", ti: "Titus",
  philem: "Philemon", phm: "Philemon",
  heb: "Hebrews", he: "Hebrews",
  james: "James", ja: "James", jm: "James",
  "1pet": "1 Peter", "1 pe": "1 Peter",
  "2pet": "2 Peter", "2 pe": "2 Peter",
  "1john": "1 John", "1 jo": "1 John", "i john": "1 John",
  "2john": "2 John", "2 jo": "2 John", "ii john": "2 John",
  "3john": "3 John", "3 jo": "3 John", "iii john": "3 John",
  jude: "Jude", jud: "Jude",
  rev: "Revelation", re: "Revelation", rv: "Revelation"
};

function normalizeRef(text: string) {
  // Try to match abbreviations and full book names
  const match = text.match(/([1-3]?\s?[a-zA-Z\.]+)[\s\.]?(\d+):?(\d+)?/i);
  if (!match) return null;

  let rawBook = match[1].replace(/\s/g, "").toLowerCase().replace(".", "");
  // Try to match abbreviation, fallback to full name
  let book = bookAliases[rawBook];
  if (!book) {
    // Try to match with spaces removed (e.g. "1cor" for "1 Corinthians")
    const alt = Object.keys(bookAliases).find(
      abbr => abbr.replace(/\s/g, "") === rawBook
    );
    if (alt) book = bookAliases[alt];
    else book = rawBook.charAt(0).toUpperCase() + rawBook.slice(1);
  }
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : null;

  return { book, chapter, verse };
}

export function useScriptureAutocomplete(noteText: string, translation = "EXB") {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  useEffect(() => {
    const debouncedSearch: (() => Promise<void>) & { cancel: () => void } = debounce(async () => {
      const parts = noteText.split(/\s+/).slice(-6); // last few words
      const match = parts.join(" ");
      const ref = normalizeRef(match);
      if (!ref) return setSuggestions([]);

      const q = query(
        collection(db, "verses"),
        where("book", "==", ref.book),
        where("chapter", "==", ref.chapter),
        ...(ref.verse ? [where("verse", "==", ref.verse)] : []),
        where("translation", "==", translation),
        limit(5)
      );
      const results = await getDocs(q);
      const data = results.docs.map(doc => doc.data());
      setSuggestions(data);
    }, 400) as any; // lodash.debounce returns a function with a cancel method, but types may not match exactly

    debouncedSearch();
    return () => debouncedSearch.cancel();
  }, [noteText]);

  return suggestions;
}
