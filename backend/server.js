import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';

const app = express();
// Dev server port
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize database before starting server
let db;
try {
  db = await initDb();
  console.log('Firebase Firestore Database initialized successfully.');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Helper to wrap async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== SUPPLIER ROUTES ====================

// Get all suppliers
app.get('/api/suppliers', asyncHandler(async (req, res) => {
  const { status, type } = req.query;
  let query = db.collection('suppliers');
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  const snapshot = await query.get();
  let suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  if (type) {
    if (type === 'supplier') {
      suppliers = suppliers.filter(s => s.type === 'supplier' || !s.type);
    } else if (type === 'monthly') {
      suppliers = suppliers.filter(s => s.type === 'monthly');
    }
  }
  res.json(suppliers);
}));

// Add new supplier
app.post('/api/suppliers', asyncHandler(async (req, res) => {
  const { name, phone, joining_date, basic_daily_wage, status, type, monthly_salary } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const supplierData = {
    name: name.trim(),
    phone: phone || '',
    joining_date: joining_date || new Date().toISOString().split('T')[0],
    basic_daily_wage: parseFloat(basic_daily_wage) || 0,
    status: status || 'active',
    type: type || 'supplier',
    monthly_salary: parseFloat(monthly_salary) || 0
  };

  let nextId;
  await db.runTransaction(async (transaction) => {
    const suppliersColl = db.collection('suppliers');
    const snapshot = await transaction.get(suppliersColl);
    let maxId = 1000;
    
    snapshot.docs.forEach(doc => {
      const numericId = parseInt(doc.id, 10);
      if (!isNaN(numericId) && numericId > maxId) {
        maxId = numericId;
      }
    });
    
    nextId = (maxId + 1).toString();
    const newDocRef = suppliersColl.doc(nextId);
    transaction.set(newDocRef, supplierData);
  });

  res.status(201).json({ id: nextId, ...supplierData });
}));

// Update supplier
app.put('/api/suppliers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, joining_date, basic_daily_wage, status, type, monthly_salary } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const docRef = db.collection('suppliers').doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  await docRef.update({
    name: name.trim(),
    phone: phone || '',
    joining_date: joining_date || '',
    basic_daily_wage: parseFloat(basic_daily_wage) || 0,
    status: status || 'active',
    type: type || 'supplier',
    monthly_salary: parseFloat(monthly_salary) || 0
  });

  const updatedDoc = await docRef.get();
  res.json({ id: updatedDoc.id, ...updatedDoc.data() });
}));

// Delete supplier
app.delete('/api/suppliers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = db.collection('suppliers').doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  await docRef.delete();

  // Cascade delete all documents associated with this supplier ID
  const batch = db.batch();
  
  const attSnapshot = await db.collection('attendance').where('supplier_id', '==', id).get();
  attSnapshot.docs.forEach(d => batch.delete(d.ref));
  
  const kotSnapshot = await db.collection('kot_bills').where('supplier_id', '==', id).get();
  kotSnapshot.docs.forEach(d => batch.delete(d.ref));
  
  const advSnapshot = await db.collection('advances').where('supplier_id', '==', id).get();
  advSnapshot.docs.forEach(d => batch.delete(d.ref));
  
  const paySnapshot = await db.collection('salary_payouts').where('supplier_id', '==', id).get();
  paySnapshot.docs.forEach(d => batch.delete(d.ref));
  
  await batch.commit();

  res.json({ message: 'Supplier and all associated logs deleted successfully' });
}));


// ==================== ATTENDANCE ROUTES ====================

// Get attendance for a date (YYYY-MM-DD)
app.get('/api/attendance', asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD)' });
  }

  const activeSuppliersSnapshot = await db.collection('suppliers').where('status', '==', 'active').get();
  const suppliers = activeSuppliersSnapshot.docs.map(doc => ({ 
    id: doc.id, 
    name: doc.data().name,
    type: doc.data().type || 'supplier'
  }));

  const logsSnapshot = await db.collection('attendance').where('date', '==', date).get();
  const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const result = suppliers.map(supplier => {
    const log = logs.find(l => l.supplier_id?.toString() === supplier.id.toString());
    return {
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      type: supplier.type,
      date,
      status: log ? log.status : 'Absent',
      shift: log ? log.shift : '11-11'
    };
  });

  res.json(result);
}));

// Save or Update attendance for a date
app.post('/api/attendance', asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  if (!date || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Date and records array are required' });
  }

  const batch = db.batch();
  for (const record of records) {
    const { supplier_id, status, shift } = record;
    const docId = `${supplier_id}_${date}`;
    const docRef = db.collection('attendance').doc(docId);
    batch.set(docRef, {
      supplier_id,
      date,
      status,
      shift: shift || '11-11'
    }, { merge: true });
  }
  
  await batch.commit();
  res.json({ message: 'Attendance records saved successfully' });
}));

// Get attendance summary for date range
app.get('/api/attendance/summary', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date query parameters are required' });
  }

  const suppliersSnapshot = await db.collection('suppliers').get();
  const suppliers = suppliersSnapshot.docs.map(doc => ({ 
    id: doc.id, 
    name: doc.data().name,
    type: doc.data().type || 'supplier'
  }));
  
  const extStartDate = getMonday(start_date);
  const extEndDate = getSunday(end_date);

  const logsSnapshot = await db.collection('attendance')
    .where('date', '>=', extStartDate)
    .where('date', '<=', extEndDate)
    .get();
  
  const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  logs.sort((a, b) => b.date.localeCompare(a.date));

  const summary = suppliers.map(supplier => {
    const isMonthly = supplier.type === 'monthly';
    const supplierLogs = logs.filter(l => l.supplier_id?.toString() === supplier.id.toString())
      .map(l => ({ ...l, supplier_name: supplier.name }));
    
    if (isMonthly) {
      const details = calculateWorkerAttendanceDetails(supplierLogs, start_date, end_date);
      const targetLogs = supplierLogs
        .filter(l => l.date >= start_date && l.date <= end_date)
        .map(l => {
          if (l.status === 'Weekly Off') {
            const status = details.weekoffStatusMap[l.date] || 'Paid';
            return { ...l, status: `Weekly Off (${status})` };
          }
          return l;
        });

      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        type: supplier.type,
        present_count: details.presentCount,
        half_count: details.halfDayCount,
        absent_count: details.absentCount + details.unpaidWeekoffCount,
        paid_weekoff_count: details.paidWeekoffCount,
        unpaid_weekoff_count: details.unpaidWeekoffCount,
        total_paid_days: details.presentCount + (details.halfDayCount * 0.5) + details.paidWeekoffCount,
        logs: targetLogs
      };
    } else {
      const targetLogs = supplierLogs.filter(l => l.date >= start_date && l.date <= end_date);
      let present = 0;
      let half = 0;
      let absent = 0;
      
      targetLogs.forEach(l => {
        if (l.status === 'Present') present++;
        else if (l.status === 'Half Day') half++;
        else absent++;
      });

      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        type: supplier.type,
        present_count: present,
        half_count: half,
        absent_count: absent,
        total_paid_days: present + (half * 0.5),
        logs: targetLogs
      };
    }
  });

  res.json(summary);
}));


// ==================== KOT BILL ROUTES ====================

// Get KOT bills with filters
app.get('/api/kot', asyncHandler(async (req, res) => {
  const { supplier_id, start_date, end_date } = req.query;

  const suppliersSnapshot = await db.collection('suppliers').get();
  const suppliers = {};
  suppliersSnapshot.docs.forEach(doc => {
    suppliers[doc.id] = doc.data().name;
  });

  let snapshot = await db.collection('kot_bills').get();
  let bills = snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(), 
    supplier_name: suppliers[doc.data().supplier_id?.toString()] || 'Unknown'
  }));

  if (supplier_id) {
    bills = bills.filter(b => b.supplier_id?.toString() === supplier_id.toString());
  }
  if (start_date) {
    bills = bills.filter(b => b.date >= start_date);
  }
  if (end_date) {
    bills = bills.filter(b => b.date <= end_date);
  }

  bills.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return (b.time || '').localeCompare(a.time || '');
  });

  res.json(bills);
}));

// Add KOT bill
app.post('/api/kot', asyncHandler(async (req, res) => {
  const { supplier_id, bill_number, amount, date, time, remarks } = req.body;
  
  if (!supplier_id || !bill_number || amount === undefined) {
    return res.status(400).json({ error: 'Supplier ID, Bill Number, and Amount are required' });
  }

  const supplierIdStr = supplier_id.toString();

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount < 0) {
    return res.status(400).json({ error: 'Amount must be a valid positive number' });
  }

  const currentDate = date || new Date().toISOString().split('T')[0];
  
  let currentTime = time;
  if (!currentTime) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    currentTime = `${hours}:${minutes}`;
  }

  const docRef = await db.collection('kot_bills').add({
    supplier_id: supplierIdStr,
    bill_number,
    amount: numericAmount,
    date: currentDate,
    time: currentTime,
    remarks: remarks || ''
  });

  const supplierDoc = await db.collection('suppliers').doc(supplierIdStr).get();
  const supplierName = supplierDoc.exists ? supplierDoc.data().name : 'Unknown';

  const newBill = await docRef.get();
  res.status(201).json({ id: newBill.id, ...newBill.data(), supplier_name: supplierName });
}));

// Bulk Add KOT bills
app.post('/api/kot/bulk', asyncHandler(async (req, res) => {
  const { bills } = req.body;
  
  if (!bills || !Array.isArray(bills)) {
    return res.status(400).json({ error: 'Bills array is required' });
  }

  const batch = db.batch();
  const suppliersSnapshot = await db.collection('suppliers').get();
  const suppliers = {};
  suppliersSnapshot.docs.forEach(doc => {
    suppliers[doc.id] = doc.data().name;
  });

  const addedBills = [];

  for (const bill of bills) {
    const { supplier_id, bill_number, amount, date, time, remarks } = bill;
    
    if (!supplier_id || !bill_number || amount === undefined) {
      continue;
    }

    const supplierIdStr = supplier_id.toString();
    const numericAmount = parseFloat(amount);
    const currentDate = date || new Date().toISOString().split('T')[0];
    
    let currentTime = time;
    if (!currentTime) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      currentTime = `${hours}:${minutes}`;
    }

    const docRef = db.collection('kot_bills').doc();
    const data = {
      supplier_id: supplierIdStr,
      bill_number,
      amount: numericAmount,
      date: currentDate,
      time: currentTime,
      remarks: remarks || ''
    };
    batch.set(docRef, data);
    addedBills.push({ id: docRef.id, ...data, supplier_name: suppliers[supplierIdStr] || 'Unknown' });
  }

  await batch.commit();
  res.status(201).json(addedBills);
}));

// Delete KOT bill
app.delete('/api/kot/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = db.collection('kot_bills').doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'KOT Bill not found' });
  }
  await docRef.delete();
  res.json({ message: 'KOT Bill deleted successfully' });
}));


// ==================== ADVANCES ROUTES ====================

// Get advances filterable by supplier_id and status
app.get('/api/advances', asyncHandler(async (req, res) => {
  const { supplier_id, status } = req.query;

  const suppliersSnapshot = await db.collection('suppliers').get();
  const suppliers = {};
  suppliersSnapshot.docs.forEach(doc => {
    suppliers[doc.id] = doc.data().name;
  });

  let snapshot = await db.collection('advances').get();
  let advances = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    supplier_name: suppliers[doc.data().supplier_id?.toString()] || 'Unknown'
  }));

  if (supplier_id) {
    advances = advances.filter(a => a.supplier_id?.toString() === supplier_id.toString());
  }
  if (status) {
    advances = advances.filter(a => a.status === status);
  }

  advances.sort((a, b) => b.date.localeCompare(a.date));
  res.json(advances);
}));

// Log new cash advance
app.post('/api/advances', asyncHandler(async (req, res) => {
  const { supplier_id, amount, date, remarks } = req.body;
  
  if (!supplier_id || amount === undefined) {
    return res.status(400).json({ error: 'Supplier ID and Amount are required' });
  }

  const supplierIdStr = supplier_id.toString();

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a valid positive number' });
  }

  const advanceDate = date || new Date().toISOString().split('T')[0];

  const docRef = await db.collection('advances').add({
    supplier_id: supplierIdStr,
    amount: numericAmount,
    date: advanceDate,
    remarks: remarks || '',
    status: 'pending',
    payout_id: null
  });

  const supplierDoc = await db.collection('suppliers').doc(supplierIdStr).get();
  const supplierName = supplierDoc.exists ? supplierDoc.data().name : 'Unknown';

  const newAdvance = await docRef.get();
  res.status(201).json({ id: newAdvance.id, ...newAdvance.data(), supplier_name: supplierName });
}));

// Delete a pending cash advance
app.delete('/api/advances/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = db.collection('advances').doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    return res.status(404).json({ error: 'Advance record not found' });
  }
  if (doc.data().status !== 'pending') {
    return res.status(400).json({ error: 'Only pending advances can be deleted' });
  }

  await docRef.delete();
  res.json({ message: 'Advance record deleted successfully' });
}));


// ==================== PAYROLL & SALARY ROUTES ====================

// Calculate salary breakdown for date range
app.get('/api/payroll/calculate', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date parameters are required' });
  }

  const thresholdDoc = await db.collection('settings').doc('kot_commission_limit').get();
  const threshold = thresholdDoc.exists ? parseFloat(thresholdDoc.data().value) : 250;

  const suppliersSnapshot = await db.collection('suppliers').get();
  const suppliers = suppliersSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(s => s.type === 'supplier' || !s.type);

  const attendanceSnapshot = await db.collection('attendance')
    .where('date', '>=', start_date)
    .where('date', '<=', end_date)
    .get();
  const allAttendance = attendanceSnapshot.docs.map(doc => doc.data());

  const kotSnapshot = await db.collection('kot_bills')
    .where('date', '>=', start_date)
    .where('date', '<=', end_date)
    .get();
  const allKots = kotSnapshot.docs.map(doc => doc.data());

  const advancesSnapshot = await db.collection('advances')
    .where('status', '==', 'pending')
    .get();
  const allAdvances = advancesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const payoutsSnapshot = await db.collection('salary_payouts').get();
  const allPayouts = payoutsSnapshot.docs.map(doc => doc.data());

  const report = [];

  const filteredSuppliers = suppliers.filter(supplier => {
    if (supplier.status === 'active') return true;
    const hasAttendance = allAttendance.some(a => a.supplier_id?.toString() === supplier.id.toString());
    const hasKot = allKots.some(k => k.supplier_id?.toString() === supplier.id.toString());
    return hasAttendance || hasKot;
  });

  for (const supplier of filteredSuppliers) {
    const supplierAttendance = allAttendance.filter(a => a.supplier_id?.toString() === supplier.id.toString());
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;

    supplierAttendance.forEach(log => {
      if (log.status === 'Present') presentCount++;
      else if (log.status === 'Half Day') halfDayCount++;
      else if (log.status === 'Absent') absentCount++;
    });

    const attendanceDays = presentCount + (halfDayCount * 0.5);
    const attendancePay = attendanceDays * (supplier.basic_daily_wage || 0);

    const supplierKots = allKots.filter(k => k.supplier_id?.toString() === supplier.id.toString());
    const dailyTotals = {};
    supplierKots.forEach(k => {
      dailyTotals[k.date] = (dailyTotals[k.date] || 0) + (k.amount || 0);
    });

    let totalKotAmount = 0;
    let commissionAmount = 0;
    let qualifiedDaysCount = 0;
    let qualifiedKotAmount = 0;
    let totalDaysWithKots = Object.keys(dailyTotals).length;

    Object.keys(dailyTotals).forEach(date => {
      const dailyTotal = dailyTotals[date];
      totalKotAmount += dailyTotal;
      
      const dailyComm = dailyTotal * 0.05;
      commissionAmount += dailyComm;
      qualifiedDaysCount++;
      qualifiedKotAmount += dailyTotal;
    });

    const pendingAdvances = allAdvances.filter(a => a.supplier_id?.toString() === supplier.id.toString() && a.date <= end_date);
    pendingAdvances.sort((a, b) => a.date.localeCompare(b.date));

    let advanceDeducted = 0;
    pendingAdvances.forEach(adv => {
      advanceDeducted += adv.amount;
    });

    const existingPayout = allPayouts.find(p => 
      p.supplier_id?.toString() === supplier.id.toString() && 
      !(p.end_date < start_date || p.start_date > end_date)
    );

    const totalSalary = attendancePay + commissionAmount;
    const netSalary = Math.max(0, totalSalary - advanceDeducted);

    report.push({
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      basic_daily_wage: supplier.basic_daily_wage,
      present_days: presentCount,
      half_days: halfDayCount,
      absent_days: absentCount,
      attendance_days: attendanceDays,
      attendance_pay: attendancePay,
      total_kot_amount: totalKotAmount,
      commission_amount: commissionAmount,
      qualified_days_count: qualifiedDaysCount,
      qualified_kot_amount: qualifiedKotAmount,
      total_days_with_kots: totalDaysWithKots,
      total_salary: totalSalary,
      advance_deducted: advanceDeducted,
      net_salary: netSalary,
      advances: pendingAdvances,
      already_paid: existingPayout ? true : false,
      payout_details: existingPayout ? {
        id: existingPayout.id,
        start_date: existingPayout.start_date,
        end_date: existingPayout.end_date,
        payment_date: existingPayout.payment_date
      } : null
    });
  }

  res.json({
    start_date,
    end_date,
    report
  });
}));

// Disburse and record payout
app.post('/api/payroll/payout', asyncHandler(async (req, res) => {
  const { records, start_date, end_date, payment_date } = req.body;
  if (!records || !Array.isArray(records) || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required payroll details' });
  }

  const pDate = payment_date || new Date().toISOString().split('T')[0];
  const batch = db.batch();
  const advancesColl = db.collection('advances');

  for (const record of records) {
    const { supplier_id, attendance_days, total_kot_amount, commission_amount, attendance_pay, total_salary, advance_deducted, net_salary, qualified_days_count, qualified_kot_amount, total_days_with_kots } = record;
    
    const supplierIdStr = supplier_id.toString();

    const payoutRef = db.collection('salary_payouts').doc();
    batch.set(payoutRef, {
      supplier_id: supplierIdStr,
      start_date,
      end_date,
      attendance_days: parseFloat(attendance_days) || 0,
      total_kot_amount: parseFloat(total_kot_amount) || 0,
      commission_amount: parseFloat(commission_amount) || 0,
      qualified_days_count: parseInt(qualified_days_count) || 0,
      qualified_kot_amount: parseFloat(qualified_kot_amount) || 0,
      total_days_with_kots: parseInt(total_days_with_kots) || 0,
      attendance_pay: parseFloat(attendance_pay) || 0,
      total_salary: parseFloat(total_salary) || 0,
      advance_deducted: parseFloat(advance_deducted) || 0,
      net_salary: net_salary !== undefined ? parseFloat(net_salary) : parseFloat(total_salary),
      payment_date: pDate,
      status: 'Paid'
    });

    const advSnapshot = await advancesColl
      .where('supplier_id', '==', supplierIdStr)
      .where('status', '==', 'pending')
      .get();

    advSnapshot.docs.forEach(doc => {
      if (doc.data().date <= end_date) {
        batch.update(doc.ref, {
          status: 'deducted',
          payout_id: payoutRef.id
        });
      }
    });
  }

  await batch.commit();
  res.json({ message: 'Payouts recorded successfully.' });
}));

// Get payout history
app.get('/api/payroll/history', asyncHandler(async (req, res) => {
  const suppliersSnapshot = await db.collection('suppliers').get();
  const suppliers = {};
  suppliersSnapshot.docs.forEach(doc => {
    suppliers[doc.id] = doc.data().name;
  });

  const payoutsSnapshot = await db.collection('salary_payouts').get();
  // Filter out monthly worker payouts from main supplier payroll history
  const payouts = payoutsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(p => p.worker_type !== 'monthly');

  const advancesSnapshot = await db.collection('advances').get();
  const advances = advancesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  payouts.forEach(payout => {
    payout.supplier_name = suppliers[payout.supplier_id?.toString()] || 'Unknown';
    payout.advances = advances.filter(a => a.payout_id === payout.id)
      .map(a => ({ amount: a.amount, date: a.date, remarks: a.remarks }));
    payout.advances.sort((a, b) => a.date.localeCompare(b.date));
  });

  payouts.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  res.json(payouts);
}));

// ==================== MONTHLY WORKER PAYROLL ROUTES ====================

// Helper functions for weekly off calculations
const getMonday = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

const getSunday = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

const calculateWorkerAttendanceDetails = (workerLogs, start_date, end_date) => {
  const sortedLogs = [...workerLogs].sort((a, b) => a.date.localeCompare(b.date));
  
  const weeklyOffsByWeek = {};
  sortedLogs.forEach(log => {
    if (log.status === 'Weekly Off') {
      const mon = getMonday(log.date);
      if (!weeklyOffsByWeek[mon]) {
        weeklyOffsByWeek[mon] = [];
      }
      weeklyOffsByWeek[mon].push(log.date);
    }
  });

  const weekoffStatusMap = {};
  Object.keys(weeklyOffsByWeek).forEach(mon => {
    const dates = weeklyOffsByWeek[mon].sort();
    dates.forEach((date, index) => {
      weekoffStatusMap[date] = index === 0 ? 'Paid' : 'Unpaid';
    });
  });

  let presentCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;
  let paidWeekoffCount = 0;
  let unpaidWeekoffCount = 0;
  const targetWeekoffs = [];

  sortedLogs.forEach(log => {
    if (log.date >= start_date && log.date <= end_date) {
      if (log.status === 'Present') {
        presentCount++;
      } else if (log.status === 'Half Day') {
        halfDayCount++;
      } else if (log.status === 'Absent') {
        absentCount++;
      } else if (log.status === 'Weekly Off') {
        const status = weekoffStatusMap[log.date] || 'Paid';
        if (status === 'Paid') {
          paidWeekoffCount++;
        } else {
          unpaidWeekoffCount++;
        }
        targetWeekoffs.push({ date: log.date, status });
      }
    }
  });

  const weekGroups = {};
  targetWeekoffs.forEach(wo => {
    const mon = getMonday(wo.date);
    if (!weekGroups[mon]) weekGroups[mon] = [];
    weekGroups[mon].push(wo);
  });

  const weekoffDetails = Object.keys(weekGroups).sort().map(mon => {
    return {
      week_start: mon,
      weekoffs: weekGroups[mon].sort((a, b) => a.date.localeCompare(b.date))
    };
  });

  return {
    presentCount,
    halfDayCount,
    absentCount,
    paidWeekoffCount,
    unpaidWeekoffCount,
    weekoffDetails,
    weekoffStatusMap
  };
};

// Calculate monthly salary breakdown for date range
app.get('/api/payroll/monthly/calculate', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date parameters are required' });
  }

  // Count total days in the period
  const start = new Date(start_date);
  const end = new Date(end_date);
  const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

  const suppliersSnapshot = await db.collection('suppliers').where('type', '==', 'monthly').get();
  const workers = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const extStartDate = getMonday(start_date);
  const extEndDate = getSunday(end_date);

  const attendanceSnapshot = await db.collection('attendance')
    .where('date', '>=', extStartDate)
    .where('date', '<=', extEndDate)
    .get();
  const allAttendance = attendanceSnapshot.docs.map(doc => doc.data());

  const advancesSnapshot = await db.collection('advances')
    .where('status', '==', 'pending')
    .get();
  const allAdvances = advancesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const payoutsSnapshot = await db.collection('salary_payouts').get();
  const allPayouts = payoutsSnapshot.docs.map(doc => doc.data());

  const report = [];

  const filteredWorkers = workers.filter(worker => {
    if (worker.status === 'active') return true;
    const hasAttendance = allAttendance.some(a => 
      a.supplier_id?.toString() === worker.id.toString() && 
      a.date >= start_date && 
      a.date <= end_date
    );
    return hasAttendance;
  });

  for (const worker of filteredWorkers) {
    const workerAttendance = allAttendance.filter(a => a.supplier_id?.toString() === worker.id.toString());
    const details = calculateWorkerAttendanceDetails(workerAttendance, start_date, end_date);

    const presentCount = details.presentCount;
    const halfDayCount = details.halfDayCount;
    const absentCount = details.absentCount;
    const paidWeekoffs = details.paidWeekoffCount;
    const unpaidWeekoffs = details.unpaidWeekoffCount;
    const weekoffDetails = details.weekoffDetails;

    const start = new Date(start_date);
    const year = start.getFullYear();
    const month = start.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate() || 30;

    const attendanceDays = presentCount + (halfDayCount * 0.5) + paidWeekoffs;
    const monthlySalary = worker.monthly_salary || 0;
    const dailyRate = daysInMonth > 0 ? (monthlySalary / daysInMonth) : 0;
    const attendancePay = Math.round(dailyRate * attendanceDays);

    const pendingAdvances = allAdvances.filter(a => a.supplier_id?.toString() === worker.id.toString() && a.date <= end_date);
    pendingAdvances.sort((a, b) => a.date.localeCompare(b.date));

    let advanceDeducted = 0;
    pendingAdvances.forEach(adv => {
      advanceDeducted += adv.amount;
    });

    const existingPayout = allPayouts.find(p => 
      p.supplier_id?.toString() === worker.id.toString() && 
      !(p.end_date < start_date || p.start_date > end_date)
    );

    const totalSalary = attendancePay;
    const netSalary = Math.max(0, totalSalary - advanceDeducted);

    report.push({
      supplier_id: worker.id,
      supplier_name: worker.name,
      monthly_salary: monthlySalary,
      daily_rate: dailyRate,
      present_days: presentCount,
      half_days: halfDayCount,
      absent_days: absentCount,
      paid_weekoffs: paidWeekoffs,
      unpaid_weekoffs: unpaidWeekoffs,
      weekoff_details: weekoffDetails,
      attendance_days: attendanceDays,
      attendance_pay: attendancePay,
      total_salary: totalSalary,
      advance_deducted: advanceDeducted,
      net_salary: netSalary,
      advances: pendingAdvances,
      already_paid: existingPayout ? true : false,
      payout_details: existingPayout ? {
        id: existingPayout.id,
        start_date: existingPayout.start_date,
        end_date: existingPayout.end_date,
        payment_date: existingPayout.payment_date
      } : null
    });
  }

  res.json({
    start_date,
    end_date,
    total_days: totalDays,
    report
  });
}));

// Disburse and record monthly worker payout
app.post('/api/payroll/monthly/payout', asyncHandler(async (req, res) => {
  const { records, start_date, end_date, payment_date } = req.body;
  if (!records || !Array.isArray(records) || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required payroll details' });
  }

  const pDate = payment_date || new Date().toISOString().split('T')[0];
  const batch = db.batch();
  const advancesColl = db.collection('advances');

  for (const record of records) {
    const { 
      supplier_id, 
      attendance_days, 
      attendance_pay, 
      total_salary, 
      advance_deducted, 
      net_salary,
      present_days,
      half_days,
      absent_days,
      paid_weekoffs,
      unpaid_weekoffs,
      weekoff_details
    } = record;
    
    const supplierIdStr = supplier_id.toString();

    const payoutRef = db.collection('salary_payouts').doc();
    batch.set(payoutRef, {
      supplier_id: supplierIdStr,
      start_date,
      end_date,
      attendance_days: parseFloat(attendance_days) || 0,
      total_kot_amount: 0,
      commission_amount: 0,
      qualified_days_count: 0,
      qualified_kot_amount: 0,
      total_days_with_kots: 0,
      attendance_pay: parseFloat(attendance_pay) || 0,
      total_salary: parseFloat(total_salary) || 0,
      advance_deducted: parseFloat(advance_deducted) || 0,
      net_salary: net_salary !== undefined ? parseFloat(net_salary) : parseFloat(total_salary),
      present_days: parseInt(present_days) || 0,
      half_days: parseInt(half_days) || 0,
      absent_days: parseInt(absent_days) || 0,
      paid_weekoffs: parseInt(paid_weekoffs) || 0,
      unpaid_weekoffs: parseInt(unpaid_weekoffs) || 0,
      weekoff_details: weekoff_details || [],
      payment_date: pDate,
      status: 'Paid',
      worker_type: 'monthly'
    });

    const advSnapshot = await advancesColl
      .where('supplier_id', '==', supplierIdStr)
      .where('status', '==', 'pending')
      .get();

    advSnapshot.docs.forEach(doc => {
      if (doc.data().date <= end_date) {
        batch.update(doc.ref, {
          status: 'deducted',
          payout_id: payoutRef.id
        });
      }
    });
  }

  await batch.commit();
  res.json({ message: 'Monthly worker payouts recorded successfully.' });
}));


// Get monthly worker payout history
app.get('/api/payroll/monthly/history', asyncHandler(async (req, res) => {
  const suppliersSnapshot = await db.collection('suppliers').where('type', '==', 'monthly').get();
  const workers = {};
  suppliersSnapshot.docs.forEach(doc => {
    workers[doc.id] = doc.data().name;
  });

  const payoutsSnapshot = await db.collection('salary_payouts').where('worker_type', '==', 'monthly').get();
  let payouts = payoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Fallback: If some payouts didn't have worker_type but their supplier exists in the workers dict
  if (payouts.length === 0) {
    const allPayoutsSnapshot = await db.collection('salary_payouts').get();
    payouts = allPayoutsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => workers[p.supplier_id?.toString()] !== undefined);
  }

  const advancesSnapshot = await db.collection('advances').get();
  const advances = advancesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  payouts.forEach(payout => {
    payout.supplier_name = workers[payout.supplier_id?.toString()] || 'Unknown';
    payout.advances = advances.filter(a => a.payout_id === payout.id)
      .map(a => ({ amount: a.amount, date: a.date, remarks: a.remarks }));
    payout.advances.sort((a, b) => a.date.localeCompare(b.date));
  });

  payouts.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  res.json(payouts);
}));


// ==================== SYSTEM CONFIGURATION ROUTES ====================

// Get system settings (excluding password)
app.get('/api/settings', asyncHandler(async (req, res) => {
  const snapshot = await db.collection('settings').get();
  const result = {};
  snapshot.docs.forEach(doc => {
    if (doc.id !== 'admin_password') {
      result[doc.id] = doc.id === 'kot_commission_limit' ? parseFloat(doc.data().value) : doc.data().value;
    }
  });
  res.json(result);
}));

// Update system settings (excluding password)
app.put('/api/settings', asyncHandler(async (req, res) => {
  const { kot_commission_limit, admin_name } = req.body;

  if (kot_commission_limit !== undefined) {
    const parsedLimit = parseFloat(kot_commission_limit);
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      return res.status(400).json({ error: 'Commission threshold must be a valid positive number' });
    }
    await db.collection('settings').doc('kot_commission_limit').set({ value: parsedLimit.toString() });
  }

  if (admin_name !== undefined) {
    await db.collection('settings').doc('admin_name').set({ value: admin_name.toString().trim() });
  }

  res.json({ message: 'Settings updated successfully' });
}));

// Authentication endpoint
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const doc = await db.collection('settings').doc('admin_password').get();
  const correctPassword = doc.exists ? doc.data().value : 'cosmo1111';

  if (password === correctPassword) {
    res.json({ success: true, message: 'Authenticated successfully' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
}));

// Change admin password
app.post('/api/settings/change-password', asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const docRef = db.collection('settings').doc('admin_password');
  const doc = await docRef.get();
  const correctPassword = doc.exists ? doc.data().value : 'cosmo1111';

  if (current_password !== correctPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  await docRef.set({ value: new_password });
  res.json({ message: 'Password updated successfully' });
}));

// Reset/Clear all database collections and re-seed defaults
app.post('/api/system/reset-database', asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required to reset database' });
  }

  const doc = await db.collection('settings').doc('admin_password').get();
  const correctPassword = doc.exists ? doc.data().value : 'cosmo1111';

  if (password !== correctPassword) {
    return res.status(401).json({ error: 'Invalid admin password. Reset aborted.' });
  }

  console.log('⚠ API TRIGGERED DATABASE RESET...');
  const collections = ['attendance', 'kot_bills', 'advances', 'salary_payouts', 'suppliers', 'settings'];
  
  for (const coll of collections) {
    const snapshot = await db.collection(coll).get();
    if (!snapshot.empty) {
      const chunks = [];
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 500) {
        chunks.push(docs.slice(i, i + 500));
      }
      for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  }

  console.log('🌱 Re-seeding database settings and suppliers...');
  await initDb();
  
  res.json({ success: true, message: 'Database reset successfully and default data re-seeded' });
}));


// ==================== DASHBOARD STATS ROUTE ====================

app.get('/api/dashboard/stats', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';

  const thresholdDoc = await db.collection('settings').doc('kot_commission_limit').get();
  const threshold = thresholdDoc.exists ? parseFloat(thresholdDoc.data().value) : 250;

  // Fetch collections
  const suppliersSnapshot = await db.collection('suppliers').get();
  const suppliers = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const kotSnapshot = await db.collection('kot_bills').get();
  const allKots = kotSnapshot.docs.map(doc => doc.data());

  const attendanceSnapshot = await db.collection('attendance').get();
  const allAttendance = attendanceSnapshot.docs.map(doc => doc.data());

  const payoutsSnapshot = await db.collection('salary_payouts').get();
  const allPayouts = payoutsSnapshot.docs.map(doc => doc.data());

  // 1. Today's KOT volume
  const todayKots = allKots.filter(k => k.date === today);
  const todayKotTotal = todayKots.reduce((sum, k) => sum + (k.amount || 0), 0);

  // 2. Active suppliers count
  const activeSuppliersCount = suppliers.filter(s => s.status === 'active').length;

  // 3. Today's checked-in (present/half-day) suppliers
  const presentTodayCount = allAttendance.filter(a => a.date === today && (a.status === 'Present' || a.status === 'Half Day')).length;

  // 4. Month-to-date KOT volume
  const mtdKots = allKots.filter(k => k.date >= monthStart && k.date <= today);
  const mtdKotTotal = mtdKots.reduce((sum, k) => sum + (k.amount || 0), 0);

  // 5. Month-to-date estimated payout
  const mtdGrouped = {};
  mtdKots.forEach(k => {
    const key = `${k.supplier_id?.toString()}_${k.date}`;
    mtdGrouped[key] = (mtdGrouped[key] || 0) + (k.amount || 0);
  });

  let estimatedMtdCommission = 0;
  Object.keys(mtdGrouped).forEach(key => {
    const dailyTotal = mtdGrouped[key];
    const dailyComm = dailyTotal * 0.05;
    estimatedMtdCommission += dailyComm;
  });

  const mtdAttendance = allAttendance.filter(a => a.date >= monthStart && a.date <= today);
  let estimatedMtdAttPay = 0;

  // Process daily suppliers
  const dailySuppliers = suppliers.filter(s => s.type === 'supplier' || !s.type);
  mtdAttendance.forEach(log => {
    const supplier = dailySuppliers.find(s => s.id === log.supplier_id?.toString());
    if (supplier) {
      if (log.status === 'Present') {
        estimatedMtdAttPay += (supplier.basic_daily_wage || 0);
      } else if (log.status === 'Half Day') {
        estimatedMtdAttPay += ((supplier.basic_daily_wage || 0) * 0.5);
      }
    }
  });

  // Process monthly workers with pro-rated weekly offs
  const monthlyWorkers = suppliers.filter(s => s.type === 'monthly');
  monthlyWorkers.forEach(worker => {
    const workerLogs = allAttendance.filter(a => a.supplier_id?.toString() === worker.id.toString());
    const details = calculateWorkerAttendanceDetails(workerLogs, monthStart, today);
    const dailyRate = (worker.monthly_salary || 0) / 30; // standard 30-day divisor for MTD estimation
    const paidDays = details.presentCount + (details.halfDayCount * 0.5) + details.paidWeekoffCount;
    estimatedMtdAttPay += (dailyRate * paidDays);
  });

  const estimatedMtdSalary = estimatedMtdCommission + estimatedMtdAttPay;

  // 5b. Today's Qualified Commission
  const todayGrouped = {};
  todayKots.forEach(k => {
    const supIdStr = k.supplier_id?.toString();
    todayGrouped[supIdStr] = (todayGrouped[supIdStr] || 0) + (k.amount || 0);
  });
  let todayQualifiedCommission = 0;
  Object.keys(todayGrouped).forEach(supId => {
    const dailyTotal = todayGrouped[supId];
    const dailyComm = dailyTotal * 0.05;
    todayQualifiedCommission += dailyComm;
  });

  // 6. Today's Average KOT bill size
  const avgBillToday = todayKots.length > 0 ? (todayKotTotal / todayKots.length) : 0;

  // 7. Top Supplier for the current month
  const mtdSupplierTotals = {};
  mtdKots.forEach(k => {
    const supIdStr = k.supplier_id?.toString();
    mtdSupplierTotals[supIdStr] = (mtdSupplierTotals[supIdStr] || 0) + (k.amount || 0);
  });
  let topSupplier = null;
  let maxTotal = 0;
  Object.keys(mtdSupplierTotals).forEach(supId => {
    const supplier = suppliers.find(s => s.id === supId);
    if (supplier && supplier.type !== 'monthly') {
      const total = mtdSupplierTotals[supId];
      if (total > maxTotal) {
        maxTotal = total;
        topSupplier = { name: supplier.name, total };
      }
    }
  });

  // 8. Supplier Leaderboard (Sales total in current month)
  const leaderboard = suppliers.filter(s => s.status === 'active' && s.type !== 'monthly').map(s => {
    return {
      name: s.name,
      total: mtdSupplierTotals[s.id] || 0
    };
  });
  leaderboard.sort((a, b) => b.total - a.total);

  // 9. 7-Day Weekly Trend Array
  const weekly_trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    weekly_trend.push({ date: dateStr, total: 0 });
  }
  weekly_trend.forEach(item => {
    const dayKots = allKots.filter(k => k.date === item.date);
    item.total = dayKots.reduce((sum, k) => sum + (k.amount || 0), 0);
  });

  // 10. Unified Live System Activity Log
  const recentKotsData = [...allKots];
  recentKotsData.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return (b.time || '').localeCompare(a.time || '');
  });
  const recentKotsSlice = recentKotsData.slice(0, 5);

  const recentAttendanceData = [...allAttendance];
  recentAttendanceData.sort((a, b) => b.date.localeCompare(a.date));
  const recentAttendanceSlice = recentAttendanceData.slice(0, 5);

  const recentPayoutsData = [...allPayouts];
  recentPayoutsData.sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const recentPayoutsSlice = recentPayoutsData.slice(0, 5);

  const activities = [];

  recentKotsSlice.forEach(k => {
    const supplier = suppliers.find(s => s.id === k.supplier_id?.toString());
    const name = supplier ? supplier.name : 'Unknown';
    activities.push({
      type: 'kot',
      date: k.date,
      time: k.time || '11:00',
      desc: `${name} logged Bill ${k.bill_number} of ₹${(k.amount || 0).toLocaleString('en-IN')}`,
      timestamp: new Date(`${k.date}T${k.time || '11:00'}`).getTime()
    });
  });

  recentAttendanceSlice.forEach(a => {
    const supplier = suppliers.find(s => s.id === a.supplier_id?.toString());
    const name = supplier ? supplier.name : 'Unknown';
    const hr = a.shift === '5-11' ? '17:00' : '11:00';
    activities.push({
      type: 'attendance',
      date: a.date,
      time: hr,
      desc: `${name} marked as ${a.status} (Shift: ${a.shift === '11-11' ? '11 AM-11 PM' : a.shift})`,
      timestamp: new Date(`${a.date}T${hr}`).getTime()
    });
  });

  recentPayoutsSlice.forEach(p => {
    const supplier = suppliers.find(s => s.id === p.supplier_id?.toString());
    const name = supplier ? supplier.name : 'Unknown';
    activities.push({
      type: 'payout',
      date: p.payment_date,
      time: '23:00',
      desc: `Disbursed ₹${(p.total_salary || 0).toLocaleString('en-IN')} to ${name} (Period: ${p.start_date} to ${p.end_date})`,
      timestamp: new Date(`${p.payment_date}T23:00`).getTime()
    });
  });

  activities.sort((a, b) => b.timestamp - a.timestamp);

  const dashboardKotsTable = recentKotsSlice.map(k => {
    const supplier = suppliers.find(s => s.id === k.supplier_id);
    return {
      ...k,
      supplier_name: supplier ? supplier.name : 'Unknown'
    };
  });

  res.json({
    today_date: today,
    today_kot_total: todayKotTotal,
    today_qualified_commission: todayQualifiedCommission,
    active_suppliers_count: activeSuppliersCount,
    present_suppliers_count: presentTodayCount,
    mtd_kot_total: mtdKotTotal,
    mtd_estimated_salary: estimatedMtdSalary,
    avg_bill_today: avgBillToday,
    top_supplier: topSupplier,
    supplier_leaderboard: leaderboard,
    weekly_trend,
    recent_activities: activities.slice(0, 6),
    recent_kots: dashboardKotsTable
  });
}));

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong on the server' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
