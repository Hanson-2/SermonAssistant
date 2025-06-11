// Quick test of the merging function
import { mergeConsecutiveVerses, ScriptureReference } from './utils/mergeConsecutiveVerses';

// Test data that should merge
const testVerses: ScriptureReference[] = [
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
