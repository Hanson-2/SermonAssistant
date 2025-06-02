import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
try {
  if (admin.apps.length === 0) {
    // If running locally and GOOGLE_APPLICATION_CREDENTIALS is not set,
    // you might need to initialize with a service account key:
    // Make sure the path to your service account key is correct.
    // If your serviceAccountKey.json is in the same directory as the script:
    const serviceAccount = await import('./serviceAccountKey.json', { with: { type: "json" } });
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount.default) // Use .default if serviceAccountKey.json is a CJS module imported into ES module
    });
    console.log('Firebase Admin SDK initialized with service account.');
    // However, if GOOGLE_APPLICATION_CREDENTIALS is set, this is simpler:
    // admin.initializeApp(); // Commented out to prioritize service account key
    // console.log('Firebase Admin SDK initialized.'); // Already logged above
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

const db = admin.firestore();
const translationsCollectionRef = db.collection('translations');
const versesCollectionRef = db.collection('verses'); // Added

/**
 * Normalizes a translation string into an object containing id, name, and displayName.
 * @param {string} translationValue - The original translation string (e.g., "KJV", "Geneva Bible").
 * @returns {{id: string, name: string, displayName: string}}
 */
function normalizeTranslationData(translationValue) {
  let id, name, displayName;

  // ID: Generate a clean, lowercase, snake_case ID
  id = translationValue.toLowerCase()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, '') // Remove non-alphanumeric (excluding underscore)
    .replace(/_+/g, '_') // Consolidate multiple underscores
    .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores

  // If ID becomes empty after sanitization (e.g., from a value like "---"), create a fallback.
  if (!id) {
    // Create a simple hash-like fallback to avoid empty IDs
    let fallbackId = 'unknown';
    for (let i = 0; i < Math.min(translationValue.length, 10); i++) {
      fallbackId += translationValue.charCodeAt(i).toString(16);
    }
    id = fallbackId;
    console.warn(`Generated fallback ID "${id}" for translation value "${translationValue}"`);
  }

  // Name: lowercase version of the original value
  name = translationValue.toLowerCase();

  // DisplayName:
  // If all caps and relatively short (e.g., KJV, NET, GENEVA), keep as is.
  // Otherwise, capitalize each word.
  if (translationValue === translationValue.toUpperCase() && translationValue.length <= 6) {
    displayName = translationValue;
  } else {
    displayName = translationValue
      .split(/[\s_-]+/) // Split by space, underscore, or hyphen
      .map(word => {
        if (word.length === 0) return "";
        // Handle all-caps words within a multi-word string (e.g., "ASV Bible" -> "ASV Bible")
        if (word === word.toUpperCase()) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  return {
    id: id,
    name: name,
    displayName: displayName,
  };
}

/**
 * Populates the 'translations' collection based on unique 'translation' field values
 * from the 'verses' collection.
 */
async function populateTranslationsFromVerses() {
  try {
    console.log('Fetching all documents from "verses" collection to identify unique translations...');
    const versesSnapshot = await versesCollectionRef.get();

    if (versesSnapshot.empty) {
      console.log('No documents found in "verses" collection. Cannot populate translations.');
      return;
    }

    console.log(`Found ${versesSnapshot.docs.length} documents in "verses" collection.`);

    const uniqueTranslationValues = new Set();
    versesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data && data.translation && typeof data.translation === 'string') {
        const trimmedTranslation = data.translation.trim();
        if (trimmedTranslation !== '') {
          uniqueTranslationValues.add(trimmedTranslation);
        }
      }
    });

    if (uniqueTranslationValues.size === 0) {
      console.log('No unique, non-empty translation values found in "verses" documents.');
      return;
    }

    console.log(`Found ${uniqueTranslationValues.size} unique translation values:`, Array.from(uniqueTranslationValues));
    console.log('Processing and saving to "translations" collection...');

    for (const translationValue of uniqueTranslationValues) {
      const translationData = normalizeTranslationData(translationValue);
      const docId = translationData.id; // This will be the Firestore document ID

      if (!docId || docId.includes('/') || docId.length > 1500) {
        console.error(`Invalid document ID generated for translation value "${translationValue}": "${docId}". Skipping.`);
        continue;
      }

      try {
        // The document in Firestore will have fields 'name' and 'displayName'.
        // The 'id' field of the Translation interface will be mapped from doc.id by the cloud function.
        await translationsCollectionRef.doc(docId).set({
          name: translationData.name,
          displayName: translationData.displayName
        }, { merge: true });
        console.log(`Processed and saved/updated translation: Value="${translationValue}", DocID="${docId}", Name="${translationData.name}", DisplayName="${translationData.displayName}"`);
      } catch (error) {
        console.error(`Error saving translation for value "${translationValue}" (DocID: ${docId}) to Firestore:`, error);
      }
    }

    console.log('Successfully populated/updated "translations" collection from "verses" data.');
  } catch (error) {
    console.error('Error populating "translations" collection from "verses" data:', error);
  }
}

// Call the new function
populateTranslationsFromVerses().then(() => {
  console.log('Translation population script (from verses collection) finished.');
  // admin.app().delete(); // Optional: clean up Firebase app instance if script is standalone and not part of a larger process.
}).catch(error => {
  console.error('Unhandled error in script execution:', error);
});
