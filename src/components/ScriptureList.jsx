import React, { useEffect, useState } from "react";
import { getScriptureBooks } from "../utils/getScriptureBooks";

const canonicalBooks = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", 
  "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", 
  "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", 
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", 
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", 
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", 
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", 
  "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", 
  "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", 
  "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", 
  "3 John", "Jude", "Revelation"
];

const nonCanonicalBooks = ["1 Enoch", "Jubilees", "Gospel of Thomas"];

const ScriptureList = () => {
  const [availableBooks, setAvailableBooks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const books = await getScriptureBooks();
      setAvailableBooks(books);
    };
    fetchData();
  }, []);

  const renderBookCard = (book) => {
    const isAvailable = availableBooks.includes(book);
    const cardClass = isAvailable ? "bg-white text-black" : "bg-gray-800 text-gray-500 pointer-events-none";

    return (
      <div key={book} className={`p-4 m-2 rounded shadow ${cardClass}`}>
        {book}
      </div>
    );
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl mb-4">Canonical Books</h2>
      <div className="flex flex-wrap">
        {canonicalBooks.map(renderBookCard)}
      </div>

      <h2 className="text-2xl mt-8 mb-4">Non-Canonical Books</h2>
      <div className="flex flex-wrap">
        {nonCanonicalBooks.map(renderBookCard)}
      </div>
    </div>
  );
};

export default ScriptureList;
