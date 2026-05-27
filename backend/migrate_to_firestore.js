import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { firestore } from './firebaseAdmin.js';

async function migrate() {
  console.log('🔄 Starting migration from SQLite to Firestore...');
  
  const sqliteDb = await open({
    filename: 'database.sqlite',
    driver: sqlite3.Database
  });

  // 1. Migrate settings
  console.log('⚙️ Migrating settings...');
  const settings = await sqliteDb.all('SELECT * FROM settings');
  for (const setting of settings) {
    await firestore.collection('settings').doc(setting.key).set({
      value: setting.value
    });
    console.log(`  ✔ Migrated setting: ${setting.key}`);
  }

  // 2. Migrate suppliers
  console.log('👥 Migrating suppliers...');
  const suppliers = await sqliteDb.all('SELECT * FROM suppliers');
  for (const sup of suppliers) {
    const docId = sup.id.toString();
    await firestore.collection('suppliers').doc(docId).set({
      name: sup.name,
      phone: sup.phone || '',
      joining_date: sup.joining_date || '',
      basic_daily_wage: parseFloat(sup.basic_daily_wage) || 0,
      status: sup.status || 'active'
    });
    console.log(`  ✔ Migrated supplier: ID ${docId} - ${sup.name}`);
  }

  // 3. Migrate attendance
  console.log('📅 Migrating attendance...');
  const attendance = await sqliteDb.all('SELECT * FROM attendance');
  for (const att of attendance) {
    const supplierId = att.supplier_id.toString();
    const docId = `${supplierId}_${att.date}`;
    await firestore.collection('attendance').doc(docId).set({
      supplier_id: supplierId,
      date: att.date,
      status: att.status,
      shift: att.shift || '11-11'
    });
  }
  console.log(`  ✔ Migrated ${attendance.length} attendance records.`);

  // 4. Migrate KOT bills
  console.log('🧾 Migrating KOT bills...');
  const kotBills = await sqliteDb.all('SELECT * FROM kot_bills');
  for (const bill of kotBills) {
    const docId = bill.id.toString();
    await firestore.collection('kot_bills').doc(docId).set({
      supplier_id: bill.supplier_id.toString(),
      bill_number: bill.bill_number,
      amount: parseFloat(bill.amount) || 0,
      date: bill.date,
      time: bill.time || '',
      remarks: bill.remarks || ''
    });
  }
  console.log(`  ✔ Migrated ${kotBills.length} KOT bills.`);

  // 5. Migrate salary payouts
  console.log('💳 Migrating salary payouts...');
  const payouts = await sqliteDb.all('SELECT * FROM salary_payouts');
  for (const payout of payouts) {
    const docId = payout.id.toString();
    await firestore.collection('salary_payouts').doc(docId).set({
      supplier_id: payout.supplier_id.toString(),
      start_date: payout.start_date,
      end_date: payout.end_date,
      attendance_days: parseFloat(payout.attendance_days) || 0,
      total_kot_amount: parseFloat(payout.total_kot_amount) || 0,
      commission_amount: parseFloat(payout.commission_amount) || 0,
      attendance_pay: parseFloat(payout.attendance_pay) || 0,
      total_salary: parseFloat(payout.total_salary) || 0,
      payment_date: payout.payment_date,
      status: payout.status || 'Paid',
      advance_deducted: parseFloat(payout.advance_deducted) || 0,
      net_salary: parseFloat(payout.net_salary) || 0
    });
  }
  console.log(`  ✔ Migrated ${payouts.length} salary payouts.`);

  // 6. Migrate advances
  console.log('💵 Migrating advances...');
  const advances = await sqliteDb.all('SELECT * FROM advances');
  for (const adv of advances) {
    const docId = adv.id.toString();
    await firestore.collection('advances').doc(docId).set({
      supplier_id: adv.supplier_id.toString(),
      amount: parseFloat(adv.amount) || 0,
      date: adv.date,
      remarks: adv.remarks || '',
      status: adv.status || 'pending',
      payout_id: adv.payout_id ? adv.payout_id.toString() : null
    });
  }
  console.log(`  ✔ Migrated ${advances.length} advances.`);

  await sqliteDb.close();
  console.log('🎉 Migration completed successfully!');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
