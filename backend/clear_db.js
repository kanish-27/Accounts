import { firestore } from './firebaseAdmin.js';
import { initDb } from './db.js';

async function clearCollection(collectionName) {
  console.log(`⏳ Fetching documents from collection: ${collectionName}...`);
  const snapshot = await firestore.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`✔ Collection ${collectionName} is already empty.`);
    return;
  }

  console.log(`🗑 Deleting ${snapshot.size} documents from ${collectionName}...`);
  const chunks = [];
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 500) {
    chunks.push(docs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = firestore.batch();
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  console.log(`✔ Successfully cleared collection: ${collectionName}`);
}

async function main() {
  console.log('⚠ STARTING DATABASE RESET...');
  const collections = ['attendance', 'kot_bills', 'advances', 'salary_payouts', 'suppliers', 'settings'];
  
  for (const coll of collections) {
    await clearCollection(coll);
  }

  console.log('🌱 Re-seeding default database settings and suppliers...');
  await initDb();
  console.log('🎉 Database reset completed successfully!');
}

main().catch(err => {
  console.error('❌ Database reset failed:', err);
  process.exit(1);
});
