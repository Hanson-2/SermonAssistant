const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: "sermon-notes-assistant",
  private_key_id: "39c13132624a08ba14ea6f5f0dd681f26c48ee97",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCwKsbL7ASpmN1W\nd5CAiPL0c7KZcwAN4wpvzGBSeo/Dl6cid14EiChTiASgBWYBeUgo5v0xT7HToofe\nXDn2vfDpCbT/il6NFLVfKAhDWVARwdXVBfdGzLFKfgnrWOvgD30u7zAPITC7pqDA\nhvB9TvtIWkgo5qCrOyvAtNbZeNj4xDCZNTn5tpV1lMgpX9Y4sCP02AcCF8NOk50j\n6KvyjkdcFAs+nxoIbJllne+A5u4fw7wdhN5I/qtqiFlpf8XKT09QWLkNfH4D3Qnk\nPNPxdI91b8ucDT4oL6dWT7rhvELeSpVr87ypw5771cbjmUjGkGcdqEzscvYlgaM0\nqMLnFUTrAgMBAAECggEAK1zEJSK5vRMy/BsfFvxerRwjbJD5hPGLOpyYYwTnCTJ1\ngc7W9g+buX/j/42En70+LU86KF6g+2Joxit2Ww1C1OG+Sx5AisJ7qGn+qrE7u7s2\nCqLWzHcK9raSc3smSDcXzaszba3yRGZN8EXmwTllMdiDJYorJyq/6MW6kroj0gtz\nBNcbk/Zc9KxplkBPC5jcOcG+Yxj2jwNXWrRgpimDq25CrJR37RKMh21smTCm5N7e\nh1++UIgH8bWwU/dsBty5CR9dCCsuZbbiMPCgAlRGeJCQDm3nVHywmx6W6zHVJ4tF\n00IKzDTXLgOdJeR+wdnn0+u1bkPe3Z2HQzCLsK4BwQKBgQD0Ya9cPvUIQZZeY5wg\nX26bdsOH0ShbsajmXzNxJlo7j6RDXAj68iON9BRcZyNALeGS0kwiz19t7mgc46fY\nEUEpZJTfUZHbt3cMePUNd3KyHqtonrieeQlwFUqxpPQMHCgtyf+dO6ayr7yz17en\nMGLDh7OTlsyMrL61AQcZ1w6vQQKBgQC4it4ufRiEpBEaeDxAO5np4+A8bi2geVjH\nirNyWTW1Bk5fqgp2D0Fo6mijDDlBe+GNSsXfkOm/ikWDcQTEp+VzxYdmn6Q6Qlk3\nZr6dirCLTcCv6NXsx8E2ZGHE8jcEhGktX/xj0vQ4Kf9c9Xacw8TbeSToBfTKLFXU\nQGC3UV2VKwKBgADo7DI3ucnSFLE9RbOJJ2xEwO2chb3xp2NUL2jYb7WRD1eA3Dey\n9xbsNbcyWxs+EHzvc4EdrIlIPfL9lf5j8g4pZbR/JT/gKv1M5fyq2S54lsLI9H8C\njFpyedi3eIEjCbNB8UWwlypLJTS2NOTWdUetFaoTAaf0bLFX06Lw/gkBAoGAMt2U\nABxa9bSDQliBwvKqqd01oXJ9AQ5xeg6xB4OvWgYy9AtadtAdp111Gfv0jCgpM1i4\n0baPt0vVfTVZqxrcE90ORSsbiTNgg/S99Y6UutDjm5kB3hHxH5zrle1tXMFifC9I\n0fsDdbedu3GtD+imChiKI6oAnvk5bxePkPfMY6ECgYBpr6RI+YeqWVLDZqhOjUZw\nHZCqsBZC7lPyuwRdHRFv+3rz0LPfYp3Unfl6urTTFAu9Ov5bF3bRDxw2VLeMtKQ9\nTnu9PiQqcFTtt/0Dd975PXWkXyEoq27ur3dRQ4fHDprYECDbECNq+i/a7dPKs7hL\nzuiHg41NPU7UY67crEDK6Q==\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@sermon-notes-assistant.iam.gserviceaccount.com",
  client_id: "111602120623602939751",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40sermon-notes-assistant.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "sermon-notes-assistant"
});

const db = admin.firestore();

async function addExbAuthorization() {
  const userId = "89UdurybrVSwbPmp4boEMeYdVzk1";
  
  try {
    console.log("Adding EXB authorization to user profile...");
    
    // Update the userProfiles document
    await db.collection('userProfiles').doc(userId).update({
      exbAuthorized: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("✅ EXB authorization added successfully!");
    console.log("User ID:", userId);
    console.log("Collection: userProfiles");
    console.log("Field added: exbAuthorized = true");
    
    // Verify the update
    const userDoc = await db.collection('userProfiles').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log("Verification - EXB Authorized:", userData.exbAuthorized);
    }
    
  } catch (error) {
    console.error("❌ Error adding EXB authorization:", error.message);
  }
  
  process.exit(0);
}

addExbAuthorization();
