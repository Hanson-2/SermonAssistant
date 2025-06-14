import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import "./../styles/splashScreen.css?v=5";
import logo from "/logo.png";

export default function SplashScreen({ onFinish }) {
  const [exiting, setExiting] = useState(false);
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [animationPhase, setAnimationPhase] = useState('initial'); // 'initial', 'blurring', 'content', 'complete'// Fetch random content from Firestore with anti-repetition tracking
  useEffect(() => {
    const fetchRandomContent = async () => {
      try {
        // Randomly choose between verseOfTheDay or bibleFactOfTheDay (equal probability)
        const useVerse = Math.random() < 0.5;
        console.log('[SplashScreen] Loading content type:', useVerse ? 'verse' : 'bible fact');

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

            console.log('[SplashScreen] Selected verse:', verseData.reference);

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
          }        } else {
          // Get truly random fact from bibleFactOfTheDay collection
          console.log('[SplashScreen] Fetching from bibleFactOfTheDay collection...');
          const bibleFactRef = collection(db, "bibleFactOfTheDay");

          // Fetch a larger sample to ensure variety
          const sampleSize = 100; // Increased for even better variety
          const randomSample = await getDocs(query(bibleFactRef, orderBy("__name__"), limit(sampleSize)));        
          
          console.log('[SplashScreen] bibleFactOfTheDay query result:', randomSample.size, 'documents found');

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
            const factData = selectedDoc.data();            // Track this selection
            const updatedShownFacts = [selectedDoc.id, ...shownFacts.slice(0, 19)]; // Keep last 20
            localStorage.setItem('shownSplashFacts', JSON.stringify(updatedShownFacts));

            console.log('[SplashScreen] Selected bible fact:', factData);

            setContent({
              type: 'fact',
              fact: factData.fact || factData.text || factData.content,
              title: factData.title || 'Bible Fact'
            });          } else {
            console.log('[SplashScreen] No documents found in bibleFactOfTheDay collection');
            // Fallback to a default fact if collection is empty
            setContent({
              type: 'fact',
              fact: 'The Bible contains 66 books, written by approximately 40 different authors over a span of about 1,500 years.',
              title: 'Bible Fact'
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
    // Animation sequence once content is loaded
    if (!loading) {
      // Phase 1: Start blur transition after content loads (faster)
      const blurTimer = setTimeout(() => setAnimationPhase('blurring'), 200);
      
      // Phase 2: Show content after blur effect starts (reduced timing)
      const contentTimer = setTimeout(() => setAnimationPhase('content'), 800);
      
      // Phase 3: Mark animation complete
      const completeTimer = setTimeout(() => setAnimationPhase('complete'), 1400);
      
      // Phase 4: Start exit animation (extended duration for better experience)
      const exitTimer = setTimeout(() => setExiting(true), 7000);
      
      // Phase 5: Finish and cleanup (longer transition time)
      const finishTimer = setTimeout(() => onFinish(), 8500);

      return () => {
        clearTimeout(blurTimer);
        clearTimeout(contentTimer);
        clearTimeout(completeTimer);
        clearTimeout(exitTimer);
        clearTimeout(finishTimer);
      };
    }
  }, [loading, onFinish]);return (
    <div
      className={`splash-container${exiting ? " exit" : ""}`}
      style={{
        background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 25%, #0d0d0d 50%, #1a1a1a 75%, #000000 100%)',   
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',        zIndex: 9999,        backdropFilter: animationPhase === 'initial' ? 'blur(0px)' : 'blur(10px)',
        WebkitBackdropFilter: animationPhase === 'initial' ? 'blur(0px)' : 'blur(10px)',
        transition: 'backdrop-filter 0.8s ease-out, -webkit-backdrop-filter 0.8s ease-out, opacity 1.5s ease-out',
        opacity: exiting ? 0 : 1
      }}
    >
      <div className="splash-content">        <img
          src={logo}
          alt="Sermon Notes Assistant Logo"
          className={`splash-logo blurred${exiting ? " exit" : ""}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',            transform: `translate(-50%, -50%) ${exiting ? 'scale(1.1)' : 'scale(1)'}`,
            width: '400px',
            maxWidth: '85vw',
            height: 'auto',
            filter: animationPhase === 'initial' 
              ? 'blur(0px) drop-shadow(0 0 0px rgba(255, 215, 0, 0))' 
              : 'blur(1.5px) drop-shadow(0 0 25px rgba(255, 215, 0, 0.4))',
            opacity: exiting ? 0 : (animationPhase === 'initial' ? 1 : 0.7),
            zIndex: 1,
            transition: 'filter 0.8s ease-out, opacity 1.5s ease-out, transform 1.5s ease-out'
          }}
        />        {!loading && content && (
          <div 
            data-splash-overlay="true"            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',              transform: exiting 
                ? `translate(-50%, -50%) scale(0.95)` 
                : `translate(-50%, -50%) ${animationPhase === 'initial' ? 'scale(0.9)' : 'scale(1)'}`,
              zIndex: 10,
              maxWidth: '500px',
              width: '85%',
              padding: '20px 25px',
              textAlign: 'center',
              background: 'radial-gradient(circle, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.45) 100%)',
              border: '1px solid #ffd700',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              backdropFilter: animationPhase === 'initial' ? 'blur(0px)' : 'blur(8px)',
              WebkitBackdropFilter: animationPhase === 'initial' ? 'blur(0px)' : 'blur(8px)',
              opacity: exiting ? 0 : (animationPhase === 'content' || animationPhase === 'complete' ? 1 : 0),
              transition: 'opacity 1.5s ease-out, transform 1.5s ease-out, backdrop-filter 1s ease-out, -webkit-backdrop-filter 1s ease-out'
            }}
            ref={(el) => {
              if (el) {
                console.log('[SplashScreen] Content overlay element:', el);
                console.log('[SplashScreen] Animation phase:', animationPhase);
              }
            }}
          ><div 
              className="scripture-seeds-header"
              style={{
                fontFamily: 'Playfair Display, Georgia, Times New Roman, serif',
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#ffd700',
                marginBottom: '8px',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)',
                letterSpacing: '1px',
                textAlign: 'center'
              }}            >
              Scripture Seeds
            </div>
            
            {/* Subtle horizontal divider */}
            <div style={{
              width: '60%',
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.6) 50%, transparent 100%)',
              margin: '0 auto 20px auto',
              boxShadow: '0 1px 2px rgba(255, 215, 0, 0.3)'
            }}></div>{content.type === 'verse' && (
              <div style={{ color: '#ffffff', lineHeight: 1.5 }}>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: '#ffe082',
                  marginBottom: '12px',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)'
                }}>
                  {content.reference}
                </div>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1rem',
                  fontStyle: 'italic',
                  color: '#f5f5f5',
                  marginBottom: '12px',
                  lineHeight: 1.6,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)'
                }}>
                  "{content.text}"
                </div>
                <div style={{
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: '#d4af37',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)'
                }}>
                  — {content.translation}
                </div>
              </div>
            )}            {content.type === 'fact' && (
              <div style={{ color: '#ffffff', lineHeight: 1.5 }}>
                {content.title && (
                  <div style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#ffe082',
                    marginBottom: '12px',
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)'
                  }}>
                    {content.title}
                  </div>
                )}
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1rem',
                  color: '#f5f5f5',
                  lineHeight: 1.6,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)'
                }}>
                  {content.fact}
                </div>
              </div>
            )}            {content.type === 'fallback' && (
              <div style={{ color: '#ffffff' }}>
                <div style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.2rem',
                  color: '#ffe082',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)'
                }}>
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