import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import "./../styles/splashScreen.css?v=2";
import logo from "/logo.png";

export default function SplashScreen({ onFinish }) {
  const [exiting, setExiting] = useState(false);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);  // Fetch random content from Firestore with anti-repetition tracking
  useEffect(() => {
    const fetchRandomContent = async () => {
      try {
        // Randomly choose between verseOfTheDay or bibleFactOfTheDay
        const useVerse = Math.random() < 0.5;
        
        if (useVerse) {
          // Get truly random verse from verseOfTheDay collection
          const verseOfTheDayRef = collection(db, "verseOfTheDay");
          
          // Fetch a larger sample to ensure variety
          const sampleSize = 100; // Increased for even better variety
          const randomSample = await getDocs(query(verseOfTheDayRef, orderBy("__name__"), limit(sampleSize)));
          
          if (!randomSample.empty) {
            // Get recently shown verses from localStorage to avoid immediate repeats
            const shownVerses = JSON.parse(localStorage.getItem('shownSplashVerses') || '[]');
            
            // Filter out recently shown verses (keep track of last 20)
            const availableDocs = randomSample.docs.filter(doc => 
              !shownVerses.includes(doc.id)
            );
            
            // If all have been shown recently, reset the tracking
            const docsToChooseFrom = availableDocs.length > 0 ? availableDocs : randomSample.docs;
            
            // Randomly select from available documents
            const randomIndex = Math.floor(Math.random() * docsToChooseFrom.length);
            const selectedDoc = docsToChooseFrom[randomIndex];
            const verseData = selectedDoc.data();
            
            // Track this selection
            const updatedShownVerses = [selectedDoc.id, ...shownVerses.slice(0, 19)]; // Keep last 20
            localStorage.setItem('shownSplashVerses', JSON.stringify(updatedShownVerses));
            
            if (verseData.reference) {
              // Enhanced parsing to handle verse ranges (e.g., "Genesis 1:1-3")
              const referenceMatch = verseData.reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
              if (referenceMatch) {
                const [, book, chapter, startVerse, endVerse] = referenceMatch;
                const startVerseNum = parseInt(startVerse);
                const endVerseNum = endVerse ? parseInt(endVerse) : startVerseNum;
                
                // Find all matching verses in the range from the verses collection
                const versesRef = collection(db, "verses");
                const versesQuery = query(
                  versesRef,
                  where("book", "==", book.trim()),
                  where("chapter", "==", parseInt(chapter)),
                  where("verse", ">=", startVerseNum),
                  where("verse", "<=", endVerseNum)
                );
                
                const versesSnapshot = await getDocs(versesQuery);
                
                if (!versesSnapshot.empty) {
                  // Group verses by translation
                  const versesByTranslation = {};
                  versesSnapshot.docs.forEach(doc => {
                    const verseData = doc.data();
                    const translation = verseData.translation;
                    if (!versesByTranslation[translation]) {
                      versesByTranslation[translation] = [];
                    }
                    versesByTranslation[translation].push(verseData);
                  });
                    // Randomly select one translation that has all verses in the range
                  const completeTranslations = Object.entries(versesByTranslation).filter(
                    ([, verses]) => verses.length === (endVerseNum - startVerseNum + 1)
                  );
                  
                  if (completeTranslations.length > 0) {
                    const [selectedTranslation, verses] = completeTranslations[
                      Math.floor(Math.random() * completeTranslations.length)
                    ];
                    
                    // Sort verses by verse number
                    const sortedVerses = verses.sort((a, b) => a.verse - b.verse);
                    
                    // Combine text if multiple verses
                    const combinedText = sortedVerses.map(v => v.text).join(" ");
                    const displayReference = endVerse ? 
                      `${book.trim()} ${chapter}:${startVerse}-${endVerse}` : 
                      `${book.trim()} ${chapter}:${startVerse}`;
                    
                    setContent({
                      type: 'verse',
                      book: book.trim(),
                      chapter: parseInt(chapter),
                      verse: endVerse ? `${startVerse}-${endVerse}` : startVerse,
                      translation: selectedTranslation,
                      text: combinedText,
                      reference: displayReference,
                      isRange: !!endVerse
                    });
                  }
                }
              }
            }
          }
        } else {
          // Get truly random fact from bibleFactOfTheDay collection
          const bibleFactRef = collection(db, "bibleFactOfTheDay");
          
          // Fetch a larger sample to ensure variety
          const sampleSize = 100; // Increased for even better variety
          const randomSample = await getDocs(query(bibleFactRef, orderBy("__name__"), limit(sampleSize)));
          
          if (!randomSample.empty) {
            // Get recently shown facts from localStorage to avoid immediate repeats
            const shownFacts = JSON.parse(localStorage.getItem('shownSplashFacts') || '[]');
            
            // Filter out recently shown facts (keep track of last 20)
            const availableDocs = randomSample.docs.filter(doc => 
              !shownFacts.includes(doc.id)
            );
            
            // If all have been shown recently, reset the tracking
            const docsToChooseFrom = availableDocs.length > 0 ? availableDocs : randomSample.docs;
            
            // Randomly select from available documents
            const randomIndex = Math.floor(Math.random() * docsToChooseFrom.length);
            const selectedDoc = docsToChooseFrom[randomIndex];
            const factData = selectedDoc.data();
            
            // Track this selection
            const updatedShownFacts = [selectedDoc.id, ...shownFacts.slice(0, 19)]; // Keep last 20
            localStorage.setItem('shownSplashFacts', JSON.stringify(updatedShownFacts));
            
            setContent({
              type: 'fact',
              fact: factData.fact || factData.text,
              title: factData.title
            });
          }
        }
      } catch (error) {
        console.error("Error fetching splash content:", error);
        // Set fallback content
        setContent({
          type: 'fallback',
          text: "Preparing your sermon notes experience..."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRandomContent();
  }, []);  useEffect(() => {
    // Only start the exit timer once content is loaded (not loading anymore)
    if (!loading) {
      const exitTimer = setTimeout(() => setExiting(true), 6000); // Increased from 3500 to 6000 for longer display
      const finishTimer = setTimeout(() => onFinish(), 6800);     // Increased from 4000 to 6800 for smoother exit

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(finishTimer);
      };
    }
  }, [loading, onFinish]); // Depend on loading state
  return (
    <div 
      className={`splash-container${exiting ? " exit" : ""}`}
      style={{
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 25%, #0d0d0d 50%, #1a1a1a 75%, #000000 100%)',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999
      }}
    >
      <div className="splash-content">
        <img
          src={logo}
          alt="Sermon Notes Assistant Logo"
          className={`splash-logo blurred${exiting ? " exit" : ""}`}
        />        {!loading && content && (
          <div 
            className={`content-overlay force-black-bg${exiting ? " exit" : ""}`}
            style={{
              background: '#000000 !important',
              backgroundColor: '#000000 !important',
              backgroundImage: 'none !important',
              border: '6px solid #ffd700',
              outline: '2px solid #b8860b'
            }}
          >
            <div className="scripture-seeds-header">Scripture Seeds</div>
            
            {content.type === 'verse' && (
              <div className="verse-content">
                <div className="verse-reference">
                  {content.reference}
                </div>
                <div className="verse-text">
                  "{content.text}"
                </div>
                <div className="verse-translation">
                  — {content.translation}
                </div>
              </div>
            )}
            
            {content.type === 'fact' && (
              <div className="fact-content">
                {content.title && (
                  <div className="fact-title">{content.title}</div>
                )}
                <div className="fact-text">
                  {content.fact}
                </div>
              </div>
            )}
            
            {content.type === 'fallback' && (
              <div className="fallback-content">
                <div className="fallback-text">
                  {content.text}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
