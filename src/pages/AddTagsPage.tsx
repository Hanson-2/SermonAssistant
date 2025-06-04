// filepath: c:\\Users\\steve\\Custom-Apps\\Sermon Notes Assistant\\src\\pages\\AddTagsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './AddTagsPage.css';
import { batchUpdateVerseTags, BatchVerseTagUpdate } from '../services/firebaseService';
import { Navigate } from 'react-router-dom';

// UserTag interface for user-specific tags
interface UserTag {
  id: string;
  name: string;
  color?: string;
}

// Import ALL_BOOKS from a shared location or define it here if not already available
// For now, let's define a simplified version. Ideally, this comes from a shared constants file.
const ALL_BOOKS: string[] = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
    "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", 
    "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", 
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", 
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", 
    "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", 
    "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", 
    "Revelation"
];

// Interfaces based on UniversalSearchPage.tsx
interface Translation {
  id: string;
  name: string;
  displayName: string;
}

interface Verse {
  objectID: string; // Firestore document ID for verses
  book: string;
  chapter: number;
  verse: number;
  text: string;
  tags: string[];
  translation: string;
  reference: string;
  // Optional: If using Algolia-like highlighting from universalScriptureSearch
  _highlightResult?: {
    text?: { value: string };
    reference?: { value: string };
  };
}

// const TRANSLATION_OPTIONS = [ ... ]; // This will be fetched dynamically

// Define the type for search parameters to be stored
interface StoredSearchParams {
  query: string;
  translations: string[];
  books?: string[];
}

export default function AddTagsPage() { 
  return <Navigate to="/tag-management" replace />; 
}
