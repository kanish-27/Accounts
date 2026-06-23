import React, { useState, useEffect } from 'react';
import { Wine, Plus, Search, Filter, Trash2, Calendar, User, DollarSign, Upload, X, CheckCircle, FileSpreadsheet } from 'lucide-react';

export default function KotBills({ showToast, API_BASE }) {
  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // CSV Import States
  const [csvFile, setCsvFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedResults, setParsedResults] = useState(null);
  const [importing, setImporting] = useState(false);

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

  const processCSVData = (lines) => {
    if (lines.length < 2) {
      return { error: 'CSV file is empty or missing data rows.' };
    }

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

    if (categoryIndex === -1) {
      return { error: 'Could not find "category_name" column in CSV.' };
    }
    if (assignIndex === -1) {
      return { error: 'Could not find "assign_to" column in CSV.' };
    }
    if (totalIndex === -1) {
      return { error: 'Could not find "item_total" column in CSV.' };
    }

    let ignoredCharges = 0;
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

    const isSupplierMatch = (assignTo, supplierName) => {
      if (!assignTo || !supplierName) return false;
      const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      return clean(assignTo) === clean(supplierName);
    };

    const findSupplier = (assignTo) => {
      if (!assignTo) return null;
      return suppliers.find(s => isSupplierMatch(assignTo, s.name));
    };

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 1 && row[0] === '') continue;
      if (row.length <= Math.max(categoryIndex, assignIndex, totalIndex)) continue;

      const category = row[categoryIndex] || '';
      const assignTo = row[assignIndex] || '';
      const itemTotalStr = row[totalIndex] || '';
      const dateStr = dateIndex !== -1 ? row[dateIndex] : '';

      // Reject if category_name represents charges (e.g. "charges", "charge", "service charges", etc.)
      const catLower = category.trim().toLowerCase();
      if (catLower === 'charges' || catLower === 'charge' || catLower.includes('charge')) {
        ignoredCharges++;
        continue;
      }

      const matchedSup = findSupplier(assignTo);
      if (matchedSup) {
        matchedSupplierCount++;
        const cleanAmt = itemTotalStr.replace(/[^0-9.]/g, '');
        const amt = parseFloat(cleanAmt) || 0;
        const parsedDate = parseDateToYYYYMMDD(dateStr) || new Date().toISOString().split('T')[0];

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
      return {
        supplier_id: g.supplierId,
        supplier_name: g.supplierName,
        date: g.date,
        amount: g.amount,
        count: g.count,
        bill_number: `CSV-${formattedDateForBill}-${g.supplierId}`
      };
    });

    groupedBills.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.supplier_name.localeCompare(b.supplier_name);
    });

    return {
      totalRows,
      ignoredCharges,
      matchedSupplierCount,
      unmatchedSupplierCount,
      matchedRows,
      groupedBills
    };
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
      const parsedLines = parseCSV(text);
      const results = processCSVData(parsedLines);
      setParsedResults(results);
      if (results.error) {
        showToast(results.error, 'error');
      } else {
        showToast(`Successfully parsed CSV. Matched ${results.matchedSupplierCount} items.`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!parsedResults || !parsedResults.groupedBills || parsedResults.groupedBills.length === 0) {
      showToast('No matching records to import', 'error');
      return;
    }

    setImporting(true);
    try {
      const payload = {
        bills: parsedResults.groupedBills.map(b => ({
          supplier_id: b.supplier_id.toString(),
          bill_number: b.bill_number,
          amount: b.amount,
          date: b.date,
          time: '12:00',
          remarks: `CSV Import - ${b.count} items (Excluded ${parsedResults.ignoredCharges} charges)`
        }))
      };

      const res = await fetch(`${API_BASE}/kot/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to import KOT bills');
      const data = await res.json();
      showToast(`Successfully imported ${data.length} KOT bills`, 'success');
      
      setCsvFile(null);
      setParsedResults(null);
      fetchBills();
    } catch (err) {
      console.error(err);
      showToast('Error importing KOT bills', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Re-process CSV when suppliers list changes
  useEffect(() => {
    if (csvFile && suppliers.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const parsedLines = parseCSV(text);
        const results = processCSVData(parsedLines);
        setParsedResults(results);
      };
      reader.readAsText(csvFile);
    } else {
      setParsedResults(null);
    }
  }, [csvFile, suppliers]);



  const handleDelete = async (id, billNo) => {
    if (!window.confirm(`Are you sure you want to delete KOT Bill: ${billNo}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/kot/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete KOT bill');
      showToast(`KOT Bill ${billNo} deleted`, 'success');
      fetchBills();
    } catch (err) {
      console.error(err);
      showToast('Error deleting KOT bill', 'error');
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
                  Requires columns: category_name, assign_to, item_total
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
                    onClick={() => { setCsvFile(null); setParsedResults(null); }}
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
                                      <td style={{ fontWeight: 600 }}>{b.supplier_name}</td>
                                      <td>{b.date ? b.date.split('-').reverse().map((x, i) => i === 2 ? x.slice(2) : x).join('/') : ''}</td>
                                      <td>{b.count} rows</td>
                                      <td className="text-gold" style={{ textAlign: 'right', fontWeight: 600 }}>
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
