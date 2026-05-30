import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DollarSign, Calendar, Calculator, CheckCircle, Printer, History, RefreshCw, ArrowLeft } from 'lucide-react';

export default function SalaryPayroll({ showToast, API_BASE, settings }) {
  const [activeTab, setActiveTab] = useState('calculate'); // 'calculate' or 'history'
  
  // Date range selectors (default to current month)
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonthStr = todayStr.substring(0, 8) + '01';
  
  const [startDate, setStartDate] = useState(firstOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);
  
  const [report, setReport] = useState([]);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Print receipt state
  const [printPayslipData, setPrintPayslipData] = useState(null);

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
      setLoading(true);
      const res = await fetch(`${API_BASE}/payroll/calculate?start_date=${startDate}&end_date=${endDate}`);
      if (!res.ok) throw new Error('Calculation failed');
      const data = await res.json();
      setReport(data.report);
      showToast('Payroll calculated successfully', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error calculating payroll', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayoutHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/payroll/history`);
      if (!res.ok) throw new Error('Failed to fetch payout history');
      const data = await res.json();
      setPayoutHistory(data);
    } catch (err) {
      console.error(err);
      showToast('Error loading payout history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'calculate') {
      calculatePayroll();
    } else {
      fetchPayoutHistory();
    }
  }, [activeTab]);

  const handleProcessPayout = async () => {
    const unpaidRecords = report.filter(r => !r.already_paid);
    if (unpaidRecords.length === 0) {
      showToast('All suppliers for this period are already paid', 'error');
      return;
    }

    if (!window.confirm(`Disburse salaries for ${unpaidRecords.length} unpaid suppliers for period ${startDate} to ${endDate}? This will log payouts in database history.`)) {
      return;
    }

    try {
      setLoading(true);
      const payload = {
        start_date: startDate,
        end_date: endDate,
        payment_date: new Date().toISOString().split('T')[0],
        records: unpaidRecords.map(r => ({
          supplier_id: r.supplier_id,
          attendance_days: r.attendance_days,
          total_kot_amount: r.total_kot_amount,
          commission_amount: r.commission_amount,
          qualified_days_count: r.qualified_days_count,
          qualified_kot_amount: r.qualified_kot_amount,
          total_days_with_kots: r.total_days_with_kots,
          attendance_pay: r.attendance_pay,
          total_salary: r.total_salary,
          advance_deducted: r.advance_deducted,
          net_salary: r.net_salary
        }))
      };

      const res = await fetch(`${API_BASE}/payroll/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to process payout');
      showToast('Payout records processed successfully!', 'success');
      
      // Navigate to history to see recorded payouts
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      showToast('Error logging payouts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openPrintDialog = (supplierSalaryData) => {
    setPrintPayslipData({
      ...supplierSalaryData,
      start_date: supplierSalaryData.start_date || startDate,
      end_date: supplierSalaryData.end_date || endDate,
      payment_date: supplierSalaryData.payment_date || new Date().toLocaleDateString('en-IN')
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
          <h1>Payroll & Supplier Salary Engine</h1>
          <p>Compute attendance earnings and KOT commission (5% share) dynamically.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
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

      {activeTab === 'calculate' ? (
        // ==================== CALCULATION & PAYOUT TAB ====================
        <div>
          {/* Filters Bar */}
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
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
                  Recalculate
                </button>
              </div>

              <button 
                onClick={handleProcessPayout} 
                className={report.length > 0 && report.every(r => r.already_paid) ? "btn btn-secondary" : "btn btn-success"} 
                style={{ alignSelf: 'flex-end' }}
                disabled={loading || report.length === 0 || (report.length > 0 && report.every(r => r.already_paid))}
              >
                <CheckCircle size={18} /> 
                {report.length > 0 && report.every(r => r.already_paid) ? "All Paid for this Period" : "Disburse & Record Payouts"}
              </button>
            </div>
          </div>

          {report.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              No supplier data available for this range. Select another date range.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Attendance Break</th>
                    <th>Wage Pay (A)</th>
                    <th>Total KOT Bill</th>
                    <th>Comm. (B) *</th>
                    <th>Salary (A+B)</th>
                    <th style={{ color: 'var(--accent-crimson)' }}>Advances (C)</th>
                    <th style={{ color: 'var(--accent-gold-glow)' }}>Net Take-Home (A+B-C)</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((row) => (
                    <tr key={row.supplier_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.supplier_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wage: {formatCurrency(row.basic_daily_wage)}/day</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.9rem' }}>
                          Present: <strong>{row.present_days}</strong>, Half: <strong>{row.half_days}</strong>, Absent: <strong>{row.absent_days}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Total Paid Days: {row.attendance_days}
                        </div>
                      </td>
                      <td>{formatCurrency(row.attendance_pay)}</td>
                      <td>{formatCurrency(row.total_kot_amount)}</td>
                      <td className="text-green">
                        {formatCurrency(row.commission_amount)}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>(5% qual.)</span>
                      </td>
                      <td>{formatCurrency(row.total_salary)}</td>
                      <td style={{ color: 'var(--accent-crimson)', fontWeight: 600 }}>
                        {(row.advance_deducted || 0) > 0 ? `-${formatCurrency(row.advance_deducted)}` : formatCurrency(0)}
                      </td>
                      <td className="text-gold" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span>{formatCurrency(row.net_salary !== undefined && row.net_salary !== null ? row.net_salary : row.total_salary)}</span>
                          {row.already_paid && (
                            <span className="badge badge-present" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', fontWeight: 700 }}>Paid</span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => openPrintDialog(row)} 
                          className="btn btn-secondary btn-icon" 
                          title="Print salary receipt"
                        >
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.85rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--accent-gold-glow)' }}>
                * Note: KOT commission (5.0%) is calculated daily. A supplier only qualifies for commission on days where their daily KOT commission reaches ₹{settings?.kot_commission_limit || 250} or more (requires daily KOT of ₹{((settings?.kot_commission_limit || 250) * 20).toLocaleString('en-IN')} or above). Daily commissions below ₹{settings?.kot_commission_limit || 250} are discarded.
              </div>
            </div>
          )}
        </div>
      ) : (
        // ==================== PAYOUT HISTORY TAB ====================
        <div>
          {payoutHistory.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              No payout records logged yet. Use the Salary Calculator tab to disburse payouts.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Payout ID</th>
                    <th>Supplier</th>
                    <th>Calculation Range</th>
                    <th>Disbursement Date</th>
                    <th>Comm. Paid (5%)</th>
                    <th>Attendance Paid</th>
                    <th>Gross Salary</th>
                    <th style={{ color: 'var(--accent-crimson)' }}>Advances Deducted</th>
                    <th style={{ color: 'var(--accent-gold-glow)' }}>Net Salary Paid</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map((hist) => (
                    <tr key={hist.id}>
                      <td>#{hist.id}</td>
                      <td style={{ fontWeight: 600 }}>{hist.supplier_name}</td>
                      <td>{hist.start_date} to {hist.end_date}</td>
                      <td>{hist.payment_date}</td>
                      <td>{formatCurrency(hist.commission_amount)}</td>
                      <td>{formatCurrency(hist.attendance_pay)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({hist.attendance_days} d)</span></td>
                      <td>{formatCurrency(hist.total_salary)}</td>
                      <td style={{ color: 'var(--accent-crimson)' }}>
                        {(hist.advance_deducted || 0) > 0 ? `-${formatCurrency(hist.advance_deducted)}` : formatCurrency(0)}
                      </td>
                      <td className="text-gold" style={{ fontWeight: 700 }}>
                        {formatCurrency(hist.net_salary !== undefined && hist.net_salary !== null ? hist.net_salary : hist.total_salary)}
                      </td>
                      <td>
                        <span className="badge badge-present">Paid</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => openPrintDialog({ ...hist, already_paid: true })} 
                          className="btn btn-secondary btn-icon btn-sm" 
                          title="Reprint salary slip"
                        >
                          <Printer size={12} />
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

      {/* HIDDEN PRINT-FRIENDLY SLIP MODAL CONTAINER */}
      {printPayslipData && createPortal(
        <div className="modal-overlay print-slip-overlay">
          {/* Printable Payslip Structure */}
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
                Staff Salary Payslip
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <div>
                <strong>Supplier Name:</strong> {printPayslipData.supplier_name}<br />
                <strong>Supplier ID:</strong> #{printPayslipData.supplier_id}<br />
                <strong>Calculation Period:</strong> {printPayslipData.start_date} to {printPayslipData.end_date}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Disbursement Date:</strong> {printPayslipData.payment_date}<br />
                <strong>Base Wage Config:</strong> {formatCurrency(printPayslipData.basic_daily_wage)}/day<br />
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
                    <strong>Attendance Base Wages</strong><br />
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>
                      Present: {printPayslipData.present_days} days • Half Days: {printPayslipData.half_days} days
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    {printPayslipData.attendance_days} days
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    {formatCurrency(printPayslipData.attendance_pay)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <strong>KOT Bill Sales Commission</strong><br />
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>
                      Commission Rate: 5.0% (Qualifies daily &gt;= ₹{settings?.kot_commission_limit || 250})
                    </span>
                    {printPayslipData.total_days_with_kots !== undefined && printPayslipData.total_days_with_kots > 0 && (
                      printPayslipData.qualified_days_count < printPayslipData.total_days_with_kots ? (
                        <span style={{ color: '#666', fontStyle: 'italic', display: 'block', marginTop: '0.15rem', fontSize: '0.7rem' }}>
                          * Only {printPayslipData.qualified_days_count} of {printPayslipData.total_days_with_kots} active days qualified (Qualified KOT: {formatCurrency(printPayslipData.qualified_kot_amount)})
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', fontStyle: 'italic', display: 'block', marginTop: '0.15rem', fontSize: '0.7rem' }}>
                          * All active days qualified (100% of sales matched)
                        </span>
                      )
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    {formatCurrency(printPayslipData.total_kot_amount)}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    {formatCurrency(printPayslipData.commission_amount)}
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
                    {formatCurrency(printPayslipData.net_salary !== undefined && printPayslipData.net_salary !== null ? printPayslipData.net_salary : printPayslipData.total_salary)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '3rem', fontSize: '0.85rem' }}>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
                Supplier Signature
              </div>
              <div style={{ borderTop: '1px solid #ccc', paddingTop: '0.5rem', textAlign: 'center' }}>
                Manager / Director Signature
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.75rem', color: '#888', borderTop: '1px dashed #ccc', paddingTop: '0.75rem' }}>
              Thank you for your service at Udumalai Cosmo Recreation Club.
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
