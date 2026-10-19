import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, User, Plus, Edit2, Trash2, RefreshCw, AlertTriangle, CheckCircle, X
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function AdminsManagement() {
  const { isSuperAdmin } = useAdminAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal state for creating/editing admins
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'inventory_manager', // default role
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);

  const canEdit = isSuperAdmin;

  const loadAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/admin/admins');
      setAdmins(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const openCreateModal = () => {
    setEditingAdmin(null);
    setFormData({ email: '', name: '', role: 'inventory_manager', isActive: true });
    setModalOpen(true);
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      name: admin.name || '',
      role: admin.role,
      isActive: admin.is_active === 1
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      alert('Email is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        email: formData.email.trim(),
        name: formData.name.trim() || null,
        role: formData.role,
        is_active: formData.isActive ? 1 : 0
      };

      if (editingAdmin) {
        await api(`/api/admin/admins/${editingAdmin.id}`, { method: 'PATCH', body: payload });
        setSuccessMsg(`Admin "${payload.email}" updated.`);
      } else {
        await api('/api/admin/admins', { method: 'POST', body: payload });
        setSuccessMsg(`Admin "${payload.email}" created.`);
      }
      setModalOpen(false);
      await loadAdmins();
    } catch (err) {
      alert(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`Delete admin "${admin.email}"? This action cannot be undone.`)) return;
    try {
      await api(`/api/admin/admins/${admin.id}`, { method: 'DELETE' });
      setSuccessMsg(`Admin "${admin.email}" removed.`);
      await loadAdmins();
    } catch (err) {
      alert(err.message || 'Failed to delete admin');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Staff & Administrator Management</h1>
          <p className="admin-page-subtitle">Provision, role‑assign and deactivate privileged users</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadAdmins} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canEdit && (
            <button onClick={openCreateModal} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              <Plus size={15} /> Add Admin
            </button>
          )}
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
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                {canEdit && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                    No administrator accounts configured.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => (
                  <tr key={adm.id}>
                    <td style={{ fontFamily: 'monospace', color: '#fff' }}>{adm.email}</td>
                    <td>{adm.name || '—'}</td>
                    <td>{adm.role.replace('_', ' ')}</td>
                    <td>{adm.is_active ? <span className="admin-badge badge-active">Active</span> : <span className="admin-badge">Inactive</span>}</td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button onClick={() => openEditModal(adm)} className="btn btn-sm btn-outline" title="Edit Admin">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete(adm)} className="btn btn-sm btn-outline" style={{ color: 'var(--admin-danger)' }} title="Delete Admin">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Create / Edit Modal */}
      {modalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">{editingAdmin ? `Edit Admin: ${editingAdmin.email}` : 'Create New Admin'}</h3>
              <button onClick={() => setModalOpen(false)} className="admin-modal-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-label">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="admin-input"
                    placeholder="admin@example.com"
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Display Name (optional)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="admin-input"
                    placeholder="John Doe"
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="admin-select"
                  >
                    <option value="super_admin">Super Admin (full control)</option>
                    <option value="inventory_manager">Inventory Manager</option>
                    <option value="marketing_manager">Marketing Manager</option>
                  </select>
                </div>
                <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    style={{ accentColor: 'var(--admin-gold)' }}
                  />
                  <label style={{ fontSize: '0.85rem', color: '#fff' }}>Active account (allow login)</label>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : (editingAdmin ? 'Update Admin' : 'Create Admin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminsManagement;
