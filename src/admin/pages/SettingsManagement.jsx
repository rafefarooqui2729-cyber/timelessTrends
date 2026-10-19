import React, { useState, useEffect } from 'react';
import {
  Settings, CheckCircle, AlertTriangle, RefreshCw, X, Save, Edit2, Trash2
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function SettingsManagement() {
  const { isSuperAdmin } = useAdminAuth();
  const [settings, setSettings] = useState({
    whatsapp_number: '',
    business_name: '',
    opening_cash: '',
    expense_categories: [],
    public_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/admin/settings');
      setSettings({
        whatsapp_number: data.whatsapp_number || '',
        business_name: data.business_name || '',
        opening_cash: data.opening_cash || '',
        expense_categories: data.expense_categories || [],
        public_url: data.public_url || ''
      });
    } catch (err) {
      setError(err.message || 'Failed to load store settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) loadSettings();
  }, [isSuperAdmin]);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpenseCategoriesChange = (e) => {
    const val = e.target.value;
    const arr = val.split(',').map((s) => s.trim()).filter(Boolean);
    setSettings((prev) => ({ ...prev, expense_categories: arr }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: {
          whatsapp_number: settings.whatsapp_number.trim() || null,
          business_name: settings.business_name.trim() || null,
          opening_cash: settings.opening_cash ? Number(settings.opening_cash) : null,
          expense_categories: settings.expense_categories,
          public_url: settings.public_url.trim() || null
        }
      });
      setSuccessMsg('Store settings updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-alert admin-alert-danger" style={{ marginTop: '40px' }}>
          <AlertTriangle size={18} /> Access denied. Only Super Admin can modify store settings.
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Store Settings & Configuration</h1>
          <p className="admin-page-subtitle">Adjust core brand and operational parameters used by the public site and admin tools.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadSettings} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert-danger" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="admin-alert admin-alert-success" style={{ marginBottom: '20px' }}>
          <CheckCircle size={18} /> {successMsg}
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div className="admin-card">
        <form onSubmit={handleSave}>
          <div className="admin-form-group">
            <label className="admin-label">WhatsApp Contact Number</label>
            <input
              type="text"
              placeholder="e.g. +91 98765 43210"
              value={settings.whatsapp_number}
              onChange={(e) => handleChange('whatsapp_number', e.target.value)}
              className="admin-input"
            />
            <span className="admin-help-text">Used for prefilled WhatsApp enquiry links.</span>
          </div>

          <div className="admin-form-group">
            <label className="admin-label">Business Name / Brand Tagline</label>
            <input
              type="text"
              placeholder="e.g. TIMELESS TRENDS"
              value={settings.business_name}
              onChange={(e) => handleChange('business_name', e.target.value)}
              className="admin-input"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-label">Opening Cash Balance (₹)</label>
            <input
              type="number"
              placeholder="e.g. 50000"
              value={settings.opening_cash}
              onChange={(e) => handleChange('opening_cash', e.target.value)}
              className="admin-input"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-label">Expense Categories (comma‑separated)</label>
            <input
              type="text"
              placeholder="Advertising, Packaging, Transport, Rent, Software, Miscellaneous"
              value={settings.expense_categories.join(', ')}
              onChange={handleExpenseCategoriesChange}
              className="admin-input"
            />
            <span className="admin-help-text">Default categories used in expense entry forms.</span>
          </div>

          <div className="admin-form-group">
            <label className="admin-label">Public URL (for WhatsApp links, etc.)</label>
            <input
              type="url"
              placeholder="https://timelesstrends.com"
              value={settings.public_url}
              onChange={(e) => handleChange('public_url', e.target.value)}
              className="admin-input"
            />
          </div>

          <div className="admin-modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={loadSettings} className="btn btn-outline" disabled={saving}>
              Discard Changes
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsManagement;
