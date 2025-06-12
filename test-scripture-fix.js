// Test script to verify the NaN bug fix
// This tests the extractScriptureReferences function

import { extractScriptureReferences } from './src/utils/smartParseScriptureInput.js';

console.log('Testing Scripture Reference Extraction - NaN Bug Fix');
console.log('=' * 60);

// Test cases that were causing NaN issues
const testCases = [
  'John 3',           // Chapter-only reference
  'Genesis 1',        // Chapter-only reference
  'Matt 5',           // Abbreviated chapter-only reference
  'John 3:16',        // Verse-specific reference
  'Matthew 5:3-12',   // Range reference
  'Romans 8:28-30',   // Verse range
  'Psalm 23',         // Chapter-only with canonical name
  'Ps 119',           // Abbreviated chapter-only
];

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}: "${testCase}"`);
  console.log('-'.repeat(40));
  
  try {
    const results = extractScriptureReferences(testCase);
    
    if (results.length === 0) {
      console.log('  No references found');
    } else {
      results.forEach((ref, refIndex) => {
        console.log(`  Reference ${refIndex + 1}:`);
        console.log(`    Book: ${ref.book}`);
        console.log(`    Chapter: ${ref.chapter}`);
        console.log(`    Verse: ${ref.verse || 'N/A'}`);
        console.log(`    End Chapter: ${ref.endChapter || 'N/A'}`);
        console.log(`    End Verse: ${ref.endVerse || 'N/A'}`);
        console.log(`    Reference String: "${ref.reference}"`);
        
        // Check for NaN in the reference string
        if (ref.reference.includes('NaN')) {
          console.log(`    ❌ ERROR: Reference contains NaN!`);
        } else {
          console.log(`    ✅ OK: Reference is properly formatted`);
        }
      });
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}`);
  }
});

console.log('\n' + '=' * 60);
console.log('Test Complete');
