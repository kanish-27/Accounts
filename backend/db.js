import { firestore } from './firebaseAdmin.js';

export async function initDb() {
  console.log('Seeding default settings in Firestore if empty...');
  const settingsColl = firestore.collection('settings');
  
  const defaultSettings = [
    { id: 'admin_password', value: 'cosmo1111' },
    { id: 'kot_commission_limit', value: '250' },
    { id: 'admin_name', value: 'Club Manager' }
  ];

  for (const setting of defaultSettings) {
    const docRef = settingsColl.doc(setting.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({ value: setting.value });
      console.log(`Seeded default setting: ${setting.id}`);
    }
  }

  // Seed default suppliers if collection is empty
  const suppliersColl = firestore.collection('suppliers');
  const snapshot = await suppliersColl.limit(1).get();
  if (snapshot.empty) {
    console.log('Seeding initial suppliers into Firestore...');
    const suppliersList = [
      { name: 'Kumar S.', phone: '9876543210', joining_date: '2026-01-10', basic_daily_wage: 300, status: 'active' },
      { name: 'Ramesh K.', phone: '9865432107', joining_date: '2026-02-15', basic_daily_wage: 300, status: 'active' },
      { name: 'Vijay P.', phone: '9786543211', joining_date: '2026-03-01', basic_daily_wage: 350, status: 'active' },
      { name: 'Suresh A.', phone: '9654321098', joining_date: '2026-04-12', basic_daily_wage: 250, status: 'active' }
    ];

    let currentId = 1001;
    for (const sup of suppliersList) {
      await suppliersColl.doc(currentId.toString()).set(sup);
      currentId++;
    }
    console.log('Seeded initial suppliers successfully with 4-digit IDs.');
  }

  return firestore;
}

export function getDb() {
  return firestore;
}
