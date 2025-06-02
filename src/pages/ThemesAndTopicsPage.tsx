import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import './ThemesAndTopicsPage.css';
import { getDisplayBookAbbrev } from '../utils/getDisplayBookAbbrev';
import { getBookOrder } from '../utils/bookOrder';
import scriptureTags from '../../scripts/scripture_tags_fixed.json'; // Import the JSON file
import { ProcessedParablesData, isVerseInParable, type Parable, type BasicVerseInfo } from '../data/parablesData'; // Added BasicVerseInfo

export interface Verse { // Added export keyword
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string; // Added translation field
  tags?: string[];
}

const ThemesAndTopicsPage: React.FC = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadTags = () => {
      try {
        setLoading(true);
        // Get tags from the keys of the imported JSON object
        const allTags = Object.keys(scriptureTags);
        setTags(allTags.sort());
        setLoading(false);
      } catch (err) {
        console.error("Error loading tags from JSON:", err);
        setError('Failed to load themes and topics. Please try again later.');
        setLoading(false);
      }
    };

    loadTags();
  }, []);

  const handleTagClick = (tag: string) => {
    navigate(`/themes-and-topics/${encodeURIComponent(tag)}`);
  };

  const normalizeTag = (tag: string): string => {
    return tag
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="themes-topics-loading loading-text">
        Loading Themes & Topics
        <span className="animated-ellipsis">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    );
  }

  if (error) {
    return <div className="themes-topics-error">{error}</div>;
  }

  return (
    <div className="themes-topics-layout">
      <div className="themes-topics-background"></div>
      <h1 className="themes-topics-title">Themes & Topics</h1>
      {tags.length === 0 && !loading && (
        <p className="themes-topics-no-tags">No themes or topics found.</p>
      )}
      <div className="themes-topics-grid">
        {tags.map(tag => (
          <button
            key={tag}
            className={
              tag === 'olivet_discourse'
                ? 'theme-topic-button theme-topic-button-olivet'
                : 'theme-topic-button'
            }
            onClick={() => handleTagClick(tag)}
            title={normalizeTag(tag)}
          >
            <span className="theme-topic-button-text">{normalizeTag(tag)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface TaggedVersesPageProps {
  // No direct props, tag is read from URL params
}

const TaggedVersesPage: React.FC<TaggedVersesPageProps> = () => {
  const { tag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTranslations, setAvailableTranslations] = useState<string[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<string>('All');
  const [selectedParableId, setSelectedParableId] = useState<number | null>(null); // New state for selected parable
  const [parableVerseMap, setParableVerseMap] = useState<Map<number, Verse[]>>(new Map()); // Corrected type

  const normalizeTagForDisplay = (tagString: string): string => { // Renamed param to avoid conflict
    return tagString
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  const decodedTag = tag ? decodeURIComponent(tag) : '';
  const displayTag = decodedTag ? normalizeTagForDisplay(decodedTag) : '';
  const isParablesTag = decodedTag.toLowerCase() === 'parables' || decodedTag.toLowerCase() === 'parable';

  useEffect(() => {
    if (!decodedTag) return;

    const fetchVerses = async () => {
      try {
        setLoading(true);
        const versesCollection = collection(db, 'verses');
        let q;
        if (isParablesTag) {
          console.log('[ThemesAndTopicsPage] Fetching ALL verses for Parables view.');
          q = query(versesCollection); // Fetch all verses
        } else {
          console.log(`[ThemesAndTopicsPage] Fetching verses for specific tag: ${decodedTag}`);
          q = query(versesCollection, where('tags', 'array-contains', decodedTag));
        }
        const querySnapshot = await getDocs(q);
        const fetchedVerses: Verse[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data() as { book: string; chapter: number; verse: number; text: string; translation?: string; tags?: string[] }; // Type assertion for data
          fetchedVerses.push({ 
            id: doc.id, 
            book: data.book,
            chapter: data.chapter,
            verse: data.verse,
            text: data.text,
            translation: data.translation || 'Unknown',
            tags: data.tags 
          } as Verse);
        });

        fetchedVerses.sort((a, b) => {
          const bookAOrder = getBookOrder(a.book);
          const bookBOrder = getBookOrder(b.book);
          if (bookAOrder !== bookBOrder) {
            return bookAOrder - bookBOrder;
          }
          if (a.chapter !== b.chapter) {
            return a.chapter - b.chapter;
          }
          return a.verse - b.verse;
        });

        setVerses(fetchedVerses);

        if (isParablesTag) {
          const newMap = new Map<number, Verse[]>(); // Corrected type for newMap
          console.log('[Parable View] Building parable-to-verse map. Number of parables to process:', ProcessedParablesData.length, 'Total verses fetched:', fetchedVerses.length);
          for (const parable of ProcessedParablesData) {
            const versesForThisParableDef = fetchedVerses.filter(v => 
              isVerseInParable({ book: v.book, chapter: v.chapter, verse: v.verse } as BasicVerseInfo, parable)
            );
            newMap.set(parable.id, versesForThisParableDef); // This should now be correct
          }
          setParableVerseMap(newMap);
          console.log('[Parable View] Parable-to-verse map created. Map size:', newMap.size);
        } else {
          setParableVerseMap(new Map()); // Clear map if not in parables view
        }

        const translations = new Set<string>();
        fetchedVerses.forEach(v => {
          if (v.translation) {
            translations.add(v.translation);
          }
        });
        const sortedTranslations = Array.from(translations).sort();
        setAvailableTranslations(['All', ...sortedTranslations]);
        
        setLoading(false);
      } catch (err) {
        console.error(`Error fetching verses for tag "${decodedTag}":`, err);
        setError(`Failed to load verses for ${displayTag}.`);
        setLoading(false);
      }
    };

    fetchVerses();
  }, [decodedTag, displayTag]);

  const filteredVerses = React.useMemo(() => {
    if (selectedTranslation === 'All') {
      return verses;
    }
    return verses.filter(v => v.translation === selectedTranslation);
  }, [verses, selectedTranslation]);

  // Calculate versesByBook and sortedBooks for the non-parables view
  const { versesByBook, sortedBooks } = React.useMemo(() => {
    if (isParablesTag || filteredVerses.length === 0) {
      return { versesByBook: {}, sortedBooks: [] };
    }

    const vb: { [key: string]: Verse[] } = {};
    const bookOrderMap = new Map<string, number>();

    filteredVerses.forEach(verse => {
      const displayBook = verse.book; // Changed from getDisplayBookAbbrev(verse.book)
      if (!vb[displayBook]) {
        vb[displayBook] = [];
        if (!bookOrderMap.has(displayBook)) {
          bookOrderMap.set(displayBook, getBookOrder(verse.book));
        }
      }
      vb[displayBook].push(verse);
    });

    const sb = Object.keys(vb).sort((a, b) => {
      return (bookOrderMap.get(a) ?? 999) - (bookOrderMap.get(b) ?? 999);
    });

    return { versesByBook: vb, sortedBooks: sb };
  }, [isParablesTag, filteredVerses]); // getDisplayBookAbbrev and getBookOrder are stable imports

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          } else {
            entry.target.classList.remove('is-visible');
          }
        });
      },
      {
        rootMargin: '0px',
        threshold: 0.1
      }
    );

    const items = document.querySelectorAll('.scroll-fade-item');
    items.forEach(item => observer.observe(item));

    return () => {
      items.forEach(item => observer.unobserve(item));
      observer.disconnect();
    };
  }, [filteredVerses, decodedTag]); // Added decodedTag dependency

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          } else {
            entry.target.classList.remove('is-visible');
          }
        });
      },
      {
        rootMargin: '0px',
        threshold: 0.1
      }
    );

    const items = document.querySelectorAll('.scroll-fade-item');
    items.forEach(item => observer.observe(item));

    return () => {
      items.forEach(item => observer.unobserve(item));
      observer.disconnect();
    };
  }, [filteredVerses, decodedTag]); // Added decodedTag dependency

  // Reset selected parable when the tag changes or when verses are re-fetched/filtered
  useEffect(() => {
    setSelectedParableId(null);
  }, [decodedTag, filteredVerses]); // Reset if tag or main verse list changes

  const handleParableSelect = (parableId: number) => {
    setSelectedParableId(prevId => prevId === parableId ? null : parableId); // Toggle selection
  };

  if (loading) {
    return <div className="tagged-verses-loading loading-text">
      Loading {isParablesTag ? 'parables' : `verses for ${displayTag}`} {/* Used isParablesTag */}
      <span className="animated-ellipsis">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
      </div>;
  }

  if (error) {
    return <div className="tagged-verses-error">{error}</div>;
  }
  // Handle general case of no verses found after filtering, before specific rendering paths
  if (filteredVerses.length === 0 && !loading && !isParablesTag) { // Added !isParablesTag to let parables view handle its own empty state
    return (
      <div className="tagged-verses-layout">
        <div className="themes-topics-background"></div>
        <button onClick={() => navigate(-1)} className="back-to-themes-button">
          &larr; Back to All Themes & Topics
        </button>
        <h1 className="tagged-verses-title">
          {isParablesTag ? 'Parables' : displayTag} {/* Used isParablesTag */}
        </h1>
        {availableTranslations.length > 1 && (
          <div className="translation-selector-container">
            <label htmlFor="translation-select">Translation: </label>
            <select
              id="translation-select"
              value={selectedTranslation}
              onChange={(e) => setSelectedTranslation(e.target.value)}
              className="translation-select"
            >
              {availableTranslations.map(trans => (
                <option key={trans} value={trans}>
                  {trans}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="no-verses-found-text">
          No verses found for {displayTag}
          {selectedTranslation !== 'All' ? ` (Translation: ${selectedTranslation})` : ''}.
        </p>
      </div>
    );
  }
  return (
    <div className="tagged-verses-layout">
      <div className="themes-topics-background"></div>
      <button onClick={() => navigate(-1)} className="back-to-themes-button">
        &larr; Back to All Themes & Topics
      </button>
      <h1 className="tagged-verses-title">
        {isParablesTag ? 'Parables' : displayTag} {/* Used isParablesTag */}
      </h1>

      {availableTranslations.length > 1 && (
        <div className="translation-selector-container">
          <label htmlFor="translation-select">Translation: </label>
          <select
            id="translation-select"
            value={selectedTranslation}
            onChange={(e) => setSelectedTranslation(e.target.value)}
            className="translation-select"
          >
            {availableTranslations.map(trans => (
              <option key={trans} value={trans}>
                {trans}
              </option>
            ))}
          </select>
        </div>
      )}

      {isParablesTag ? (
        <div>
          {(() => {
            if (ProcessedParablesData.length === 0 && !loading) {
              return <p className="no-verses-found-text">No parables have been defined yet.</p>;
            }

            // If a parable is selected, show its details
            if (selectedParableId !== null) {
              const selectedParable = ProcessedParablesData.find(p => p.id === selectedParableId);
              console.log('[Parable View] Rendering selected parable. ID:', selectedParableId, 'Found Parable:', !!selectedParable);
              // console.log('[Parable View] filteredVerses length at this point:', filteredVerses.length); // filteredVerses is less relevant here now

              if (!selectedParable) {
                console.log('[Parable View] Selected parable object NOT found.');
                return <p className="no-verses-found-text">Selected parable not found.</p>;
              }
              
              // OLD LOGIC:
              // const versesForThisParable = filteredVerses.filter(v =>
              //  isVerseInParable({ book: v.book, chapter: v.chapter, verse: v.verse } as BasicVerseInfo, selectedParable)
              // );

              // NEW OPTIMIZED LOGIC:
              const versesFromMap = parableVerseMap.get(selectedParable.id) || [];
              const versesForThisParable = selectedTranslation === 'All'
                ? versesFromMap
                : versesFromMap.filter(v => v.translation === selectedTranslation);

              console.log('[Parable View] Verses for this parable (ID:', selectedParable.id, ') from map, then filtered by translation. Count:', versesForThisParable.length);
              // console.log('[Parable View] versesForThisParable length:', versesForThisParable.length, 'Contents:', versesForThisParable); // Potentially large log

              return (
                <div>
                  <button
                    onClick={() => setSelectedParableId(null)}
                    className="back-to-themes-button back-to-parables-list-button" /* Apply both classes */
                  >
                    &larr; Back to Parables List
                  </button>
                  <div key={selectedParable.id} className="parable-section">
                    <h2 className="parable-title">{selectedParable.title}</h2>
                    {versesForThisParable.length === 0 ? (
                      <p className="no-verses-found-text">
                        No verses found for {selectedParable.title}
                        {selectedTranslation !== 'All' ? ` (Translation: ${selectedTranslation})` : ''}.
                      </p>
                    ) : (
                      <div className="verses-list">
                        {versesForThisParable.map(verse => (
                          <div key={verse.id} className="verse-item scroll-fade-item">
                            <strong>{verse.book} {verse.chapter}:{verse.verse}</strong> ({verse.translation}) - {verse.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // If no parable is selected, show the list of parable buttons
            if (filteredVerses.length === 0 && ProcessedParablesData.length > 0 && !loading) {
              // This case might need refinement: if filteredVerses is empty due to translation for *all* parables
              return (
                 <p className="no-verses-found-text">
                   No verses found for Parables
                   {selectedTranslation !== 'All' ? ` (Translation: ${selectedTranslation})` : ''}.
                 </p>
              );
            }
            
            // Display Parable Buttons if none is selected
            return (
              <div className="themes-topics-grid"> {/* Reusing grid style for parable buttons */}
                {ProcessedParablesData.map(parable => (
                  <button
                    key={parable.id}
                    className="theme-topic-button" // Reusing theme button style
                    onClick={() => handleParableSelect(parable.id)}
                    title={parable.title}
                  >
                    <span className="theme-topic-button-text">{parable.title}</span>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        // Existing rendering logic for other tags
        <div>
          {/* The existing sortedBooks.length === 0 check is now handled by the global filteredVerses.length === 0 check above */}
          {sortedBooks.map(bookName => (
            <div key={bookName} className="book-section">
              <h2 className="book-title-subpage">{bookName}</h2>
              <div className="verses-list">
                {versesByBook[bookName]?.map(verse => (
                  <div key={verse.id} className="verse-item scroll-fade-item">
                    <strong>{verse.book} {verse.chapter}:{verse.verse}</strong> ({verse.translation}) - {verse.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { ThemesAndTopicsPage, TaggedVersesPage };
