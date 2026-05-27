import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.join(__dirname, 'serviceAccountKey.json');

let app;
if (fs.existsSync(keyPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('🔥 Firebase Admin SDK initialized with serviceAccountKey.json');
} else {
  console.warn('⚠️ Warning: Firebase serviceAccountKey.json NOT found at backend/serviceAccountKey.json.');
  console.warn('Attempting to initialize Firebase Admin with default application credentials...');
  try {
    app = admin.initializeApp();
    console.log('🔥 Firebase Admin SDK initialized with application default credentials.');
  } catch (error) {
    console.error('❌ Error: Firebase Admin SDK failed to initialize.');
    console.error('Please generate a service account private key in Firebase Console (Project Settings > Service Accounts),');
    console.error(`save it as "serviceAccountKey.json", and place it in the "backend" directory: ${keyPath}`);
    process.exit(1);
  }
}

export const firestore = admin.firestore(app);
// Enable auto-timestamp settings for Firestore
firestore.settings({ ignoreUndefinedProperties: true });
