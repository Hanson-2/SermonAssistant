// Utility function to merge consecutive verses into ranges
import { buildScriptureReference, isValidVerseNumber } from '../utils/scriptureReferenceUtils.ts';

export interface ScriptureReference {
  book: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
  reference: string;
  addedViaTag?: boolean;
  sourceType?: 'manual' | 'tag';
  text?: string;
}

export function mergeConsecutiveVerses(verses: ScriptureReference[]): ScriptureReference[] {
  if (verses.length === 0) return [];

  console.log('[mergeConsecutiveVerses] ====== MERGE OPERATION START ======');
  console.log('[mergeConsecutiveVerses] Input verses count:', verses.length);
  console.log('[mergeConsecutiveVerses] Input verses detailed:', JSON.stringify(verses, null, 2));

  // DON'T SORT - preserve the original order from text position sorting
  // Only merge consecutive verses that appear consecutively in the original order
  console.log('[mergeConsecutiveVerses] Preserving original order (no sorting)...');
  const mergedVerses: ScriptureReference[] = [];
  let currentGroup: ScriptureReference[] = [];

  // Process verses in their original order (preserving text position)
  for (const verse of verses) {
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
        // Only merge verses from same source AND same addedViaTag status
        verse.addedViaTag === lastVerse.addedViaTag &&
        verse.sourceType === lastVerse.sourceType &&
        (currentVerseNum === (lastVerseNum + 1));
      
      console.log('[mergeConsecutiveVerses] Checking merge for:', verse, 'with last:', lastVerse);
      console.log('[mergeConsecutiveVerses] Can merge?', canMerge, {
        sameBook: verse.book === lastVerse.book,
        sameChapter: verse.chapter === lastVerse.chapter,
        verseDefined: currentVerseNum !== undefined && lastVerseNum !== undefined,
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

function createMergedReference(group: ScriptureReference[]): ScriptureReference {
  if (group.length === 1) {
    // Always normalize reference string
    return {
      ...group[0],
      reference: buildScriptureReference(group[0])
    };
  }

  const first = group[0];
  const last = group[group.length - 1];

  // Use buildScriptureReference to construct the merged reference robustly
  const mergedRefObj = {
    book: first.book,
    chapter: first.chapter,
    verse: first.verse,
    endVerse: last.verse !== first.verse ? last.verse : undefined
  };
  const reference = buildScriptureReference(mergedRefObj);

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
