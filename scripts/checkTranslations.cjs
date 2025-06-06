const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
try {
  if (admin.apps.length === 0) {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: process.env.GOOGLE_AUTH_URI,
      token_uri: process.env.GOOGLE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

const db = admin.firestore();

async function checkAndPopulateTranslations() {
  try {
    console.log('Checking translations collection...');
    
    const translationsSnapshot = await db.collection('translations').get();
    console.log(`Found ${translationsSnapshot.size} documents in translations collection`);
    
    if (translationsSnapshot.size > 0) {
      console.log('\nExisting translations:');
      translationsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, Name: ${data.name}, Display: ${data.displayName}`);
      });
      return;
    }

    console.log('No translations found. Fetching unique translations from verses...');
    
    // Get unique translations from verses collection
    const versesSnapshot = await db.collection('verses').get();
    const uniqueTranslations = new Set();
    
    versesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.translation) {
        uniqueTranslations.add(data.translation);
      }
    });
    
    console.log(`Found ${uniqueTranslations.size} unique translations:`, Array.from(uniqueTranslations));
    
    // Populate translations collection
    const batch = db.batch();
    let count = 0;
    
    for (const translation of uniqueTranslations) {
      const normalizedId = translation.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
      
      const docRef = db.collection('translations').doc(normalizedId);
      batch.set(docRef, {
        id: normalizedId,
        name: translation,
        displayName: translation,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      count++;
      console.log(`Prepared translation: ${translation} -> ${normalizedId}`);
    }
    
    if (count > 0) {
      await batch.commit();
      console.log(`Successfully populated ${count} translations in the translations collection!`);
    } else {
      console.log('No translations to populate.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAndPopulateTranslations();
