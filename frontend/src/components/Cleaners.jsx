import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, UserPlus, Edit2, Trash2, Phone, DollarSign, Calendar, Calculator, History, Printer, RefreshCw, ArrowLeft, CheckCircle, Sliders } from 'lucide-react';

export default function Cleaners({ showToast, API_BASE }) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory', 'calculate', 'history'
  
  // Directory state
  const [cleaners, setCleaners] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  
  // Modal state for Add/Edit Cleaner
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWage, setFormWage] = useState('');
  const [formJoinDate, setFormJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState('active');
  const [formDesignation, setFormDesignation] = useState('');
  const [editingCleanerId, setEditingCleanerId] = useState(null);

  // Advances sub-state (within selected cleaner profile)
  const [advanceTab, setAdvanceTab] = useState('pending'); // 'pending' or 'history'
  const [pendingAdvances, setPendingAdvances] = useState([]);
  const [deductedAdvances, setDeductedAdvances] = useState([]);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceRemarks, setAdvanceRemarks] = useState('');

  // Payroll Calculation States
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonthStr = todayStr.substring(0, 8) + '01';
  const [startDate, setStartDate] = useState(firstOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [report, setReport] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [printPayslipData, setPrintPayslipData] = useState(null);

  // ==================== LIFECYCLE & DATA FETCHING ====================
  const fetchCleaners = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/suppliers?type=cleaner`);
      if (!res.ok) throw new Error('Failed to fetch cleaners');
      const data = await res.json();
      setCleaners(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading cleaners directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchCleaners();
    } else if (activeTab === 'calculate') {
      calculatePayroll();
    } else {
      fetchPayoutHistory();
    }
  }, [activeTab]);

  // Load selected cleaner advances
  const fetchAdvances = async (cleanerId) => {
    try {
      const res = await fetch(`${API_BASE}/advances?supplier_id=${cleanerId}`);
      if (!res.ok) throw new Error('Failed to fetch advances');
      const data = await res.json();
      setPendingAdvances(data.filter(a => a.status === 'pending'));
      setDeductedAdvances(data.filter(a => a.status === 'deducted'));
    } catch (err) {
      console.error('Error fetching advances:', err);
    }
  };

  useEffect(() => {
    if (selectedCleaner) {
      fetchAdvances(selectedCleaner.id);
    }
  }, [selectedCleaner]);

  // ==================== CLEANER DIRECTORY HANDLERS ====================
  const openAddModal = () => {
    setEditMode(false);
    setEditingCleanerId(null);
    setFormName('');
    setFormPhone('');
    setFormWage('');
    setFormJoinDate(new Date().toISOString().split('T')[0]);
    setFormStatus('active');
    setFormDesignation('');
    setShowModal(true);
  };

  const openEditModal = (cleaner) => {
    setEditMode(true);
    setEditingCleanerId(cleaner.id);
    setFormName(cleaner.name);
    setFormPhone(cleaner.phone || '');
    setFormWage(cleaner.basic_daily_wage || '');
    setFormJoinDate(cleaner.joining_date);
    setFormStatus(cleaner.status || 'active');
    setFormDesignation(cleaner.designation || '');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName || !formWage) {
      showToast('Name and Daily Salary are required', 'error');
      return;
    }

    const payload = {
      name: formName,
      phone: formPhone,
      joining_date: formJoinDate,
      basic_daily_wage: parseFloat(formWage) || 0,
      status: formStatus,
      type: 'cleaner',
      monthly_salary: 0,
      designation: formDesignation
    };

    try {
      setLoading(true);
      const url = editMode ? `${API_BASE}/suppliers/${editingCleanerId}` : `${API_BASE}/suppliers`;
      const method = editMode ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to save cleaner profile');
      const saved = await res.json();
      
      showToast(editMode ? 'Worker profile updated' : 'Worker added', 'success');
      setShowModal(false);
      fetchCleaners();
      if (selectedCleaner && selectedCleaner.id === editingCleanerId) {
        setSelectedCleaner(saved);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this worker? All attendance, advances, and payout logs will be deleted permanently.')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete worker');
      showToast('Worker removed successfully', 'success');
      setSelectedCleaner(null);
      fetchCleaners();
    } catch (err) {
      console.error(err);
      showToast('Error removing cleaner profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ==================== CASH ADVANCE HANDLERS ====================
  const handleAddAdvance = async (e) => {
    e.preventDefault();
    if (!advanceAmount || parseFloat(advanceAmount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    const payload = {
      supplier_id: selectedCleaner.id,
      amount: parseFloat(advanceAmount),
      date: advanceDate,
      remarks: advanceRemarks.trim(),
      status: 'pending'
    };

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to log cash advance');
      showToast(`Logged ₹${parseFloat(advanceAmount).toLocaleString('en-IN')} cash advance`, 'success');
      setShowAdvanceModal(false);
      setAdvanceAmount('');
      setAdvanceRemarks('');
      fetchAdvances(selectedCleaner.id);
    } catch (err) {
      console.error(err);
      showToast('Error recording cash advance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdvance = async (advId) => {
    if (!window.confirm('Are you sure you want to delete this pending cash advance?')) return;
    try {
      const res = await fetch(`${API_BASE}/advances/${advId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete advance');
      showToast('Cash advance deleted', 'success');
      fetchAdvances(selectedCleaner.id);
    } catch (err) {
      console.error(err);
      showToast('Failed to delete advance', 'error');
    }
  };

  // ==================== PAYROLL HANDLERS ====================
  const calculatePayroll = async () => {
    if (!startDate || !endDate) {
      showToast('Please select dates', 'error');
      return;
    }
    try {
      setPayrollLoading(true);
      const res = await fetch(`${API_BASE}/payroll/cleaner/calculate?start_date=${startDate}&end_date=${endDate}`);
      if (!res.ok) throw new Error('Failed to calculate payroll');
      const data = await res.json();
      setReport(data.report);
    } catch (err) {
      console.error(err);
      showToast('Error calculating payroll', 'error');
    } finally {
      setPayrollLoading(false);
    }
  };

  const fetchPayoutHistory = async () => {
    try {
      setPayrollLoading(true);
      const res = await fetch(`${API_BASE}/payroll/cleaner/history`);
      if (!res.ok) throw new Error('Failed to fetch payout history');
      const data = await res.json();
      setPayoutHistory(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading payout history', 'error');
    } finally {
      setPayrollLoading(false);
    }
  };

  const handleProcessPayout = async (record = null) => {
    const isSingle = record !== null;
    const targetRecords = isSingle ? [record] : report.filter(r => !r.already_paid);

    if (targetRecords.length === 0) {
      showToast(isSingle ? 'Worker already paid' : 'No unpaid workers in this period', 'error');
      return;
    }

    const confirmMsg = isSingle 
      ? `Disburse salary for ${record.supplier_name} for period ${startDate} to ${endDate}?`
      : `Disburse salaries for ${targetRecords.length} unpaid workers for period ${startDate} to ${endDate}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setPayrollLoading(true);
      const res = await fetch(`${API_BASE}/payroll/cleaner/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          payment_date: new Date().toISOString().split('T')[0],
          records: targetRecords
        })
      });

      if (!res.ok) throw new Error('Failed to disburse payouts');
      showToast(isSingle ? 'Payout recorded successfully' : 'All payouts recorded successfully', 'success');
      calculatePayroll();
    } catch (err) {
      console.error(err);
      showToast('Error processing payouts', 'error');
    } finally {
      setPayrollLoading(false);
    }
  };

  const handlePrintPayslip = (payout) => {
    setPrintPayslipData(payout);
  };

  // Hook for printing payslips automatically
  useEffect(() => {
    let isMounted = true;
    if (printPayslipData) {
      const clearPrintData = () => {
        if (isMounted) setPrintPayslipData(null);
      };

      const timer = setTimeout(() => {
        window.print();
      }, 500);

      const focusTimer = setTimeout(() => {
        window.addEventListener('focus', clearPrintData);
      }, 1000);

      const handleAfterPrint = () => {
        setTimeout(clearPrintData, 30000);
      };
      window.addEventListener('afterprint', handleAfterPrint);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        clearTimeout(focusTimer);
        window.removeEventListener('focus', clearPrintData);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [printPayslipData]);

  // ==================== UTILS ====================
  const formatCurrency = (val) => {
    return '₹' + (parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const filteredCleanersList = cleaners.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  return (
    <div className="tab-view-container">
      {/* Navigation and Top Bar */}
      <div className="content-header">
        <div className="header-title">
          <h1>Cleaners & Masters Directory</h1>
          <p>Manage daily wage staff profiles, cash advances, and salary disbursements</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button 
            onClick={() => { setActiveTab('directory'); setSelectedCleaner(null); }} 
            className={`btn btn-sm ${activeTab === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            <Users size={14} /> Directory
          </button>
          <button 
            onClick={() => setActiveTab('calculate')} 
            className={`btn btn-sm ${activeTab === 'calculate' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            <Calculator size={14} /> Calculate Salary
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            <History size={14} /> Payout History
          </button>
        </div>
      </div>

      {/* ==================== TAB: DIRECTORY ==================== */}
      {activeTab === 'directory' && (
        selectedCleaner ? (
          /* Cleaner Detail Profile View */
          <div className="animate-fade-in">
            <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <button onClick={() => setSelectedCleaner(null)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowLeft size={14} /> Back to Directory
              </button>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => openEditModal(selectedCleaner)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Edit2 size={14} /> Edit Profile
                </button>
                <button onClick={() => handleDelete(selectedCleaner.id)} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>

            <div className="profile-detail-grid">
              {/* Left Column: Basic Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card gold-header" style={{ padding: '2rem' }}>
                  <div className="section-title">Worker Profile Details</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Users size={18} color="var(--text-secondary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Name</div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{selectedCleaner.name}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Phone size={18} color="var(--text-secondary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mobile Number</div>
                        <div style={{ fontWeight: 500 }}>{selectedCleaner.phone || 'Not provided'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <DollarSign size={18} color="var(--text-secondary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Wage/Salary</div>
                        <div style={{ fontWeight: 600, color: 'var(--accent-gold-glow)' }}>{formatCurrency(selectedCleaner.basic_daily_wage)} / day</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Calendar size={18} color="var(--text-secondary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Joining Date</div>
                        <div style={{ fontWeight: 500 }}>{selectedCleaner.joining_date}</div>
                      </div>
                    </div>
                    {selectedCleaner.designation && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Sliders size={18} color="var(--text-secondary)" />
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role / Designation</div>
                          <div style={{ fontWeight: 500 }}>{selectedCleaner.designation}</div>
                        </div>
                      </div>
                    )}
                    <div>
                      <span className={`badge ${selectedCleaner.status === 'active' ? 'badge-present' : 'badge-inactive'}`}>
                        {selectedCleaner.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Advances Panel */}
              <div className="card crimson-header" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1.25rem' }}>
                    <button 
                      onClick={() => setAdvanceTab('pending')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: advanceTab === 'pending' ? 'var(--accent-gold-glow)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        paddingBottom: '0.5rem',
                        borderBottom: advanceTab === 'pending' ? '2px solid var(--accent-gold-glow)' : 'none'
                      }}
                    >
                      Active Advances
                    </button>
                    <button 
                      onClick={() => setAdvanceTab('history')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: advanceTab === 'history' ? 'var(--accent-gold-glow)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        paddingBottom: '0.5rem',
                        borderBottom: advanceTab === 'history' ? '2px solid var(--accent-gold-glow)' : 'none'
                      }}
                    >
                      Advances History
                    </button>
                  </div>
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

                {advanceTab === 'pending' ? (
                  pendingAdvances.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No active advances logged.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                      {pendingAdvances.map((adv) => (
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
                              <span className="badge badge-active" style={{ fontSize: '0.6rem', padding: '0.15rem 0.35rem' }}>pending</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                              Date: {adv.date} {adv.remarks && `• Notes: ${adv.remarks}`}
                            </div>
                          </div>
                          <button onClick={() => handleDeleteAdvance(adv.id)} className="btn btn-danger btn-icon" style={{ padding: '0.35rem' }} title="Delete log">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  deductedAdvances.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No historical deducted advances found.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                      {deductedAdvances.map((adv) => (
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
                              <span className="badge badge-present" style={{ fontSize: '0.6rem', padding: '0.15rem 0.35rem' }}>deducted</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                              Date: {adv.date} {adv.remarks && `• Notes: ${adv.remarks}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Directory List View */
          <div>
            <div className="filter-bar">
              <input 
                type="text" 
                placeholder="Search daily workers by name or phone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ maxWidth: '350px' }}
              />
              <button onClick={openAddModal} className="btn btn-primary">
                <UserPlus size={18} /> Add Daily Master
              </button>
            </div>

            {loading && cleaners.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                Loading workers database...
              </div>
            ) : filteredCleanersList.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
                <h3>No daily workers found</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Add a new daily wage worker profile to get started.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Joining Date</th>
                      <th>Daily Wage / Salary</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCleanersList.map((cleaner) => (
                      <tr key={cleaner.id} className="clickable-row" onClick={() => setSelectedCleaner(cleaner)}>
                        <td>#{cleaner.id}</td>
                        <td style={{ fontWeight: 600 }}>
                          <div>{cleaner.name}</div>
                          {cleaner.designation && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent-blue)', marginTop: '0.15rem' }}>
                              {cleaner.designation}
                            </div>
                          )}
                        </td>
                        <td>{cleaner.phone || '—'}</td>
                        <td>{cleaner.joining_date}</td>
                        <td className="text-gold" style={{ fontWeight: 600 }}>{formatCurrency(cleaner.basic_daily_wage)}/day</td>
                        <td>
                          <span className={`badge ${cleaner.status === 'active' ? 'badge-present' : 'badge-inactive'}`}>
                            {cleaner.status || 'Active'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => setSelectedCleaner(cleaner)} className="btn btn-secondary btn-sm">
                              View Profile
                            </button>
                            <button onClick={() => openEditModal(cleaner)} className="btn btn-secondary btn-xs-icon" title="Edit Profile">
                              <Edit2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* ==================== TAB: CALCULATE PAYROLL ==================== */}
      {activeTab === 'calculate' && (
        <div>
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="filter-bar" style={{ marginBottom: 0, justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>Start Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="form-control"
                  />
                </div>
                <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem' }}>End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="form-control"
                  />
                </div>
                <button 
                  onClick={calculatePayroll} 
                  className="btn btn-secondary" 
                  style={{ alignSelf: 'flex-end', border: '1px solid var(--border-color)' }}
                  disabled={payrollLoading}
                >
                  <RefreshCw size={16} className={payrollLoading ? 'spin-animation' : ''} /> Recalculate
                </button>
              </div>

              <button 
                onClick={() => handleProcessPayout(null)} 
                className={report.length > 0 && report.every(r => r.already_paid) ? "btn btn-secondary" : "btn btn-success"} 
                style={{ alignSelf: 'flex-end' }}
                disabled={payrollLoading || report.length === 0 || report.every(r => r.already_paid)}
              >
                <CheckCircle size={18} /> {report.length > 0 && report.every(r => r.already_paid) ? "All Paid for Period" : "Disburse & Record Payouts"}
              </button>
            </div>
          </div>

          {report.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              No cleaner salary data available for this range. Select another date range.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Cleaner</th>
                    <th>Attendance Days</th>
                    <th>Daily Wage</th>
                    <th>Attendance Pay</th>
                    <th style={{ color: 'var(--accent-crimson)' }}>Advances Deducted</th>
                    <th style={{ color: 'var(--accent-gold-glow)' }}>Net Pay</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((row) => (
                    <tr key={row.supplier_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.supplier_name}</div>
                        {row.designation && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 500, marginTop: '0.1rem' }}>
                            {row.designation}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Rate: {formatCurrency(row.basic_daily_wage)}/day</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.9rem' }}>
                          Present: <strong>{row.present_days}</strong>, Half: <strong>{row.half_days}</strong>, Absent/WO: <strong>{row.absent_days}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Paid Days: {row.attendance_days} d</div>
                      </td>
                      <td>{formatCurrency(row.basic_daily_wage)}/day</td>
                      <td>{formatCurrency(row.attendance_pay)}</td>
                      <td style={{ color: 'var(--accent-crimson)', fontWeight: 600 }}>
                        {row.advance_deducted > 0 ? `-${formatCurrency(row.advance_deducted)}` : formatCurrency(0)}
                      </td>
                      <td className="text-gold" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span>{formatCurrency(row.net_salary)}</span>
                          {row.already_paid && (
                            <span className="badge badge-present" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', fontWeight: 700 }}>Paid</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {!row.already_paid && (
                            <button 
                              onClick={() => handleProcessPayout(row)} 
                              className="btn btn-success btn-sm"
                              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                              disabled={payrollLoading}
                            >
                              Pay
                            </button>
                          )}
                          {row.already_paid && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Disbursed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: HISTORY ==================== */}
      {activeTab === 'history' && (
        <div>
          {payrollLoading && payoutHistory.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              Loading cleaner payout history...
            </div>
          ) : payoutHistory.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              No cleaner payout records logged yet.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Payout ID</th>
                    <th>Date Paid</th>
                    <th>Name</th>
                    <th>Period covered</th>
                    <th>Paid Days</th>
                    <th>Salary Amt</th>
                    <th>Advances Deducted</th>
                    <th style={{ color: 'var(--accent-gold-glow)' }}>Net Paid Amt</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map((payout) => (
                    <tr key={payout.id}>
                      <td><code style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>#{payout.id.substring(0, 8)}</code></td>
                      <td>{payout.payment_date}</td>
                      <td style={{ fontWeight: 600 }}>
                        <div>{payout.supplier_name}</div>
                        {payout.designation && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 500, marginTop: '0.1rem' }}>
                            {payout.designation}
                          </div>
                        )}
                      </td>
                      <td><span style={{ fontSize: '0.85rem' }}>{payout.start_date} to {payout.end_date}</span></td>
                      <td>{payout.attendance_days} d</td>
                      <td>{formatCurrency(payout.attendance_pay)}</td>
                      <td style={{ color: payout.advance_deducted > 0 ? 'var(--accent-crimson)' : 'var(--text-muted)' }}>
                        {payout.advance_deducted > 0 ? `-${formatCurrency(payout.advance_deducted)}` : '—'}
                      </td>
                      <td className="text-gold" style={{ fontWeight: 700 }}>{formatCurrency(payout.net_salary)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => handlePrintPayslip(payout)} className="btn btn-secondary btn-sm">
                          <Printer size={12} /> Print Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT CLEANER ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content animate-scale-up" style={{ maxWidth: '450px', width: '100%', padding: '1.75rem' }}>
            <h2>{editMode ? 'Edit Daily Master Profile' : 'Add Daily Master Profile'}</h2>
            <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label>Full Name *</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  className="form-control"
                  placeholder="e.g. Ramesh Master"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  value={formPhone} 
                  onChange={(e) => setFormPhone(e.target.value)} 
                  className="form-control"
                  placeholder="10-digit number"
                />
              </div>

              <div className="form-group">
                <label>Designation / Role *</label>
                <input 
                  type="text" 
                  value={formDesignation} 
                  onChange={(e) => setFormDesignation(e.target.value)} 
                  className="form-control"
                  placeholder="e.g. Cleaner, Food Master"
                  required
                />
              </div>

              <div className="form-group">
                <label>Daily Salary / Wage (₹) *</label>
                <input 
                  type="number" 
                  value={formWage} 
                  onChange={(e) => setFormWage(e.target.value)} 
                  className="form-control"
                  placeholder="e.g. 400"
                  required
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

              {editMode && (
                <div className="form-group">
                  <label>Status</label>
                  <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="form-control">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : editMode ? 'Update Master' : 'Add Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD CASH ADVANCE ==================== */}
      {showAdvanceModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content animate-scale-up" style={{ maxWidth: '400px', width: '100%', padding: '1.75rem' }}>
            <h3>Log Cash Advance</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Give advance to <strong>{selectedCleaner.name}</strong>. This will be deducted automatically from their next salary payout.
            </p>
            <form onSubmit={handleAddAdvance} style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label>Advance Amount (₹) *</label>
                <input 
                  type="number" 
                  value={advanceAmount} 
                  onChange={(e) => setAdvanceAmount(e.target.value)} 
                  className="form-control"
                  placeholder="e.g. 500"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Date Given</label>
                <input 
                  type="date" 
                  value={advanceDate} 
                  onChange={(e) => setAdvanceDate(e.target.value)} 
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Remarks / Notes</label>
                <input 
                  type="text" 
                  value={advanceRemarks} 
                  onChange={(e) => setAdvanceRemarks(e.target.value)} 
                  className="form-control"
                  placeholder="e.g. Festival advance"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAdvanceModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Disburse Cash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PRINTABLE PAYSLIP CONTAINER ==================== */}
      {printPayslipData && createPortal(
        <div className="modal-overlay print-slip-overlay">
          <div className="printable-payslip" style={{ position: 'relative', width: '100%', maxWidth: '600px', padding: '2rem', background: '#fff', color: '#000' }}>
            {printPayslipData.already_paid && (
              <div className="print-stamp">
                PAID
              </div>
            )}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'Montserrat', fontSize: '1.5rem', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
                Udumalai Cosmo Recreation Club
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                FL2 License Club Bar • Timings: 11:00 AM to 11:00 PM
              </div>
              <h3 style={{ fontSize: '1.1rem', marginTop: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Daily Staff Salary Payslip
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div>
                <strong>Worker Name:</strong> {printPayslipData.supplier_name}<br />
                {printPayslipData.designation && <><strong>Designation:</strong> {printPayslipData.designation}<br /></>}
                <strong>Worker ID:</strong> #{printPayslipData.supplier_id}<br />
                <strong>Calculation Period:</strong> {printPayslipData.start_date} to {printPayslipData.end_date}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Disbursement Date:</strong> {printPayslipData.payment_date}<br />
                <strong>Daily Wage Rate:</strong> {formatCurrency(printPayslipData.basic_daily_wage || (printPayslipData.attendance_pay / printPayslipData.attendance_days))}/day<br />
                <strong>Payout Status:</strong> PAID (CASH/TFR)
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ccc', background: '#f5f5f5' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Earnings Breakdown</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Qty / Value</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <strong>Daily Wage Wages</strong><br />
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>
                      Present: {printPayslipData.present_days} days • Half Days: {printPayslipData.half_days} days • Absent/WO: {printPayslipData.absent_days} days
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    {printPayslipData.attendance_days} work days
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    {formatCurrency(printPayslipData.attendance_pay || printPayslipData.total_salary)}
                  </td>
                </tr>

                {printPayslipData.advances && printPayslipData.advances.length > 0 && (
                  <>
                    <tr style={{ borderBottom: '1px solid #eee', background: '#fff9f9' }}>
                      <td colSpan="3" style={{ padding: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c' }}>
                        DEDUCTIONS (CASH ADVANCES)
                      </td>
                    </tr>
                    {printPayslipData.advances.map((adv, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                        <td style={{ padding: '0.5rem 0.5rem', paddingLeft: '1.5rem', color: '#555' }}>
                          Advance Given on {adv.date} {adv.remarks && `(${adv.remarks})`}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', color: '#555' }}>-</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: '#b91c1c' }}>
                          -{formatCurrency(adv.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: '1px solid #eee', fontWeight: 600 }}>
                      <td style={{ padding: '0.5rem 0.5rem', paddingLeft: '1.5rem' }}>Total Advances Deducted</td>
                      <td></td>
                      <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#b91c1c' }}>
                        -{formatCurrency(printPayslipData.advance_deducted)}
                      </td>
                    </tr>
                  </>
                )}

                <tr style={{ borderTop: '2px solid #333', fontSize: '1.1rem', fontWeight: 700 }}>
                  <td style={{ padding: '1rem 0.5rem' }}>Net Take Home Salary (Remaining)</td>
                  <td></td>
                  <td style={{ padding: '1rem 0.5rem', textAlign: 'right', color: '#000' }}>
                    {formatCurrency(printPayslipData.net_salary)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '3rem', fontSize: '0.85rem' }}>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
                Employee Signature
              </div>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
                Manager / Director Signature
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.75rem', color: '#888', borderTop: '1px dashed #ccc', paddingTop: '0.75rem', marginBottom: '1.5rem' }}>
              Thank you for your service at Udumalai Cosmo Recreation Club.
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
