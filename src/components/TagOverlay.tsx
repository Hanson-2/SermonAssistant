import React, { useState, useEffect } from 'react';
import { getVersesByTag } from '../services/firebaseService';
import { buildScriptureReference } from '../utils/scriptureReferenceUtils';
import './TagOverlay.css';

interface TagOverlayProps {
  tagName: string;
  isOpen: boolean;
  onClose: () => void;
  onVerseSelect: (verses: any[]) => void;
}

interface Verse {
  id?: string;
  book?: string;
  chapter?: string | number; // Allow both string and number to handle firebaseService data
  verse: string;
  text: string;
  translation: string;
}

type VersesByBook = {
  [book: string]: {
    [chapter: number]: Verse[];
  };
};

const TagOverlay: React.FC<TagOverlayProps> = ({ tagName, isOpen, onClose, onVerseSelect }) => {
  const [verses, setVerses] = useState<VersesByBook>({});
  const [loading, setLoading] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tagName) {
      loadVerses();
    }
  }, [isOpen, tagName]);
  const loadVerses = async () => {
    setLoading(true);
    setError(null);
    try {
      const verseData = await getVersesByTag(tagName);
      // Ensure the data structure matches our VersesByBook type
      const normalizedData: VersesByBook = {};
      
      Object.entries(verseData).forEach(([book, chapters]) => {
        normalizedData[book] = {};
        Object.entries(chapters as any).forEach(([chapterNum, chapterVerses]) => {
          const chapterNumber = parseInt(chapterNum);
          normalizedData[book][chapterNumber] = (chapterVerses as Verse[]).map(verse => ({
            ...verse,
            chapter: typeof verse.chapter === 'string' ? parseInt(verse.chapter) : verse.chapter
          }));
        });
      });
      
      setVerses(normalizedData);
    } catch (err) {
      console.error('Error loading verses for tag:', err);
      setError('Failed to load verses for this tag');
    } finally {
      setLoading(false);
    }
  };

  const normalizeTagForDisplay = (tag: string): string => {
    return tag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleVerseToggle = (verseKey: string) => {
    const newSelected = new Set(selectedVerses);
    if (newSelected.has(verseKey)) {
      newSelected.delete(verseKey);
    } else {
      newSelected.add(verseKey);
    }
    setSelectedVerses(newSelected);
  };
  const handleSelectAll = () => {
    const allVerseKeys = new Set<string>();
    Object.entries(verses).forEach(([book, bookChapters]) => {
      Object.entries(bookChapters).forEach(([chapterNum, chapterVerses]) => {
        chapterVerses.forEach(verse => {
          const verseBook = verse.book || book;
          const verseChapter = verse.chapter || parseInt(chapterNum);
          allVerseKeys.add(`${verseBook}-${verseChapter}-${verse.verse}`);
        });
      });
    });
    setSelectedVerses(allVerseKeys);
  };

  const handleClearSelection = () => {
    setSelectedVerses(new Set());
  };  const handleAddToExpository = () => {
    // Use the same key logic as in handleVerseToggle
    const selectedVerseObjects: any[] = [];
    Object.entries(verses).forEach(([book, chapters]) => {
      Object.entries(chapters).forEach(([chapterNum, chapterVerses]) => {
        chapterVerses.forEach(verse => {
          const verseBook = verse.book || book;
          const verseChapter = verse.chapter || parseInt(chapterNum);        const verseKey = verse.id ? verse.id : `${verseBook}-${verseChapter}-${verse.verse}-${verse.translation}`;
          if (selectedVerses.has(verseKey)) {
            selectedVerseObjects.push({
              book: verseBook,
              chapter: verseChapter,
              verse: verse.verse,
              endVerse: verse.verse,
              reference: buildScriptureReference({
                book: verseBook,
                chapter: verseChapter,
                verse: verse.verse,
                endVerse: verse.verse
              })
            });
          }
        });
      });
    });
    console.log('[TagOverlay] handleAddToExpository selectedVerseObjects:', selectedVerseObjects);
    if (selectedVerseObjects.length > 0) {
      onVerseSelect(selectedVerseObjects);
      setSelectedVerses(new Set());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tag-overlay-backdrop" onClick={onClose}>
      <div className="tag-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="tag-overlay-header">
          <h2 className="tag-overlay-title">
            Tag: {normalizeTagForDisplay(tagName)}
          </h2>
          <button className="tag-overlay-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tag-overlay-body">
          {loading && (
            <div className="tag-overlay-loading">
              Loading verses...
            </div>
          )}

          {error && (
            <div className="tag-overlay-error">
              {error}
            </div>
          )}

          {!loading && !error && Object.keys(verses).length === 0 && (
            <div className="tag-overlay-empty">
              No verses found for this tag.
            </div>
          )}

          {!loading && !error && Object.keys(verses).length > 0 && (
            <>
              <div className="tag-overlay-controls">
                <button className="tag-control-btn" onClick={handleSelectAll}>
                  Select All
                </button>
                <button className="tag-control-btn" onClick={handleClearSelection}>
                  Clear Selection
                </button>
                <span className="selected-count">
                  {selectedVerses.size} verse{selectedVerses.size !== 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="verses-container">
                {Object.entries(verses).map(([book, chapters]) => (
                  <div key={book} className="book-section">
                    <h3 className="book-title">{book}</h3>
                    {Object.entries(chapters).map(([chapterNum, chapterVerses]) => (
                      <div key={`${book}-${chapterNum}`} className="chapter-section">
                        <h4 className="chapter-title">Chapter {chapterNum}</h4>                        <div className="verses-grid">
                          {chapterVerses.map((verse) => {
                            const verseBook = verse.book || book;
                            const verseChapter = verse.chapter || parseInt(chapterNum);
                            // Use verse.id if available, otherwise include translation for uniqueness
                            const verseKey = verse.id ? verse.id : `${verseBook}-${verseChapter}-${verse.verse}-${verse.translation}`;
                            const isSelected = selectedVerses.has(verseKey);
                            return (
                              <div 
                                key={verseKey}
                                className={`verse-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleVerseToggle(verseKey)}
                              >
                                <div className="verse-reference">
                                  {verseBook} {verseChapter}:{verse.verse}
                                </div>
                                <div className="verse-text">
                                  {verse.text}
                                </div>
                                <div className="verse-translation">
                                  ({verse.translation})
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!loading && !error && selectedVerses.size > 0 && (
          <div className="tag-overlay-footer">
            <button className="add-verses-btn" onClick={handleAddToExpository}>
              Add {selectedVerses.size} Verse{selectedVerses.size !== 1 ? 's' : ''} to Expository
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TagOverlay;
