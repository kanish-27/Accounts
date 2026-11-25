import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Calendar, DollarSign, Search, Filter, ArrowUpRight, 
  BarChart3, Banknote, Smartphone, Edit3, Upload, X, CheckCircle, 
  ChevronLeft, ChevronRight, Printer, AlertCircle, FileSpreadsheet, RefreshCw
} from 'lucide-react';

export default function SalesCollections({ showToast, API_BASE }) {
  // Navigation & View Mode: 'daily' | 'monthly'
  const [viewMode, setViewMode] = useState('daily');
  
  // Date & Month Selectors
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Data States
  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filtering & Search in Day View
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('amount_desc'); // 'amount_desc' | 'qty_desc' | 'name_asc'

  // Modal: Edit Cash / UPI Split
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [modalCash, setModalCash] = useState(0);
  const [modalUpi, setModalUpi] = useState(0);
  const [savingSplit, setSavingSplit] = useState(false);

  // Modal: Direct CSV Upload in this tab
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadParsed, setUploadParsed] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Modal: Edit Product Quantity / Details
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductQty, setEditProductQty] = useState(0);
  const [editProductAmt, setEditProductAmt] = useState(0);
  const [savingProduct, setSavingProduct] = useState(false);

  // Currency Formatter
  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt || 0);
  };

  // Fetch Day Data
  const fetchDailySales = async (date) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/sales/daily?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch daily sales');
      const data = await res.json();
      setDailyData(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading daily sales', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Month Data
  const fetchMonthlySales = async (month) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/sales/month?month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch monthly sales');
      const data = await res.json();
      setMonthlyData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast('Error loading monthly sales', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'daily') {
      fetchDailySales(selectedDate);
    } else {
      fetchMonthlySales(selectedMonth);
    }
  }, [viewMode, selectedDate, selectedMonth]);

  // Date Navigation Helpers
  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const shiftMonth = (deltaMonths) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + deltaMonths, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  // Open Cash/UPI adjustment modal
  const handleOpenSplitModal = () => {
    if (!dailyData) return;
    setModalCash(dailyData.cash_amount || 0);
    setModalUpi(dailyData.upi_amount || 0);
    setShowSplitModal(true);
  };

  const handleSaveSplit = async () => {
    try {
      setSavingSplit(true);
      const res = await fetch(`${API_BASE}/sales/daily/${selectedDate}/collection`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cash_amount: modalCash,
          upi_amount: modalUpi
        })
      });
      if (!res.ok) throw new Error('Failed to update collection split');
      const updated = await res.json();
      setDailyData(updated);
      setShowSplitModal(false);
      showToast('Collection split updated successfully', 'success');
      if (viewMode === 'monthly') fetchMonthlySales(selectedMonth);
    } catch (err) {
      console.error(err);
      showToast('Error updating collection split', 'error');
    } finally {
      setSavingSplit(false);
    }
  };

  // Edit individual product quantity / amount
  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod);
    setEditProductQty(prod.quantity || 0);
    setEditProductAmt(prod.amount || 0);
    setShowEditProductModal(true);
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    try {
      setSavingProduct(true);
      const res = await fetch(`${API_BASE}/sales/daily/${selectedDate}/product`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: editingProduct.name,
          quantity: parseFloat(editProductQty) || 0,
          amount: parseFloat(editProductAmt) || 0
        })
      });
      if (!res.ok) throw new Error('Failed to update product details');
      const updated = await res.json();
      setDailyData(updated);
      setShowEditProductModal(false);
      showToast(`Updated "${editingProduct.name}" to ${editProductQty} units`, 'success');
      if (viewMode === 'monthly') fetchMonthlySales(selectedMonth);
    } catch (err) {
      console.error(err);
      showToast('Error updating product details', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  // CSV parsing for direct upload
  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    const cleanField = (val) => (!val ? '' : val.trim().replace(/^["']|["']$/g, '').trim());

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
        if (c === '\r' && next === '\n') i++;
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

  const processSalesFromCSV = (lines) => {
    if (lines.length < 2) return { error: 'CSV file is empty or missing data rows.' };

    const headers = lines[0].map(h => (h || '').toLowerCase().replace(/[\s_\-.]+/g, ''));
    const categoryIndex = headers.findIndex(h => h.includes('category'));
    const itemIndex = headers.findIndex(h => (h.includes('item') || h.includes('product')) &&
      !['total', 'price', 'qty', 'quantity', 'id', 'code', 'amount', 'tax', 'discount', 'sum', 'count'].some(w => h.includes(w)));
    const totalIndex = headers.findIndex(h => h.includes('itemtotal') || h.includes('total') || h.includes('amount'));

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

    const payModeIndex = headers.findIndex(h => (h.includes('pay') || h.includes('tender') || h.includes('mode')) && !h.includes('amount') && !h.includes('total'));
    const cashIndex = headers.findIndex(h => h === 'cash' || h === 'cashamount');
    const upiIndex = headers.findIndex(h => h === 'upi' || h === 'upiamount' || h === 'gpay' || h === 'online');

    if (itemIndex === -1 || totalIndex === -1) {
      return { error: 'Could not find required item name and total amount columns in CSV.' };
    }

    const productMap = new Map();
    let totalAmt = 0;
    let totalUnits = 0;
    let cashAmt = 0;
    let upiAmt = 0;
    let hasPayMode = false;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length <= 1) continue;
      const itemName = (row[itemIndex] || '').trim();
      if (!itemName) continue;

      const category = (categoryIndex !== -1 ? (row[categoryIndex] || '').trim() : '') || 'General';
      const amtStr = row[totalIndex] || '';
      const amt = parseFloat(amtStr.replace(/[^0-9.]/g, '')) || 0;

      let qty = 0;
      if (qtyIndex !== -1 && row[qtyIndex] !== undefined && row[qtyIndex] !== null && row[qtyIndex] !== '') {
        const q = parseFloat(String(row[qtyIndex]).replace(/[^0-9.]/g, ''));
        if (!isNaN(q) && q > 0) qty = q;
      }

      // Fallback: calculate from item_total / item_price if quantity column was missing
      if (qty <= 0 && priceIndex !== -1 && row[priceIndex] !== undefined && amt > 0) {
        const pr = parseFloat(String(row[priceIndex]).replace(/[^0-9.]/g, ''));
        if (!isNaN(pr) && pr > 0) {
          const derived = Math.round(amt / pr);
          if (derived > 0) qty = derived;
        }
      }

      if (qty <= 0) {
        qty = 1;
      }

      const cleanName = itemName;
      totalAmt += amt;
      totalUnits += qty;

      const pKey = cleanName.toLowerCase();
      if (!productMap.has(pKey)) {
        productMap.set(pKey, {
          name: cleanName,
          category,
          quantity: 0,
          amount: 0
        });
      }
      const p = productMap.get(pKey);
      p.quantity += qty;
      p.amount += amt;

      if (cashIndex !== -1 || upiIndex !== -1) {
        const rc = cashIndex !== -1 ? (parseFloat((row[cashIndex] || '').replace(/[^0-9.]/g, '')) || 0) : 0;
        const ru = upiIndex !== -1 ? (parseFloat((row[upiIndex] || '').replace(/[^0-9.]/g, '')) || 0) : 0;
        if (rc > 0 || ru > 0) {
          cashAmt += rc;
          upiAmt += ru;
          hasPayMode = true;
        }
      } else if (payModeIndex !== -1) {
        const pMode = (row[payModeIndex] || '').toLowerCase();
        if (
          pMode.includes('upi') || pMode.includes('gpay') || pMode.includes('phonepe') ||
          pMode.includes('online') || pMode.includes('qr') || pMode.includes('card')
        ) {
          upiAmt += amt;
          hasPayMode = true;
        } else if (pMode.includes('cash')) {
          cashAmt += amt;
          hasPayMode = true;
        }
      }
    }

    if (!hasPayMode) {
      cashAmt = totalAmt;
      upiAmt = 0;
    } else {
      const accounted = cashAmt + upiAmt;
      if (accounted < totalAmt) cashAmt += (totalAmt - accounted);
    }

    const products = Array.from(productMap.values()).map(p => ({
      name: p.name,
      category: p.category,
      quantity: Math.round(p.quantity * 100) / 100,
      amount: Math.round(p.amount * 100) / 100
    }));
    products.sort((a, b) => b.amount - a.amount);

    return {
      total_amount: Math.round(totalAmt * 100) / 100,
      cash_amount: Math.round(cashAmt * 100) / 100,
      upi_amount: Math.round(upiAmt * 100) / 100,
      total_items_count: Math.round(totalUnits * 100) / 100,
      products,
      hasPayMode
    };
  };

  const handleFileSelected = (file) => {
    if (!file.name.endsWith('.csv')) {
      showToast('Only CSV files are supported', 'error');
      return;
    }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = parseCSV(text);
      const parsed = processSalesFromCSV(lines);
      setUploadParsed(parsed);
      if (parsed.error) {
        showToast(parsed.error, 'error');
      } else {
        showToast(`Parsed ${parsed.products.length} products (${parsed.total_items_count} units)`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadParsed || uploadParsed.error) {
      showToast('No valid sales data to import', 'error');
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(`${API_BASE}/sales/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: uploadDate,
          total_amount: uploadParsed.total_amount,
          cash_amount: uploadParsed.cash_amount,
          upi_amount: uploadParsed.upi_amount,
          total_items_count: uploadParsed.total_items_count,
          products: uploadParsed.products,
          source: 'direct_upload'
        })
      });
      if (!res.ok) throw new Error('Failed to save sales record');
      showToast(`Sales record saved for ${uploadDate}`, 'success');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadParsed(null);
      setSelectedDate(uploadDate);
      fetchDailySales(uploadDate);
      if (viewMode === 'monthly') fetchMonthlySales(selectedMonth);
    } catch (err) {
      console.error(err);
      showToast('Error saving sales record', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Filtered & Sorted Day Products
  const categories = dailyData && Array.isArray(dailyData.products) 
    ? Array.from(new Set(dailyData.products.map(p => p.category || 'General')))
    : [];

  const filteredProducts = (dailyData?.products || []).filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'all' || (p.category || 'General') === categoryFilter;
    return matchesSearch && matchesCat;
  }).sort((a, b) => {
    if (sortBy === 'amount_desc') return b.amount - a.amount;
    if (sortBy === 'qty_desc') return b.quantity - a.quantity;
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    return 0;
  });

  // Calculate Monthly Totals
  const monthTotalRevenue = monthlyData.reduce((sum, d) => sum + (d.total_amount || 0), 0);
  const monthCashTotal = monthlyData.reduce((sum, d) => sum + (d.cash_amount || 0), 0);
  const monthUpiTotal = monthlyData.reduce((sum, d) => sum + (d.upi_amount || 0), 0);
  const monthUnitsTotal = monthlyData.reduce((sum, d) => sum + (d.total_items_count || 0), 0);

  // Aggregate Top Monthly Products
  const monthlyProductMap = new Map();
  monthlyData.forEach(d => {
    (d.products || []).forEach(p => {
      const key = p.name.toLowerCase();
      if (!monthlyProductMap.has(key)) {
        monthlyProductMap.set(key, {
          name: p.name,
          category: p.category || 'General',
          quantity: 0,
          amount: 0
        });
      }
      const obj = monthlyProductMap.get(key);
      obj.quantity += (p.quantity || 0);
      obj.amount += (p.amount || 0);
    });
  });

  const topMonthlyProducts = Array.from(monthlyProductMap.values())
    .sort((a, b) => b.amount - a.amount);

  // Format Date for table
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const getDayName = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="content-header" style={{ marginBottom: '1.25rem' }}>
        <div className="header-title">
          <h1>Sales & Collections</h1>
          <p>Product sales volume, daily receipts, and UPI vs Cash collections.</p>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${viewMode === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('daily')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Calendar size={15} /> Day View
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('monthly')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <BarChart3 size={15} /> Month View
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            title="Upload POS Sales CSV directly"
          >
            <Upload size={15} /> Upload CSV
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ==================== 1. DAILY VIEW ====================== */}
      {/* ========================================================= */}
      {viewMode === 'daily' && (
        <div>
          {/* Controls Bar */}
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon"
                onClick={() => shiftDate(-1)}
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-control"
                style={{ width: 'auto', fontWeight: 600 }}
              />

              <button 
                type="button" 
                className="btn btn-secondary btn-icon"
                onClick={() => shiftDate(1)}
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              >
                Today
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => fetchDailySales(selectedDate)}
                title="Refresh data"
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>

            {dailyData && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleOpenSplitModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Edit3 size={14} /> Adjust Cash / UPI Split
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => window.print()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            )}
          </div>

          {/* Daily KPI Summary Cards */}
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: '1.5rem' }}>
            {/* Total Received */}
            <div className="card gold-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Total Received Today</span>
              <span className="card-value" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {formatCurrency(dailyData?.total_amount || 0)}
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {formatDateDisplay(selectedDate)} ({getDayName(selectedDate)})
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <DollarSign size={28} />
              </div>
            </div>

            {/* Cash Collection */}
            <div className="card green-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Cash Collection</span>
              <span className="card-value text-green" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {formatCurrency(dailyData?.cash_amount || 0)}
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {dailyData?.total_amount ? `${Math.round(((dailyData.cash_amount || 0) / dailyData.total_amount) * 100)}% of today's total` : '0%'}
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <Banknote size={28} />
              </div>
            </div>

            {/* UPI Collection */}
            <div className="card blue-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>UPI / Online Collection</span>
              <span className="card-value text-gold" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {formatCurrency(dailyData?.upi_amount || 0)}
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {dailyData?.total_amount ? `${Math.round(((dailyData.upi_amount || 0) / dailyData.total_amount) * 100)}% of today's total` : '0%'}
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <Smartphone size={28} />
              </div>
            </div>

            {/* Total Units Sold */}
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Products Sold</span>
              <span className="card-value" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {dailyData?.total_items_count || 0} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Units</span>
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {dailyData?.products?.length || 0} unique items
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <ShoppingBag size={28} />
              </div>
            </div>
          </div>

          {/* Product Sales Section */}
          {!dailyData || !dailyData.products || dailyData.products.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <ShoppingBag size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                No Sales Recorded for {formatDateDisplay(selectedDate)}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                When you upload the daily POS CSV file in the <strong>KOT Bills Log</strong> tab, sales and product quantities are automatically calculated and recorded here. You can also upload a CSV directly.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setUploadDate(selectedDate);
                  setShowUploadModal(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Upload size={16} /> Upload Sales CSV for {formatDateDisplay(selectedDate)}
              </button>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              {/* Table Filters Header */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <div className="section-title" style={{ margin: 0 }}>Item Sales Breakdown</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    How much quantity of each product went out on {formatDateDisplay(selectedDate)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  {/* Search */}
                  <div style={{ position: 'relative', width: '200px' }}>
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="form-control"
                      style={{ paddingRight: '2rem', fontSize: '0.8rem' }}
                    />
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  {/* Category Filter */}
                  {categories.length > 1 && (
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.8rem', width: 'auto' }}
                    >
                      <option value="all">All Categories ({categories.length})</option>
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}

                  {/* Sort By */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="form-control"
                    style={{ fontSize: '0.8rem', width: 'auto' }}
                  >
                    <option value="amount_desc">Highest Revenue</option>
                    <option value="qty_desc">Highest Quantity</option>
                    <option value="name_asc">Alphabetical (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'center' }}>Quantity Sold</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                      <th style={{ width: '140px' }}>Share of Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p, idx) => {
                      const sharePct = dailyData.total_amount > 0 
                        ? Math.round((p.amount / dailyData.total_amount) * 1000) / 10 
                        : 0;

                      return (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                          <td>
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
                              {p.category || 'General'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.12)', padding: '2px 10px', borderRadius: '4px' }}>
                                {p.quantity}
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                style={{ padding: '0.2rem', height: '22px', width: '22px', borderRadius: '4px' }}
                                title={`Edit quantity for ${p.name}`}
                                onClick={() => handleOpenEditProduct(p)}
                              >
                                <Edit3 size={11} />
                              </button>
                            </div>
                          </td>
                          <td className="text-gold" style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(p.amount)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flexGrow: 1, height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(sharePct, 100)}%`, height: '100%', background: 'var(--accent-gold-glow, #f59e0b)', borderRadius: '3px' }}></div>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '32px' }}>{sharePct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', fontWeight: 700 }}>
                      <td colSpan="3" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>
                        Daily Total ({filteredProducts.length} items):
                      </td>
                      <td style={{ textAlign: 'center', color: '#60a5fa', fontWeight: 700 }}>
                        {filteredProducts.reduce((sum, p) => sum + (p.quantity || 0), 0)} Units
                      </td>
                      <td className="text-gold" style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                        {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.amount || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ==================== 2. MONTH VIEW ====================== */}
      {/* ========================================================= */}
      {viewMode === 'monthly' && (
        <div>
          {/* Month Controls Bar */}
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon"
                onClick={() => shiftMonth(-1)}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              
              <input 
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="form-control"
                style={{ width: 'auto', fontWeight: 600 }}
              />

              <button 
                type="button" 
                className="btn btn-secondary btn-icon"
                onClick={() => shiftMonth(1)}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              >
                Current Month
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => fetchMonthlySales(selectedMonth)}
                title="Refresh month data"
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
              >
                <Printer size={14} /> Print Monthly Report
              </button>
            </div>
          </div>

          {/* Monthly KPI Summary Cards */}
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: '1.5rem' }}>
            <div className="card gold-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Total Monthly Revenue</span>
              <span className="card-value" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {formatCurrency(monthTotalRevenue)}
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Across {monthlyData.length} recorded sales days
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <DollarSign size={28} />
              </div>
            </div>

            <div className="card green-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Month Cash Total</span>
              <span className="card-value text-green" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {formatCurrency(monthCashTotal)}
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {monthTotalRevenue ? `${Math.round((monthCashTotal / monthTotalRevenue) * 100)}% of monthly collections` : '0%'}
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <Banknote size={28} />
              </div>
            </div>

            <div className="card blue-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Month UPI / Online Total</span>
              <span className="card-value text-gold" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {formatCurrency(monthUpiTotal)}
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {monthTotalRevenue ? `${Math.round((monthUpiTotal / monthTotalRevenue) * 100)}% of monthly collections` : '0%'}
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <Smartphone size={28} />
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Products Sold in Month</span>
              <span className="card-value" style={{ fontSize: '1.65rem', marginBottom: '0.2rem' }}>
                {monthUnitsTotal} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Units</span>
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {topMonthlyProducts.length} unique items sold
              </div>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <ShoppingBag size={28} />
              </div>
            </div>
          </div>

          {/* Month Data Grid: Day-by-Day Table + Top Products */}
          {monthlyData.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <Calendar size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                No Sales Records Found for {selectedMonth}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                Daily sales imported via KOT CSV files will accumulate here to give you a full monthly picture of collections, cash vs UPI split, and top moving products.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(320px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Left Column: Day-by-Day Table */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div className="section-title" style={{ marginBottom: '0.25rem' }}>Daily Collections Log</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Day-by-day cash, UPI, and product volume
                </div>

                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th style={{ textAlign: 'center' }}>Products</th>
                        <th style={{ textAlign: 'right' }}>Cash</th>
                        <th style={{ textAlign: 'right' }}>UPI</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map(d => (
                        <tr key={d.date}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{formatDateDisplay(d.date)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{getDayName(d.date)}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600 }}>
                            {d.total_items_count || 0}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: '#10b981' }}>
                            {formatCurrency(d.cash_amount)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--accent-gold-glow)' }}>
                            {formatCurrency(d.upi_amount)}
                          </td>
                          <td className="text-gold" style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                            {formatCurrency(d.total_amount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(d.date);
                                setViewMode('daily');
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                              title="View detailed product sales for this day"
                            >
                              View Day
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.03)', fontWeight: 700 }}>
                        <td style={{ color: 'var(--text-primary)' }}>Total ({monthlyData.length} Days)</td>
                        <td style={{ textAlign: 'center', color: '#60a5fa' }}>{monthUnitsTotal}</td>
                        <td style={{ textAlign: 'right', color: '#10b981' }}>{formatCurrency(monthCashTotal)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-gold-glow)' }}>{formatCurrency(monthUpiTotal)}</td>
                        <td className="text-gold" style={{ textAlign: 'right' }}>{formatCurrency(monthTotalRevenue)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Right Column: Month Top Products */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div className="section-title" style={{ marginBottom: '0.25rem' }}>Top Products of the Month</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Ranked by volume and revenue for {selectedMonth}
                </div>

                <div className="table-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35px' }}>#</th>
                        <th>Product</th>
                        <th style={{ textAlign: 'center' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Total Revenue</th>
                        <th style={{ textAlign: 'right' }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topMonthlyProducts.map((p, idx) => {
                        const pct = monthTotalRevenue > 0 
                          ? Math.round((p.amount / monthTotalRevenue) * 1000) / 10 
                          : 0;

                        return (
                          <tr key={idx}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{p.name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.category}</div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#60a5fa' }}>
                              {p.quantity}
                            </td>
                            <td className="text-gold" style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>
                              {formatCurrency(p.amount)}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ============= MODAL: ADJUST CASH / UPI SPLIT ============ */}
      {/* ========================================================= */}
      {showSplitModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Adjust Cash / UPI Split
              </h3>
              <button 
                type="button" 
                onClick={() => setShowSplitModal(false)}
                className="btn btn-icon btn-secondary"
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Adjust the payment receipt split for <strong>{formatDateDisplay(selectedDate)}</strong>.
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid var(--accent-gold-border)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Total Day Receipts:</span>
                <span className="text-gold">{formatCurrency(dailyData?.total_amount || 0)}</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <Banknote size={15} color="#10b981" /> Cash Amount (₹)
              </label>
              <input
                type="number"
                value={modalCash}
                onChange={(e) => setModalCash(parseFloat(e.target.value) || 0)}
                className="form-control"
                min="0"
                step="1"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <Smartphone size={15} color="#f59e0b" /> UPI / Online Amount (₹)
              </label>
              <input
                type="number"
                value={modalUpi}
                onChange={(e) => setModalUpi(parseFloat(e.target.value) || 0)}
                className="form-control"
                min="0"
                step="1"
              />
            </div>

            {/* Quick Balance Helpers */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.72rem', flex: 1, padding: '0.3rem' }}
                onClick={() => {
                  const rem = Math.max(0, (dailyData?.total_amount || 0) - modalCash);
                  setModalUpi(rem);
                }}
              >
                Put Balance into UPI
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.72rem', flex: 1, padding: '0.3rem' }}
                onClick={() => {
                  const rem = Math.max(0, (dailyData?.total_amount || 0) - modalUpi);
                  setModalCash(rem);
                }}
              >
                Put Balance into Cash
              </button>
            </div>

            <div style={{ fontSize: '0.75rem', color: (modalCash + modalUpi === (dailyData?.total_amount || 0)) ? '#10b981' : '#f59e0b', marginBottom: '1rem', fontWeight: 600 }}>
              Sum: {formatCurrency(modalCash + modalUpi)} 
              {modalCash + modalUpi !== (dailyData?.total_amount || 0) && (
                <span> (Diff: {formatCurrency((dailyData?.total_amount || 0) - (modalCash + modalUpi))})</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowSplitModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSplit}
                disabled={savingSplit}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {savingSplit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ============= MODAL: DIRECT CSV UPLOAD ================== */}
      {/* ========================================================= */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                Upload POS Sales CSV
              </h3>
              <button 
                type="button" 
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadParsed(null); }}
                className="btn btn-icon btn-secondary"
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Select Sales Date *
              </label>
              <input
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="form-control"
              />
            </div>

            {!uploadFile ? (
              <div
                className={`csv-upload-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelected(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => document.getElementById('sales-csv-input').click()}
                style={{ padding: '1.5rem 1rem' }}
              >
                <input
                  id="sales-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleFileSelected(e.target.files[0]);
                  }}
                  style={{ display: 'none' }}
                />
                <Upload className="csv-upload-icon" size={28} />
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Drag & Drop POS CSV File</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>or click to browse</div>
              </div>
            ) : (
              <div>
                <div className="csv-file-info" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileSpreadsheet size={16} className="text-gold" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{uploadFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUploadFile(null); setUploadParsed(null); }}
                    className="btn btn-icon btn-danger"
                    style={{ padding: '0.2rem' }}
                  >
                    <X size={12} />
                  </button>
                </div>

                {uploadParsed && !uploadParsed.error && (
                  <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total Amount:</span>
                      <strong className="text-gold">{formatCurrency(uploadParsed.total_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Cash Received:</span>
                      <strong style={{ color: '#10b981' }}>{formatCurrency(uploadParsed.cash_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>UPI Received:</span>
                      <strong style={{ color: '#f59e0b' }}>{formatCurrency(uploadParsed.upi_amount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Products / Units:</span>
                      <strong>{uploadParsed.products.length} products ({uploadParsed.total_items_count} units)</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadParsed(null); }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={uploading || !uploadParsed || !!uploadParsed.error}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {uploading ? 'Saving...' : 'Confirm & Save Sales'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ============= MODAL: EDIT PRODUCT DETAILS =============== */}
      {/* ========================================================= */}
      {showEditProductModal && editingProduct && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  Edit Product Quantity
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {editingProduct.name} ({editingProduct.category || 'General'})
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowEditProductModal(false); setEditingProduct(null); }}
                className="btn btn-icon btn-secondary"
                style={{ padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Total Quantity Sold (Units) *
              </label>
              <input
                type="number"
                value={editProductQty}
                onChange={(e) => setEditProductQty(e.target.value)}
                className="form-control"
                min="0"
                step="1"
                placeholder="e.g. 56"
                autoFocus
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                Actual units sold across all orders on {formatDateDisplay(selectedDate)}.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                Total Sales Amount (₹)
              </label>
              <input
                type="number"
                value={editProductAmt}
                onChange={(e) => setEditProductAmt(e.target.value)}
                className="form-control"
                min="0"
                step="1"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setShowEditProductModal(false); setEditingProduct(null); }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProductEdit}
                disabled={savingProduct}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {savingProduct ? 'Saving...' : 'Update Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
