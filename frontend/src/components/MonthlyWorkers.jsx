import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, UserPlus, Edit2, Trash2, Phone, DollarSign, Calendar, Calculator, History, Printer, RefreshCw, ArrowLeft, CheckCircle, Sliders, LogOut } from 'lucide-react';

export default function MonthlyWorkers({ showToast, API_BASE }) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory', 'calculate', 'history'
  
  // Directory state
  const [workers, setWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  
  // Modal state for Add/Edit Worker
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSalary, setFormSalary] = useState('');
  const [formJoinDate, setFormJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState('active');

  // Advances sub-state (within selected worker profile)
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
  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/suppliers?type=monthly`);
      if (!res.ok) throw new Error('Failed to fetch monthly workers');
      const data = await res.json();
      setWorkers(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading monthly workers directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'directory') {
      fetchWorkers();
    } else if (activeTab === 'calculate') {
      calculatePayroll();
    } else {
      fetchPayoutHistory();
    }
  }, [activeTab]);

  // Load selected worker advances
  const fetchAdvances = async (workerId) => {
    try {
      const res = await fetch(`${API_BASE}/advances?supplier_id=${workerId}`);
      if (!res.ok) throw new Error('Failed to fetch advances');
      const data = await res.json();
      setPendingAdvances(data.filter(a => a.status === 'pending'));
      setDeductedAdvances(data.filter(a => a.status === 'deducted'));
    } catch (err) {
      console.error('Error fetching advances:', err);
    }
  };

  useEffect(() => {
    if (selectedWorker) {
      fetchAdvances(selectedWorker.id);
    }
  }, [selectedWorker]);

  // ==================== WORKER DIRECTORY HANDLERS ====================
  const openAddModal = () => {
    setEditMode(false);
    setFormName('');
    setFormPhone('');
    setFormSalary('');
    setFormJoinDate(new Date().toISOString().split('T')[0]);
    setFormStatus('active');
    setShowModal(true);
  };

  const openEditModal = (worker) => {
    setEditMode(true);
    setFormName(worker.name);
    setFormPhone(worker.phone || '');
    setFormSalary(worker.monthly_salary || '');
    setFormJoinDate(worker.joining_date);
    setFormStatus(worker.status || 'active');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName || !formSalary) {
      showToast('Name and Monthly Salary are required', 'error');
      return;
    }

    const payload = {
      name: formName,
      phone: formPhone,
      joining_date: formJoinDate,
      monthly_salary: parseFloat(formSalary) || 0,
      status: formStatus,
      type: 'monthly',
      basic_daily_wage: 0
    };

    try {
      setLoading(true);
      const url = editMode ? `${API_BASE}/suppliers/${selectedWorker.id}` : `${API_BASE}/suppliers`;
      const method = editMode ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to save monthly worker profile');
      const saved = await res.json();
      
      showToast(editMode ? 'Worker profile updated' : 'Monthly worker added', 'success');
      setShowModal(false);
      fetchWorkers();
      if (selectedWorker) {
        setSelectedWorker(saved);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this monthly worker? All attendance, advances, and payout logs will be deleted permanently.')) {
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete worker');
      showToast('Worker removed successfully', 'success');
      setSelectedWorker(null);
      fetchWorkers();
    } catch (err) {
      console.error(err);
      showToast('Error removing worker', 'error');
    } finally {
      setLoading(false);
    }
  };

  const viewProfile = (worker) => {
    setSelectedWorker(worker);
  };

  // ==================== ADVANCES HANDLERS ====================
  const handleLogAdvance = async (e) => {
    e.preventDefault();
    if (!advanceAmount) {
      showToast('Please enter advance amount', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: selectedWorker.id,
          amount: parseFloat(advanceAmount),
          date: advanceDate,
          remarks: advanceRemarks
        })
      });
      if (!res.ok) throw new Error('Failed to log cash advance');
      
      showToast('Cash advance logged successfully', 'success');
      setAdvanceAmount('');
      setAdvanceRemarks('');
      setShowAdvanceModal(false);
      fetchAdvances(selectedWorker.id);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAdvance = async (advId) => {
    if (!window.confirm('Delete this pending advance log?')) return;
    try {
      const res = await fetch(`${API_BASE}/advances/${advId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete advance');
      showToast('Advance log deleted', 'success');
      fetchAdvances(selectedWorker.id);
    } catch (err) {
      console.error(err);
      showToast('Error deleting advance', 'error');
    }
  };

  // ==================== PAYROLL & CALCULATIONS ====================
  const calculatePayroll = async () => {
    if (!startDate || !endDate) {
      showToast('Please select start and end dates', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      showToast('Start date cannot be after end date', 'error');
      return;
    }
    try {
      setPayrollLoading(true);
      const res = await fetch(`${API_BASE}/payroll/monthly/calculate?start_date=${startDate}&end_date=${endDate}`);
      if (!res.ok) throw new Error('Failed to calculate payroll');
      const data = await res.json();
      setReport(data.report || []);
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
      const res = await fetch(`${API_BASE}/payroll/monthly/history`);
      if (!res.ok) throw new Error('Failed to fetch payouts history');
      const data = await res.json();
      setPayoutHistory(data || []);
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
      showToast(isSingle ? 'This worker is already paid' : 'All workers for this period are already paid', 'error');
      return;
    }

    const confirmMsg = isSingle 
      ? `Disburse salary for ${record.supplier_name} for period ${startDate} to ${endDate}?`
      : `Disburse salaries for ${targetRecords.length} unpaid monthly workers for period ${startDate} to ${endDate}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setPayrollLoading(true);
      const payload = {
        start_date: startDate,
        end_date: endDate,
        payment_date: new Date().toISOString().split('T')[0],
        records: targetRecords.map(r => ({
          supplier_id: r.supplier_id,
          attendance_days: r.attendance_days,
          attendance_pay: r.attendance_pay,
          total_salary: r.total_salary,
          advance_deducted: r.advance_deducted,
          net_salary: r.net_salary
        }))
      };

      const res = await fetch(`${API_BASE}/payroll/monthly/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to disburse payout');
      showToast(isSingle ? `Payout for ${record.supplier_name} processed` : 'Payout records processed successfully', 'success');
      
      if (isSingle) {
        await calculatePayroll();
      } else {
        setActiveTab('history');
      }
    } catch (err) {
      console.error(err);
      showToast('Error processing payout', 'error');
    } finally {
      setPayrollLoading(false);
    }
  };

  // ==================== PRINT PAYSLIP HANDLER ====================
  const openPrintDialog = (workerData) => {
    setPrintPayslipData({
      ...workerData,
      start_date: workerData.start_date || startDate,
      end_date: workerData.end_date || endDate,
      payment_date: workerData.payment_date || new Date().toLocaleDateString('en-IN')
    });
  };

  useEffect(() => {
    if (printPayslipData) {
      const handleAfterPrint = () => {
        setPrintPayslipData(null);
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
  }, [printPayslipData]);

  // Client-side filtering of workers by name/phone
  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.phone && w.phone.includes(searchQuery))
  );

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt);
  };

  return (
    <div>
      {/* Navigation and Top Bar */}
      <div className="content-header">
        <div className="header-title">
          <h1>Monthly Salary Workers</h1>
          <p>Manage fixed-salaried staff profiles, rosters, advances, and payroll settlements.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button 
            onClick={() => { setActiveTab('directory'); setSelectedWorker(null); }} 
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

      {/* ==================== TAB: DIRECTORY VIEW ==================== */}
      {activeTab === 'directory' && (
        selectedWorker ? (
          /* Profile Detail View */
          <div>
            <div className="card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <button onClick={() => setSelectedWorker(null)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowLeft size={14} /> Back to Directory
              </button>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => openEditModal(selectedWorker)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Edit2 size={14} /> Edit Profile
                </button>
                <button onClick={() => handleDelete(selectedWorker.id)} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                        <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{selectedWorker.name}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Phone size={18} color="var(--text-secondary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mobile Number</div>
                        <div style={{ fontWeight: 500 }}>{selectedWorker.phone || 'Not provided'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <DollarSign size={18} color="var(--text-secondary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly Base Salary</div>
                        <div style={{ fontWeight: 600, color: 'var(--accent-gold-glow)' }}>{formatCurrency(selectedWorker.monthly_salary)} / month</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Calendar size={18} color="var(--text-secondary)" />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Joining Date</div>
                        <div style={{ fontWeight: 500 }}>{selectedWorker.joining_date}</div>
                      </div>
                    </div>
                    <div>
                      <span className={`badge ${selectedWorker.status === 'active' ? 'badge-present' : 'badge-inactive'}`}>
                        {selectedWorker.status === 'active' ? 'Active' : 'Inactive'}
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
          /* Directory Directory Listing */
          <div>
            <div className="filter-bar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="form-group" style={{ flexGrow: 1, minWidth: '250px', marginBottom: 0 }}>
                <input 
                  type="text" 
                  placeholder="Search workers by name or phone..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control"
                />
              </div>
              <button onClick={openAddModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserPlus size={16} /> Add Worker
              </button>
            </div>

            {loading && filteredWorkers.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                Loading directory...
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                <h3>No monthly workers found</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Add a new monthly salary worker profile to get started.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Monthly Base Salary</th>
                      <th>Joining Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.id} style={{ cursor: 'pointer' }} onClick={() => viewProfile(worker)}>
                        <td>#{worker.id}</td>
                        <td style={{ fontWeight: 600 }}>{worker.name}</td>
                        <td>{worker.phone || '-'}</td>
                        <td className="text-gold">{formatCurrency(worker.monthly_salary)} / month</td>
                        <td>{worker.joining_date}</td>
                        <td>
                          <span className={`badge ${worker.status === 'active' ? 'badge-present' : 'badge-inactive'}`}>
                            {worker.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => openEditModal(worker)} className="btn btn-secondary btn-icon" title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(worker.id)} className="btn btn-danger btn-icon" title="Delete">
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
              No monthly worker salary data available for this range. Select another date range.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Attendance Days</th>
                    <th>Monthly Salary</th>
                    <th>Daily Rate</th>
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monthly: {formatCurrency(row.monthly_salary)}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.9rem' }}>
                          Present: <strong>{row.present_days}</strong>, Half: <strong>{row.half_days}</strong>, Absent: <strong>{row.absent_days}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Paid Days: {row.attendance_days} d</div>
                      </td>
                      <td>{formatCurrency(row.monthly_salary)}</td>
                      <td>{formatCurrency(row.daily_rate)}/day</td>
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
                          <button onClick={() => openPrintDialog(row)} className="btn btn-secondary btn-icon btn-sm" title="Print payslip">
                            <Printer size={14} />
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
      )}

      {/* ==================== TAB: PAYOUT HISTORY ==================== */}
      {activeTab === 'history' && (
        <div>
          {payoutHistory.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              No monthly worker payout records logged yet.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Payout ID</th>
                    <th>Worker</th>
                    <th>Calculation Period</th>
                    <th>Disbursement Date</th>
                    <th>Attendance Paid</th>
                    <th>Gross Salary</th>
                    <th style={{ color: 'var(--accent-crimson)' }}>Advances Deducted</th>
                    <th style={{ color: 'var(--accent-gold-glow)' }}>Net Salary Paid</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Print</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map((hist) => (
                    <tr key={hist.id}>
                      <td>#{hist.id}</td>
                      <td style={{ fontWeight: 600 }}>{hist.supplier_name}</td>
                      <td>{hist.start_date} to {hist.end_date}</td>
                      <td>{hist.payment_date}</td>
                      <td>{formatCurrency(hist.attendance_pay)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({hist.attendance_days} d)</span></td>
                      <td>{formatCurrency(hist.total_salary)}</td>
                      <td style={{ color: 'var(--accent-crimson)' }}>
                        {hist.advance_deducted > 0 ? `-${formatCurrency(hist.advance_deducted)}` : formatCurrency(0)}
                      </td>
                      <td className="text-gold" style={{ fontWeight: 700 }}>{formatCurrency(hist.net_salary)}</td>
                      <td><span className="badge badge-present">Paid</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => openPrintDialog({ ...hist, already_paid: true })} className="btn btn-secondary btn-icon btn-sm" title="Print payslip">
                          <Printer size={12} /> Slip
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

      {/* ==================== MODAL: ADD/EDIT WORKER ==================== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editMode ? 'Edit Monthly Worker' : 'Add Monthly Worker'}</h2>
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
                  placeholder="e.g. Manoj K." 
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
                  <label>Monthly Base Salary (₹) *</label>
                  <input 
                    type="number" 
                    value={formSalary} 
                    onChange={(e) => setFormSalary(e.target.value)} 
                    className="form-control" 
                    min="0"
                    placeholder="e.g. 15000"
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
                  {editMode ? 'Save Changes' : 'Add Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: LOG CASH ADVANCE ==================== */}
      {showAdvanceModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Log Worker Cash Advance</h2>
              <button onClick={() => setShowAdvanceModal(false)} className="modal-close">✕</button>
            </div>
            
            <form onSubmit={handleLogAdvance}>
              <div className="form-group">
                <label>Worker Name</label>
                <input 
                  type="text" 
                  value={selectedWorker?.name || ''} 
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
                  placeholder="e.g. Festival advance, emergency..."
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
                Monthly Staff Salary Payslip
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div>
                <strong>Worker Name:</strong> {printPayslipData.supplier_name}<br />
                <strong>Worker ID:</strong> #{printPayslipData.supplier_id}<br />
                <strong>Calculation Period:</strong> {printPayslipData.start_date} to {printPayslipData.end_date}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Disbursement Date:</strong> {printPayslipData.payment_date}<br />
                <strong>Monthly Salary:</strong> {formatCurrency(printPayslipData.monthly_salary || printPayslipData.total_salary)}/month<br />
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
                    <strong>Attendance Pro-rated Wages</strong><br />
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>
                      Present: {printPayslipData.present_days} days • Half Days: {printPayslipData.half_days} days • Absent: {printPayslipData.absent_days} days
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    {printPayslipData.attendance_days} paid days
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
