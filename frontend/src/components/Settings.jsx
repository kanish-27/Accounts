import React, { useState, useEffect } from 'react';
import { Save, ShieldAlert, Key, Sliders, UserCheck, Trash2 } from 'lucide-react';

export default function Settings({ showToast, API_BASE, settings, onSettingsUpdate }) {
  const [kotLimit, setKotLimit] = useState(settings?.kot_commission_limit || 250);
  const [adminName, setAdminName] = useState(settings?.admin_name || 'Club Manager');
  const [loading, setLoading] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // Reset database fields
  const [confirmPasswordForReset, setConfirmPasswordForReset] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleResetDatabase = async () => {
    if (!confirmPasswordForReset) {
      showToast('Admin password is required to reset database', 'error');
      return;
    }

    const firstConfirm = window.confirm(
      '⚠ WARNING: You are about to permanently reset the entire database.\n\n' +
      'This will delete all suppliers, attendance logs, KOT bills, advances, salary payouts, and settings, and restore defaults.\n\n' +
      'Are you absolutely sure you want to proceed?'
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      'FINAL WARNING: THIS OPERATION CANNOT BE UNDONE.\n\n' +
      'All data will be lost forever. Click OK to initiate the reset.'
    );
    if (!secondConfirm) return;

    try {
      setResetLoading(true);
      const res = await fetch(`${API_BASE}/system/reset-database`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: confirmPasswordForReset })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset database');

      showToast('Database reset successfully! Default data has been re-seeded.', 'success');
      setConfirmPasswordForReset('');
      if (onSettingsUpdate) onSettingsUpdate();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Error resetting database', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  // Sync settings when they load
  useEffect(() => {
    if (settings) {
      if (settings.kot_commission_limit !== undefined) {
        setKotLimit(settings.kot_commission_limit);
      }
      if (settings.admin_name !== undefined) {
        setAdminName(settings.admin_name);
      }
    }
  }, [settings]);

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kot_commission_limit: kotLimit,
          admin_name: adminName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');
      
      showToast('System settings updated successfully', 'success');
      if (onSettingsUpdate) onSettingsUpdate();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Error updating settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('All password fields are required', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 4) {
      showToast('New password must be at least 4 characters long', 'error');
      return;
    }

    try {
      setPassLoading(true);
      const res = await fetch(`${API_BASE}/settings/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      showToast('Admin password changed successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Error changing password', 'error');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div>
      <div className="content-header">
        <div className="header-title">
          <h1>System Configuration & Security</h1>
          <p>Manage default payroll rules and administrator credentials.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* General Settings Panel */}
        <form onSubmit={handleSaveGeneral} className="glass-panel" style={{ padding: '1.75rem', margin: 0 }}>
          <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>
            <Sliders size={18} color="var(--accent-gold-glow)" style={{ marginRight: '0.4rem', verticalAlign: 'middle', display: 'inline' }} />
            General Settings & Rules
          </h2>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <UserCheck size={14} /> Admin Name / Title
            </label>
            <input 
              type="text" 
              value={adminName} 
              onChange={(e) => setAdminName(e.target.value)} 
              className="form-control" 
              placeholder="e.g. Club Manager, Chief Auditor..."
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Specifies the administrator name/title for registry tracking.
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sliders size={14} /> KOT Salary Commission Daily Limit (₹)
            </label>
            <input 
              type="number" 
              value={kotLimit} 
              onChange={(e) => setKotLimit(parseFloat(e.target.value) || 0)} 
              className="form-control" 
              min="0"
              required
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              The minimum daily commission (4% share) a supplier must earn to qualify.
              Currently ₹{kotLimit} limit requires daily KOT sales volume of ₹{(kotLimit * 25).toLocaleString('en-IN')}.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={18} />
              {loading ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </form>

        {/* Security Password Panel */}
        <form onSubmit={handlePasswordChange} className="glass-panel" style={{ padding: '1.75rem', margin: 0 }}>
          <h2 className="section-title" style={{ marginBottom: '1.5rem', borderLeftColor: 'var(--accent-crimson)' }}>
            <Key size={18} color="var(--accent-crimson)" style={{ marginRight: '0.4rem', verticalAlign: 'middle', display: 'inline' }} />
            Security & Credentials
          </h2>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label>Current Admin Password</label>
            <input 
              type="password" 
              value={currentPassword} 
              onChange={(e) => setCurrentPassword(e.target.value)} 
              className="form-control" 
              placeholder="Enter current password..."
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label>New Admin Password</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              className="form-control" 
              placeholder="Min 4 characters..."
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label>Confirm New Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className="form-control" 
              placeholder="Retype new password..."
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="submit" className="btn btn-danger" disabled={passLoading}>
              <ShieldAlert size={18} />
              {passLoading ? 'Updating Password...' : 'Change Password'}
            </button>
          </div>
        </form>

        {/* Danger Zone Panel */}
        <div className="glass-panel" style={{ padding: '1.75rem', gridColumn: '1 / -1', borderLeft: '4px solid var(--accent-crimson)' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem', color: 'var(--accent-crimson)', borderLeft: 'none', paddingLeft: 0 }}>
            <Trash2 size={18} color="var(--accent-crimson)" style={{ marginRight: '0.4rem', verticalAlign: 'middle', display: 'inline' }} />
            Danger Zone - Reset System
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Permanently delete all suppliers, attendance logs, KOT bills, advances, salary payouts, and custom settings. 
            This will restore the database to its default, freshly-initialized state. <strong>This action cannot be undone.</strong>
          </p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="password" 
              placeholder="Enter admin password to confirm..." 
              value={confirmPasswordForReset} 
              onChange={(e) => setConfirmPasswordForReset(e.target.value)}
              className="form-control" 
              style={{ maxWidth: '300px', margin: 0 }}
            />
            <button 
              onClick={handleResetDatabase} 
              className="btn btn-danger"
              disabled={resetLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Trash2 size={18} />
              {resetLoading ? 'Resetting Database...' : 'Reset Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
