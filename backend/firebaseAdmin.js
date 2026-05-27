import admin from 'firebase-admin';

let app;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n').trim();
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
  }
}

if (projectId && clientEmail && privateKey) {
  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    console.log('🔥 Firebase Admin SDK initialized successfully via Environment Variables.');
  } catch (error) {
    console.error('❌ Error: Failed to initialize Firebase Admin with environment credentials:', error.message);
    process.exit(1);
  }
} else {
  console.warn('⚠️ Warning: Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in environment.');
  console.warn('Attempting to initialize Firebase Admin with default application credentials...');
  try {
    app = admin.initializeApp();
    console.log('🔥 Firebase Admin SDK initialized with application default credentials.');
  } catch (error) {
    console.error('❌ Error: Firebase Admin SDK failed to initialize.');
    console.error('Please configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your backend/.env file.');
    process.exit(1);
  }
}

export const firestore = admin.firestore(app);
firestore.settings({ ignoreUndefinedProperties: true });
