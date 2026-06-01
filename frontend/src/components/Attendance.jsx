import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Save, Clock, FileText, RefreshCw, Printer } from 'lucide-react';

export default function Attendance({ showToast, API_BASE }) {
  const [activeTab, setActiveTab] = useState('mark'); // 'mark' or 'summary'
  
  // Mark Attendance State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Summary State
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonthStr = todayStr.substring(0, 8) + '01';
  const [startDate, setStartDate] = useState(firstOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [summaryData, setSummaryData] = useState([]);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState(null);
  const [printAttendanceData, setPrintAttendanceData] = useState(null);

  const fetchAttendance = async (selectedDate) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/attendance?date=${selectedDate}`);
      if (!res.ok) throw new Error('Failed to fetch attendance');
      const data = await res.json();
      setRecords(data);
    } catch (error) {
      console.error(error);
      showToast('Error loading attendance logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!startDate || !endDate) {
      showToast('Please select start and end dates', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      showToast('Start date cannot be after end date', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/attendance/summary?start_date=${startDate}&end_date=${endDate}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setSummaryData(data);
    } catch (error) {
      console.error(error);
      showToast('Error loading attendance summary', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mark') {
      fetchAttendance(date);
    } else {
      fetchSummary();
    }
  }, [activeTab, date]);

  // Hook for printing logs using afterprint
  useEffect(() => {
    if (printAttendanceData) {
      const handleAfterPrint = () => {
        setPrintAttendanceData(null);
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
  }, [printAttendanceData]);

  const handleStatusChange = (supplierId, newStatus) => {
    setRecords(prev => prev.map(rec => {
      if (rec.supplier_id === supplierId) {
        return { ...rec, status: newStatus };
      }
      return rec;
    }));
  };

  const handleShiftChange = (supplierId, newShift) => {
    setRecords(prev => prev.map(rec => {
      if (rec.supplier_id === supplierId) {
        return { ...rec, shift: newShift };
      }
      return rec;
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const payload = {
        date,
        records: records.map(rec => ({
          supplier_id: rec.supplier_id,
          status: rec.status,
          shift: rec.shift
        }))
      };

      const res = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save attendance');
      showToast(`Attendance for ${date} saved successfully`, 'success');
      fetchAttendance(date);
    } catch (error) {
      console.error(error);
      showToast('Error saving attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAttendance = (row) => {
    // Sort logs ascending chronologically for printing
    const sortedLogs = row.logs ? [...row.logs].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
    setPrintAttendanceData({
      ...row,
      logs: sortedLogs,
      start_date: startDate,
      end_date: endDate,
      printed_at: new Date().toLocaleString('en-IN')
    });
  };

  return (
    <div>
      <div className="content-header">
        <div className="header-title">
          <h1>Supplier Attendance Console</h1>
          <p>Mark daily rosters or analyze aggregate summaries for selected periods.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button 
            onClick={() => setActiveTab('mark')} 
            className={`btn btn-sm ${activeTab === 'mark' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            <Clock size={14} /> Mark Attendance
          </button>
          <button 
            onClick={() => setActiveTab('summary')} 
            className={`btn btn-sm ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
          >
            <Calendar size={14} /> Attendance Summary
          </button>
        </div>
      </div>

      {activeTab === 'mark' ? (
        // ==================== TAB: MARK DAILY ATTENDANCE ====================
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Attendance Sheet
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={16} color="var(--accent-gold-glow)" />
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="form-control"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {loading && records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Syncing attendance sheet...
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No active suppliers found in directory. Go to Suppliers page to register them.
            </div>
          ) : (
            <div>
              {/* Suppliers Section */}
              <h3 className="section-title" style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--accent-gold-glow)' }}>Suppliers</h3>
              {records.filter(r => r.type === 'supplier').length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', padding: '1rem', fontSize: '0.9rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  No active suppliers found.
                </div>
              ) : (
                <div className="table-wrapper" style={{ marginBottom: '1.5rem' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Shift Hours</th>
                        <th style={{ textAlign: 'center' }}>Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.filter(r => r.type === 'supplier').map((rec) => (
                        <tr key={rec.supplier_id}>
                          <td>#{rec.supplier_id}</td>
                          <td style={{ fontWeight: 600 }}>{rec.supplier_name}</td>
                          <td>
                            <select 
                              value={rec.shift} 
                              onChange={(e) => handleShiftChange(rec.supplier_id, e.target.value)}
                              className="form-control"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', minWidth: '130px' }}
                            >
                              <option value="11-11">11 AM - 11 PM (Full)</option>
                              <option value="11-6">11 AM - 6 PM (Day)</option>
                              <option value="5-11">5 PM - 11 PM (Night)</option>
                            </select>
                          </td>
                          <td style={{ display: 'flex', justifyContent: 'center' }}>
                            <div className="status-selector">
                              <button 
                                onClick={() => handleStatusChange(rec.supplier_id, 'Present')}
                                className={`status-btn ${rec.status === 'Present' ? 'active present' : ''}`}
                              >
                                Present
                              </button>
                              <button 
                                onClick={() => handleStatusChange(rec.supplier_id, 'Half Day')}
                                className={`status-btn ${rec.status === 'Half Day' ? 'active half-day' : ''}`}
                              >
                                Half Day
                              </button>
                              <button 
                                onClick={() => handleStatusChange(rec.supplier_id, 'Absent')}
                                className={`status-btn ${rec.status === 'Absent' ? 'active absent' : ''}`}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Monthly Workers Section */}
              <h3 className="section-title" style={{ fontSize: '1.05rem', marginTop: '2rem', marginBottom: '0.75rem', borderLeftColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}>Monthly Workers</h3>
              {records.filter(r => r.type === 'monthly').length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', padding: '1rem', fontSize: '0.9rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  No active monthly workers found.
                </div>
              ) : (
                <div className="table-wrapper" style={{ marginBottom: '1.5rem' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Shift Hours</th>
                        <th style={{ textAlign: 'center' }}>Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.filter(r => r.type === 'monthly').map((rec) => (
                        <tr key={rec.supplier_id}>
                          <td>#{rec.supplier_id}</td>
                          <td style={{ fontWeight: 600 }}>{rec.supplier_name}</td>
                          <td>
                            <select 
                              value={rec.shift} 
                              onChange={(e) => handleShiftChange(rec.supplier_id, e.target.value)}
                              className="form-control"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', minWidth: '130px' }}
                            >
                              <option value="11-11">11 AM - 11 PM (Full)</option>
                              <option value="11-6">11 AM - 6 PM (Day)</option>
                              <option value="5-11">5 PM - 11 PM (Night)</option>
                            </select>
                          </td>
                          <td style={{ display: 'flex', justifyContent: 'center' }}>
                            <div className="status-selector">
                              <button 
                                onClick={() => handleStatusChange(rec.supplier_id, 'Present')}
                                className={`status-btn ${rec.status === 'Present' ? 'active present' : ''}`}
                              >
                                Present
                              </button>
                              <button 
                                onClick={() => handleStatusChange(rec.supplier_id, 'Half Day')}
                                className={`status-btn ${rec.status === 'Half Day' ? 'active half-day' : ''}`}
                              >
                                Half Day
                              </button>
                              <button 
                                onClick={() => handleStatusChange(rec.supplier_id, 'Absent')}
                                className={`status-btn ${rec.status === 'Absent' ? 'active absent' : ''}`}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Saving records...' : 'Save Daily Attendance'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ==================== TAB: ATTENDANCE SUMMARY ====================
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
                  onClick={fetchSummary} 
                  className="btn btn-secondary" 
                  style={{ alignSelf: 'flex-end', border: '1px solid var(--border-color)' }}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
                  Fetch Summary
                </button>
              </div>
            </div>
          </div>

          {loading && summaryData.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              Loading attendance summary...
            </div>
          ) : summaryData.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              No data available for selected range.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th style={{ textAlign: 'center' }}>Present Days</th>
                    <th style={{ textAlign: 'center' }}>Half Days</th>
                    <th style={{ textAlign: 'center' }}>Absent Days</th>
                    <th style={{ textAlign: 'center', color: 'var(--accent-gold-glow)' }}>Total Paid Days</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((row) => (
                    <tr key={row.supplier_id}>
                      <td>#{row.supplier_id}</td>
                      <td style={{ fontWeight: 600 }}>
                        {row.supplier_name}
                        <span className={`badge ${row.type === 'monthly' ? 'badge-active' : 'badge-inactive'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', marginLeft: '0.5rem', textTransform: 'capitalize' }}>
                          {row.type || 'supplier'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-present">{row.present_count} d</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-half-day">{row.half_count} d</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-absent">{row.absent_count} d</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }} className="text-gold">
                        {row.total_paid_days} d
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => setSelectedSupplierDetail(row)} 
                            className="btn btn-secondary btn-sm"
                            title="View detailed logs"
                          >
                            <FileText size={12} /> Detail Logs
                          </button>
                          <button 
                            onClick={() => handlePrintAttendance(row)} 
                            className="btn btn-secondary btn-sm"
                            title="Print attendance statement"
                          >
                            <Printer size={12} /> Print
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

      {/* DETAIL LOGS MODAL */}
      {selectedSupplierDetail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Attendance Details: {selectedSupplierDetail.supplier_name}</h2>
              <button onClick={() => setSelectedSupplierDetail(null)} className="modal-close">✕</button>
            </div>
            
            <div style={{ marginBottom: '1.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Period: <strong>{startDate}</strong> to <strong>{endDate}</strong>
            </div>

            <div className="table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shift Hours</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSupplierDetail.logs.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records logged in this period.
                      </td>
                    </tr>
                  ) : (
                    selectedSupplierDetail.logs.map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.date}</td>
                        <td>
                          {log.shift === '11-11' ? '11 AM - 11 PM (Full)' : 
                           log.shift === '11-6' ? '11 AM - 6 PM (Day)' : 
                           log.shift === '5-11' ? '5 PM - 11 PM (Night)' : log.shift}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`badge ${
                            log.status === 'Present' ? 'badge-present' : 
                            log.status === 'Half Day' ? 'badge-half-day' : 'badge-absent'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                onClick={() => handlePrintAttendance(selectedSupplierDetail)} 
                className="btn btn-primary btn-sm"
                title="Print detailed attendance statement"
              >
                <Printer size={14} /> Print Summary
              </button>
              <button onClick={() => setSelectedSupplierDetail(null)} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT-FRIENDLY ATTENDANCE STATEMENT */}
      {printAttendanceData && createPortal(
        <div className="printable-attendance-statement">
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: 'Montserrat', fontSize: '1.5rem', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
              Udumalai Cosmo Recreation Club
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              FL2 License Club Bar • Timings: 11:00 AM to 11:00 PM
            </div>
            <h3 style={{ fontSize: '1.1rem', marginTop: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {printAttendanceData.type === 'monthly' ? 'Worker' : 'Supplier'} Attendance Summary
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <div>
              <strong>{printAttendanceData.type === 'monthly' ? 'Worker' : 'Supplier'} Name:</strong> {printAttendanceData.supplier_name}<br />
              <strong>{printAttendanceData.type === 'monthly' ? 'Worker' : 'Supplier'} ID:</strong> #{printAttendanceData.supplier_id}<br />
              <strong>Summary Period:</strong> {printAttendanceData.start_date} to {printAttendanceData.end_date}
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>Printed Date:</strong> {printAttendanceData.printed_at}<br />
              <strong>Present Days:</strong> {printAttendanceData.present_count} days<br />
              <strong>Half Days:</strong> {printAttendanceData.half_count} days<br />
              <strong>Absent Days:</strong> {printAttendanceData.absent_count} days
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333', background: '#f5f5f5' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Shift Hours</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {printAttendanceData.logs.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ padding: '0.5rem', textAlign: 'center', color: '#666' }}>
                    No records logged in this period.
                  </td>
                </tr>
              ) : (
                printAttendanceData.logs.map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>{log.date}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {log.shift === '11-11' ? '11 AM - 11 PM (Full)' : 
                       log.shift === '11-6' ? '11 AM - 6 PM (Day)' : 
                       log.shift === '5-11' ? '5 PM - 11 PM (Night)' : log.shift}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                      {log.status}
                    </td>
                  </tr>
                ))
              )}
              <tr style={{ borderTop: '2px solid #333', fontSize: '1.1rem', fontWeight: 700 }}>
                <td style={{ padding: '1rem 0.5rem' }} colSpan="2">Total Calculated Paid Days</td>
                <td style={{ padding: '1rem 0.5rem', textAlign: 'right', color: '#10b981' }}>
                  {printAttendanceData.total_paid_days} days
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '4rem', fontSize: '0.85rem' }}>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
              {printAttendanceData.type === 'monthly' ? 'Worker' : 'Supplier'} Signature
            </div>
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
              Manager / Auditor Signature
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
