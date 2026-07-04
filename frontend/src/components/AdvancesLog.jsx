/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Search, Trash2, Calendar, DollarSign, Plus, RefreshCw, Users } from 'lucide-react';

export default function AdvancesLog({ showToast, API_BASE }) {
  const [advances, setAdvances] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters State
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [filterType, setFilterType] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Log Advance Modal State
  const [showLogModal, setShowLogModal] = useState(false);
  const [logSupplierId, setLogSupplierId] = useState('');
  const [logAmount, setLogAmount] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logRemarks, setLogRemarks] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch advances
      const advRes = await fetch(`${API_BASE}/advances`);
      if (!advRes.ok) throw new Error('Failed to fetch advances');
      const advData = await advRes.json();

      // Fetch suppliers to map roles/types
      const supRes = await fetch(`${API_BASE}/suppliers`);
      if (!supRes.ok) throw new Error('Failed to fetch suppliers');
      const supData = await supRes.json();

      setAdvances(advData);
      setSuppliers(supData);
    } catch (err) {
      console.error(err);
      showToast('Error loading advances log data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format Helper
  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt);
  };

  // Map supplier details for quick lookup
  const supplierMap = {};
  suppliers.forEach(s => {
    supplierMap[s.id] = s;
  });

  // Get user-friendly role text and badge class
  const getRoleInfo = (type) => {
    switch (type) {
      case 'monthly':
        return { label: 'Monthly Worker', className: 'badge-monthly' };
      case 'cleaner':
        return { label: 'Cleaner/Master', className: 'badge-cleaner' };
      default:
        return { label: 'Supplier', className: 'badge-supplier' };
    }
  };

  // Filter and process advances
  const processedAdvances = advances.map(adv => {
    const sInfo = supplierMap[adv.supplier_id];
    return {
      ...adv,
      supplier_type: sInfo?.type || 'supplier',
      // If supplier_name from backend is "Unknown" or not present, fallback to local suppliers list
      supplier_name: adv.supplier_name && adv.supplier_name !== 'Unknown' 
        ? adv.supplier_name 
        : (sInfo?.name || 'Unknown Staff')
    };
  });

  // Apply filters
  const filteredAdvances = processedAdvances.filter(adv => {
    // Date filter
    if (filterDate && adv.date !== filterDate) return false;

    // Role type filter
    if (filterType !== 'all') {
      if (adv.supplier_type !== filterType) return false;
    }

    // Search query (matches supplier name or remarks)
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const nameMatch = adv.supplier_name.toLowerCase().includes(q);
      const remarkMatch = adv.remarks?.toLowerCase().includes(q) || false;
      if (!nameMatch && !remarkMatch) return false;
    }

    return true;
  });

  // Calculate Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const totalGivenToday = processedAdvances
    .filter(adv => adv.date === todayStr)
    .reduce((sum, adv) => sum + (adv.amount || 0), 0);

  const totalGivenOnSelectedDate = filterDate 
    ? processedAdvances
        .filter(adv => adv.date === filterDate)
        .reduce((sum, adv) => sum + (adv.amount || 0), 0)
    : processedAdvances.reduce((sum, adv) => sum + (adv.amount || 0), 0);

  const totalPendingRecoveries = processedAdvances
    .filter(adv => adv.status === 'pending')
    .reduce((sum, adv) => sum + (adv.amount || 0), 0);

  // Handle Deletion
  const handleDelete = async (id, name, amount) => {
    if (!window.confirm(`Are you sure you want to delete the pending advance of ${formatCurrency(amount)} given to ${name}?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/advances/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Advance record deleted successfully', 'success');
        fetchData();
      } else {
        showToast(data.error || 'Failed to delete advance', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error during deletion', 'error');
    }
  };

  // Handle Log Advance
  const handleLogAdvance = async (e) => {
    e.preventDefault();
    if (!logSupplierId) {
      showToast('Please select a supplier/staff', 'error');
      return;
    }
    const parsedAmount = parseFloat(logAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Please enter a valid positive amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: logSupplierId,
          amount: parsedAmount,
          date: logDate,
          remarks: logRemarks
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Logged advance of ${formatCurrency(parsedAmount)} successfully`, 'success');
        setShowLogModal(false);
        // Clear modal form states
        setLogSupplierId('');
        setLogAmount('');
        setLogDate(new Date().toISOString().split('T')[0]);
        setLogRemarks('');
        // Sync data
        fetchData();
      } else {
        showToast(data.error || 'Failed to log advance', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to backend server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const activeSuppliers = suppliers.filter(s => s.status === 'active');
  const sortedActiveSuppliers = [...activeSuppliers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="advances-log-container">
      <div className="content-header">
        <div className="header-title">
          <h1>Daily Cash Advances</h1>
          <p>Check and track all cash advances given to suppliers, monthly workers, and cleaners on any specific day.</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowLogModal(true)} className="btn btn-primary">
            <Plus size={18} />
            Log Cash Advance
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card gold-header" style={{ padding: '1.25rem 1.5rem', position: 'relative' }}>
          <span className="card-title" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {filterDate ? `Given on ${filterDate.split('-').reverse().join('/')}` : 'Total Given (All Dates)'}
          </span>
          <span className="card-value" style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0.5rem 0 0 0' }}>
            {formatCurrency(totalGivenOnSelectedDate)}
          </span>
          <div className="card-icon-wrapper" style={{ top: '1.25rem', right: '1.5rem' }}>
            <Calendar size={28} />
          </div>
        </div>

        <div className="card green-header" style={{ padding: '1.25rem 1.5rem', position: 'relative' }}>
          <span className="card-title" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Today's Total Given
          </span>
          <span className="card-value" style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0.5rem 0 0 0' }}>
            {formatCurrency(totalGivenToday)}
          </span>
          <div className="card-icon-wrapper" style={{ top: '1.25rem', right: '1.5rem' }}>
            <DollarSign size={28} />
          </div>
        </div>

        <div className="card crimson-header" style={{ padding: '1.25rem 1.5rem', position: 'relative' }}>
          <span className="card-title" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Pending Recoveries
          </span>
          <span className="card-value" style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0.5rem 0 0 0' }}>
            {formatCurrency(totalPendingRecoveries)}
          </span>
          <div className="card-icon-wrapper" style={{ top: '1.25rem', right: '1.5rem' }}>
            <Users size={28} />
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ margin: 0, padding: '1.5rem' }}>
        <div className="section-title" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Advances Log & History</span>
          <button 
            onClick={fetchData} 
            className="btn btn-secondary btn-icon" 
            title="Refresh database"
            style={{ padding: '0.4rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar" style={{ gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flexGrow: 1, minWidth: '200px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Search Name / Remarks</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="e.g. John Doe, family function..." 
                value={filterSearch} 
                onChange={(e) => setFilterSearch(e.target.value)}
                className="form-control"
                style={{ width: '100%', paddingRight: '2.25rem' }}
              />
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by Role</label>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="form-control"
              style={{ width: '100%' }}
            >
              <option value="all">All Roles</option>
              <option value="supplier">Suppliers</option>
              <option value="monthly">Monthly Workers</option>
              <option value="cleaner">Cleaners & Masters</option>
            </select>
          </div>

          <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Given</label>
            <input 
              type="date" 
              value={filterDate} 
              onChange={(e) => setFilterDate(e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '0.65rem 0.5rem' }}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: 0 }}>
            <button 
              onClick={() => setFilterDate('')} 
              className="btn btn-secondary" 
              style={{ height: '38px', padding: '0 1rem', fontSize: '0.85rem' }}
              title="View advances from all recorded dates"
            >
              Clear Date
            </button>
            <button 
              onClick={() => setFilterDate(new Date().toISOString().split('T')[0])} 
              className="btn btn-secondary" 
              style={{ height: '38px', padding: '0 1rem', fontSize: '0.85rem' }}
              title="Show advances given today"
            >
              Today
            </button>
          </div>
        </div>

        {/* Data Display */}
        {loading && advances.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <RefreshCw className="spin" size={24} style={{ marginBottom: '0.5rem' }} />
            <div>Loading advances ledger...</div>
          </div>
        ) : filteredAdvances.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            No advance records match your filters.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role / Category</th>
                  <th>Given Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Remarks / Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdvances.map((adv) => {
                  const roleInfo = getRoleInfo(adv.supplier_type);
                  const isPending = adv.status === 'pending';
                  
                  return (
                    <tr key={adv.id}>
                      <td style={{ fontWeight: 600 }}>{adv.supplier_name}</td>
                      <td>
                        <span className={`badge ${roleInfo.className}`} style={{ fontSize: '0.75rem' }}>
                          {roleInfo.label}
                        </span>
                      </td>
                      <td>{adv.date.split('-').reverse().join('/')}</td>
                      <td className="text-gold" style={{ fontWeight: 600 }}>{formatCurrency(adv.amount)}</td>
                      <td>
                        <span className={`badge ${isPending ? 'badge-absent' : 'badge-present'}`} style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                          {adv.status || 'pending'}
                        </span>
                      </td>
                      <td style={{ color: adv.remarks ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={adv.remarks}>
                        {adv.remarks || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isPending ? (
                          <button 
                            onClick={() => handleDelete(adv.id, adv.supplier_name, adv.amount)} 
                            className="btn btn-danger btn-icon" 
                            title="Delete pending advance"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Recovered
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Advance Modal */}
      {showLogModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Log Cash Advance</h2>
              <button onClick={() => setShowLogModal(false)} className="modal-close">✕</button>
            </div>
            
            <form onSubmit={handleLogAdvance}>
              <div className="form-group">
                <label>Select Staff / Supplier *</label>
                <select
                  value={logSupplierId}
                  onChange={(e) => setLogSupplierId(e.target.value)}
                  className="form-control"
                  required
                >
                  <option value="">-- Choose Person --</option>
                  {sortedActiveSuppliers.map(s => {
                    const rInfo = getRoleInfo(s.type);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({rInfo.label})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label>Advance Amount (₹) *</label>
                <input 
                  type="number" 
                  value={logAmount} 
                  onChange={(e) => setLogAmount(e.target.value)} 
                  className="form-control" 
                  placeholder="Enter amount..."
                  required
                  min="1"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Given Date *</label>
                <input 
                  type="date" 
                  value={logDate} 
                  onChange={(e) => setLogDate(e.target.value)} 
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label>Remarks / Notes</label>
                <input 
                  type="text" 
                  value={logRemarks} 
                  onChange={(e) => setLogRemarks(e.target.value)} 
                  className="form-control"
                  placeholder="e.g. Festival advance, emergency cash..."
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowLogModal(false)} 
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Logging...' : 'Log Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
