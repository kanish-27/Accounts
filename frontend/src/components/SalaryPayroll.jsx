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
  
  // Print KOT Statement state
  const [printKotsData, setPrintKotsData] = useState(null);

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

  const handleProcessPayout = async (record = null) => {
    const isSingle = record && record.supplier_id !== undefined;
    const targetRecords = isSingle ? [record] : report.filter(r => !r.already_paid);
    
    if (targetRecords.length === 0) {
      showToast(isSingle ? 'This supplier is already paid for this period' : 'All suppliers for this period are already paid', 'error');
      return;
    }

    const confirmMsg = isSingle 
      ? `Disburse salary for ${record.supplier_name} for period ${startDate} to ${endDate}? This will log their payout in database history.`
      : `Disburse salaries for ${targetRecords.length} unpaid suppliers for period ${startDate} to ${endDate}? This will log payouts in database history.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setLoading(true);
      const payload = {
        start_date: startDate,
        end_date: endDate,
        payment_date: new Date().toISOString().split('T')[0],
        records: targetRecords.map(r => ({
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
      showToast(isSingle 
        ? `Payout for ${record.supplier_name} processed successfully!` 
        : 'Payout records processed successfully!', 'success');
      
      if (isSingle) {
        await calculatePayroll();
      }
      
      // Navigate to history to see recorded payouts
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      showToast('Error logging payouts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openPrintDialog = async (supplierSalaryData) => {
    const sDate = supplierSalaryData.start_date || startDate;
    const eDate = supplierSalaryData.end_date || endDate;
    
    let kots = [];
    try {
      const res = await fetch(`${API_BASE}/kot?supplier_id=${supplierSalaryData.supplier_id}&start_date=${sDate}&end_date=${eDate}`);
      if (res.ok) {
        kots = await res.json();
      }
    } catch (err) {
      console.error('Error fetching KOTs for payslip print:', err);
    }

    setPrintPayslipData({
      ...supplierSalaryData,
      start_date: sDate,
      end_date: eDate,
      payment_date: supplierSalaryData.payment_date || new Date().toLocaleDateString('en-IN'),
      kots: kots
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

  const handlePrintHistoryKOTs = async (payout) => {
    try {
      const kotRes = await fetch(`${API_BASE}/kot?supplier_id=${payout.supplier_id}`);
      if (!kotRes.ok) throw new Error('Failed to fetch KOTs');
      const allKots = await kotRes.json();
      
      const filteredKots = allKots.filter(kot => kot.date >= payout.start_date && kot.date <= payout.end_date);
      
      let phone = '';
      let joining_date = '';
      try {
        const supRes = await fetch(`${API_BASE}/suppliers`);
        if (supRes.ok) {
          const suppliers = await supRes.json();
          const sup = suppliers.find(s => s.id?.toString() === payout.supplier_id?.toString());
          if (sup) {
            phone = sup.phone || '';
            joining_date = sup.joining_date || '';
          }
        }
      } catch (err) {
        console.error('Error loading supplier metadata:', err);
      }
      
      setPrintKotsData({
        supplier_name: payout.supplier_name,
        supplier_id: payout.supplier_id,
        phone: phone || 'Not provided',
        joining_date: joining_date || 'Not provided',
        kots: filteredKots,
        payouts: [payout],
        printed_at: new Date().toLocaleString('en-IN'),
        already_paid: true
      });
    } catch (error) {
      console.error(error);
      showToast('Failed to load KOT statement for printing', 'error');
    }
  };

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
          <p>Compute attendance earnings and KOT commission (4% share) dynamically.</p>
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
            <div className="table-wrapper" style={{ overflowX: 'visible' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Attendance</th>
                    <th>Base Pay</th>
                    <th>Commission</th>
                    <th>Gross Salary</th>
                    <th style={{ color: 'var(--accent-crimson)' }}>Advances</th>
                    <th style={{ color: 'var(--accent-gold-glow)' }}>Net Pay</th>
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
                      <td className="text-green">
                        {formatCurrency(row.commission_amount)}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>(4% qual.)</span>
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
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {!row.already_paid && (
                            <button 
                              onClick={() => handleProcessPayout(row)} 
                              className="btn btn-success btn-sm"
                              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                              title="Process payout for this supplier"
                              disabled={loading}
                            >
                              Pay
                            </button>
                          )}
                          <button 
                            onClick={() => openPrintDialog(row)} 
                            className="btn btn-secondary btn-icon btn-sm" 
                            title="Print salary receipt"
                          >
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
      ) : (
        // ==================== PAYOUT HISTORY TAB ====================
        <div>
          {payoutHistory.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              No payout records logged yet. Use the Salary Calculator tab to disburse payouts.
            </div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: 'visible' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Payout ID</th>
                    <th>Supplier</th>
                    <th>Calculation Range</th>
                    <th>Disbursement Date</th>
                    <th>Comm. Paid (4%)</th>
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
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => openPrintDialog({ ...hist, already_paid: true })} 
                            className="btn btn-secondary btn-icon btn-sm" 
                            title="Print Salary Payslip"
                          >
                            <Printer size={12} /> Slip
                          </button>
                          <button 
                            onClick={() => handlePrintHistoryKOTs(hist)} 
                            className="btn btn-secondary btn-icon btn-sm" 
                            title="Print KOT Statement"
                            style={{ borderColor: 'var(--accent-gold-glow)', color: 'var(--accent-gold-glow)' }}
                          >
                            <Printer size={12} /> KOT
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
                      Commission Rate: 4.0% (Qualifies daily &gt;= ₹{settings?.kot_commission_limit || 250})
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

            <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.75rem', color: '#888', borderTop: '1px dashed #ccc', paddingTop: '0.75rem', marginBottom: '1.5rem' }}>
              Thank you for your service at Udumalai Cosmo Recreation Club.
            </div>

            {/* Daily KOT Bills breakdown */}
            {printPayslipData.kots && printPayslipData.kots.length > 0 && (
              <div className="print-kot-breakdown-section" style={{ marginTop: '2rem', borderTop: '2px dashed #000', paddingTop: '1.5rem', pageBreakBefore: 'auto' }}>
                <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.5px', fontFamily: 'Montserrat', fontWeight: 700 }}>
                  Daily KOT Bills & Commission Breakdown (4%)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', background: '#f5f5f5', fontWeight: 'bold' }}>
                      <th style={{ padding: '0.4rem', textAlign: 'left' }}>Bill Number</th>
                      <th style={{ padding: '0.4rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.4rem', textAlign: 'left' }}>Time</th>
                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const dailyTotals = {};
                      printPayslipData.kots.forEach(k => {
                        dailyTotals[k.date] = (dailyTotals[k.date] || 0) + (k.amount || 0);
                      });
                      const commissionLimit = settings?.kot_commission_limit || 250;

                      return printPayslipData.kots.map((kot, idx) => {
                        const dailyTotal = dailyTotals[kot.date] || 0;
                        const isQualified = (dailyTotal * 0.04) >= commissionLimit;
                        const commission = isQualified ? kot.amount * 0.04 : 0;

                        return (
                          <tr key={kot.id || idx} style={{ borderBottom: '1px solid #eee', background: isQualified ? 'transparent' : '#fff5f5' }}>
                            <td style={{ padding: '0.4rem', fontWeight: 600 }}>{kot.bill_number}</td>
                            <td style={{ padding: '0.4rem' }}>{kot.date}</td>
                            <td style={{ padding: '0.4rem' }}>{kot.time || '-'}</td>
                            <td style={{ padding: '0.4rem', textAlign: 'right' }}>{formatCurrency(kot.amount)}</td>
                            <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: isQualified ? 'bold' : 'normal' }}>
                              {isQualified ? formatCurrency(commission) : (
                                <span style={{ color: '#ef4444', fontStyle: 'italic', fontSize: '0.7rem' }}>Unqualified</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* HIDDEN PRINT-FRIENDLY KOT STATEMENT */}
      {printKotsData && createPortal(
        <div className="printable-kot-statement" style={{ position: 'relative' }}>
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

          {(() => {
            const dailyTotals = {};
            printKotsData.kots.forEach((kot) => {
              dailyTotals[kot.date] = (dailyTotals[kot.date] || 0) + (kot.amount || 0);
            });
            
            const commissionLimit = settings?.kot_commission_limit || 250;
            
            const isDateQualified = (date) => {
              const total = dailyTotals[date] || 0;
              return (total * 0.04) >= commissionLimit;
            };
            
            const isKotPaid = (kot) => {
              const payoutsList = printKotsData.payouts || [];
              return payoutsList.some(p => kot.date >= p.start_date && kot.date <= p.end_date);
            };
            
            const allPaid = printKotsData.already_paid || (printKotsData.kots.length > 0 && printKotsData.kots.every(isKotPaid));
            
            const totalGrossVolume = printKotsData.kots.reduce((sum, k) => sum + k.amount, 0);
            const totalQualifiedVolume = printKotsData.kots.reduce((sum, k) => {
              return sum + (isDateQualified(k.date) ? k.amount : 0);
            }, 0);
            const totalUnqualifiedVolume = totalGrossVolume - totalQualifiedVolume;
            const totalCommission = totalQualifiedVolume * 0.04;
            
            return (
              <>
                {allPaid && (
                  <div className="print-stamp">
                    PAID
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #333', background: '#f5f5f5' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Bill Number</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Time</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>KOT Bill Amount</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Commission (4%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printKotsData.kots.map((kot) => {
                      const isQualified = isDateQualified(kot.date);
                      const isPaid = isKotPaid(kot);
                      const commission = isQualified ? kot.amount * 0.04 : 0;
                      return (
                        <tr key={kot.id} style={{ borderBottom: '1px solid #eee', background: isQualified ? 'transparent' : '#fff5f5' }}>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{kot.bill_number}</td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>{kot.date}</td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>{kot.time}</td>
                          <td style={{ padding: '0.65rem 0.5rem', color: isPaid ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                            {isPaid ? 'Paid' : 'Unpaid'}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                            {formatCurrency(kot.amount)}
                            {!isQualified && (
                              <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 500 }}>
                                Unqualified Day
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                            {formatCurrency(commission)}
                            {!isQualified && (
                              <div style={{ fontSize: '0.7rem', color: '#999', fontStyle: 'italic' }}>
                                (Daily comm. &lt; ₹{commissionLimit})
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Totals Summary */}
                    <tr style={{ borderTop: '2px solid #333', fontSize: '0.95rem', fontWeight: 600 }}>
                      <td style={{ padding: '0.65rem 0.5rem' }} colSpan="4">Gross KOT Volume (All Bills)</td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                        {formatCurrency(totalGrossVolume)}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                        {formatCurrency(totalGrossVolume * 0.04)}
                      </td>
                    </tr>
                    
                    {totalUnqualifiedVolume > 0 && (
                      <tr style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ef4444' }}>
                        <td style={{ padding: '0.5rem' }} colSpan="4">Less: Unqualified Days Volume</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          -{formatCurrency(totalUnqualifiedVolume)}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          -{formatCurrency(totalUnqualifiedVolume * 0.04)}
                        </td>
                      </tr>
                    )}
                    
                    <tr style={{ borderTop: '1px solid #111', borderBottom: '2px solid #333', fontSize: '1.1rem', fontWeight: 700 }}>
                      <td style={{ padding: '0.75rem 0.5rem' }} colSpan="4">Total KOT Billing Volume</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        {formatCurrency(totalQualifiedVolume)}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#10b981' }}>
                        {formatCurrency(totalCommission)}
                      </td>
                    </tr>
                    
                    <tr style={{ fontSize: '1rem', fontWeight: 700 }}>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#10b981' }} colSpan="5">Est. Supplier Commission (4.0%)</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#10b981' }}>
                        {formatCurrency(totalCommission)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            );
          })()}

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
    </div>
  );
}
