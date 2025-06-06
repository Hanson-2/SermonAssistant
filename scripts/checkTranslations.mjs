import admin from 'firebase-admin';
import dotenv from 'dotenv';

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

async function checkTranslationsCollection() {
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
    } else {
      console.log('No translations found. Checking verses collection for unique translations...');
      
      const versesQuery = await db.collection('verses')
        .limit(100)
        .get();
        
      const uniqueTranslations = new Set();
      versesQuery.forEach(doc => {
        const data = doc.data();
        if (data.translation) {
          uniqueTranslations.add(data.translation);
        }
      });
      
      console.log(`Found ${uniqueTranslations.size} unique translations in verses:`, Array.from(uniqueTranslations));
    }
    
  } catch (error) {
    console.error('Error checking translations:', error);
  }
}

checkTranslationsCollection();
