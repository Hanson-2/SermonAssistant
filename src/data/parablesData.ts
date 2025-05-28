import { getBookOrder } from '../utils/bookOrder'; // Adjust path as necessary
import { getDisplayBookAbbrev } from '../utils/getDisplayBookAbbrev'; // Added import

// Define a more specific type for verse information needed by isVerseInParable
export interface BasicVerseInfo {
  book: string;
  chapter: number;
  verse: number;
}

// Define interfaces for Parable data
export interface ParableScriptureRange {
  chapter: number;
  startVerse: number;
  endVerse: number;
}

export interface ParableReferenceDetail {
  book: string; // Full book name, e.g., "Matthew"
  parsedRanges: ParableScriptureRange[];
}

export interface Parable {
  id: number;
  title: string;
  canonicalReferences: ParableReferenceDetail[];
  firstVerseInfo: { book: string; chapter: number; verse: number; bookOrder: number };
}

// Helper function to parse scripture range strings (e.g., "13:3-9, 18-23" or "10:29")
function parseRangesStr(rangesStr: string | null): ParableScriptureRange[] {
  if (!rangesStr || rangesStr.trim() === '-' || rangesStr.trim() === '—') return [];
  
  const ranges: ParableScriptureRange[] = [];
  const normalizedRangesStr = rangesStr.replace(/[–—]/g, '-'); // Normalize all dashes to hyphens
  const parts = normalizedRangesStr.split(','); 
  let currentChapter: number | null = null;

  parts.forEach(part => {
    part = part.trim();
    const chapterVerseSplit = part.split(':');
    
    let versePart: string;
    if (chapterVerseSplit.length > 1) {
      const chapterNum = parseInt(chapterVerseSplit[0], 10);
      if (!isNaN(chapterNum)) {
        currentChapter = chapterNum;
      }
      versePart = chapterVerseSplit[1];
    } else {
      versePart = chapterVerseSplit[0];
    }

    if (currentChapter === null || !versePart) return; 

    const verseRangeSplit = versePart.split('-');
    const startVerse = parseInt(verseRangeSplit[0], 10);
    const endVerse = verseRangeSplit.length > 1 ? parseInt(verseRangeSplit[1], 10) : startVerse;

    if (!isNaN(startVerse) && !isNaN(endVerse)) {
      ranges.push({ chapter: currentChapter, startVerse, endVerse });
    }
  });
  return ranges;
}

// Raw data based on the provided table
const parablesListRaw = [
  { id: 1, title: "The Sower", refs: [{ book: "Matthew", rangesStr: "13:3-9,18-23" }, { book: "Mark", rangesStr: "4:3-9,13-20" }, { book: "Luke", rangesStr: "8:5-8,11-15" }] },
  { id: 2, title: "The Weeds (Tares)", refs: [{ book: "Matthew", rangesStr: "13:24-30,36-43" }] },
  { id: 3, title: "The Mustard Seed", refs: [{ book: "Matthew", rangesStr: "13:31-32" }, { book: "Mark", rangesStr: "4:30-32" }, { book: "Luke", rangesStr: "13:18-19" }] },
  { id: 4, title: "The Leaven", refs: [{ book: "Matthew", rangesStr: "13:33" }, { book: "Luke", rangesStr: "13:20-21" }] },
  { id: 5, title: "The Hidden Treasure", refs: [{ book: "Matthew", rangesStr: "13:44" }] },
  { id: 6, title: "The Pearl of Great Price", refs: [{ book: "Matthew", rangesStr: "13:45-46" }] },
  { id: 7, title: "The Net (Dragnet)", refs: [{ book: "Matthew", rangesStr: "13:47-50" }] },
  { id: 8, title: "The Lost Sheep", refs: [{ book: "Matthew", rangesStr: "18:12-14" }, { book: "Luke", rangesStr: "15:3-7" }] },
  { id: 9, title: "The Unforgiving Servant", refs: [{ book: "Matthew", rangesStr: "18:23-35" }] },
  { id: 10, title: "The Workers in the Vineyard", refs: [{ book: "Matthew", rangesStr: "20:1-16" }] },
  { id: 11, title: "The Two Sons", refs: [{ book: "Matthew", rangesStr: "21:28-32" }] },
  { id: 12, title: "The Wicked Tenants", refs: [{ book: "Matthew", rangesStr: "21:33-46" }, { book: "Mark", rangesStr: "12:1-12" }, { book: "Luke", rangesStr: "20:9-19" }] },
  { id: 13, title: "The Wedding Feast", refs: [{ book: "Matthew", rangesStr: "22:1-14" }] },
  { id: 14, title: "The Ten Virgins", refs: [{ book: "Matthew", rangesStr: "25:1-13" }] },
  { id: 15, title: "The Talents", refs: [{ book: "Matthew", rangesStr: "25:14-30" }] },
  { id: 16, title: "The Sheep and the Goats", refs: [{ book: "Matthew", rangesStr: "25:31-46" }] },
  { id: 17, title: "The Lamp under a Basket", refs: [{ book: "Matthew", rangesStr: "5:14-16" }, { book: "Mark", rangesStr: "4:21-25" }, { book: "Luke", rangesStr: "8:16-18" }] },
  { id: 18, title: "The Wise and Foolish Builders", refs: [{ book: "Matthew", rangesStr: "7:24-27" }, { book: "Luke", rangesStr: "6:47-49" }] },
  { id: 19, title: "New Cloth on Old Garment", refs: [{ book: "Matthew", rangesStr: "9:16" }, { book: "Mark", rangesStr: "2:21" }, { book: "Luke", rangesStr: "5:36" }] },
  { id: 20, title: "New Wine in Old Wineskins", refs: [{ book: "Matthew", rangesStr: "9:17" }, { book: "Mark", rangesStr: "2:22" }, { book: "Luke", rangesStr: "5:37-39" }] },
  { id: 21, title: "The Strong Man", refs: [{ book: "Matthew", rangesStr: "12:29" }, { book: "Mark", rangesStr: "3:27" }, { book: "Luke", rangesStr: "11:21-22" }] },
  { id: 22, title: "The Rich Fool", refs: [{ book: "Luke", rangesStr: "12:16-21" }] },
  { id: 23, title: "The Watchful Servants", refs: [{ book: "Luke", rangesStr: "12:35-40" }] },
  { id: 24, title: "The Faithful and Wicked Servants", refs: [{ book: "Matthew", rangesStr: "24:45-51" }, { book: "Mark", rangesStr: "13:34-37" }, { book: "Luke", rangesStr: "12:42-48" }] },
  { id: 25, title: "The Barren Fig Tree", refs: [{ book: "Luke", rangesStr: "13:6-9" }] },
  { id: 26, title: "The Great Banquet", refs: [{ book: "Luke", rangesStr: "14:15-24" }] },
  { id: 27, title: "The Tower Builder and Warring King", refs: [{ book: "Luke", rangesStr: "14:28-33" }] },
  { id: 28, title: "The Lost Coin", refs: [{ book: "Luke", rangesStr: "15:8-10" }] },
  { id: 29, title: "The Prodigal Son", refs: [{ book: "Luke", rangesStr: "15:11-32" }] },
  { id: 30, title: "The Shrewd Manager", refs: [{ book: "Luke", rangesStr: "16:1-13" }] },
  { id: 31, title: "The Rich Man and Lazarus", refs: [{ book: "Luke", rangesStr: "16:19-31" }] },
  { id: 32, title: "The Persistent Widow", refs: [{ book: "Luke", rangesStr: "18:1-8" }] },
  { id: 33, title: "The Pharisee and the Tax Collector", refs: [{ book: "Luke", rangesStr: "18:9-14" }] },
  { id: 34, title: "The Ten Minas", refs: [{ book: "Luke", rangesStr: "19:11-27" }] },
  { id: 35, title: "The Good Samaritan", refs: [{ book: "Luke", rangesStr: "10:25-37" }] },
  { id: 36, title: "The Friend at Midnight", refs: [{ book: "Luke", rangesStr: "11:5-8" }] },
  { id: 37, title: "The Rich Young Fool (combined concept)", refs: [{ book: "Luke", rangesStr: "18:18-30" }] },
  { id: 38, title: "The Vine and the Branches", refs: [{ book: "John", rangesStr: "15:1-8" }] },
];

// Process the raw parables data to parse ranges and determine first verse for sorting
export const ProcessedParablesData: Parable[] = parablesListRaw.map(p_raw => {
  const canonicalRefs: ParableReferenceDetail[] = [];
  p_raw.refs.forEach(refInput => {
    if (refInput.rangesStr && refInput.rangesStr.trim() !== '-' && refInput.rangesStr.trim() !== '—') {
      const parsed = parseRangesStr(refInput.rangesStr);
      if (parsed.length > 0) {
        canonicalRefs.push({ book: refInput.book, parsedRanges: parsed });
      }
    }
  });

  let firstVerse = { book: "", chapter: Infinity, verse: Infinity, bookOrder: Infinity };

  if (canonicalRefs.length > 0) {
    firstVerse.book = canonicalRefs[0].book; // Initial guess
    firstVerse.bookOrder = getBookOrder(canonicalRefs[0].book);
    firstVerse.chapter = canonicalRefs[0].parsedRanges[0].chapter;
    firstVerse.verse = canonicalRefs[0].parsedRanges[0].startVerse;

    canonicalRefs.forEach(refDetail => {
      const currentBookOrder = getBookOrder(refDetail.book);
      refDetail.parsedRanges.forEach(range => {
        if (currentBookOrder < firstVerse.bookOrder) {
          firstVerse = { book: refDetail.book, chapter: range.chapter, verse: range.startVerse, bookOrder: currentBookOrder };
        } else if (currentBookOrder === firstVerse.bookOrder) {
          if (range.chapter < firstVerse.chapter) {
            firstVerse = { book: refDetail.book, chapter: range.chapter, verse: range.startVerse, bookOrder: currentBookOrder };
          } else if (range.chapter === firstVerse.chapter && range.startVerse < firstVerse.verse) {
            firstVerse = { book: refDetail.book, chapter: range.chapter, verse: range.startVerse, bookOrder: currentBookOrder };
          }
        }
      });
    });
  }
  
  return {
    id: p_raw.id,
    title: p_raw.title,
    canonicalReferences: canonicalRefs,
    firstVerseInfo: firstVerse,
  };
}).sort((a, b) => {
  if (a.firstVerseInfo.bookOrder !== b.firstVerseInfo.bookOrder) {
    return a.firstVerseInfo.bookOrder - b.firstVerseInfo.bookOrder;
  }
  if (a.firstVerseInfo.chapter !== b.firstVerseInfo.chapter) {
    return a.firstVerseInfo.chapter - b.firstVerseInfo.chapter;
  }
  return a.firstVerseInfo.verse - b.firstVerseInfo.verse;
});

// Function to check if a verse belongs to a specific parable\'s defined ranges
export function isVerseInParable(verse: BasicVerseInfo, parable: Parable): boolean {
  const verseBookComparable = getDisplayBookAbbrev(verse.book);
  // console.log(`isVerseInParable: Checking verse ${verse.book} ${verse.chapter}:${verse.verse} (comparable: ${verseBookComparable}) for parable "${parable.title}"`);

  for (const ref of parable.canonicalReferences) {
    const parableRefBookComparable = getDisplayBookAbbrev(ref.book);
    // console.log(`  Comparing verse book "${verseBookComparable}" with parable ref book "${ref.book}" (comparable: ${parableRefBookComparable})`);
    
    if (verseBookComparable === parableRefBookComparable) { 
      // console.log(`    Book match! ("${verseBookComparable}" === "${parableRefBookComparable}"). Checking ranges...`);
      for (const range of ref.parsedRanges) {
        // console.log(`      Parable "${parable.title}" (Ref: ${ref.book}): Checking verse ${verse.book} ${verse.chapter}:${verse.verse} against range Ch: ${range.chapter} (${typeof range.chapter}), V: ${range.startVerse}-${range.endVerse}. Verse types: Ch: ${typeof verse.chapter}, V: ${typeof verse.verse}`);
        
        const verseChapterNum = typeof verse.chapter === 'string' ? parseInt(verse.chapter, 10) : verse.chapter;
        const verseVerseNum = typeof verse.verse === 'string' ? parseInt(verse.verse, 10) : verse.verse;

        if (isNaN(verseChapterNum) || isNaN(verseVerseNum)) {
          // console.log(`        Verse chapter or verse is NaN after parsing. Skipping.`);
          continue;
        }

        if (verseChapterNum === range.chapter && verseVerseNum >= range.startVerse && verseVerseNum <= range.endVerse) {
          // console.log(`        MATCH FOUND: Verse ${verse.book} ${verseChapterNum}:${verseVerseNum} IS INCLUDED in range Ch: ${range.chapter}, V: ${range.startVerse}-${range.endVerse} for parable "${parable.title}".`);
          return true;
        }
      }
    }
  }
  return false;
}
