export type Scripture = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  topicTags?: string[];
};

export function parseScriptureChapterInput(input: string): Scripture[] {
  const lines = input.trim().split(/\n+/);
  const regex = /^([\w\s]+)\s+(\d+):(\d+)\s+(.+)$/;
  const results: Scripture[] = [];

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const [, book, chapter, verse, text] = match;
      results.push({
        book: book.trim(),
        chapter: parseInt(chapter, 10),
        verse: parseInt(verse, 10),
        text: text.trim(),
      });
    }
  }

  if (results.length === 0) {
    throw new Error("No valid verses found. Expected format: 'Book Chapter:Verse Text' per line.");
  }

  return results;
}
