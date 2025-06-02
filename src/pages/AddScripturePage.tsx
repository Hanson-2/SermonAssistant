import React, { useState } from "react";
import { saveScriptureVerses } from "../services/firebaseService";
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

  // User tags state
  const [userTags, setUserTags] = useState<UserTag[]>([]);
  const [isLoadingUserTags, setIsLoadingUserTags] = useState(false);
  const [userTagLoadError, setUserTagLoadError] = useState<string | null>(null);
  const [userTagFilter, setUserTagFilter] = useState('');
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState<number>(-1);
  const userTagFilterInputRef = React.useRef<HTMLInputElement>(null);
  const functions = getFunctions();

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

  const handleParse = () => {
    try {
      const lines = input.split(/\r?\n/).filter((line) => line.trim() !== "");
      const verses: ParsedVerse[] = [];

      let currentBook = "";
      let currentChapter = 0;

      const firstLineMatch = lines[0].match(/^([1-3]?\s?[A-Za-z ]+)\s+(\d+)$/);
      if (firstLineMatch) {
        currentBook = firstLineMatch[1].trim();
        currentChapter = parseInt(firstLineMatch[2], 10);
        lines.shift();
      } else {
        setError("Start with a line like 'Acts 2'");
        return;
      }

      let buffer = "";
      for (let line of lines) {
        buffer += " " + line;
      }
      buffer = buffer.trim();

      // Parse using custom tokenizer
      const matches: { verseNum: number; text: string }[] = [];
      let bracketDepth = 0;
      let token = "";
      let currentVerseNum: number | null = null;

      const flushToken = () => {
        if (currentVerseNum !== null && token.trim()) {
          matches.push({ verseNum: currentVerseNum, text: token.trim() });
          token = "";
          currentVerseNum = null;
        }
      };

      let i = 0;
      while (i < buffer.length) {
        const char = buffer[i];
        const next4 = buffer.slice(i, i + 4);

        if (char === "[" || char === "(") bracketDepth++;
        if (char === "]" || char === ")") bracketDepth--;

        // Detect possible verse start: must be outside brackets and not like 2:14
        const verseStartMatch = buffer.slice(i).match(/^(\d{1,3})\s+/);
        const isSafeStart = bracketDepth === 0 && !/^\d+:\d/.test(buffer.slice(i));

        if (verseStartMatch && isSafeStart) {
          flushToken();
          currentVerseNum = parseInt(verseStartMatch[1], 10);
          i += verseStartMatch[0].length;
          continue;
        }

        token += char;
        i++;
      }

      flushToken(); // Push final

      if (matches.length === 0) {
        setError("No valid verse format found.");
        return;
      }

      const output: ParsedVerse[] = matches.map(({ verseNum, text }) => {
        const suggestedTags = suggestTagsFromText(text);
        return {
          book: currentBook,
          book_lower: currentBook.toLowerCase(),
          chapter: currentChapter,
          linkedSermonID: "",
          reference: `${currentBook} ${currentChapter}:${verseNum}`,
          tags: suggestedTags,
          text,
          translation,
          verse: verseNum,
        };
      });

      setParsedVerses(output);
      setError("");
    } catch (err: any) {
      setError(err.message || "Parsing failed.");
    }
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

          <div className="translation-selection-group">
            <label htmlFor="translation-select" className="add-scripture-translation-label">
              Translation:
            </label>
            <select 
              id="translation-select" 
              value={translation} 
              onChange={(e) => setTranslation(e.target.value)} 
              className="add-scripture-translation-dropdown"
            >
              {TRANSLATION_GROUPS.map((group) => (
                <optgroup label={group.label} key={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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
            <button onClick={handleSubmit} className="add-scripture-submit-btn" disabled={submitting || parsedVerses.length === 0}>
              {submitting ? "Submitting..." : "Submit Verses"}
            </button>
          </div>

          {parsedVerses.length > 0 && (
            <>
              <h2 className="add-scripture-preview-title">Preview & Edit Verses ({parsedVerses.length})</h2>
              <SortableContext items={parsedVerses.map((_, i) => i)} strategy={verticalListSortingStrategy}>
                <ul className="add-scripture-preview-list">
                  {parsedVerses.map((verse, index) => (
                    <SortableVerseItem
                      key={index} // Using index as key for sortable items, ensure it's stable if items don't have unique IDs yet
                      id={index} // ID for dnd-kit
                      verse={verse}
                      index={index}
                      onChange={updateVerse} // Corrected: Was handleVerseChange
                      onDelete={handleDelete}  // Corrected: Was handleDeleteVerse
                      userTags={userTags}
                    />
                  ))}
                </ul>
              </SortableContext>
            </>
          )}
        </div>
      </div>
    </DndContext>
  );
}

// Helper function for drag and drop (ensure it's defined or imported)
// const handleDragEnd = (event: any, setParsedVerses: Function) => { ... };
