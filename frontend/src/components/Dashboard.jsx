import React, { useState, useEffect } from 'react';
import { Wine, Users, CalendarCheck, TrendingUp, DollarSign, Clock, Trophy, Activity, RefreshCw, BarChart2 } from 'lucide-react';

export default function Dashboard({ setTab, showToast, API_BASE, settings }) {
  const [stats, setStats] = useState({
    today_date: new Date().toISOString().split('T')[0],
    today_kot_total: 0,
    active_suppliers_count: 0,
    present_suppliers_count: 0,
    mtd_kot_total: 0,
    mtd_estimated_salary: 0,
    avg_bill_today: 0,
    top_supplier: null,
    supplier_leaderboard: [],
    weekly_trend: [],
    recent_activities: [],
    recent_kots: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      
      const res = await fetch(`${API_BASE}/dashboard/stats`);
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error(error);
      showToast('Error loading dashboard statistics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDayName = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <RefreshCw className="spin-animation" size={36} color="var(--accent-gold-glow)" />
          <div style={{ color: 'var(--accent-gold-glow)', fontWeight: 600, letterSpacing: '0.5px' }}>
            Syncing Club Ledger...
          </div>
        </div>
      </div>
    );
  }

  // Construct SVG Area Chart Points
  const trendTotals = stats.weekly_trend.map(t => t.total);
  const maxTrend = Math.max(...trendTotals, 5000); // default minimum cap to avoid flat layouts
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  const points = stats.weekly_trend.map((item, index) => {
    const x = paddingX + (index * (chartWidth - paddingX * 2) / (stats.weekly_trend.length - 1));
    const y = chartHeight - paddingY - (item.total / maxTrend) * (chartHeight - paddingY * 2);
    return { x, y, date: item.date, total: item.total };
  });

  const pathString = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaString = points.length > 0 
    ? `${pathString} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : '';

  // Get leading supplier total for leaderboard sizing
  const leaderTotal = stats.supplier_leaderboard.length > 0 ? stats.supplier_leaderboard[0].total : 1;

  return (
    <div>
      {/* Premium Dashboard Header */}
      <div className="content-header" style={{ marginBottom: '2rem' }}>
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-gold-glow)', boxShadow: '0 0 8px var(--accent-gold-glow)' }}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-gold-glow)', letterSpacing: '1px' }}>
              Management Console
            </span>
          </div>
          <h1 style={{ marginTop: '0.25rem' }}>Udumalai Cosmo Recreation Club</h1>
          <p>Real-time salary settlements, KOT tracking, and shift rosters.</p>
        </div>
        <div className="header-actions">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, background: 'rgba(255,255,255,0.02)', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            📅 {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button 
            onClick={() => fetchStats(true)} 
            className="btn btn-secondary btn-icon" 
            style={{ borderRadius: '50%' }}
            title="Refresh statistics"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards Row (6 Columns) */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
        <div className="card blue-header">
          <span className="card-title">Present Today</span>
          <span className="card-value" style={{ fontSize: '1.85rem' }}>
            {stats.present_suppliers_count} / {stats.active_suppliers_count}
          </span>
          <span className="card-desc">Staff present today</span>
          <div className="card-icon-wrapper"><CalendarCheck size={36} /></div>
        </div>

        <div className="card green-header">
          <span className="card-title">MTD Commission</span>
          <span className="card-value" style={{ fontSize: '1.85rem' }}>{formatCurrency(stats.mtd_commission || 0)}</span>
          <span className="card-desc">Total commission earned this month</span>
          <div className="card-icon-wrapper"><DollarSign size={36} /></div>
        </div>

        <div className="card gold-header">
          <span className="card-title">Outstanding Advances</span>
          <span className="card-value" style={{ fontSize: '1.85rem' }}>{formatCurrency(stats.total_pending_advances || 0)}</span>
          <span className="card-desc">Total unpaid cash advances</span>
          <div className="card-icon-wrapper"><TrendingUp size={36} /></div>
        </div>

        <div className="card gold-header">
          <span className="card-title">Month-To-Date KOT</span>
          <span className="card-value" style={{ fontSize: '1.85rem' }}>{formatCurrency(stats.mtd_kot_total)}</span>
          <span className="card-desc">Cumulative KOT volume</span>
          <div className="card-icon-wrapper"><TrendingUp size={36} /></div>
        </div>

        <div className="card green-header">
          <span className="card-title">Last Month's KOT</span>
          <span className="card-value" style={{ fontSize: '1.85rem' }}>{formatCurrency(stats.last_month_kot_total || 0)}</span>
          <span className="card-desc">
            Total KOT volume in {(() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 1);
              return d.toLocaleDateString('en-US', { month: 'long' });
            })()}
          </span>
          <div className="card-icon-wrapper"><TrendingUp size={36} /></div>
        </div>

        <div className="card gold-header">
          <span className="card-title">MTD Top Supplier</span>
          <span className="card-value" style={{ fontSize: '1.25rem', height: '40px', display: 'flex', alignItems: 'center', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stats.top_supplier ? stats.top_supplier.name : 'None'}
          </span>
          <span className="card-desc">
            {stats.top_supplier ? `Volume: ${formatCurrency(stats.top_supplier.total)}` : 'No logs recorded'}
          </span>
          <div className="card-icon-wrapper"><Trophy size={36} /></div>
        </div>
      </div>

      {/* Main Grid Layout (Redesigned for perfect vertical and horizontal alignment) */}
      <div className="dashboard-layout-row-1" style={{ marginTop: '1rem' }}>
        {/* Visual Trend Chart */}
        <div className="chart-container" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
              <BarChart2 size={18} color="var(--accent-gold-glow)" style={{ marginRight: '0.4rem', verticalAlign: 'middle', display: 'inline' }} />
              7-Day KOT Sales Volume Trend
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Scale Cap: {formatCurrency(maxTrend)}
            </span>
          </div>

          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="chart-svg" style={{ flexGrow: 1 }}>
            <defs>
              <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-gold-glow)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent-gold-glow)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} className="chart-grid" />
            <line x1={paddingX} y1={(chartHeight) / 2} x2={chartWidth - paddingX} y2={(chartHeight) / 2} className="chart-grid" />
            <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} className="chart-grid" />

            {/* Fill Area */}
            {areaString && <path d={areaString} className="chart-area" />}

            {/* Glowing Bezier Curve */}
            {pathString && <path d={pathString} className="chart-line" />}

            {/* Data Node Rings */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="5" 
                  fill="var(--bg-dark)" 
                  stroke="var(--accent-gold-glow)" 
                  strokeWidth="3" 
                  style={{ cursor: 'pointer' }}
                />
                {/* Tooltip value */}
                <text 
                  x={p.x} 
                  y={p.y - 12} 
                  textAnchor="middle" 
                  fill="var(--text-primary)" 
                  fontSize="9px" 
                  fontWeight="600"
                >
                  {p.total > 0 ? formatCurrency(p.total).replace('₹', '') : ''}
                </text>
                {/* Axis Labels */}
                <text 
                  x={p.x} 
                  y={chartHeight - 10} 
                  textAnchor="middle" 
                  className="chart-axis-txt"
                >
                  {getDayName(p.date)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Quick Actions Panel */}
        <div className="glass-panel" style={{ margin: 0, padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="section-title" style={{ border: 'none', padding: 0, marginBottom: '1.25rem' }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <button onClick={() => setTab('kot')} className="btn btn-primary" style={{ width: '100%' }}>
              Log New KOT Bill
            </button>
            <button onClick={() => setTab('attendance')} className="btn btn-secondary" style={{ width: '100%' }}>
              Mark Attendance
            </button>
            <button onClick={() => setTab('payroll')} className="btn btn-secondary" style={{ width: '100%', borderColor: 'rgba(255,255,255,0.06)' }}>
              Open Salary Calculator
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: 3-column equal height layout */}
      <div className="dashboard-layout-row-2">
        {/* Column 1: Recent KOT entries */}
        <div className="glass-panel">
          <div className="section-title">
            <Wine size={18} color="var(--accent-gold-glow)" style={{ marginRight: '0.4rem', verticalAlign: 'middle', display: 'inline' }} />
            Recent KOT Entries
          </div>
          <div className="glass-panel-content">
            {stats.recent_kots.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No KOT bills logged today.
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Bill No.</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Supplier</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Time</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_kots.map((kot) => (
                      <tr key={kot.id}>
                        <td style={{ fontWeight: 600, padding: '0.75rem 0.5rem' }}>{kot.bill_number}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>{kot.supplier_name}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{kot.time}</td>
                        <td className="text-gold" style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(kot.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Supplier Leaderboard */}
        <div className="glass-panel">
          <div className="section-title">
            <Trophy size={18} color="var(--accent-gold-glow)" style={{ marginRight: '0.4rem', verticalAlign: 'middle', display: 'inline' }} />
            Supplier Leaderboard (MTD)
          </div>
          <div className="glass-panel-content">
            {stats.supplier_leaderboard.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No active records.
              </div>
            ) : (
              <div className="leaderboard-list">
                {stats.supplier_leaderboard.map((item, index) => {
                  const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
                  return (
                    <div className="leaderboard-item" key={index} style={{ padding: '0.65rem 0.85rem' }}>
                      <div className={`leaderboard-rank ${rankClass}`}>
                        {index + 1}
                      </div>
                      <div className="leaderboard-info">
                        <div className="leaderboard-name" style={{ fontSize: '0.85rem' }}>{item.name}</div>
                      </div>
                      <div className="leaderboard-value" style={{ fontSize: '0.85rem' }}>
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Live System Log */}
        <div className="glass-panel">
          <div className="section-title">
            <Activity size={18} color="var(--accent-gold-glow)" style={{ marginRight: '0.4rem', verticalAlign: 'middle', display: 'inline' }} />
            Live System Activity Log
          </div>
          <div className="glass-panel-content">
            {stats.recent_activities.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No activity logged yet.
              </div>
            ) : (
              <div className="activity-list" style={{ gap: '0.85rem' }}>
                {stats.recent_activities.map((act, index) => (
                  <div className="activity-item" key={index} style={{ paddingBottom: '0.65rem', gap: '0.65rem' }}>
                    <div className={`activity-icon-wrapper ${act.type}`} style={{ padding: '0.35rem' }}>
                      {act.type === 'kot' ? <Wine size={12} /> : act.type === 'attendance' ? <CalendarCheck size={12} /> : <DollarSign size={12} />}
                    </div>
                    <div className="activity-details">
                      <div className="activity-desc" style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>{act.desc}</div>
                      <div className="activity-time" style={{ fontSize: '0.65rem' }}>{act.date} | {act.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
