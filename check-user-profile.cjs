const admin = require('firebase-admin');

// Initialize Firebase Admin (using default credentials from environment or ADC)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'sermon-notes-assistant'
  });
}

const db = admin.firestore();

async function checkUserProfile() {
  try {
    const userId = '89UdurybrVSwbPmp4boEMeYdVzk1'; // Your user ID from the logs
    console.log(`Checking user profile for ID: ${userId}`);
    
    const userDoc = await db.collection('userProfiles').doc(userId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('\n=== USER PROFILE DATA ===');
      console.log(JSON.stringify(userData, null, 2));
      
      console.log('\n=== KEY FIELDS ===');
      console.log('exbAuthorized:', userData.exbAuthorized);
      console.log('defaultBibleVersion:', userData.defaultBibleVersion);
      
      // Check if defaultBibleVersion field exists
      if (!userData.hasOwnProperty('defaultBibleVersion')) {
        console.log('\n❌ defaultBibleVersion field is missing from user profile!');
        console.log('Available fields:', Object.keys(userData));
      } else if (userData.defaultBibleVersion === null) {
        console.log('\n⚠️ defaultBibleVersion field exists but is null');
      } else if (userData.defaultBibleVersion === undefined) {
        console.log('\n⚠️ defaultBibleVersion field exists but is undefined');
      } else {
        console.log('\n✅ defaultBibleVersion field exists with value:', userData.defaultBibleVersion);
      }
    } else {
      console.log('❌ User profile not found');
    }
  } catch (error) {
    console.error('Error checking user profile:', error);
  }
}

checkUserProfile().then(() => {
  console.log('\nDone checking user profile.');
  process.exit(0);
}).catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
