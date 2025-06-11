// Quick test of the merging function - simplified JavaScript version

function mergeConsecutiveVerses(verses) {
  if (verses.length === 0) return [];

  console.log('[mergeConsecutiveVerses] ====== MERGE OPERATION START ======');
  console.log('[mergeConsecutiveVerses] Input verses count:', verses.length);
  console.log('[mergeConsecutiveVerses] Input verses detailed:', JSON.stringify(verses, null, 2));

  // Sort verses by book, chapter, then verse
  const sortedVerses = [...verses].sort((a, b) => {
    // Compare books
    if (a.book !== b.book) {
      return a.book.localeCompare(b.book);
    }
    
    // Compare chapters - ensure numeric comparison
    const aChapter = typeof a.chapter === 'string' ? parseInt(a.chapter, 10) : a.chapter;
    const bChapter = typeof b.chapter === 'string' ? parseInt(b.chapter, 10) : b.chapter;
    if (aChapter !== bChapter) {
      return aChapter - bChapter;
    }
    
    // Compare verses (handle undefined verses as 0) - ensure numeric comparison
    const aVerse = a.verse ? (typeof a.verse === 'string' ? parseInt(a.verse, 10) : a.verse) : 0;
    const bVerse = b.verse ? (typeof b.verse === 'string' ? parseInt(b.verse, 10) : b.verse) : 0;
    return aVerse - bVerse;
  });

  console.log('[mergeConsecutiveVerses] Sorted verses:', JSON.stringify(sortedVerses, null, 2));

  const mergedVerses = [];
  let currentGroup = [];

  for (const verse of sortedVerses) {
    if (currentGroup.length === 0) {
      currentGroup = [verse];
      console.log('[mergeConsecutiveVerses] Starting new group with:', verse);
    } else {
      const lastVerse = currentGroup[currentGroup.length - 1];
      
      // Ensure numeric comparison for verse numbers
      const currentVerseNum = verse.verse ? (typeof verse.verse === 'string' ? parseInt(verse.verse, 10) : verse.verse) : undefined;
      const lastVerseNum = lastVerse.verse ? (typeof lastVerse.verse === 'string' ? parseInt(lastVerse.verse, 10) : lastVerse.verse) : undefined;
      
      // Check if this verse can be merged with the current group
      const canMerge = 
        verse.book === lastVerse.book &&
        verse.chapter === lastVerse.chapter &&
        currentVerseNum !== undefined && 
        lastVerseNum !== undefined &&
        currentVerseNum === (lastVerseNum + 1) &&
        // Only merge verses from same source AND same addedViaTag status
        verse.addedViaTag === lastVerse.addedViaTag &&
        verse.sourceType === lastVerse.sourceType;
      
      console.log('[mergeConsecutiveVerses] Checking merge for:', verse, 'with last:', lastVerse);
      console.log('[mergeConsecutiveVerses] Can merge?', canMerge, {
        sameBook: verse.book === lastVerse.book,
        sameChapter: verse.chapter === lastVerse.chapter,
        verseDefined: currentVerseNum !== undefined && lastVerseNum !== undefined,
        consecutive: currentVerseNum === (lastVerseNum + 1),
        sameTag: verse.addedViaTag === lastVerse.addedViaTag,
        sameSource: verse.sourceType === lastVerse.sourceType
      });
      
      if (canMerge) {
        currentGroup.push(verse);
        console.log('[mergeConsecutiveVerses] Added to group, now:', currentGroup.length, 'verses');
      } else {
        // Create merged reference for current group and start new group
        const merged = createMergedReference(currentGroup);
        mergedVerses.push(merged);
        console.log('[mergeConsecutiveVerses] Finalized group as:', merged);
        currentGroup = [verse];
        console.log('[mergeConsecutiveVerses] Starting new group with:', verse);
      }
    }
  }

  // Handle the last group
  if (currentGroup.length > 0) {
    const merged = createMergedReference(currentGroup);
    mergedVerses.push(merged);
    console.log('[mergeConsecutiveVerses] Final group merged as:', merged);
  }

  console.log('[mergeConsecutiveVerses] Input:', verses.length, 'verses, Output:', mergedVerses.length, 'verses');
  console.log('[mergeConsecutiveVerses] Final merged results:', JSON.stringify(mergedVerses, null, 2));
  console.log('[mergeConsecutiveVerses] ====== MERGE OPERATION END ======');

  return mergedVerses;
}

function createMergedReference(group) {
  if (group.length === 1) {
    return group[0];
  }

  const first = group[0];
  const last = group[group.length - 1];

  // Create range reference
  let reference;
  if (first.verse !== undefined && last.verse !== undefined) {
    if (first.verse === last.verse) {
      reference = `${first.book} ${first.chapter}:${first.verse}`;
    } else {
      reference = `${first.book} ${first.chapter}:${first.verse}-${last.verse}`;
    }
  } else {
    // Chapter-only reference
    reference = `${first.book} ${first.chapter}`;
  }

  // Combine text if available
  const combinedText = group
    .map(v => v.text)
    .filter(text => text)
    .join(' ');

  return {
    book: first.book,
    chapter: first.chapter,
    verse: first.verse,
    endVerse: last.verse !== first.verse ? last.verse : undefined,
    reference,
    addedViaTag: first.addedViaTag,
    sourceType: first.sourceType,
    text: combinedText || first.text
  };
}

// Test data that should merge
const testVerses = [
  {
    book: "Genesis",
    chapter: 1,
    verse: 1,
    reference: "Genesis 1:1",
    addedViaTag: true,
    sourceType: 'tag',
    text: "In the beginning God created the heaven and the earth."
  },
  {
    book: "Genesis", 
    chapter: 1,
    verse: 2,
    reference: "Genesis 1:2",
    addedViaTag: true,
    sourceType: 'tag',
    text: "And the earth was without form, and void..."
  },
  {
    book: "Genesis",
    chapter: 1, 
    verse: 3,
    reference: "Genesis 1:3",
    addedViaTag: true,
    sourceType: 'tag',
    text: "And God said, Let there be light..."
  }
];

console.log('Testing mergeConsecutiveVerses...');
const result = mergeConsecutiveVerses(testVerses);
console.log('Result:', result);
console.log('Expected: 1 merged verse Genesis 1:1-3');
console.log('Actual count:', result.length);
if (result.length === 1) {
  console.log('SUCCESS: Merged correctly');
  console.log('Reference:', result[0].reference);
} else {
  console.log('FAILURE: Did not merge properly');
}
