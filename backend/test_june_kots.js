import { firestore } from './firebaseAdmin.js';

async function checkJuneKots() {
  const today = '2026-07-04'; // Simulated today
  
  // Calculate Last Month's prefix
  const prevMonthDate = new Date(today + 'T12:00:00');
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthYear = prevMonthDate.getFullYear();
  const prevMonthVal = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const prevMonthPrefix = `${prevMonthYear}-${prevMonthVal}`;
  
  console.log(`Today: ${today}`);
  console.log(`Generated Previous Month Prefix: "${prevMonthPrefix}"`);

  const kotsSnapshot = await firestore.collection('kot_bills').get();
  const allKots = kotsSnapshot.docs.map(doc => doc.data());
  
  console.log(`Total KOT bills in database: ${allKots.length}`);
  
  const sampleKots = allKots.slice(0, 5);
  console.log('Sample KOT dates in DB:', sampleKots.map(k => k.date));

  const matchingKots = allKots.filter(k => k.date && k.date.startsWith(prevMonthPrefix));
  const sum = matchingKots.reduce((sum, k) => sum + (k.amount || 0), 0);

  console.log(`Number of KOTs matching "${prevMonthPrefix}": ${matchingKots.length}`);
  console.log(`Sum of KOTs matching "${prevMonthPrefix}": ${sum}`);
}

checkJuneKots().catch(console.error);
