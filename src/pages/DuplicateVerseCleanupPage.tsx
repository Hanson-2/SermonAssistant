import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { collection, query, getDocs, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trash2, AlertTriangle, Search, RefreshCw, Download, CheckCircle, Filter } from 'lucide-react';
import { getBookOrder } from '../utils/bookOrder';
import './DuplicateVerseCleanupPage.scss';

interface Verse {
  id: string;
  book: string;
  book_lower: string;
  chapter: number;
  verse: number;
  translation: string;
  text: string;
  created_at?: any;
  updated_at?: any;
  tags?: string[];
  userId?: string;
}

interface DuplicateGroup {
  key: string;
  verses: Verse[];
  book: string;
  chapter: number;
  verse: number;
  translation: string;
}

export default function DuplicateVerseCleanupPage() {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<DuplicateGroup[]>([]);
  const [totalVerses, setTotalVerses] = useState(0);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ current: number; total: number; stage: string } | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<string>('All');
  const [availableTranslations, setAvailableTranslations] = useState<string[]>(['All']);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/login');
      }
    });
    return unsubscribe;
  }, [navigate]);
  const createDuplicateKey = (verse: Verse): string => {
    // Looser criteria: use book OR book_lower, chapter, verse, and translation (case-insensitive)
    const bookKey = verse.book_lower || verse.book.toLowerCase();
    const translationKey = verse.translation.toLowerCase();
    return `${bookKey}-${verse.chapter}-${verse.verse}-${translationKey}`;
  };  const findDuplicates = async () => {
    if (!user) {
      console.error('No user found - cannot analyze duplicates');
      return;
    }

    console.log('=== STARTING DUPLICATE ANALYSIS ===');
    console.log('Current user ID:', user.uid);
    
    setAnalyzing(true);
    setDuplicateGroups([]);
    setFilteredGroups([]);
    setTotalVerses(0);
    setTotalDuplicates(0);
    setAnalyzeProgress({ current: 0, total: 100, stage: 'Initializing...' });

    try {
      // Stage 1: Fetch all verses with detailed logging
      console.log('Stage 1: Fetching verses from database...');
      setAnalyzeProgress({ current: 5, total: 100, stage: 'Connecting to database...' });
      
      const versesRef = collection(db, 'verses');
      const q = query(versesRef, orderBy('book'), orderBy('chapter'), orderBy('verse'));
      
      console.log('Executing Firestore query...');
      setAnalyzeProgress({ current: 10, total: 100, stage: 'Fetching verses from database...' });
      
      const snapshot = await getDocs(q);
      console.log(`Firestore query returned ${snapshot.size} total documents`);
      
      setAnalyzeProgress({ current: 25, total: 100, stage: 'Processing verse data...' });
      
      const allVerses: Verse[] = [];
      const translations = new Set<string>();
      let processedCount = 0;
      let userVerseCount = 0;
      
      console.log('Processing documents...');
      snapshot.forEach((doc) => {
        processedCount++;
        const data = doc.data();
        
        // Log first few documents for debugging
        if (processedCount <= 5) {
          console.log(`Document ${processedCount}:`, {
            id: doc.id,
            userId: data.userId,
            book: data.book,
            chapter: data.chapter,
            verse: data.verse,
            translation: data.translation
          });
        }
          // Check if this verse belongs to the current user
        // If there's no userId field, include all verses (backwards compatibility)
        const belongsToUser = !data.userId || data.userId === user.uid;
        if (belongsToUser) {
          userVerseCount++;
          const verse: Verse = {
            id: doc.id,
            book: data.book || '',
            book_lower: data.book_lower || data.book?.toLowerCase() || '',
            chapter: Number(data.chapter) || 0,
            verse: Number(data.verse) || 0,
            translation: data.translation || '',
            text: data.text || '',
            created_at: data.created_at,
            updated_at: data.updated_at,
            tags: data.tags || [],
            userId: data.userId
          };
          allVerses.push(verse);
          translations.add(verse.translation);
          
          // Log first few user verses
          if (userVerseCount <= 5) {
            console.log(`User verse ${userVerseCount}:`, verse);
          }
        }
        
        // Update progress during processing
        if (processedCount % 1000 === 0) {
          const progress = 25 + Math.round((processedCount / snapshot.size) * 25);
          setAnalyzeProgress({ 
            current: progress, 
            total: 100, 
            stage: `Processing ${processedCount}/${snapshot.size} documents... Found ${userVerseCount} user verses` 
          });
          console.log(`Processed ${processedCount}/${snapshot.size} documents, found ${userVerseCount} user verses`);
        }
      });

      console.log(`=== PROCESSING COMPLETE ===`);
      console.log(`Total documents processed: ${processedCount}`);
      console.log(`User verses found: ${allVerses.length}`);
      console.log(`Translations found: ${Array.from(translations)}`);
      
      setTotalVerses(allVerses.length);
      setAvailableTranslations(['All', ...Array.from(translations).sort()]);

      if (allVerses.length === 0) {
        console.log('No verses found for user - ending analysis');
        setAnalyzeProgress({ current: 100, total: 100, stage: 'No verses found for current user' });
        setAnalyzing(false);
        setAnalyzeProgress(null);
        return;
      }

      // Stage 2: Group by duplicate criteria using chunked processing
      console.log('Stage 2: Analyzing for duplicates...');
      setAnalyzeProgress({ current: 50, total: 100, stage: 'Analyzing duplicates...' });
      
      const verseGroups = new Map<string, Verse[]>();
      const CHUNK_SIZE = 200; // Smaller chunks for more frequent updates
      let processedVerses = 0;
      
      const processChunk = (startIndex: number): Promise<void> => {
        return new Promise((resolve) => {
          const endIndex = Math.min(startIndex + CHUNK_SIZE, allVerses.length);
          
          for (let i = startIndex; i < endIndex; i++) {
            const verse = allVerses[i];
            const key = createDuplicateKey(verse);
            if (!verseGroups.has(key)) {
              verseGroups.set(key, []);
            }
            verseGroups.get(key)!.push(verse);
            processedVerses++;
          }
          
          // Update progress more frequently
          const progress = 50 + Math.round((processedVerses / allVerses.length) * 25);
          setAnalyzeProgress({ 
            current: progress, 
            total: 100, 
            stage: `Analyzing duplicates: ${processedVerses}/${allVerses.length} verses processed` 
          });
          
          console.log(`Duplicate analysis: ${processedVerses}/${allVerses.length} verses processed`);
          
          // Use requestAnimationFrame for smoother updates
          requestAnimationFrame(() => setTimeout(resolve, 1));
        });
      };
      
      // Process all verses in chunks
      for (let i = 0; i < allVerses.length; i += CHUNK_SIZE) {
        await processChunk(i);
      }      // Stage 3: Filter and sort duplicates with chunked processing
      console.log('Stage 3: Organizing duplicate groups...');
      setAnalyzeProgress({ current: 75, total: 100, stage: 'Organizing duplicate groups...' });
      
      const duplicates: DuplicateGroup[] = [];
      let duplicateCount = 0;
      let groupsProcessed = 0;

      console.log(`Found ${verseGroups.size} unique verse groups`);
      
      // Convert Map to array for easier chunked processing
      const groupEntries = Array.from(verseGroups.entries());
      const GROUP_CHUNK_SIZE = 100; // Process groups in smaller chunks
      
      const processGroupChunk = async (startIndex: number): Promise<void> => {
        return new Promise((resolve) => {
          const endIndex = Math.min(startIndex + GROUP_CHUNK_SIZE, groupEntries.length);
          
          for (let i = startIndex; i < endIndex; i++) {
            const [key, verses] = groupEntries[i];
            groupsProcessed++;
            
            if (verses.length > 1) {
              // Sort verses within group by creation date (oldest first)
              const sortedVerses = verses.sort((a, b) => {
                if (a.created_at && b.created_at) {
                  return a.created_at.seconds - b.created_at.seconds;
                }
                return 0;
              });

              duplicates.push({
                key,
                verses: sortedVerses,
                book: sortedVerses[0].book,
                chapter: sortedVerses[0].chapter,
                verse: sortedVerses[0].verse,
                translation: sortedVerses[0].translation
              });
              duplicateCount += verses.length - 1; // Count extra duplicates
              
              // Log first few duplicate groups
              if (duplicates.length <= 5) {
                console.log(`Duplicate group ${duplicates.length}:`, {
                  key,
                  count: verses.length,
                  book: sortedVerses[0].book,
                  chapter: sortedVerses[0].chapter,
                  verse: sortedVerses[0].verse,
                  translation: sortedVerses[0].translation
                });
              }
            }
          }
            // Update progress after each chunk (but not too frequently for large datasets)
          const shouldUpdateProgress = endIndex === groupEntries.length || 
                                     (groupsProcessed % Math.max(GROUP_CHUNK_SIZE, 200) === 0);
          
          if (shouldUpdateProgress) {
            const progress = 75 + Math.round((groupsProcessed / groupEntries.length) * 10);
            setAnalyzeProgress({ 
              current: progress, 
              total: 100, 
              stage: `Found ${duplicates.length} duplicate groups (${groupsProcessed}/${groupEntries.length} processed)` 
            });
            
            console.log(`Group processing: ${groupsProcessed}/${groupEntries.length} groups processed, ${duplicates.length} duplicates found`);
          }
          
          // Use requestAnimationFrame for smoother updates
          requestAnimationFrame(() => setTimeout(resolve, 1));
        });
      };
      
      // Process all group entries in chunks
      for (let i = 0; i < groupEntries.length; i += GROUP_CHUNK_SIZE) {
        await processGroupChunk(i);
      }      // Stage 4: Sort duplicate groups with chunked processing
      console.log('Stage 4: Sorting in biblical order...');
      setAnalyzeProgress({ current: 85, total: 100, stage: 'Sorting in biblical order...' });
      
      // Use setTimeout with longer delay to ensure UI stays responsive
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(`Starting sort of ${duplicates.length} duplicate groups...`);
          
          duplicates.sort((a, b) => {
            // First sort by book order (biblical chronological order)
            const bookOrderA = getBookOrder(a.book);
            const bookOrderB = getBookOrder(b.book);
            
            if (bookOrderA !== bookOrderB) {
              return bookOrderA - bookOrderB;
            }
            
            // Then by chapter
            if (a.chapter !== b.chapter) {
              return a.chapter - b.chapter;
            }
            
            // Finally by verse
            return a.verse - b.verse;
          });
          
          console.log('Sorting complete');
          resolve();
        }, 20); // Slightly longer delay to ensure UI responsiveness
      });

      console.log(`=== ANALYSIS COMPLETE ===`);
      console.log(`Total verses analyzed: ${allVerses.length}`);
      console.log(`Duplicate groups found: ${duplicates.length}`);
      console.log(`Total duplicate verses: ${duplicateCount}`);
      
      setDuplicateGroups(duplicates);
      setFilteredGroups(duplicates); // Initially show all
      setTotalDuplicates(duplicateCount);
      
      setAnalyzeProgress({ current: 100, total: 100, stage: `Analysis complete! Found ${duplicates.length} duplicate groups` });

    } catch (error) {
      console.error('Error during duplicate analysis:', error);
      setAnalyzeProgress({ current: 0, total: 100, stage: 'Analysis failed - check console for details' });
      alert(`Error analyzing duplicates: ${error}`);
    } finally {
      setTimeout(() => {
        setAnalyzing(false);
        setAnalyzeProgress(null);
      }, 3000); // Show completion longer for debugging
    }
  };  // Filter groups by translation with optimization for large datasets
  useEffect(() => {
    console.log(`Filtering ${duplicateGroups.length} groups by translation: ${selectedTranslation}`);
    
    if (selectedTranslation === 'All') {
      setFilteredGroups(duplicateGroups);
      console.log(`Showing all ${duplicateGroups.length} groups`);
    } else {
      // Use setTimeout for large datasets to avoid blocking UI
      if (duplicateGroups.length > 1000) {
        setTimeout(() => {
          const filtered = duplicateGroups.filter(group => 
            group.verses.some(verse => verse.translation === selectedTranslation)
          );
          setFilteredGroups(filtered);
          console.log(`Filtered to ${filtered.length} groups for translation: ${selectedTranslation}`);
        }, 10);
      } else {
        const filtered = duplicateGroups.filter(group => 
          group.verses.some(verse => verse.translation === selectedTranslation)
        );
        setFilteredGroups(filtered);
        console.log(`Filtered to ${filtered.length} groups for translation: ${selectedTranslation}`);
      }
    }
  }, [duplicateGroups, selectedTranslation]);

  const toggleGroupSelection = (key: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedGroups(newSelected);
  };

  const selectAll = () => {
    setSelectedGroups(new Set(filteredGroups.map(group => group.key)));
  };

  const selectNone = () => {
    setSelectedGroups(new Set());
  };
  const deleteSelectedDuplicates = async () => {
    if (selectedGroups.size === 0) return;

    const confirmMessage = `This will delete duplicates from ${selectedGroups.size} groups. This action cannot be undone. Are you sure?`;
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    
    try {
      const versesToDelete: string[] = [];
      
      // For each selected group, keep the first verse (usually oldest) and delete the rest
      filteredGroups.forEach((group) => {
        if (selectedGroups.has(group.key)) {
          // Keep the first verse, delete the rest
          for (let i = 1; i < group.verses.length; i++) {
            versesToDelete.push(group.verses[i].id);
          }
        }
      });

      console.log(`Deleting ${versesToDelete.length} duplicate verses...`);
      setDeleteProgress({ current: 0, total: versesToDelete.length });

      // Delete verses in batches
      const batchSize = 10;
      for (let i = 0; i < versesToDelete.length; i += batchSize) {
        const batch = versesToDelete.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (verseId) => {
            await deleteDoc(doc(db, 'verses', verseId));
            setDeleteProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
          })
        );
        
        // Small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      alert(`Successfully deleted ${versesToDelete.length} duplicate verses!`);
      
      // Refresh the analysis
      setSelectedGroups(new Set());
      await findDuplicates();

    } catch (error) {
      console.error('Error deleting duplicates:', error);
      alert('Error deleting duplicates. Please try again.');
    } finally {
      setLoading(false);
      setDeleteProgress(null);
    }
  };

  const deleteSpecificVerse = async (verseId: string, groupKey: string) => {
    if (!window.confirm('Are you sure you want to delete this specific verse? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'verses', verseId));
      
      // Update the local state
      setDuplicateGroups(prevGroups => 
        prevGroups.map(group => {
          if (group.key === groupKey) {
            const updatedVerses = group.verses.filter(v => v.id !== verseId);
            // If only one verse remains, remove the group entirely
            if (updatedVerses.length <= 1) {
              return null;
            }
            return { ...group, verses: updatedVerses };
          }
          return group;
        }).filter(Boolean) as DuplicateGroup[]
      );

      // Update totals
      setTotalDuplicates(prev => prev - 1);
      
    } catch (error) {
      console.error('Error deleting verse:', error);
      alert('Error deleting verse. Please try again.');
    }
  };

  const exportDuplicateReport = () => {
    const report = duplicateGroups.map(group => ({
      reference: `${group.book} ${group.chapter}:${group.verse} (${group.translation})`,
      duplicateCount: group.verses.length,
      verses: group.verses.map(v => ({
        id: v.id,
        text: v.text,
        created_at: v.created_at?.toDate?.()?.toISOString() || 'unknown',
        tags: v.tags?.join(', ') || 'none'
      }))
    }));

    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `duplicate-verses-report-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  // Diagnostic function to check Firestore data structure
  const diagnosticCheck = async () => {
    if (!user) return;
    
    console.log('=== FIRESTORE DIAGNOSTIC CHECK ===');
    const versesRef = collection(db, 'verses');
    const q = query(versesRef, limit(10)); // Just get first 10 documents
    
    try {
      const snapshot = await getDocs(q);
      console.log(`Found ${snapshot.size} sample documents:`);
      
      let index = 0;
      snapshot.forEach((doc) => {
        index++;
        const data = doc.data();
        console.log(`Document ${index}:`, {
          id: doc.id,
          hasUserId: 'userId' in data,
          userId: data.userId,
          userIdType: typeof data.userId,
          currentUserId: user.uid,
          userIdMatch: data.userId === user.uid,
          keys: Object.keys(data),
          sampleData: {
            book: data.book,
            chapter: data.chapter,
            verse: data.verse,
            translation: data.translation
          }
        });
      });
    } catch (error) {
      console.error('Diagnostic check failed:', error);
    }
  };

  if (!user) {
    return <div className="duplicate-cleanup-page">Loading...</div>;
  }

  return (
    <div className="duplicate-cleanup-page">
      <div className="page-header">
        <h1>
          <AlertTriangle className="icon" />
          Duplicate Verse Cleanup
        </h1>
        <p>Find and remove duplicate scripture verses from your collection</p>
      </div>      {analyzeProgress && (
        <div className="progress-section">
          <div className="progress-header">
            <h3>Analyzing Verses</h3>
            <span className="progress-percentage">{analyzeProgress.current}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill analyze-progress" 
              style={{ width: `${analyzeProgress.current}%` }}
            />
          </div>
          <div className="progress-text">
            {analyzeProgress.stage}
          </div>
        </div>
      )}

      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-label">Total Verses</div>
          <div className="stat-value">{totalVerses.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {selectedTranslation === 'All' ? 'All Duplicate Groups' : `${selectedTranslation} Groups`}
          </div>
          <div className="stat-value">
            {selectedTranslation === 'All' ? duplicateGroups.length : filteredGroups.length}
            {selectedTranslation !== 'All' && duplicateGroups.length > 0 && (
              <span className="stat-total"> / {duplicateGroups.length}</span>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {selectedTranslation === 'All' ? 'Total Extra Duplicates' : `${selectedTranslation} Duplicates`}
          </div>
          <div className="stat-value">
            {selectedTranslation === 'All' 
              ? totalDuplicates 
              : filteredGroups.reduce((sum, group) => sum + (group.verses.length - 1), 0)
            }
            {selectedTranslation !== 'All' && totalDuplicates > 0 && (
              <span className="stat-total"> / {totalDuplicates}</span>
            )}
          </div>
        </div>
      </div>      <div className="action-bar">
        <button
          onClick={findDuplicates}
          disabled={analyzing}
          className="btn btn-primary"
        >
          {analyzing ? (
            <>
              <RefreshCw className="icon spinning" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="icon" />
              Find Duplicates
            </>
          )}
        </button>

        <button
          onClick={diagnosticCheck}
          disabled={analyzing}
          className="btn btn-secondary"
          title="Check Firestore data structure (check console)"
        >
          🔍 Debug Data
        </button>

        {duplicateGroups.length > 0 && (
          <>
            <div className="filter-section">
              <label htmlFor="translation-filter" className="filter-label">
                <Filter className="icon" />
                Filter by Translation:
              </label>
              <select
                id="translation-filter"
                value={selectedTranslation}
                onChange={(e) => setSelectedTranslation(e.target.value)}
                className="translation-filter"
              >
                {availableTranslations.map(translation => (
                  <option key={translation} value={translation}>
                    {translation} {translation !== 'All' && duplicateGroups.length > 0 && (
                      `(${duplicateGroups.filter(group => 
                        group.verses.some(verse => verse.translation === translation)
                      ).length})`
                    )}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={exportDuplicateReport} className="btn btn-secondary">
              <Download className="icon" />
              Export Report
            </button>
            
            <div className="selection-controls">
              <button onClick={selectAll} className="btn btn-outline">
                Select All ({filteredGroups.length})
              </button>
              <button onClick={selectNone} className="btn btn-outline">
                Clear Selection
              </button>
            </div>

            <button
              onClick={deleteSelectedDuplicates}
              disabled={selectedGroups.size === 0 || loading}
              className="btn btn-danger"
            >
              {loading ? (
                <>
                  <RefreshCw className="icon spinning" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="icon" />
                  Delete Selected ({selectedGroups.size})
                </>
              )}
            </button>
          </>
        )}
      </div>

      {deleteProgress && (
        <div className="progress-section">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
            />
          </div>
          <div className="progress-text">
            Deleting {deleteProgress.current} of {deleteProgress.total} verses...
          </div>
        </div>
      )}      {filteredGroups.length > 0 && (
        <div className="duplicates-section">
          <h2>
            {selectedTranslation === 'All' 
              ? `Duplicate Groups (${filteredGroups.length})` 
              : `${selectedTranslation} Duplicate Groups (${filteredGroups.length} of ${duplicateGroups.length})`
            }
          </h2>
          <p className="help-text">
            For each group, the first verse (usually oldest) will be kept and the rest will be deleted.
            You can also delete specific verses manually.
          </p>

          <div className="duplicate-groups">
            {filteredGroups.map((group) => (
              <div 
                key={group.key} 
                className={`duplicate-group ${selectedGroups.has(group.key) ? 'selected' : ''}`}
              >
                <div className="group-header">
                  <label className="group-selector">
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(group.key)}
                      onChange={() => toggleGroupSelection(group.key)}
                    />
                    <strong>{group.book} {group.chapter}:{group.verse}</strong>
                    <span className="translation">({group.translation})</span>
                    <span className="count">{group.verses.length} duplicates</span>
                  </label>
                </div>

                <div className="verses-list">
                  {group.verses.map((verse, index) => (
                    <div key={verse.id} className={`verse-item ${index === 0 ? 'keep' : 'duplicate'}`}>
                      <div className="verse-header">
                        <div className="verse-label">
                          {index === 0 ? (
                            <>
                              <CheckCircle className="icon keep-icon" />
                              Will Keep (Oldest)
                            </>
                          ) : (
                            <>
                              <Trash2 className="icon delete-icon" />
                              Will Delete
                            </>
                          )}
                        </div>
                        <div className="verse-meta">
                          ID: {verse.id}
                          {verse.created_at && (
                            <span className="date">
                              • {verse.created_at.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => deleteSpecificVerse(verse.id, group.key)}
                          className="btn btn-small btn-danger"
                          title="Delete this specific verse"
                        >
                          <Trash2 className="icon" />
                        </button>
                      </div>
                      
                      <div className="verse-text">
                        {verse.text}
                      </div>
                      
                      {verse.tags && verse.tags.length > 0 && (
                        <div className="verse-tags">
                          Tags: {verse.tags.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}      {!analyzing && filteredGroups.length === 0 && duplicateGroups.length === 0 && totalVerses > 0 && (
        <div className="no-duplicates">
          <CheckCircle className="icon" />
          <h3>No Duplicates Found!</h3>
          <p>Your verse collection is clean - no duplicate entries were found.</p>
        </div>
      )}

      {!analyzing && filteredGroups.length === 0 && duplicateGroups.length > 0 && selectedTranslation !== 'All' && (
        <div className="no-duplicates filtered">
          <Filter className="icon" />
          <h3>No Duplicates in {selectedTranslation}</h3>
          <p>
            No duplicate verses found for the selected translation "{selectedTranslation}".
            There are {duplicateGroups.length} duplicate groups in other translations.
          </p>
        </div>
      )}
    </div>
  );
}
