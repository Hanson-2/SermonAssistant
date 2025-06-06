// Utility to get capitalized, abbreviated book name for display (e.g., "Gen.", "1Co.")
// This is a shared version for overlays and mini-cards.

const bookAbbreviations: Record<string, string[]> = {
  'genesis': ['gen', 'ge', 'gn'],
  'exodus': ['ex', 'exo', 'exod'],
  'leviticus': ['lev', 'le', 'lv'],
  'numbers': ['num', 'nu', 'nm', 'nb'],
  'deuteronomy': ['deut', 'dt'],
  'joshua': ['josh', 'jos', 'jsh'],
  'judges': ['judg', 'jdg', 'jg', 'jdgs'],
  'ruth': ['ruth', 'ru'],
  '1 samuel': ['1 sam', '1sa', '1 samuel', 'i samuel', '1st samuel'],
  '2 samuel': ['2 sam', '2sa', '2 samuel', 'ii samuel', '2nd samuel'],
  '1 kings': ['1 kgs', '1 ki', '1 kings', 'i kings', '1st kings'],
  '2 kings': ['2 kgs', '2 ki', '2 kings', 'ii kings', '2nd kings'],
  '1 chronicles': ['1 chr', '1 chron', 'i chronicles', '1st chronicles'],
  '2 chronicles': ['2 chr', '2 chron', 'ii chronicles', '2nd chronicles'],
  'ezra': ['ezra', 'ezr'],
  'nehemiah': ['neh', 'ne'],
  'esther': ['est', 'es'],
  'job': ['job', 'jb'],
  'psalms': ['ps', 'psa', 'psalm', 'pslm', 'pss'],
  'proverbs': ['prov', 'pro', 'prv', 'pr'],
  'ecclesiastes': ['eccl', 'ecc', 'qoh'],
  'song of solomon': ['song', 'so', 'song of songs', 'sos', 'canticles'],
  'isaiah': ['isa', 'is'],
  'jeremiah': ['jer', 'je', 'jr'],
  'lamentations': ['lam', 'la'],
  'ezekiel': ['ezek', 'eze', 'ezk'],
  'daniel': ['dan', 'da', 'dn'],
  'hosea': ['hos', 'ho'],
  'joel': ['joel', 'jl'],
  'amos': ['amos', 'am'],
  'obadiah': ['obad', 'ob'],
  'jonah': ['jon', 'jnh'],
  'micah': ['mic', 'mc'],
  'nahum': ['nah', 'na'],
  'habakkuk': ['hab', 'hb'],
  'zephaniah': ['zeph', 'zp'],
  'haggai': ['hag', 'hg'],
  'zechariah': ['zech', 'zc'],
  'malachi': ['mal', 'ml'],
  'matthew': ['matt', 'mt'],
  'mark': ['mrk', 'mk', 'mr'],
  'luke': ['luk', 'lk'],
  'john': ['john', 'jn', 'jhn'],
  'acts': ['acts', 'ac'],
  'romans': ['rom', 'ro', 'rm'],
  '1 corinthians': ['1 cor', '1 co', 'i cor', '1st corinthians'],
  '2 corinthians': ['2 cor', '2 co', 'ii cor', '2nd corinthians'],
  'galatians': ['gal', 'ga'],
  'ephesians': ['eph', 'ep'],
  'philippians': ['phil', 'php'],
  'colossians': ['col', 'cl'],
  '1 thessalonians': ['1 thess', '1 thes', 'i thess', '1st thessalonians'],
  '2 thessalonians': ['2 thess', '2 thes', 'ii thess', '2nd thessalonians'],
  '1 timothy': ['1 tim', 'i tim', '1st timothy'],
  '2 timothy': ['2 tim', 'ii tim', '2nd timothy'],
  'titus': ['titus', 'tit'],
  'philemon': ['philem', 'phm'],
  'hebrews': ['heb', 'he'],
  'james': ['jam', 'jm', 'jas'],
  '1 peter': ['1 pet', 'i pet', '1st peter'],
  '2 peter': ['2 pet', 'ii pet', '2nd peter'],
  '1 john': ['1 john', 'i john', '1st john'],
  '2 john': ['2 john', 'ii john', '2nd john'],
  '3 john': ['3 john', 'iii john', '3rd john'],
  'jude': ['jude', 'jud'],
  'revelation': ['rev', 're', 'rv', 'apocalypse'],
};

export function normalizeBookName(input: string): string {
  const trimmed = input.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [full, abbrevs] of Object.entries(bookAbbreviations)) {
    if (full === trimmed) return full;
    if (abbrevs.includes(trimmed)) return full;
    if (abbrevs.includes(trimmed.replace(/\s+/g, ''))) return full;
    if (abbrevs.some(a => a.replace(/\s+/g, '') === trimmed.replace(/\s+/g, ''))) return full;
  }
  return trimmed;
}

export function getDisplayBookAbbrev(book: string): string {
  // Try to find the abbreviation from the map
  const entry = Object.entries(bookAbbreviations).find(([full, abbrevs]) => {
    if (full === book) return true;
    return abbrevs.includes(book);
  });
  if (entry) {
    // Use the first abbreviation, capitalize properly, add period
    const abbr = entry[1][0];
    // Split by spaces and capitalize each word
    const capitalizedAbbr = abbr.split(' ')
      .map(word => {
        // Keep numbers as-is, capitalize first letter of words
        if (/^\d+$/.test(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
    return capitalizedAbbr + '.';
  }
  // Fallback: capitalize first letter, add period
  return book.charAt(0).toUpperCase() + book.slice(1, 4) + '.';
}

export function getDisplayBookFull(book: string): string {
  // Try to find the full name from the map
  const entry = Object.entries(bookAbbreviations).find(([full, abbrevs]) => {
    if (full === book) return true;
    return abbrevs.includes(book);
  });
  
  if (entry) {
    // Return the full name with proper capitalization
    const fullName = entry[0];
    return capitalizeBookName(fullName);
  }
  
  // Fallback: capitalize the input
  return capitalizeBookName(book);
}

function capitalizeBookName(name: string): string {
  return name
    .split(' ')
    .map(word => {
      // Keep numbers as-is, capitalize words
      if (/^\d+$/.test(word)) {
        return word; // Keep numbers unchanged
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
