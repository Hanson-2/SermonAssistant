// Enhanced User Translation Preferences System
// This shows how to modify the system to support any preferred translation

// 1. UPDATE FIRESTORE SCHEMA
// Add these fields to your userProfiles documents:
{
  "preferredTranslation": "EXB",  // User's preferred translation ID
  "authorizedTranslations": ["EXB", "NASB", "ESV"],  // Array of authorized translations
  "exbAuthorized": true  // Keep for backward compatibility
}

// 2. ENHANCED COMPONENT LOGIC
// Replace the current hardcoded logic with this flexible version:

const [preferredTranslation, setPreferredTranslation] = useState<string | null>(null);
const [authorizedTranslations, setAuthorizedTranslations] = useState<string[]>([]);

// Auth state listener with flexible preference checking
useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(async (user) => {
    setUserId(user ? user.uid : null);
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, "userProfiles", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Get preferred translation
          setPreferredTranslation(userData.preferredTranslation || null);
          
          // Get authorized translations (fallback to EXB for backward compatibility)
          const authorized = userData.authorizedTranslations || [];
          if (userData.exbAuthorized) {
            authorized.push("EXB");
          }
          setAuthorizedTranslations(authorized);
          
          console.log("Preferred translation:", userData.preferredTranslation);
          console.log("Authorized translations:", authorized);
        }
      } catch (error) {
        console.error("Error checking user preferences:", error);
      }
    } else {
      setPreferredTranslation(null);
      setAuthorizedTranslations([]);
    }
  });
  return () => unsubscribe();
}, []);

// Enhanced translation filtering and sorting
const processTranslations = (fetchedTranslations) => {
  // Filter out unauthorized translations
  const filteredTranslations = fetchedTranslations.filter(tr => {
    // If translation doesn't need authorization, include it
    const needsAuth = ["EXB", "NASB"].includes(tr.id.toUpperCase()); // Add restricted translations here
    if (!needsAuth) return true;
    
    // If it needs auth, check if user is authorized
    return authorizedTranslations.includes(tr.id.toUpperCase());
  });
  
  // Sort translations: preferred first, then alphabetical
  const sortedTranslations = [...filteredTranslations].sort((a, b) => {
    // Put preferred translation first
    if (preferredTranslation) {
      if (a.id.toUpperCase() === preferredTranslation.toUpperCase() && 
          b.id.toUpperCase() !== preferredTranslation.toUpperCase()) return -1;
      if (b.id.toUpperCase() === preferredTranslation.toUpperCase() && 
          a.id.toUpperCase() !== preferredTranslation.toUpperCase()) return 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });
  
  return sortedTranslations;
};

// Enhanced default translation selection
useEffect(() => {
  if (availableTranslations.length > 0) {
    let shouldUpdateSelection = selectedTranslations.length === 0;
    
    // Also update if preferred translation becomes available
    if (preferredTranslation && selectedTranslations.length > 0) {
      const hasPreferredSelected = selectedTranslations.some(id => 
        id.toUpperCase() === preferredTranslation.toUpperCase()
      );
      const preferredIsAvailable = availableTranslations.some(tr => 
        tr.id.toUpperCase() === preferredTranslation.toUpperCase()
      );
      if (!hasPreferredSelected && preferredIsAvailable) {
        shouldUpdateSelection = true;
      }
    }
    
    if (shouldUpdateSelection) {
      let defaultTranslationId = availableTranslations[0].id;
      
      // Use preferred translation if available
      if (preferredTranslation) {
        const preferredTr = availableTranslations.find(tr => 
          tr.id.toUpperCase() === preferredTranslation.toUpperCase()
        );
        if (preferredTr) {
          defaultTranslationId = preferredTr.id;
        }
      }
      
      setSelectedTranslations([defaultTranslationId]);
    }
  }
}, [availableTranslations, preferredTranslation, authorizedTranslations]);
