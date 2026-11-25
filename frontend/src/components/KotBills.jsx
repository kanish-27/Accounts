import React, { useState, useEffect } from 'react';
import { Wine, Plus, Search, Filter, Trash2, Calendar, User, DollarSign, Upload, X, CheckCircle, FileSpreadsheet, AlertCircle, ShoppingBag } from 'lucide-react';

// Products that never count towards a supplier's KOT amount
const EXCLUDED_KOT_ITEMS = [
  'Tumbler', 'Kara Sev', 'Pori', 'Mixture',
  'British 300 Ml', 'British 500 Ml',
  'Rich Aqua 500 Ml', 'Rich Aqua 300 Ml',
  'Aquafina 500 Ml', 'Aquafina 300 Ml',
  'Water 500 Ml', 'Water 300 Ml',
  'Masal Kallai', 'Varu Kallai'
];

// Products that are conditionally excluded from KOT ONLY if that particular person is in charge of charges.
// If the person does NOT have charges or was only altering during lunch, these two products alone are added to the KOT calculation.
const CONDITIONAL_KOT_ITEMS = [
  'Aquafina 1 L', 'Aquafina 1L', 'Aquafina 1 Ltr', 'Aquafina 1 Litre', 'Aquafina 1000 Ml',
  'Water 1 L', 'Water 1L', 'Water 1 Ltr', 'Water 1 Litre', 'Water 1000 Ml'
];

// Available charges in the club: Kudil Charge, AC Charges
const getChargeType = (category, itemName) => {
  const cat = (category || '').toLowerCase();
  const item = (itemName || '').toLowerCase();

  // Match Kudil Charge / Kudil Charges / Kudil
  if (cat.includes('kudil') || item.includes('kudil')) return 'Kudil Charge';

  // Match AC Charges / AC Charge / A/C Charges / A/C Charge / A.C Charges
  if (
    cat.includes('ac charge') || item.includes('ac charge') ||
    cat.includes('ac charges') || item.includes('ac charges') ||
    cat.includes('a/c charge') || item.includes('a/c charge') ||
    cat.includes('a/c charges') || item.includes('a/c charges') ||
    cat.includes('a.c charge') || item.includes('a.c charge') ||
    cat.includes('a.c charges') || item.includes('a.c charges') ||
    cat.includes('ac_charge') || item.includes('ac_charge')
  ) {
    return 'AC Charges';
  }

  // General charge detection (e.g. Category 'Charges' or 'Charge')
  if (cat.includes('charge') || item.includes('charge')) return 'Charge';

  return null;
};

const isChargeItemOrCategory = (category, itemName) => {
  return getChargeType(category, itemName) !== null;
};

// Lowercase, drop any leading quantity numbers (e.g. "2 Tumbler", "1 x Pori", "2 Aquafina 1 L"), then keep only letters/digits
const normalizeItemName = (name) => name
  .toLowerCase()
  .replace(/^(\s*[#(]?\d+(\.\d+)?[)]?\s*(x|×|\*|-|\.|:)?\s*)+/, '')
  .replace(/[^a-z0-9]/g, '');

const EXCLUDED_KOT_ITEM_KEYS = new Set(EXCLUDED_KOT_ITEMS.map(normalizeItemName));
const CONDITIONAL_KOT_ITEM_KEYS = new Set(CONDITIONAL_KOT_ITEMS.map(normalizeItemName));

const isExcludedKotItem = (itemName) => !!itemName && EXCLUDED_KOT_ITEM_KEYS.has(normalizeItemName(itemName));
const isConditionalKotItem = (itemName) => !!itemName && CONDITIONAL_KOT_ITEM_KEYS.has(normalizeItemName(itemName));

export default function KotBills({ showToast, API_BASE }) {
  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // CSV Import States
  const [csvFile, setCsvFile] = useState(null);
  const [rawCsvText, setRawCsvText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [parsedResults, setParsedResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);

  // Selected supplier(s) in charge of charges (for removing 1L water bottles)
  const [selectedChargeSuppliers, setSelectedChargeSuppliers] = useState([]);

  // Filters State
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterSearch, setFilterSearch] = useState('');

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE}/suppliers?status=active&type=supplier`);
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      const data = await res.json();
      setSuppliers(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading suppliers dropdown', 'error');
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      // Query parameters for filters
      const params = new URLSearchParams();
      if (filterSupplier) params.append('supplier_id', filterSupplier);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);

      const res = await fetch(`${API_BASE}/kot?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch KOT bills');
      const data = await res.json();
      setBills(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading KOT list', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sync bills when filters change
  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [filterSupplier, filterStartDate, filterEndDate]);



  // CSV Helper Functions
  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    const cleanField = (val) => {
      if (!val) return '';
      return val.trim().replace(/^["']|["']$/g, '').trim();
    };

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row.map(cleanField));
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row.map(cleanField));
    }
    return lines;
  };

  const processCSVData = (lines, chargeSuppliers = selectedChargeSuppliers) => {
    if (lines.length < 2) {
      return { error: 'CSV file is empty or missing data rows.' };
    }

    const activeChargeSuppliers = Array.isArray(chargeSuppliers)
      ? chargeSuppliers
      : (Array.isArray(selectedChargeSuppliers) ? selectedChargeSuppliers : []);

    // Identify columns
    const headers = lines[0].map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
    
    const categoryIndex = (() => {
      let idx = headers.findIndex(h => h === 'categoryname' || h === 'category_name');
      if (idx !== -1) return idx;
      return headers.findIndex(h => h.includes('category'));
    })();

    const assignIndex = (() => {
      let idx = headers.findIndex(h => h === 'assignto' || h === 'assign_to');
      if (idx !== -1) return idx;
      return headers.findIndex(h => h.includes('assign') || h.includes('supplier') || h.includes('staff'));
    })();

    const totalIndex = (() => {
      let idx = headers.findIndex(h => h === 'itemtotal' || h === 'item_total' || h === 'itemsum');
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => h.includes('itemtotal'));
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => h === 'total');
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => h.includes('total'));
      if (idx !== -1) return idx;
      return headers.findIndex(h => h.includes('amount') || h.includes('price'));
    })();

    const dateIndex = (() => {
      let idx = headers.findIndex(h => h === 'date' || h === 'createdat' || h === 'created_at');
      if (idx !== -1) return idx;
      return headers.findIndex(h => h.includes('date') || h.includes('createdat') || h.includes('time'));
    })();

    const itemIndex = (() => {
      let idx = headers.findIndex(h => h === 'itemname' || h === 'item' || h === 'productname' || h === 'product');
      if (idx !== -1) return idx;
      return headers.findIndex(h => (h.includes('item') || h.includes('product')) &&
        !['total', 'price', 'qty', 'quantity', 'id', 'code', 'amount', 'tax', 'discount', 'sum', 'count'].some(w => h.includes(w)));
    })();

    const qtyIndex = (() => {
      // 1. Direct match for standard item quantity headers (after stripping symbols/spaces)
      let idx = headers.findIndex(h => 
        h === 'itemquantity' || h === 'itemqty' || h === 'quantity' || h === 'qty' || 
        h === 'itemcount' || h === 'itemquant' || h === 'totalqty' || h === 'totqty'
      );
      if (idx !== -1) return idx;

      // 2. Starts with itemqu or itemqty (e.g. item_quantity, item_qty)
      idx = headers.findIndex(h => h.startsWith('itemqu') || h.startsWith('itemqty'));
      if (idx !== -1) return idx;

      // 3. Contains quantity or qty (excluding price/amount/total/tax/discount)
      idx = headers.findIndex(h => 
        (h.includes('quantity') || h.includes('qty')) &&
        !['price', 'total', 'amount', 'tax', 'rate', 'disc', 'cost'].some(bad => h.includes(bad))
      );
      if (idx !== -1) return idx;

      // 4. Safe count matches (EXPLICITLY exclude account, discount, taxable, etc.)
      idx = headers.findIndex(h => 
        (h.includes('count') || h.includes('pieces') || h.includes('units') || h.includes('nos')) &&
        !['account', 'discount', 'price', 'total', 'amount', 'tax', 'taxable', 'bill', 'table', 'token'].some(bad => h.includes(bad))
      );
      return idx;
    })();

    const priceIndex = (() => {
      let idx = headers.findIndex(h => 
        h === 'itemprice' || h === 'price' || h === 'itemrate' || h === 'rate' || h === 'unitprice'
      );
      if (idx !== -1) return idx;
      idx = headers.findIndex(h => 
        (h.includes('price') || h.includes('rate')) &&
        !['total', 'tax', 'discount', 'amount', 'disc'].some(bad => h.includes(bad))
      );
      return idx;
    })();

    const payModeIndex = (() => {
      let idx = headers.findIndex(h => h === 'paymentmode' || h === 'payment_mode' || h === 'paymode' || h === 'pay_mode' || h === 'paymenttype' || h === 'payment_type');
      if (idx !== -1) return idx;
      return headers.findIndex(h => (h.includes('pay') || h.includes('tender') || h.includes('mode') || h.includes('settle')) && !h.includes('amount') && !h.includes('total') && !h.includes('payout'));
    })();

    const cashIndex = headers.findIndex(h => h === 'cash' || h === 'cashamount' || h === 'cash_amount' || h === 'paidcash');
    const upiIndex = headers.findIndex(h => h === 'upi' || h === 'upiamount' || h === 'upi_amount' || h === 'gpay' || h === 'online' || h === 'onlineamount' || h === 'qr');

    if (categoryIndex === -1) {
      return { error: 'Could not find "category_name" column in CSV.' };
    }
    if (assignIndex === -1) {
      return { error: 'Could not find "assign_to" column in CSV.' };
    }
    if (totalIndex === -1) {
      return { error: 'Could not find "item_total" column in CSV.' };
    }
    if (itemIndex === -1) {
      return { error: 'Could not find "item_name" column in CSV (needed to exclude non-KOT products).' };
    }

    let ignoredCharges = 0;
    let ignoredItems = 0;
    let matchedSupplierCount = 0;
    let unmatchedSupplierCount = 0;
    let totalRows = lines.length - 1;
    const matchedRows = [];

    const parseDateToYYYYMMDD = (dateStr) => {
      if (!dateStr) return null;
      const clean = dateStr.trim();
      // DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }
      // YYYY-MM-DD
      const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (ymdMatch) {
        return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
      }
      try {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch (e) {}
      return null;
    };

    const isSupplierMatch = (assignTo, supplier) => {
      if (!assignTo || !supplier) return false;
      const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanAssign = clean(assignTo);
      const cleanName = clean(supplier.name);
      if (cleanAssign === cleanName) return true;
      if (supplier.id && cleanAssign === clean(supplier.id.toString())) return true;
      return false;
    };

    const findSupplier = (assignTo) => {
      if (!assignTo) return null;
      return suppliers.find(s => isSupplierMatch(assignTo, s));
    };

    // First pass: identify which suppliers have charges (Kudil Charge, AC Charges)
    const suppliersWithCharges = new Set();
    const suppliersWithChargesByDate = new Set();
    const suppliersWithUndatedCharges = new Set();
    const detectedMap = new Map();

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 1 && row[0] === '') continue;
      if (row.length <= Math.max(categoryIndex, assignIndex, totalIndex)) continue;

      const category = (row[categoryIndex] || '').trim();
      const assignTo = (row[assignIndex] || '').trim();
      const itemName = (row[itemIndex] || '').trim();
      const dateStr = dateIndex !== -1 ? row[dateIndex] : '';
      const rowDate = parseDateToYYYYMMDD(dateStr);

      const chargeType = getChargeType(category, itemName);
      if (chargeType && assignTo) {
        const cleanAssign = assignTo.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matched = findSupplier(assignTo);
        const keys = new Set();
        if (cleanAssign) keys.add(cleanAssign);
        if (matched) {
          keys.add(matched.id.toString());
          if (matched.name) {
            keys.add(matched.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
          }
          const sId = matched.id.toString();
          if (!detectedMap.has(sId)) {
            detectedMap.set(sId, { id: sId, name: matched.name, charges: new Set() });
          }
          detectedMap.get(sId).charges.add(chargeType);
        }

        keys.forEach(k => {
          suppliersWithCharges.add(k);
          if (rowDate) {
            suppliersWithChargesByDate.add(`${k}_${rowDate}`);
          } else {
            suppliersWithUndatedCharges.add(k);
          }
        });
      }
    }

    const detectedSuppliersWithCharges = [];
    detectedMap.forEach(val => {
      detectedSuppliersWithCharges.push({
        id: val.id,
        name: val.name,
        charges: Array.from(val.charges)
      });
    });

    const excludedWaterSuppliers = new Set();

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 1 && row[0] === '') continue;
      if (row.length <= Math.max(categoryIndex, assignIndex, totalIndex)) continue;

      const category = row[categoryIndex] || '';
      const assignTo = row[assignIndex] || '';
      const itemTotalStr = row[totalIndex] || '';
      const dateStr = dateIndex !== -1 ? row[dateIndex] : '';
      const parsedDate = parseDateToYYYYMMDD(dateStr) || new Date().toISOString().split('T')[0];

      const itemName = row[itemIndex] || '';

      // Reject charges (Kudil Charge, AC Charges, or general charges)
      if (isChargeItemOrCategory(category, itemName)) {
        ignoredCharges++;
        continue;
      }

      // Reject products unconditionally excluded from KOT (water 300/500ml, snacks, tumbler, etc.)
      if (isExcludedKotItem(itemName)) {
        ignoredItems++;
        continue;
      }

      const matchedSup = findSupplier(assignTo);

      // Check conditional products (e.g. 2 Aquafina 1 L, 2 Water 1 L)
      // Excluded ONLY if:
      // 1. That particular person is in charge of charges (user selected/given)
      // 2. AND either of the 2 charges (Kudil Charge, AC Charges) is available for them in the CSV.
      // If someone altered during lunch, they are not selected, so their 1L water bottles are NOT removed.
      if (isConditionalKotItem(itemName)) {
        const cleanAssign = (assignTo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const keys = new Set();
        if (cleanAssign) keys.add(cleanAssign);
        if (matchedSup) {
          keys.add(matchedSup.id.toString());
          if (matchedSup.name) {
            keys.add(matchedSup.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
          }
        }

        const isGivenSupplier = matchedSup
          ? activeChargeSuppliers.includes(matchedSup.id.toString())
          : Array.from(keys).some(k => activeChargeSuppliers.includes(k));

        if (isGivenSupplier) {
          const personHasCharges = Array.from(keys).some(k => {
            if (parsedDate && suppliersWithChargesByDate.has(`${k}_${parsedDate}`)) return true;
            if (suppliersWithUndatedCharges.has(k)) return true;
            if (suppliersWithCharges.has(k)) return true;
            return false;
          });

          if (personHasCharges) {
            ignoredItems++;
            if (matchedSup) {
              excludedWaterSuppliers.add(matchedSup.id.toString());
            }
            continue;
          }
        }
      }

      if (matchedSup) {
        matchedSupplierCount++;
        const cleanAmt = itemTotalStr.replace(/[^0-9.]/g, '');
        const amt = parseFloat(cleanAmt) || 0;

        matchedRows.push({
          supplierId: matchedSup.id,
          supplierName: matchedSup.name,
          category,
          assignTo,
          amount: amt,
          date: parsedDate
        });
      } else {
        unmatchedSupplierCount++;
      }
    }

    const grouped = {};
    matchedRows.forEach(row => {
      const key = `${row.supplierId}_${row.date}`;
      if (!grouped[key]) {
        grouped[key] = {
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          date: row.date,
          amount: 0,
          count: 0
        };
      }
      grouped[key].amount += row.amount;
      grouped[key].count += 1;
    });

    const groupedBills = Object.keys(grouped).map(key => {
      const g = grouped[key];
      const formattedDateForBill = g.date.replace(/-/g, '');
      const sId = g.supplierId.toString();
      return {
        supplier_id: g.supplierId,
        supplier_name: g.supplierName,
        date: g.date,
        amount: g.amount,
        count: g.count,
        hadWaterExcluded: excludedWaterSuppliers.has(sId),
        hasChargesInCsv: detectedMap.has(sId),
        bill_number: `CSV-${formattedDateForBill}-${g.supplierId}`
      };
    });

    groupedBills.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.supplier_name.localeCompare(b.supplier_name);
    });

    // Aggregate product-level sales & Cash vs UPI breakdown for the "Sales & Collections" tab
    const productSalesMap = new Map();
    let totalSalesUnits = 0;
    let totalSalesAmount = 0;
    let detectedCashAmount = 0;
    let detectedUpiAmount = 0;
    let hasPaymentModeData = false;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 1 && row[0] === '') continue;
      if (row.length <= Math.max(categoryIndex, assignIndex, totalIndex)) continue;

      const category = (row[categoryIndex] || '').trim() || 'General';
      const itemName = (row[itemIndex] || '').trim();
      const itemTotalStr = row[totalIndex] || '';
      const cleanAmt = itemTotalStr.replace(/[^0-9.]/g, '');
      const amt = parseFloat(cleanAmt) || 0;

      if (!itemName) continue;

      let rowQty = 0;
      if (qtyIndex !== -1 && row[qtyIndex] !== undefined && row[qtyIndex] !== null && row[qtyIndex] !== '') {
        const q = parseFloat(String(row[qtyIndex]).replace(/[^0-9.]/g, ''));
        if (!isNaN(q) && q > 0) rowQty = q;
      }

      // Fallback: calculate from item_total / item_price if quantity column wasn't populated
      if (rowQty <= 0 && priceIndex !== -1 && row[priceIndex] !== undefined && amt > 0) {
        const pr = parseFloat(String(row[priceIndex]).replace(/[^0-9.]/g, ''));
        if (!isNaN(pr) && pr > 0) {
          const derived = Math.round(amt / pr);
          if (derived > 0) rowQty = derived;
        }
      }

      // Default to 1 if neither quantity nor price was available
      if (rowQty <= 0) {
        rowQty = 1;
      }

      const cleanItemName = itemName;

      totalSalesAmount += amt;
      totalSalesUnits += rowQty;

      const pKey = cleanItemName.toLowerCase();
      if (!productSalesMap.has(pKey)) {
        productSalesMap.set(pKey, {
          name: cleanItemName,
          category,
          quantity: 0,
          amount: 0
        });
      }
      const pObj = productSalesMap.get(pKey);
      pObj.quantity += rowQty;
      pObj.amount += amt;

      if (cashIndex !== -1 || upiIndex !== -1) {
        const rowCash = cashIndex !== -1 ? (parseFloat((row[cashIndex] || '').replace(/[^0-9.]/g, '')) || 0) : 0;
        const rowUpi = upiIndex !== -1 ? (parseFloat((row[upiIndex] || '').replace(/[^0-9.]/g, '')) || 0) : 0;
        if (rowCash > 0 || rowUpi > 0) {
          detectedCashAmount += rowCash;
          detectedUpiAmount += rowUpi;
          hasPaymentModeData = true;
        }
      } else if (payModeIndex !== -1) {
        const pMode = (row[payModeIndex] || '').toLowerCase();
        if (
          pMode.includes('upi') || pMode.includes('gpay') || pMode.includes('phonepe') ||
          pMode.includes('paytm') || pMode.includes('online') || pMode.includes('qr') ||
          pMode.includes('scan') || pMode.includes('card') || pMode.includes('pos') ||
          pMode.includes('bank') || pMode.includes('transfer')
        ) {
          detectedUpiAmount += amt;
          hasPaymentModeData = true;
        } else if (pMode.includes('cash')) {
          detectedCashAmount += amt;
          hasPaymentModeData = true;
        }
      }
    }

    if (!hasPaymentModeData) {
      detectedCashAmount = totalSalesAmount;
      detectedUpiAmount = 0;
    } else {
      const accounted = detectedCashAmount + detectedUpiAmount;
      if (accounted < totalSalesAmount) {
        detectedCashAmount += (totalSalesAmount - accounted);
      }
    }

    const productsList = Array.from(productSalesMap.values()).map(p => ({
      name: p.name,
      category: p.category,
      quantity: Math.round(p.quantity * 100) / 100,
      amount: Math.round(p.amount * 100) / 100
    }));
    productsList.sort((a, b) => b.amount - a.amount);

    const salesSummary = {
      date: importDate || new Date().toISOString().split('T')[0],
      total_amount: Math.round(totalSalesAmount * 100) / 100,
      cash_amount: Math.round(detectedCashAmount * 100) / 100,
      upi_amount: Math.round(detectedUpiAmount * 100) / 100,
      total_items_count: Math.round(totalSalesUnits * 100) / 100,
      products: productsList,
      hasPaymentModeData
    };

    return {
      totalRows,
      ignoredCharges,
      ignoredItems,
      matchedSupplierCount,
      unmatchedSupplierCount,
      matchedRows,
      groupedBills,
      detectedSuppliersWithCharges,
      excludedWaterSupplierIds: Array.from(excludedWaterSuppliers),
      salesSummary
    };
  };

  const toggleChargeSupplier = (id) => {
    const sId = id.toString();
    setSelectedChargeSuppliers(prev =>
      prev.includes(sId) ? prev.filter(x => x !== sId) : [...prev, sId]
    );
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file) => {
    if (!file.name.endsWith('.csv')) {
      showToast('Only CSV files are supported', 'error');
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setRawCsvText(text);
      const parsedLines = parseCSV(text);
      const results = processCSVData(parsedLines, selectedChargeSuppliers);
      setParsedResults(results);
      if (results.error) {
        showToast(results.error, 'error');
      } else {
        showToast(`Successfully parsed CSV. Matched ${results.matchedSupplierCount} items.`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveFile = () => {
    setCsvFile(null);
    setRawCsvText('');
    setParsedResults(null);
  };

  const handleImportSubmit = async () => {
    if (!parsedResults || !parsedResults.groupedBills || parsedResults.groupedBills.length === 0) {
      showToast('No matching records to import', 'error');
      return;
    }
    if (!importDate) {
      showToast('Please select a date first', 'error');
      return;
    }

    // Confirmation if Kudil/AC charges detected in CSV but no in-charge supplier selected
    if (
      parsedResults.detectedSuppliersWithCharges &&
      parsedResults.detectedSuppliersWithCharges.length > 0 &&
      selectedChargeSuppliers.length === 0
    ) {
      const proceed = window.confirm(
        'Kudil / AC charges were detected in this CSV, but NO supplier was selected as in-charge.\n\n1L water bottles will NOT be deducted for any staff (including alter persons).\n\nDo you want to proceed without deducting 1L water for charges?'
      );
      if (!proceed) {
        return;
      }
    }

    setImporting(true);
    try {
      const formattedDateForBill = importDate.replace(/-/g, '');
      const payload = {
        bills: parsedResults.groupedBills.map(b => ({
          supplier_id: b.supplier_id.toString(),
          bill_number: `CSV-${formattedDateForBill}-${b.supplier_id}`,
          amount: b.amount,
          date: importDate,
          time: '12:00',
          remarks: `CSV Import - ${b.count} items (Excluded ${parsedResults.ignoredCharges} charges, ${parsedResults.ignoredItems} non-KOT items${b.hadWaterExcluded ? '; 1L water removed for charges' : ''})`
        }))
      };

      const res = await fetch(`${API_BASE}/kot/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to import KOT bills');
      const data = await res.json();

      // Sync daily sales & product breakdown to Sales & Collections tab
      if (parsedResults.salesSummary && parsedResults.salesSummary.products.length > 0) {
        try {
          await fetch(`${API_BASE}/sales/daily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: importDate,
              total_amount: parsedResults.salesSummary.total_amount,
              cash_amount: parsedResults.salesSummary.cash_amount,
              upi_amount: parsedResults.salesSummary.upi_amount,
              total_items_count: parsedResults.salesSummary.total_items_count,
              products: parsedResults.salesSummary.products,
              source: 'kot_csv_import'
            })
          });
        } catch (salesErr) {
          console.error('Failed to sync sales to daily_sales collection:', salesErr);
        }
      }

      showToast(`Successfully imported ${data.length} KOT bills & synced to Sales & Collections`, 'success');
      
      setCsvFile(null);
      setRawCsvText('');
      setParsedResults(null);
      fetchBills();
    } catch (err) {
      console.error(err);
      showToast('Error importing KOT bills', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Re-process CSV when suppliers list, selectedChargeSuppliers, or rawCsvText changes
  useEffect(() => {
    if (rawCsvText && suppliers.length > 0) {
      const parsedLines = parseCSV(rawCsvText);
      const results = processCSVData(parsedLines, selectedChargeSuppliers);
      setParsedResults(results);
    } else {
      setParsedResults(null);
    }
  }, [rawCsvText, suppliers, selectedChargeSuppliers]);



  const handleDelete = async (id, billNo) => {
    if (!window.confirm(`Are you sure you want to delete KOT Bill: ${billNo}?`)) {
      return;
    }

    // Remove from the screen immediately; reload only if the delete fails
    setBills(prev => prev.filter(b => b.id !== id));
    showToast(`KOT Bill ${billNo} deleted`, 'success');

    try {
      const res = await fetch(`${API_BASE}/kot/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete KOT bill');
    } catch (err) {
      console.error(err);
      showToast(`KOT Bill ${billNo} could not be deleted and has been restored`, 'error');
      fetchBills();
    }
  };

  // Perform client-side filter for text search (bill number)
  const filteredBills = bills.filter(b => 
    b.bill_number.toLowerCase().includes(filterSearch.toLowerCase())
  );

  // Sum up totals
  const totalAmount = filteredBills.reduce((sum, b) => sum + b.amount, 0);
  const estimatedCommission = totalAmount * 0.05;

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt);
  };

  return (
    <div>
      <div className="content-header">
        <div className="header-title">
          <h1>KOT Bills Management</h1>
          <p>Register kitchen orders per supplier and track billing commission values.</p>
        </div>
      </div>

      <div className="kot-layout-grid">
        {/* Left: Input Form Card */}
        <div className="card gold-header" style={{ height: 'fit-content' }}>
          <div className="section-title">
            <Wine size={18} color="var(--accent-gold-glow)" /> Log KOT Bill
          </div>
          
          <div style={{ marginTop: '1rem' }}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>
                Select Date for KOT Bills *
              </label>
              <input 
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e.target.value)}
                className="form-control"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Supplier in charge of Charges
                </label>
                {selectedChargeSuppliers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedChargeSuppliers([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-gold-glow, #f59e0b)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                  >
                    Clear ({selectedChargeSuppliers.length})
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', lineHeight: 1.35 }}>
                Select who is in charge of Kudil/AC charges. 1L water bottles will be removed <strong>only</strong> for this supplier if charges exist. Alter staff during lunch will <strong>not</strong> be reduced.
              </div>

              {/* Dropdown selector */}
              <select
                value={selectedChargeSuppliers.length === 1 ? selectedChargeSuppliers[0] : (selectedChargeSuppliers.length > 1 ? 'multiple' : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setSelectedChargeSuppliers([]);
                  } else if (val !== 'multiple') {
                    setSelectedChargeSuppliers([val]);
                  }
                }}
                className="form-control"
                style={{ marginBottom: '0.45rem' }}
              >
                <option value="">-- None (Do not remove 1L water) --</option>
                {suppliers.map(sup => {
                  const sId = sup.id.toString();
                  const detected = parsedResults?.detectedSuppliersWithCharges?.find(d => d.id === sId);
                  return (
                    <option key={sup.id} value={sId}>
                      {sup.name} {detected ? `⚡ (Charges: ${detected.charges.join(', ')})` : ''}
                    </option>
                  );
                })}
                {selectedChargeSuppliers.length > 1 && (
                  <option value="multiple" disabled>
                    Multiple selected ({selectedChargeSuppliers.length} staff)
                  </option>
                )}
              </select>

              {/* Quick toggle chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {suppliers.map(sup => {
                  const sId = sup.id.toString();
                  const isSelected = selectedChargeSuppliers.includes(sId);
                  const detected = parsedResults?.detectedSuppliersWithCharges?.find(d => d.id === sId);
                  return (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => toggleChargeSupplier(sId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.22rem 0.55rem',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        border: isSelected 
                          ? '1px solid var(--accent-gold-border, #f59e0b)' 
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        background: isSelected 
                          ? 'rgba(245, 158, 11, 0.2)' 
                          : 'rgba(255, 255, 255, 0.04)',
                        color: isSelected 
                          ? 'var(--accent-gold-glow, #fbbf24)' 
                          : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                      title={detected ? `Charges detected in CSV: ${detected.charges.join(', ')}` : 'Click to select/deselect'}
                    >
                      <span>{isSelected ? '✓' : '+'}</span>
                      <span>{sup.name}</span>
                      {detected && (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          background: isSelected ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.15)', 
                          color: '#f59e0b', 
                          padding: '1px 4px', 
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          ⚡ Charges
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {!csvFile ? (
              <div 
                className={`csv-upload-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <input 
                  id="csv-file-input"
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }}
                />
                <Upload className="csv-upload-icon" size={32} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Drag & Drop CSV File</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>or click to browse files</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Requires columns: item_name, category_name, assign_to, item_total
                </div>
              </div>
            ) : (
              <div>
                <div className="csv-file-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <FileSpreadsheet size={18} className="text-gold" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                      {csvFile.name}
                    </span>
                  </div>
                  <button 
                    type="button"
                    className="btn btn-icon btn-danger"
                    style={{ padding: '0.25rem', height: 'auto', width: 'auto' }}
                    onClick={handleRemoveFile}
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>

                {parsedResults && (
                  <div className="csv-preview-card">
                    {parsedResults.error ? (
                      <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>
                        <strong>Error:</strong> {parsedResults.error}
                      </div>
                    ) : (
                      <div>
                        <div className="csv-preview-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <CheckCircle size={14} className="text-green" />
                          Parsed KOT Data
                        </div>

                        {/* Kudil / AC Charges detection banner & alter protection */}
                        {parsedResults.detectedSuppliersWithCharges && parsedResults.detectedSuppliersWithCharges.length > 0 && (
                          <div style={{
                            padding: '0.65rem 0.75rem',
                            background: selectedChargeSuppliers.length === 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.06)',
                            border: `1px solid ${selectedChargeSuppliers.length === 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--accent-gold-border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            marginBottom: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedChargeSuppliers.length === 0 ? '#f87171' : 'var(--accent-gold-glow)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <AlertCircle size={14} />
                                Charges Detected in CSV
                              </span>
                              {selectedChargeSuppliers.length === 0 ? (
                                <span style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 600 }}>Please Select In-Charge</span>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <CheckCircle size={12} /> Configured
                                </span>
                              )}
                            </div>
                            
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', lineHeight: 1.35 }}>
                              Charges ({parsedResults.detectedSuppliersWithCharges.map(d => `${d.charges.join('/')} for ${d.name}`).join('; ')}) found in CSV. Select who was in charge to remove 1L water bottles (alter staff during lunch will not be reduced):
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                              {parsedResults.detectedSuppliersWithCharges.map(d => {
                                const isSelected = selectedChargeSuppliers.includes(d.id);
                                return (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => toggleChargeSupplier(d.id)}
                                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', height: 'auto', borderRadius: '4px' }}
                                  >
                                    {isSelected ? '✓ ' : ''}{d.name} {isSelected ? '(In-Charge)' : '(Make In-Charge)'}
                                  </button>
                                );
                              })}
                              {selectedChargeSuppliers.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedChargeSuppliers([])}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', height: 'auto', color: 'var(--text-muted)' }}
                                >
                                  Clear (No deduction)
                                </button>
                              )}
                            </div>

                            <div style={{ marginTop: '0.45rem', fontSize: '0.7rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.4rem' }}>
                              {selectedChargeSuppliers.length > 0 ? (
                                <>
                                  <div style={{ color: '#10b981', fontWeight: 600 }}>
                                    ✓ 1L Water removed for: {suppliers.filter(s => selectedChargeSuppliers.includes(s.id.toString()) && parsedResults.excludedWaterSupplierIds.includes(s.id.toString())).map(s => s.name).join(', ') || 'None (no 1L bottles found in CSV)'}
                                  </div>
                                  {parsedResults.detectedSuppliersWithCharges.filter(d => !selectedChargeSuppliers.includes(d.id)).length > 0 && (
                                    <div style={{ color: '#94a3b8', marginTop: '0.15rem' }}>
                                      🛡️ Alter staff protected (1L water kept): {parsedResults.detectedSuppliersWithCharges.filter(d => !selectedChargeSuppliers.includes(d.id)).map(d => d.name).join(', ')}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ color: '#f87171' }}>
                                  No in-charge selected: 1L water bottles will NOT be deducted for any supplier.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="csv-stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                          <div className="csv-stat-item">
                            <span className="csv-stat-label">Matched Rows</span>
                            <span className="csv-stat-val text-gold">{parsedResults.matchedSupplierCount}</span>
                          </div>
                          <div className="csv-stat-item">
                            <span className="csv-stat-label">Excluded Charges</span>
                            <span className="csv-stat-val" style={{ color: 'var(--text-muted)' }}>{parsedResults.ignoredCharges}</span>
                          </div>
                          <div className="csv-stat-item">
                            <span className="csv-stat-label">Excluded Items</span>
                            <span className="csv-stat-val" style={{ color: 'var(--text-muted)' }}>{parsedResults.ignoredItems}</span>
                          </div>
                          <div className="csv-stat-item">
                            <span className="csv-stat-label">Unmatched Rows</span>
                            <span className="csv-stat-val" style={{ color: parsedResults.unmatchedSupplierCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                              {parsedResults.unmatchedSupplierCount}
                            </span>
                          </div>
                          <div className="csv-stat-item">
                            <span className="csv-stat-label">Total Rows</span>
                            <span className="csv-stat-val">{parsedResults.totalRows}</span>
                          </div>
                        </div>

                        {parsedResults.groupedBills.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                            No matching KOT entries found for any active suppliers.
                          </div>
                        ) : (
                          <>
                            {parsedResults.salesSummary && parsedResults.salesSummary.products.length > 0 && (
                              <div style={{ marginBottom: '0.85rem', padding: '0.6rem 0.75rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem' }}>
                                <div style={{ fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                                  <ShoppingBag size={13} /> Sales & Collections Extraction
                                </div>
                                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                                  <strong>{parsedResults.salesSummary.products.length} Products ({parsedResults.salesSummary.total_items_count} Units)</strong> • Total: <strong className="text-gold">{formatCurrency(parsedResults.salesSummary.total_amount)}</strong>
                                  <br />
                                  <span>Cash: <strong style={{ color: '#10b981' }}>{formatCurrency(parsedResults.salesSummary.cash_amount)}</strong> | UPI: <strong style={{ color: '#f59e0b' }}>{formatCurrency(parsedResults.salesSummary.upi_amount)}</strong></span>
                                </div>
                              </div>
                            )}

                            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                              Parsed KOT Statements:
                            </div>
                            <div className="csv-preview-table-wrapper">
                              <table className="csv-preview-table">
                                <thead>
                                  <tr>
                                    <th>Supplier</th>
                                    <th>Date</th>
                                    <th>Items</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parsedResults.groupedBills.map((b, idx) => (
                                    <tr key={idx}>
                                      <td style={{ padding: '0.45rem 0.35rem' }}>
                                        <div style={{ fontWeight: 600 }}>{b.supplier_name}</div>
                                        {b.hadWaterExcluded ? (
                                          <div style={{ marginTop: '2px' }}>
                                            <span style={{ color: '#ef4444', fontSize: '0.62rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.12)', padding: '1px 5px', borderRadius: '3px', display: 'inline-block' }}>
                                              1L Water Removed
                                            </span>
                                          </div>
                                        ) : b.hasChargesInCsv ? (
                                          <div style={{ marginTop: '2px' }}>
                                            <span style={{ color: '#10b981', fontSize: '0.62rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', padding: '1px 5px', borderRadius: '3px', display: 'inline-block' }}>
                                              Lunch Alter (Water Kept)
                                            </span>
                                          </div>
                                        ) : null}
                                      </td>
                                      <td>{importDate ? importDate.split('-').reverse().map((x, i) => i === 2 ? x.slice(2) : x).join('/') : ''}</td>
                                      <td>{b.count} rows</td>
                                      <td className="text-gold" style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                                        {formatCurrency(b.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <button 
                              type="button" 
                              className="btn btn-primary" 
                              style={{ width: '100%', marginTop: '0.5rem' }}
                              onClick={handleImportSubmit}
                              disabled={importing}
                            >
                              {importing ? 'Importing...' : `Confirm & Import (${parsedResults.groupedBills.length} Statements)`}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Logs Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Summary Mini Cards */}
          <div className="card-grid kot-summary-grid" style={{ marginBottom: 0 }}>
            <div className="card gold-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Total KOT Sum</span>
              <span className="card-value" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{formatCurrency(totalAmount)}</span>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <Wine size={32} />
              </div>
            </div>
            <div className="card green-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Supplier Comm.</span>
              <span className="card-value" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{formatCurrency(estimatedCommission)}</span>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <DollarSign size={32} />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ margin: 0, padding: '1.5rem' }}>
            <div className="section-title" style={{ marginBottom: '1.25rem' }}>KOT Transaction History</div>
            
            {/* Filters Row */}
            <div className="filter-bar" style={{ gap: '0.75rem' }}>
              <div className="form-group" style={{ flexGrow: 1, minWidth: '150px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem' }}>Search Bill No.</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="e.g. KOT-104" 
                    value={filterSearch} 
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="form-control"
                    style={{ width: '100%', paddingRight: '2rem' }}
                  />
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>
              
              <div className="form-group" style={{ minWidth: '140px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem' }}>Supplier</label>
                <select 
                  value={filterSupplier} 
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="form-control"
                >
                  <option value="">All Staff</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ minWidth: '120px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem' }}>From Date</label>
                <input 
                  type="date" 
                  value={filterStartDate} 
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="form-control"
                  style={{ padding: '0.65rem 0.5rem' }}
                />
              </div>

              <div className="form-group" style={{ minWidth: '120px', marginBottom: 0 }}>
                <label style={{ fontSize: '0.75rem' }}>To Date</label>
                <input 
                  type="date" 
                  value={filterEndDate} 
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="form-control"
                  style={{ padding: '0.65rem 0.5rem' }}
                />
              </div>
            </div>

            {loading && bills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                Loading transactions...
              </div>
            ) : filteredBills.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No records match selected filters.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Bill Number</th>
                      <th>Supplier</th>
                      <th>Date / Time</th>
                      <th>Amount</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((bill) => (
                      <tr key={bill.id}>
                        <td style={{ fontWeight: 600 }}>{bill.bill_number}</td>
                        <td>{bill.supplier_name}</td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>{bill.date}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bill.time}</div>
                        </td>
                        <td className="text-gold">{formatCurrency(bill.amount)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleDelete(bill.id, bill.bill_number)} className="btn btn-danger btn-icon" title="Delete record">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
