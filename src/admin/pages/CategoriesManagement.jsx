import React, { useState, useEffect } from 'react';
import {
  Layers, Plus, Edit2, Trash2, CheckCircle, AlertTriangle, RefreshCw, X, Image as ImageIcon
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function CategoriesManagement() {
  const { user, isSuperAdmin, isInventoryManager, isMarketingManager } = useAdminAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    display_order: 0,
    is_active: 1
  });
  const [submitting, setSubmitting] = useState(false);

  const canEdit = isSuperAdmin || isInventoryManager || isMarketingManager;

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/admin/categories');
      setCategories(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      image_url: '',
      display_order: categories.length + 1,
      is_active: 1
    });
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      image_url: cat.image_url || '',
      display_order: cat.display_order || 0,
      is_active: cat.is_active ? 1 : 0
    });
    setModalOpen(true);
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    if (!editingCategory) {
      setFormData((prev) => ({
        ...prev,
        name: val,
        slug: generateSlug(val)
      }));
    } else {
      setFormData((prev) => ({ ...prev, name: val }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Category name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || generateSlug(formData.name),
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        display_order: parseInt(formData.display_order, 10) || 0,
        is_active: formData.is_active ? 1 : 0
      };

      if (editingCategory) {
        await api(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: payload
        });
        setSuccessMsg(`Category "${payload.name}" updated successfully.`);
      } else {
        await api('/api/admin/categories', {
          method: 'POST',
          body: payload
        });
        setSuccessMsg(`Category "${payload.name}" created successfully.`);
      }

      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      alert(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat) => {
    if (cat.product_count > 0) {
      alert(`Cannot delete "${cat.name}": There are ${cat.product_count} active watches assigned to this category. Reassign or remove those watches first to preserve catalogue integrity.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete category "${cat.name}"?`)) {
      return;
    }

    try {
      await api(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
      setSuccessMsg(`Category "${cat.name}" deleted.`);
      await loadCategories();
    } catch (err) {
      alert(err.message || 'Failed to delete category');
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Category Architecture</h1>
          <p className="admin-page-subtitle">Organize luxury watch lines into curated customer collections</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadCategories} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canEdit && (
            <button onClick={openCreateModal} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              <Plus size={15} /> Add Category
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
                <th style={{ width: '60px' }}>Order</th>
                <th>Category Name</th>
                <th>Slug</th>
                <th>Assigned Watches</th>
                <th>Description</th>
                <th>Status</th>
                {canEdit && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                    No categories defined yet.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: 600, color: 'var(--admin-gold)' }}>
                      #{cat.display_order}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>{cat.name}</div>
                      {cat.image_url && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <ImageIcon size={12} /> Banner linked
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--admin-silver)' }}>
                      {cat.slug}
                    </td>
                    <td>
                      <span className="admin-badge" style={{ backgroundColor: cat.product_count > 0 ? 'var(--admin-gold-soft)' : 'transparent', color: cat.product_count > 0 ? 'var(--admin-gold)' : 'var(--admin-text-muted)' }}>
                        {cat.product_count || 0} watches
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--admin-silver)', maxWidth: '280px' }}>
                      {cat.description || '—'}
                    </td>
                    <td>
                      {cat.is_active ? (
                        <span className="admin-badge badge-active">Live</span>
                      ) : (
                        <span className="admin-badge">Hidden</span>
                      )}
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditModal(cat)}
                            className="btn btn-sm btn-outline"
                            title="Edit Category"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            className="btn btn-sm btn-outline"
                            style={{ color: cat.product_count > 0 ? 'var(--admin-text-muted)' : 'var(--admin-danger)' }}
                            title={cat.product_count > 0 ? 'Cannot delete: watches assigned' : 'Delete category'}
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

      {/* Category Edit / Create Modal */}
      {modalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Watch Category'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="admin-modal-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-label">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleNameChange}
                    className="admin-input"
                    placeholder="e.g. Chronographs, Dive Watches, Dress"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. chronographs"
                  />
                  <span className="admin-help-text">Used in navigation URL: /collections/:slug</span>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="admin-input"
                    placeholder="Curated editorial description for this collection..."
                  />
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-label">Display Order</label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                      className="admin-input"
                      placeholder="0"
                    />
                    <span className="admin-help-text">Sort position in store menus.</span>
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-label">Status</label>
                    <select
                      value={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value, 10) })}
                      className="admin-select"
                    >
                      <option value={1}>Active & Live in Store</option>
                      <option value={0}>Draft / Hidden</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Collection Banner URL (Optional)</label>
                  <input
                    type="text"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. /uploads/banner-chronos.webp"
                  />
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
                  {submitting ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoriesManagement;
