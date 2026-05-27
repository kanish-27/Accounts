import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, Edit2, Trash2, Phone, Calendar, ArrowLeft, UserPlus, DollarSign } from 'lucide-react';

export default function Suppliers({ showToast, API_BASE }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null); // For detail/profile view
  const [supplierActivity, setSupplierActivity] = useState({ attendance: [], kots: [], advances: [] });
  const [printKotsData, setPrintKotsData] = useState(null);

  // Cash Advance States
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceRemarks, setAdvanceRemarks] = useState('');

  // Modal forms states
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWage, setFormWage] = useState(300);
  const [formJoinDate, setFormJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState('active');

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/suppliers`);
      if (!res.ok) throw new Error('Failed to fetch suppliers');
      const data = await res.json();
      setSuppliers(data);
    } catch (error) {
      console.error(error);
      showToast('Error loading suppliers list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openAddModal = () => {
    setEditMode(false);
    setFormName('');
    setFormPhone('');
    setFormWage(300);
    setFormJoinDate(new Date().toISOString().split('T')[0]);
    setFormStatus('active');
    setShowModal(true);
  };

  const openEditModal = (supplier) => {
    setEditMode(true);
    setCurrentId(supplier.id);
    setFormName(supplier.name);
    setFormPhone(supplier.phone || '');
    setFormWage(supplier.basic_daily_wage || 0);
    setFormJoinDate(supplier.joining_date || new Date().toISOString().split('T')[0]);
    setFormStatus(supplier.status || 'active');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Supplier Name is required', 'error');
      return;
    }

    const payload = {
      name: formName.trim(),
      phone: formPhone.trim(),
      basic_daily_wage: parseFloat(formWage) || 0,
      joining_date: formJoinDate,
      status: formStatus
    };

    try {
      let res;
      if (editMode) {
        res = await fetch(`${API_BASE}/suppliers/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/suppliers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Operation failed');
      }

      showToast(`Supplier ${editMode ? 'updated' : 'added'} successfully`, 'success');
      setShowModal(false);
      fetchSuppliers();
      
      // If we are editing the selected supplier in detail view, refresh it too
      if (selectedSupplier && selectedSupplier.id === currentId) {
        setSelectedSupplier({ ...selectedSupplier, ...payload });
      }
    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier? All associated KOT bills and attendance records will be removed.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete supplier');
      showToast('Supplier deleted successfully', 'success');
      fetchSuppliers();
      if (selectedSupplier && selectedSupplier.id === id) {
        setSelectedSupplier(null);
      }
    } catch (error) {
      console.error(error);
      showToast('Error deleting supplier', 'error');
    }
  };

  // Fetch supplier detailed activity (KOTs & Attendance logs)
  const viewProfile = async (supplier) => {
    setSelectedSupplier(supplier);
    try {
      // Get all KOT bills for this supplier
      const kotRes = await fetch(`${API_BASE}/kot?supplier_id=${supplier.id}`);
      const kots = await kotRes.json();

      // Get all advances for this supplier
      const advRes = await fetch(`${API_BASE}/advances?supplier_id=${supplier.id}`);
      const advances = await advRes.json();

      setSupplierActivity({ kots, advances });
    } catch (err) {
      console.error(err);
      showToast('Error loading profile activity', 'error');
    }
  };

  const handleLogAdvance = async (e) => {
    e.preventDefault();
    if (!advanceAmount || parseFloat(advanceAmount) <= 0) {
      showToast('Please enter a valid advance amount', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedSupplier.id,
          amount: parseFloat(advanceAmount),
          date: advanceDate,
          remarks: advanceRemarks
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to log cash advance');
      }

      showToast('Cash advance logged successfully', 'success');
      setShowAdvanceModal(false);
      setAdvanceAmount('');
      setAdvanceRemarks('');
      
      // Refresh supplier activity to show the new advance
      viewProfile(selectedSupplier);
    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
    }
  };

  const handleDeleteAdvance = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cash advance record?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/advances/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete advance');
      }

      showToast('Cash advance deleted successfully', 'success');
      viewProfile(selectedSupplier);
    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
    }
  };

  const handlePrintKOTs = () => {
    if (!selectedSupplier || supplierActivity.kots.length === 0) return;
    setPrintKotsData({
      supplier_name: selectedSupplier.name,
      supplier_id: selectedSupplier.id,
      phone: selectedSupplier.phone,
      joining_date: selectedSupplier.joining_date,
      kots: supplierActivity.kots,
      printed_at: new Date().toLocaleString('en-IN')
    });
  };

  useEffect(() => {
    if (printKotsData) {
      const handleAfterPrint = () => {
        setPrintKotsData(null);
      };
      window.addEventListener('afterprint', handleAfterPrint);

      const timer = setTimeout(() => {
        window.print();
      }, 300);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printKotsData]);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.phone && s.phone.includes(searchQuery))
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading && suppliers.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ color: 'var(--accent-gold-glow)', fontWeight: 600 }}>Loading Suppliers directory...</div>
      </div>
    );
  }

  // PROFILE / DETAILED PROFILE VIEW
  if (selectedSupplier) {
    return (
      <div>
        <div className="content-header">
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setSelectedSupplier(null)} className="btn btn-secondary btn-icon" style={{ borderRadius: '50%' }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1>{selectedSupplier.name}</h1>
              <p>Supplier ID: #{selectedSupplier.id} | Joined on {selectedSupplier.joining_date}</p>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={() => openEditModal(selectedSupplier)} className="btn btn-primary btn-sm">
              <Edit2 size={14} /> Edit Profile
            </button>
            <button onClick={() => handleDelete(selectedSupplier.id)} className="btn btn-danger btn-sm">
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '2rem' }}>
          {/* Left Column wrapper for Profile and Advances */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Supplier details card */}
            <div className="card gold-header" style={{ height: 'fit-content', padding: '2rem' }}>
              <div className="section-title">Supplier Profile Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Phone size={18} color="var(--text-secondary)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mobile Number</div>
                    <div style={{ fontWeight: 500 }}>{selectedSupplier.phone || 'Not provided'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <DollarSign size={18} color="var(--text-secondary)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Base Daily Wage</div>
                    <div style={{ fontWeight: 600, color: 'var(--accent-gold-glow)' }}>{formatCurrency(selectedSupplier.basic_daily_wage)} / day</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Calendar size={18} color="var(--text-secondary)" />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Joining Date</div>
                    <div style={{ fontWeight: 500 }}>{selectedSupplier.joining_date}</div>
                  </div>
                </div>
                <div>
                  <span className={`badge ${selectedSupplier.status === 'active' ? 'badge-present' : 'badge-inactive'}`}>
                    {selectedSupplier.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Supplier cash advances card */}
            <div className="card crimson-header" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div className="section-title" style={{ margin: 0, paddingLeft: '0.75rem' }}>Cash Advances</div>
                <button 
                  onClick={() => {
                    setAdvanceDate(new Date().toISOString().split('T')[0]);
                    setShowAdvanceModal(true);
                  }} 
                  className="btn btn-primary btn-sm"
                >
                  + Log Advance
                </button>
              </div>

              {!supplierActivity.advances || supplierActivity.advances.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No advances logged for this supplier.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {supplierActivity.advances.map((adv) => (
                    <div key={adv.id} style={{
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid var(--border-color)',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{formatCurrency(adv.amount)}</span>
                          <span className={`badge ${adv.status === 'deducted' ? 'badge-present' : 'badge-active'}`} style={{ fontSize: '0.6rem', padding: '0.15rem 0.35rem' }}>
                            {adv.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Date: {adv.date} {adv.remarks && `• Remarks: ${adv.remarks}`}
                        </div>
                      </div>
                      {adv.status === 'pending' && (
                        <button 
                          onClick={() => handleDeleteAdvance(adv.id)} 
                          className="btn btn-danger btn-icon" 
                          style={{ padding: '0.35rem' }} 
                          title="Delete pending advance"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity Logs (KOT bills) */}
          <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div className="section-title" style={{ margin: 0 }}>Supplier KOT Bills Statement</div>
              <button 
                onClick={handlePrintKOTs} 
                className="btn btn-secondary btn-sm"
                style={{ border: '1px solid var(--border-color)' }}
                disabled={supplierActivity.kots.length === 0}
              >
                Print KOT Statement
              </button>
            </div>

            {supplierActivity.kots.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No recent KOT transactions found for this supplier.
              </div>
            ) : (
              <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Bill Number</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierActivity.kots.map((kot) => (
                      <tr key={kot.id}>
                        <td style={{ fontWeight: 600 }}>{kot.bill_number}</td>
                        <td>{kot.date}</td>
                        <td>{kot.time}</td>
                        <td className="text-gold">{formatCurrency(kot.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* HIDDEN PRINT-FRIENDLY KOT STATEMENT */}
        {printKotsData && createPortal(
          <div className="printable-kot-statement">
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'Montserrat', fontSize: '1.5rem', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
                Udumalai Cosmo Recreation Club
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                FL2 License Club Bar • Timings: 11:00 AM to 11:00 PM
              </div>
              <h3 style={{ fontSize: '1.1rem', marginTop: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Supplier KOT Bills Statement
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div>
                <strong>Supplier Name:</strong> {printKotsData.supplier_name}<br />
                <strong>Supplier ID:</strong> #{printKotsData.supplier_id}<br />
                <strong>Phone Number:</strong> {printKotsData.phone || 'Not provided'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Printed Date:</strong> {printKotsData.printed_at}<br />
                <strong>Club Joining Date:</strong> {printKotsData.joining_date}<br />
                <strong>Total KOTs Count:</strong> {printKotsData.kots.length} bills
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333', background: '#f5f5f5' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Bill Number</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>KOT Bill Amount</th>
                </tr>
              </thead>
              <tbody>
                {printKotsData.kots.map((kot) => (
                  <tr key={kot.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{kot.bill_number}</td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>{kot.date}</td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>{kot.time}</td>
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                      {formatCurrency(kot.amount)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #333', fontSize: '1.1rem', fontWeight: 700 }}>
                  <td style={{ padding: '1rem 0.5rem' }} colSpan="3">Total KOT Billing Volume</td>
                  <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                    {formatCurrency(printKotsData.kots.reduce((sum, k) => sum + k.amount, 0))}
                  </td>
                </tr>
                <tr style={{ fontSize: '1rem', fontWeight: 700 }}>
                  <td style={{ padding: '0.5rem', color: '#10b981' }} colSpan="3">Est. Supplier Commission (5.0%)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#10b981' }}>
                    {formatCurrency(printKotsData.kots.reduce((sum, k) => sum + k.amount, 0) * 0.05)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '4rem', fontSize: '0.85rem' }}>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
                Supplier Signature
              </div>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
                Manager / Auditor Signature
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Add Advance Modal */}
        {showAdvanceModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2>Log Cash Advance</h2>
                <button onClick={() => setShowAdvanceModal(false)} className="modal-close">✕</button>
              </div>
              
              <form onSubmit={handleLogAdvance}>
                <div className="form-group">
                  <label>Supplier Name</label>
                  <input 
                    type="text" 
                    value={selectedSupplier?.name || ''} 
                    className="form-control" 
                    disabled 
                  />
                </div>

                <div className="form-group">
                  <label>Advance Amount (₹) *</label>
                  <input 
                    type="number" 
                    value={advanceAmount} 
                    onChange={(e) => setAdvanceAmount(e.target.value)} 
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
                    value={advanceDate} 
                    onChange={(e) => setAdvanceDate(e.target.value)} 
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Remarks / Notes</label>
                  <input 
                    type="text" 
                    value={advanceRemarks} 
                    onChange={(e) => setAdvanceRemarks(e.target.value)} 
                    className="form-control"
                    placeholder="e.g. Personal request, family function..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => setShowAdvanceModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Log Advance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // GRID DIRECTORY VIEW
  return (
    <div>
      <div className="content-header">
        <div className="header-title">
          <h1>Suppliers Directory</h1>
          <p>Manage list of active bar suppliers, joining records, and basic daily wages.</p>
        </div>
        <div className="header-actions">
          <button onClick={openAddModal} className="btn btn-primary">
            <UserPlus size={18} />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="filter-bar">
        <div className="form-group" style={{ flexGrow: 1, minWidth: '250px', marginBottom: 0 }}>
          <input 
            type="text" 
            placeholder="Search suppliers by name or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control"
          />
        </div>
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No suppliers found</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Create a new supplier profile to begin tracking their sales.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Daily Wage</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} style={{ cursor: 'pointer' }} onClick={() => viewProfile(supplier)}>
                  <td>#{supplier.id}</td>
                  <td style={{ fontWeight: 600 }}>{supplier.name}</td>
                  <td>{supplier.phone || '-'}</td>
                  <td className="text-gold">{formatCurrency(supplier.basic_daily_wage)}</td>
                  <td>{supplier.joining_date}</td>
                  <td>
                    <span className={`badge ${supplier.status === 'active' ? 'badge-present' : 'badge-inactive'}`}>
                      {supplier.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => openEditModal(supplier)} className="btn btn-secondary btn-icon" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(supplier.id)} className="btn btn-danger btn-icon" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editMode ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button onClick={() => setShowModal(false)} className="modal-close">✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name *</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  className="form-control" 
                  placeholder="e.g. Kumar S." 
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="text" 
                  value={formPhone} 
                  onChange={(e) => setFormPhone(e.target.value)} 
                  className="form-control" 
                  placeholder="10 digit mobile"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Base Daily Wage (₹)</label>
                  <input 
                    type="number" 
                    value={formWage} 
                    onChange={(e) => setFormWage(e.target.value)} 
                    className="form-control" 
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input 
                    type="date" 
                    value={formJoinDate} 
                    onChange={(e) => setFormJoinDate(e.target.value)} 
                    className="form-control"
                  />
                </div>
              </div>

              {editMode && (
                <div className="form-group">
                  <label>Status</label>
                  <select 
                    value={formStatus} 
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="form-control"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editMode ? 'Save Changes' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Advance Modal */}
      {showAdvanceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Log Cash Advance</h2>
              <button onClick={() => setShowAdvanceModal(false)} className="modal-close">✕</button>
            </div>
            
            <form onSubmit={handleLogAdvance}>
              <div className="form-group">
                <label>Supplier Name</label>
                <input 
                  type="text" 
                  value={selectedSupplier?.name || ''} 
                  className="form-control" 
                  disabled 
                />
              </div>

              <div className="form-group">
                <label>Advance Amount (₹) *</label>
                <input 
                  type="number" 
                  value={advanceAmount} 
                  onChange={(e) => setAdvanceAmount(e.target.value)} 
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
                  value={advanceDate} 
                  onChange={(e) => setAdvanceDate(e.target.value)} 
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label>Remarks / Notes</label>
                <input 
                  type="text" 
                  value={advanceRemarks} 
                  onChange={(e) => setAdvanceRemarks(e.target.value)} 
                  className="form-control"
                  placeholder="e.g. Personal request, family function..."
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowAdvanceModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Log Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
