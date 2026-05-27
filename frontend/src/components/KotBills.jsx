import React, { useState, useEffect } from 'react';
import { Wine, Plus, Search, Filter, Trash2, Calendar, User, DollarSign } from 'lucide-react';

export default function KotBills({ showToast, API_BASE }) {
  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // New KOT Form State
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [remarks, setRemarks] = useState('');

  // Filters State
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterSearch, setFilterSearch] = useState('');

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE}/suppliers?status=active`);
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

  // Set default time to current on focus/load
  useEffect(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setTime(`${hours}:${minutes}`);
  }, [bills]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!supplierId) {
      showToast('Please select a supplier', 'error');
      return;
    }
    if (!billNumber.trim()) {
      showToast('Please enter KOT bill number', 'error');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid KOT amount', 'error');
      return;
    }

    const payload = {
      supplier_id: parseInt(supplierId),
      bill_number: billNumber.trim(),
      amount: parseFloat(amount),
      date,
      time,
      remarks: remarks.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/kot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to add KOT bill');
      showToast(`KOT Bill ${billNumber} logged successfully`, 'success');
      
      // Reset form
      setBillNumber('');
      setAmount('');
      setRemarks('');
      
      // Refresh list
      fetchBills();
    } catch (err) {
      console.error(err);
      showToast('Error saving KOT bill', 'error');
    }
  };

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

      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '2rem' }}>
        {/* Left: Input Form Card */}
        <div className="card gold-header" style={{ height: 'fit-content' }}>
          <div className="section-title">
            <Wine size={18} color="var(--accent-gold-glow)" /> Log KOT Bill
          </div>
          
          <form onSubmit={handleSubmit} style={{ marginTop: '0.5rem' }}>
            <div className="form-group">
              <label>Select Supplier *</label>
              <select 
                value={supplierId} 
                onChange={(e) => setSupplierId(e.target.value)}
                className="form-control"
                required
              >
                <option value="">-- Choose Staff --</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name} (₹{sup.basic_daily_wage}/day)</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>KOT Bill Number *</label>
              <input 
                type="text" 
                value={billNumber} 
                onChange={(e) => setBillNumber(e.target.value)} 
                className="form-control" 
                placeholder="e.g. KOT-1049"
                required
              />
            </div>

            <div className="form-group">
              <label>Bill Amount (₹) *</label>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="form-control" 
                placeholder="e.g. 10000"
                min="1"
                step="0.01"
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Est. Commission (5%): <strong style={{ color: 'var(--accent-gold-glow)' }}>{formatCurrency(amount ? amount * 0.05 : 0)}</strong>
              </span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input 
                  type="time" 
                  value={time} 
                  onChange={(e) => setTime(e.target.value)} 
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Remarks</label>
              <input 
                type="text" 
                value={remarks} 
                onChange={(e) => setRemarks(e.target.value)} 
                className="form-control" 
                placeholder="Table no, extra info, etc."
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              <Plus size={18} /> Add KOT Entry
            </button>
          </form>
        </div>

        {/* Right: Interactive Logs Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Summary Mini Cards */}
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 0 }}>
            <div className="card gold-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Total KOT Sum</span>
              <span className="card-value" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{formatCurrency(totalAmount)}</span>
              <div className="card-icon-wrapper" style={{ top: '1rem', right: '1rem' }}>
                <Wine size={32} />
              </div>
            </div>
            <div className="card green-header" style={{ padding: '1rem 1.25rem' }}>
              <span className="card-title" style={{ fontSize: '0.75rem' }}>Supplier Comm. (5%)</span>
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
