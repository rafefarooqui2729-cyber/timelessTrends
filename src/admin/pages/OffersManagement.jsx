import React, { useState, useEffect } from 'react';
import {
  Tag, Plus, Edit2, Trash2, CheckCircle, AlertTriangle, RefreshCw, X, Calendar, Percent, DollarSign
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function OffersManagement() {
  const { isSuperAdmin, isMarketingManager } = useAdminAuth();
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    badge_text: '',
    discount_type: 'percentage', // 'percentage' | 'fixed'
    discount_value: '',
    target_type: 'all', // 'all' | 'category' | 'product'
    target_id: '',
    starts_at: '',
    ends_at: '',
    is_active: 1
  });
  const [submitting, setSubmitting] = useState(false);

  const canEdit = isSuperAdmin || isMarketingManager;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [offersData, catsData, prodsData] = await Promise.all([
        api('/api/admin/offers'),
        api('/api/admin/categories').catch(() => []),
        api('/api/admin/products').catch(() => [])
      ]);
      setOffers(offersData || []);
      setCategories(catsData || []);
      setProducts(prodsData || []);
    } catch (err) {
      setError(err.message || 'Failed to load promotional offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingOffer(null);
    setFormData({
      title: '',
      description: '',
      badge_text: 'LIMITED OFFER',
      discount_type: 'percentage',
      discount_value: '',
      target_type: 'all',
      target_id: '',
      starts_at: '',
      ends_at: '',
      is_active: 1
    });
    setModalOpen(true);
  };

  const openEditModal = (off) => {
    setEditingOffer(off);
    setFormData({
      title: off.title || '',
      description: off.description || '',
      badge_text: off.badge_text || '',
      discount_type: off.discount_type || 'percentage',
      discount_value: off.discount_value != null ? off.discount_value.toString() : '',
      target_type: off.target_type || 'all',
      target_id: off.target_id ? off.target_id.toString() : '',
      starts_at: off.starts_at ? off.starts_at.substring(0, 10) : '',
      ends_at: off.ends_at ? off.ends_at.substring(0, 10) : '',
      is_active: off.is_active ? 1 : 0
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid positive discount amount or percentage');
      return;
    }
    if (formData.discount_type === 'percentage' && val > 100) {
      alert('Percentage discount cannot exceed 100%');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        badge_text: formData.badge_text.trim() || null,
        discount_type: formData.discount_type,
        discount_value: val,
        target_type: formData.target_type,
        target_id: formData.target_type !== 'all' && formData.target_id ? parseInt(formData.target_id, 10) : null,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
        is_active: formData.is_active ? 1 : 0
      };

      if (editingOffer) {
        await api(`/api/admin/offers/${editingOffer.id}`, {
          method: 'PUT',
          body: payload
        });
        setSuccessMsg(`Offer "${payload.title}" updated.`);
      } else {
        await api('/api/admin/offers', {
          method: 'POST',
          body: payload
        });
        setSuccessMsg(`Offer "${payload.title}" created successfully.`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to save offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (off) => {
    if (!window.confirm(`Are you sure you want to delete offer "${off.title}"?`)) return;
    try {
      await api(`/api/admin/offers/${off.id}`, { method: 'DELETE' });
      setSuccessMsg(`Offer "${off.title}" removed.`);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete offer');
    }
  };

  const getTargetDescription = (off) => {
    if (off.target_type === 'all') return 'All Catalogue Watches';
    if (off.target_type === 'category') {
      const cat = categories.find((c) => c.id === off.target_id);
      return cat ? `Collection: ${cat.name}` : `Category #${off.target_id}`;
    }
    if (off.target_type === 'product') {
      const prod = products.find((p) => p.id === off.target_id);
      return prod ? `Watch: ${prod.name}` : `Product #${off.target_id}`;
    }
    return 'Specific Items';
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Promotions & Exclusive Offers</h1>
          <p className="admin-page-subtitle">Configure percentage or flat discounts, promotional badges, and time windows</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canEdit && (
            <button onClick={openCreateModal} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              <Plus size={15} /> Create Offer
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
                <th>Offer Details</th>
                <th>Discount</th>
                <th>Target Scope</th>
                <th>Promotional Badge</th>
                <th>Validity Window</th>
                <th>Status</th>
                {canEdit && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                    No active or scheduled promotions found.
                  </td>
                </tr>
              ) : (
                offers.map((off) => (
                  <tr key={off.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>{off.title}</div>
                      {off.description && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }}>
                          {off.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--admin-gold)', fontSize: '1rem' }}>
                        {off.discount_type === 'percentage'
                          ? `${off.discount_value}% OFF`
                          : `₹${Number(off.discount_value).toLocaleString('en-IN')} OFF`}
                      </span>
                    </td>
                    <td style={{ color: 'var(--admin-silver)', fontSize: '0.85rem' }}>
                      {getTargetDescription(off)}
                    </td>
                    <td>
                      {off.badge_text ? (
                        <span className="admin-badge badge-role-super" style={{ letterSpacing: '0.06em' }}>
                          {off.badge_text}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.8rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                      {off.starts_at || off.ends_at ? (
                        <div>
                          {off.starts_at && <div>From: {off.starts_at.substring(0, 10)}</div>}
                          {off.ends_at && <div>Until: {off.ends_at.substring(0, 10)}</div>}
                        </div>
                      ) : (
                        <span>Always Active</span>
                      )}
                    </td>
                    <td>
                      {off.is_active ? (
                        <span className="admin-badge badge-active">Active</span>
                      ) : (
                        <span className="admin-badge">Inactive</span>
                      )}
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditModal(off)}
                            className="btn btn-sm btn-outline"
                            title="Edit Offer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(off)}
                            className="btn btn-sm btn-outline"
                            style={{ color: 'var(--admin-danger)' }}
                            title="Delete Offer"
                          >
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

      {/* Offer Form Modal */}
      {modalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {editingOffer ? `Edit Offer: ${editingOffer.title}` : 'Create Promotional Offer'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="admin-modal-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-label">Campaign Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. Festive Horology Celebration, Summer Clearance"
                  />
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-label">Discount Type *</label>
                    <select
                      value={formData.discount_type}
                      onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                      className="admin-select"
                    >
                      <option value="percentage">Percentage Discount (%)</option>
                      <option value="fixed">Fixed Price Reduction (₹)</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-label">Discount Value *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      className="admin-input"
                      placeholder={formData.discount_type === 'percentage' ? '15 (for 15%)' : '2000'}
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Promotional Badge Text</label>
                  <input
                    type="text"
                    value={formData.badge_text}
                    onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. 15% OFF, DIWALI SPECIAL, EXCLUSIVE"
                  />
                  <span className="admin-help-text">Displays as a stylish ribbon on watch cards.</span>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-label">Target Audience / Scope *</label>
                    <select
                      value={formData.target_type}
                      onChange={(e) => setFormData({ ...formData, target_type: e.target.value, target_id: '' })}
                      className="admin-select"
                    >
                      <option value="all">All Watches (Storewide)</option>
                      <option value="category">Specific Collection / Category</option>
                      <option value="product">Single Specific Watch</option>
                    </select>
                  </div>

                  {formData.target_type === 'category' && (
                    <div className="admin-form-group">
                      <label className="admin-label">Target Collection *</label>
                      <select
                        required
                        value={formData.target_id}
                        onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                        className="admin-select"
                      >
                        <option value="">Select category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.target_type === 'product' && (
                    <div className="admin-form-group">
                      <label className="admin-label">Target Watch *</label>
                      <select
                        required
                        value={formData.target_id}
                        onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                        className="admin-select"
                      >
                        <option value="">Select watch...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-label">Start Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.starts_at}
                      onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                      className="admin-input"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-label">End Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.ends_at}
                      onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                      className="admin-input"
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Campaign Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="admin-input"
                    placeholder="Internal marketing brief or terms..."
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Offer Status</label>
                  <select
                    value={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value, 10) })}
                    className="admin-select"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Disabled / Draft</option>
                  </select>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Saving...' : (editingOffer ? 'Update Promotion' : 'Activate Promotion')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OffersManagement;
