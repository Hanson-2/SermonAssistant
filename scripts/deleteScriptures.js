import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

if (typeof process === 'undefined' || typeof process.env === 'undefined') {
  console.error('process or process.env is not defined!');
  throw new Error('process.env is not available. Make sure to run this script with Node.js.');
}

// Construct service account from environment variables
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteAllExcept(docToKeepId) {
  const collectionRef = db.collection('scriptures');
  const snapshot = await collectionRef.get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    if (doc.id !== docToKeepId) {
      batch.delete(doc.ref);
    }
  });

  await batch.commit();
  console.log('Deletion completed.');
}

// Replace 'Genesis' with your doc ID to keep
deleteAllExcept('Genesis');
