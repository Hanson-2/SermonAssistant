import React, { useState, useEffect } from "react";
import { saveScriptureVerses } from "../services/firebaseService";
import { buildScriptureReference } from "../utils/scriptureReferenceUtils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./AddScripturePage.css"; // Added CSS import
import { getFunctions, httpsCallable } from 'firebase/functions';
import { listAll, ref as storageRef, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface ParsedVerse {
  book: string;
  book_lower: string;
  chapter: number;
  linkedSermonID?: string;
  reference: string;
  tags: string[];
  text: string;
  translation: string;
  verse: number;
}

// UserTag interface for user-specific tags
interface UserTag {
  id: string;
  name: string;
  color?: string;
}

const TRANSLATION_GROUPS = [
  {
    label: "Common English",
    options: [
      { value: "EXB", label: "Expanded Bible (EXB)" },
      { value: "ESV", label: "English Standard Version (ESV)" },
      { value: "KJV", label: "King James Version (KJV)" },
      { value: "NIV", label: "New International Version (NIV)" },
    ],
  },
];

function SortableVerseItem({ verse, index, onChange, onDelete, userTags }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: index,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Tag input and user tag suggestions
  const [localTagFilter, setLocalTagFilter] = React.useState('');
  const [highlightedIdx, setHighlightedIdx] = React.useState(-1);
  const localInputRef = React.useRef<HTMLInputElement>(null);
  const filteredUserTags = localTagFilter.trim().length === 0
    ? []
    : (userTags || []).filter(tag => tag.name.toLowerCase().includes(localTagFilter.trim().toLowerCase()));
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredUserTags.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx(idx => (idx + 1) % filteredUserTags.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx(idx => (idx - 1 + filteredUserTags.length) % filteredUserTags.length);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && highlightedIdx >= 0) {
      onChange(index, 'addTag', filteredUserTags[highlightedIdx].name);
      setHighlightedIdx(-1);
      setLocalTagFilter('');
      e.preventDefault();
    }
  };
  React.useEffect(() => { setHighlightedIdx(-1); }, [localTagFilter, filteredUserTags.length]);

  return (
    // Apply the style from useSortable here for dnd-kit functionality
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="add-scripture-preview-item-modern">
      <div className="verse-item-header"> {/* Changed from inline style to class */}
        <span className="add-scripture-ref-modern">
          Verse {verse.chapter}:{verse.verse}
        </span>
        <span
          className="verse-item-delete-btn" /* Changed from inline style to class */
          onClick={() => onDelete(index)}
        >
          ×
        </span>
      </div>

      <textarea
        className="add-scripture-verse-textarea"
        value={verse.text}
        onChange={(e) => onChange(index, "text", e.target.value)}
        placeholder="Enter verse text"
        title="Verse text"
      />

      <div className="suggested-tag-container">
        {suggestTagsFromText(verse.text).map((tag: string) => (
          <span
            key={tag}
            className="suggested-tag"
            onClick={() => onChange(index, "addTag", tag)}
          >
            + {tag}
          </span>
        ))}
      </div>

      <input
        type="text"
        placeholder="Add tags (comma separated)"
        value={verse.tags.join(", ")}
        onChange={(e) => {
          const inputTags = e.target.value.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
          onChange(index, "setTags", inputTags);
          setLocalTagFilter(e.target.value.split(',').pop() || '');
        }}
        onKeyDown={handleKeyDown}
        ref={localInputRef}
      />
      {filteredUserTags.length > 0 && localTagFilter.trim() && (
        <ul className="user-tag-suggestion-list">
          {filteredUserTags.map((tag, idx) => (
            <li
              key={tag.id + '-suggestion'}
              className={
                'user-tag-suggestion-item' + (idx === highlightedIdx ? ' highlighted' : '')
              }
              onMouseDown={() => {
                onChange(index, 'addTag', tag.name);
                setLocalTagFilter('');
              }}
              tabIndex={-1}
            >
              {tag.name}
            </li>
          ))}
        </ul>
      )}

      <span className="add-scripture-translation-modern">
        {verse.reference} ({verse.translation})
      </span>
    </li>
  );
}

function suggestTagsFromText(text: string): string[] {
  const keywordMap: { [key: string]: string } = {
    "Holy Spirit": "holy-spirit",
    "tongue": "tongues",
    "fire": "pentecost",
    "baptism": "baptism",
    "Jesus": "jesus",
    "faith": "faith",
    "sin": "sin",
    "repent": "repentance",
    "kingdom": "kingdom",
    "cross": "crucifixion",
    "resurrection": "resurrection",
  };

  const tags = new Set<string>();
  for (const keyword in keywordMap) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      tags.add(keywordMap[keyword]);
    }
  }
  return Array.from(tags);
}

export default function AddScripturePage() {
  const [input, setInput] = useState("Acts 2\n1 When the day of Pentecost came...\n2 And suddenly there came a sound from heaven as of a rushing mighty wind..."); // Added example placeholder
  const [parsedVerses, setParsedVerses] = useState<ParsedVerse[]>([]);
  const [error, setError] = useState("");
  const [translation, setTranslation] = useState("EXB");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false); // New state for parsing indicator

  // User tags state
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [isLoadingUserTags, setIsLoadingUserTags] = useState(false);
  const [userTagLoadError, setUserTagLoadError] = useState<string | null>(null);
  const [userTagFilter, setUserTagFilter] = useState('');
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState<number>(-1);
  const userTagFilterInputRef = React.useRef<HTMLInputElement>(null);
  const functions = getFunctions();

  // New state for translations
  const [translations, setTranslations] = useState<{ name: string; displayName: string }[]>([]);
  const [showAddTranslationPrompt, setShowAddTranslationPrompt] = useState(false);
  const [newTranslation, setNewTranslation] = useState("");
  const [newTranslationDisplay, setNewTranslationDisplay] = useState("");

  // Batch parsing state
  const [unparsedText, setUnparsedText] = useState<string>("");
  const [parsedBookCount, setParsedBookCount] = useState<number>(0);
  const [batchDone, setBatchDone] = useState<boolean>(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Fetch user tags on mount
  React.useEffect(() => {
    const fetchUserTags = async () => {
      setIsLoadingUserTags(true);
      setUserTagLoadError(null);
      try {
        const getUserTags = httpsCallable(functions, 'getUserTags');
        const result = await getUserTags();
        const tagsData = (result.data as any)?.tags || [];
        setUserTags(tagsData);
      } catch (e: any) {
        setUserTagLoadError(e.message || 'Failed to load your tags.');
      } finally {
        setIsLoadingUserTags(false);
      }
    };
    fetchUserTags();
  }, [functions]);

  // Fetch all available translations from Firestore
  useEffect(() => {
    async function fetchTranslations() {
      try {
        const translationsCol = collection(db, "translations");
        const snapshot = await getDocs(translationsCol);
        const list: { name: string; displayName: string }[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.name && data.displayName) {
            list.push({ name: data.name, displayName: data.displayName });
          }
        });
        setTranslations(list);
      } catch (err) {
        setTranslations([
          { name: "esv", displayName: "ESV" },
          { name: "kjv", displayName: "KJV" },
          { name: "niv", displayName: "NIV" },
          { name: "exb", displayName: "EXB" },
        ]); // fallback
      }
    }
    fetchTranslations();
  }, []);

  // Handle translation dropdown change
  const handleTranslationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "__add_new__") {
      setShowAddTranslationPrompt(true);
    } else {
      setTranslation(e.target.value);
    }
  };

  // Add new translation to Firestore
  const handleAddTranslation = async () => {
    if (!newTranslation.trim() || !newTranslationDisplay.trim()) return;
    const name = newTranslation.trim().toLowerCase();
    const displayName = newTranslationDisplay.trim();
    try {
      const translationsCol = collection(db, "translations");
      await addDoc(translationsCol, { name, displayName });
      setTranslations([...translations, { name, displayName }]);
      setTranslation(name);
      setShowAddTranslationPrompt(false);
      setNewTranslation("");
      setNewTranslationDisplay("");
    } catch (err) {
      alert("Failed to add translation. Try again.");
    }
  };

  // Filtered user tags for display
  const filteredUserTags = userTagFilter.trim().length === 0
    ? userTags
    : userTags.filter(tag => tag.name.toLowerCase().includes(userTagFilter.trim().toLowerCase()));

  // Keyboard navigation for tag suggestions
  const handleUserTagFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, onAdd: (tag: string) => void) => {
    if (filteredUserTags.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSuggestionIdx(idx => (idx + 1) % filteredUserTags.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSuggestionIdx(idx => (idx - 1 + filteredUserTags.length) % filteredUserTags.length);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && highlightedSuggestionIdx >= 0) {
      onAdd(filteredUserTags[highlightedSuggestionIdx].name);
      setHighlightedSuggestionIdx(-1);
      e.preventDefault();
    }
  };

  React.useEffect(() => {
    setHighlightedSuggestionIdx(-1);
  }, [userTagFilter, filteredUserTags.length]);

  // Non-blocking, chunked parsing for large files with progress
  const handleParse = () => {
    setIsParsing(true);
    setProgress(0);
    setTimeout(() => {
      try {
        const source = unparsedText || input;
        const lines = source.split(/\r?\n/).map(line => line.trim());
        const verses: ParsedVerse[] = [];
        let currentBook = "";
        let currentChapter = 0;
        let verseNum = 1;
        let lastChapterLine = false;
        let currentVerseText = "";
        let currentVerseNum = 1;
        let i = 0;
        const total = lines.length;
        const chunkSize = 50;
        let booksParsed = 0;
        let batchLimitReached = false;
        let batchEndLine = 0;
        const pushVerse = () => {
          if (currentVerseText.trim()) {            verses.push({
              book: currentBook,
              book_lower: currentBook.toLowerCase(),
              chapter: currentChapter,
              linkedSermonID: "",
              reference: buildScriptureReference({
                book: currentBook,
                chapter: currentChapter,
                verse: currentVerseNum
              }),
              tags: suggestTagsFromText(currentVerseText),
              text: currentVerseText.trim(),
              translation,
              verse: currentVerseNum,
            });
          }
        };
        function parseChunk() {
          const end = Math.min(i + chunkSize, total);
          for (; i < end; i++) {
            const line = lines[i];
            const chapterMatch = line.match(/^([1-3]?\s?[A-Za-z ]+)\s+(\d+)$/);
            if (chapterMatch) {
              if (currentBook && chapterMatch[1].trim() !== currentBook) {
                booksParsed++;
                if (booksParsed >= 10) {
                  batchLimitReached = true;
                  batchEndLine = i;
                  break;
                }
              }
              pushVerse();
              currentBook = chapterMatch[1].trim();
              currentChapter = parseInt(chapterMatch[2], 10);
              verseNum = 1;
              currentVerseNum = 1;
              currentVerseText = "";
              lastChapterLine = true;
              continue;
            }
            if (!line) continue;
            if (lastChapterLine) {
              pushVerse();
              currentVerseNum = 1;
              currentVerseText = line;
              verseNum = 2;
              lastChapterLine = false;
              continue;
            }
            const numberedVerseMatch = line.match(/^(\d+)\.[\s·]+(.+)/);
            if (numberedVerseMatch) {
              pushVerse();
              currentVerseNum = parseInt(numberedVerseMatch[1], 10);
              currentVerseText = numberedVerseMatch[2].trim();
              verseNum = currentVerseNum + 1;
              continue;
            }
            if (currentVerseText) {
              currentVerseText += " " + line;
            } else {
              currentVerseText = line;
            }
          }
          setProgress(Math.round((i / total) * 100));
          if (batchLimitReached || i >= total) {
            pushVerse();
            setParsedVerses(verses);
            setError("");
            setIsParsing(false);
            setProgress(0);
            setParsedBookCount(booksParsed);
            setBatchDone(i >= total);
            // Save remaining unparsed text for next batch
            if (batchLimitReached && batchEndLine < lines.length) {
              setUnparsedText(lines.slice(batchEndLine).join("\n"));
            } else {
              setUnparsedText("");
            }
            return;
          }
          if (i < total) {
            if (window.requestIdleCallback) {
              window.requestIdleCallback(parseChunk, { timeout: 100 });
            } else {
              setTimeout(parseChunk, 0);
            }
          }
        }
        parseChunk();
      } catch (err: any) {
        setError(err.message || "Parsing failed.");
        setIsParsing(false);
        setProgress(0);
      }
    }, 0);
  };

  // After submitting, allow parsing next batch if available
  const handleNextBatch = () => {
    setParsedVerses([]);
    setParsedBookCount(0);
    setBatchDone(false);
    setTimeout(() => handleParse(), 0);
  };

  const updateVerse = (index: number, action: string, payload: any) => {
    setParsedVerses((prev) => {
      const updated = [...prev];
      if (action === "text") {
        updated[index].text = payload;
      } else if (action === "addTag") {
        if (!updated[index].tags.includes(payload)) {
          updated[index].tags.push(payload);
        }
      } else if (action === "setTags") {
        const currentTags = new Set(updated[index].tags);
        payload.forEach((tag: string) => currentTags.add(tag));
        updated[index].tags = Array.from(currentTags);
      }
      return updated;
    });
  };

  const handleDelete = (index: number) => {
    setParsedVerses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setParsedVerses((items) => {
        const oldIndex = active.id;
        const newIndex = over.id;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitStatus("");
    setProgress(0);

    try {
      let completed = 0;
      for (const verse of parsedVerses) {
        await saveScriptureVerses([verse]);
        completed++;
        setProgress(Math.round((completed / parsedVerses.length) * 100));
      }
      setSubmitStatus("Scriptures added successfully.");
      setInput("");
      setParsedVerses([]);
    } catch (err) {
      setSubmitStatus("Error submitting to Firebase.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitStatus(""), 2500);
      setProgress(0);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInput(text || "");
      setTimeout(() => handleParse(), 0); // Parse after state update
    };
    reader.readAsText(file);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="add-scripture-layout">
        <div className="add-scripture-container"> {/* Added container for centering and max-width */} 
          <h1 className="add-scripture-title">Add Scripture</h1>

          {error && <p className="add-scripture-error">{error}</p>}
          {submitStatus && <p className={`submit-status-message ${submitting ? '' : (submitStatus.includes('Success') ? 'success' : 'error')}`}>{submitStatus}</p>}
          {submitting && progress > 0 && (
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ ['--progress-width' as any]: `${progress}%` }}
              >
                {progress}%
              </div>
            </div>
          )}
          {isParsing && (
            <div className="add-scripture-loading-indicator">
              <span className="spinner" style={{ marginRight: 8 }} />
              Parsing scripture, please wait... ({progress}%)
            </div>
          )}

          <div className="translation-selection-group">
            <label htmlFor="translation-select" className="add-scripture-translation-label">
              Translation:
            </label>
            <select
              id="translation-select"
              value={translation}
              onChange={handleTranslationChange}
              className="add-scripture-translation-dropdown"
            >
              {translations.map((t) => (
                <option key={t.name} value={t.name}>{t.displayName}</option>
              ))}
              <option value="__add_new__">Add New Translation...</option>
            </select>
            {showAddTranslationPrompt && (
              <div className="add-translation-prompt">
                <input
                  type="text"
                  placeholder="Translation code (e.g. nlt)"
                  value={newTranslation}
                  onChange={e => setNewTranslation(e.target.value)}
                  maxLength={10}
                  style={{ marginRight: 8 }}
                />
                <input
                  type="text"
                  placeholder="Display name (e.g. NLT)"
                  value={newTranslationDisplay}
                  onChange={e => setNewTranslationDisplay(e.target.value)}
                  maxLength={32}
                  style={{ marginRight: 8 }}
                />
                <button onClick={handleAddTranslation}>Add</button>
                <button onClick={() => setShowAddTranslationPrompt(false)} style={{ marginLeft: 8 }}>Cancel</button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="scripture-file-upload" style={{ fontWeight: 500, marginRight: 8 }}>Upload Scripture File (.txt):</label>
            <input
              id="scripture-file-upload"
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              disabled={submitting}
              style={{ marginRight: 8 }}
            />
          </div>

          <textarea
            className="add-scripture-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste scripture here. Start with book and chapter (e.g., John 3) on the first line, then verses starting with their numbers on subsequent lines."
            rows={10} // Increased default rows
          />

          <div className="add-scripture-actions"> {/* Added wrapper for buttons */} 
            <button onClick={handleParse} className="add-scripture-parse-btn" disabled={submitting || !input.trim()}>
              Parse Scripture
            </button>
            <button 
              onClick={async () => {
                await handleSubmit();
                if (unparsedText) handleNextBatch();
              }} 
              className="add-scripture-submit-btn" 
              disabled={submitting || parsedVerses.length === 0}
            >
              {submitting
                ? "Submitting..."
                : unparsedText
                  ? "Submit and Parse Next Batch"
                  : "Submit Verses"}
            </button>
          </div>

          {parsedVerses.length > 0 && (
            <>
              <h2 className="add-scripture-preview-title">Preview & Edit Verses ({parsedVerses.length})</h2>
              <SortableContext items={parsedVerses.map((_, i) => i)} strategy={verticalListSortingStrategy}>
                <ul className="add-scripture-preview-list">
                  {parsedVerses.map((verse, index) => (
                    <SortableVerseItem
                      key={index}
                      id={index}
                      verse={verse}
                      index={index}
                      onChange={updateVerse}
                      onDelete={handleDelete}
                      userTags={userTags}
                    />
                  ))}
                </ul>
              </SortableContext>
              {unparsedText && (
                <div className="add-scripture-batch-controls">
                  <button onClick={handleNextBatch} className="add-scripture-next-batch-btn">
                    Parse Next Batch ({batchDone ? 'Done' : 'Next 10 Books'})
                  </button>
                  <span style={{ marginLeft: 12, color: '#e0c97f' }}>
                    {batchDone ? 'All scripture parsed.' : 'More scripture remains to be parsed.'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DndContext>
  );
}

// Helper function for drag and drop (ensure it's defined or imported)
// const handleDragEnd = (event: any, setParsedVerses: Function) => { ... };
