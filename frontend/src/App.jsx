import React, { useState, useEffect } from 'react';
import { Wine, LayoutDashboard, Users, CalendarCheck, FileSpreadsheet, Calculator, LogOut, Lock, Check, AlertCircle, Sun, Moon, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Suppliers from './components/Suppliers';
import Attendance from './components/Attendance';
import KotBills from './components/KotBills';
import SalaryPayroll from './components/SalaryPayroll';
import Settings from './components/Settings';
import LandingPage from './components/LandingPage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://accounts-va8t.onrender.com/api');

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const [theme, setTheme] = useState('dark');

  // Set initial theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  };

  const [settings, setSettings] = useState({ kot_commission_limit: 250 });

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Automatically dismiss toast notifications
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        showToast('Admin logged in successfully', 'success');
        fetchSettings();
      } else {
        showToast(data.error || 'Invalid Admin password', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Error connecting to backend server', 'error');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setCurrentTab('dashboard');
    showToast('Logged out successfully', 'success');
  };

  // Check if current hour is within 11 AM - 11 PM
  const isClubOpen = () => {
    const currentHour = new Date().getHours();
    return currentHour >= 11 && currentHour < 23;
  };

  // Renders the correct view component based on active tab
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard setTab={setCurrentTab} showToast={showToast} API_BASE={API_BASE} settings={settings} />;
      case 'suppliers':
        return <Suppliers showToast={showToast} API_BASE={API_BASE} settings={settings} />;
      case 'attendance':
        return <Attendance showToast={showToast} API_BASE={API_BASE} settings={settings} />;
      case 'kot':
        return <KotBills showToast={showToast} API_BASE={API_BASE} settings={settings} />;
      case 'payroll':
        return <SalaryPayroll showToast={showToast} API_BASE={API_BASE} settings={settings} />;
      case 'settings':
        return <Settings showToast={showToast} API_BASE={API_BASE} settings={settings} onSettingsUpdate={fetchSettings} />;
      default:
        return <Dashboard setTab={setCurrentTab} showToast={showToast} API_BASE={API_BASE} settings={settings} />;
    }
  };

  // PUBLIC LANDING HOME PAGE
  if (!isAuthenticated) {
    return (
      <LandingPage 
        onLogin={handleLogin} 
        password={password} 
        setPassword={setPassword} 
        toast={toast}
        theme={theme}
        toggleTheme={toggleTheme}
        isClubOpen={isClubOpen}
      />
    );
  }

  // MAIN SYSTEM RENDER
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Wine className="logo-icon" />
          <div>
            <div className="logo-text">Udumalai Cosmo</div>
            <div className="logo-subtext">Recreation Club</div>
          </div>
        </div>

        <ul className="nav-links">
          <li>
            <div 
              className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </div>
          </li>
          <li>
            <div 
              className={`nav-link ${currentTab === 'suppliers' ? 'active' : ''}`}
              onClick={() => setCurrentTab('suppliers')}
            >
              <Users size={18} />
              Suppliers Directory
            </div>
          </li>
          <li>
            <div 
              className={`nav-link ${currentTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setCurrentTab('attendance')}
            >
              <CalendarCheck size={18} />
              Daily Attendance
            </div>
          </li>
          <li>
            <div 
              className={`nav-link ${currentTab === 'kot' ? 'active' : ''}`}
              onClick={() => setCurrentTab('kot')}
            >
              <FileSpreadsheet size={18} />
              KOT Bills Log
            </div>
          </li>
          <li>
            <div 
              className={`nav-link ${currentTab === 'payroll' ? 'active' : ''}`}
              onClick={() => setCurrentTab('payroll')}
            >
              <Calculator size={18} />
              Salary & Payroll
            </div>
          </li>
          <li>
            <div 
              className={`nav-link ${currentTab === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentTab('settings')}
            >
              <SettingsIcon size={18} />
              System Settings
            </div>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Timing: 11 AM - 11 PM</div>
          <div className="club-timing-badge" style={{ background: isClubOpen() ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isClubOpen() ? 'var(--accent-green)' : 'var(--accent-crimson)', borderColor: isClubOpen() ? 'var(--accent-green-border)' : 'var(--accent-crimson-border)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isClubOpen() ? 'var(--accent-green)' : 'var(--accent-crimson)', display: 'inline-block' }}></span>
            {isClubOpen() ? 'Club is Active' : 'Club is Closed'}
          </div>

          <button onClick={toggleTheme} className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} 
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <LogOut size={14} /> Lock Dashboard
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {/* Dynamic Inner Tab View */}
        {renderTabContent()}
      </main>

      {/* Global Toast Alert */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.type === 'error' ? <AlertCircle size={18} color="var(--accent-crimson)" /> : <Check size={18} color="var(--accent-green)" />}
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
