# Chapter-Only Scripture Reference Fixes

## Issue Summary
Chapter-only references like "Genesis 1" were not working properly in the scripture reference system. The issues were:

1. **Mini card display**: Chapter-only references weren't being parsed and displayed correctly on mini cards
2. **Reference string creation**: Chapter-only references were generating malformed reference strings like "Genesis 1:undefined"
3. **Flow from parsing to display**: The parsing was working correctly, but the conversion to display-ready objects was broken

## Root Cause
The issue was in how ScriptureReference objects were being converted to display-ready mini card objects:

1. **ScriptureMiniCard.tsx**: Only had regex patterns for chapter:verse references, not chapter-only references
2. **ExpositoryDetailPage.tsx**: Both `handleRefsChange` and `debouncedSetRefs` functions were assuming all references had a `verse` property, causing malformed reference strings

## Fixes Implemented

### 1. Fixed ScriptureMiniCard Display Logic
**File**: `src/components/ScriptureMiniCard.tsx`

**Changes**:
- Added regex pattern to handle chapter-only references like "Genesis 1"
- Updated the reference display logic to handle cases where `verse` is undefined
- Ensured proper abbreviation display for both chapter-only and verse-specific references

**Before**:
```tsx
// Only handled chapter:verse patterns
const refMatch = verse.reference.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+):(\d+)(?:-(\d+))?$/i);
if (refMatch) {
  // Display logic for verse references
} else {
  displayRef = verse.reference; // Fallback - would show malformed strings
}
```

**After**:
```tsx
// Try to parse reference like "Genesis 1:1" or "Gen 1:1-2"
const refMatch = verse.reference.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+):(\d+)(?:-(\d+))?$/i);
if (refMatch) {
  // Display logic for verse references
} else {
  // Try to parse chapter-only reference like "Genesis 1"
  const chapterMatch = verse.reference.match(/^([1-3]?\s*[A-Za-z .]+)\s+(\d+)$/i);
  if (chapterMatch) {
    const book = normalizeBookName(chapterMatch[1]);
    const chapter = chapterMatch[2];
    displayRef = `${getDisplayBookAbbrev(book)} ${chapter}`;
  } else {
    displayRef = verse.reference;
  }
}
```

### 2. Fixed Reference String Generation in ExpositoryDetailPage
**File**: `src/pages/ExpositoryDetailPage.tsx`

**Changes**:
- Updated both `handleRefsChange` and `debouncedSetRefs` functions to properly handle chapter-only references
- Added conditional logic to check if `verse` property exists before including it in the reference string

**Before**:
```tsx
// Always assumed verse existed - caused "Genesis 1:undefined"
let referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
if (ref.endVerse && ref.endVerse !== ref.verse) {
  referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
}
```

**After**:
```tsx
// Build normalized reference string (handle chapter-only vs verse-specific)
let referenceString;
if (ref.verse !== undefined) {
  // Verse-specific reference
  referenceString = `${bookName} ${ref.chapter}:${ref.verse}`;
  if (ref.endVerse && ref.endVerse !== ref.verse) {
    referenceString = `${bookName} ${ref.chapter}:${ref.verse}-${ref.endVerse}`;
  }
} else {
  // Chapter-only reference
  referenceString = `${bookName} ${ref.chapter}`;
}
```

## Expected Results

### Chapter-Only Reference Flow
1. **User types**: "Genesis 1" in the rich text editor
2. **Parsing**: `smartParseScriptureInput.ts` correctly extracts it as `{ book: "Genesis", chapter: 1 }` (no verse property)
3. **Reference string creation**: ExpositoryDetailPage creates reference string as "Genesis 1" (not "Genesis 1:undefined")
4. **Mini card display**: ScriptureMiniCard displays it as "Gen 1" using the abbreviated book name
5. **ScriptureOverlay**: When clicked, the overlay correctly parses "Genesis 1" as a chapter-only reference and shows the full chapter content

### Verse-Specific References
- Continue to work as before: "Genesis 1:1" → "Gen 1:1"
- Verse ranges continue to work: "Genesis 1:1-3" → "Gen 1:1-3"

## Testing Recommendations
1. Type "Genesis 1" in the rich text editor and verify it appears as "Gen 1" on the mini card
2. Click the "Gen 1" mini card and verify the overlay shows the full Genesis chapter 1 content
3. Verify that verse-specific references like "Genesis 1:1" still work correctly
4. Test with various book name formats (full names, abbreviations, etc.)

## Files Modified
- `src/components/ScriptureMiniCard.tsx`
- `src/pages/ExpositoryDetailPage.tsx`

## Dependencies
This fix relies on the existing infrastructure:
- `smartParseScriptureInput.ts` - Already correctly parses chapter-only references
- `ScriptureOverlay.jsx` - Already correctly handles chapter-only references with endVerse=999
- `getDisplayBookAbbrev.ts` - For abbreviated book name display
