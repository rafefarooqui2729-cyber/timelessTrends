import React, { useState, useEffect } from 'react';
import {
  Sparkles, Star, Search, RefreshCw, AlertTriangle, CheckCircle, ArrowUpDown, Filter, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function NewArrivalsManagement() {
  const { isSuperAdmin, isInventoryManager, isMarketingManager } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'new_only' | 'featured_only'
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const canEdit = isSuperAdmin || isInventoryManager || isMarketingManager;

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/admin/products');
      setProducts(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load watches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleToggle = async (product, field) => {
    if (!canEdit) return;
    setSavingId(product.id);
    const newValue = !product[field];
    try {
      await api(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        body: {
          [field]: newValue
        }
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, [field]: newValue ? 1 : 0 } : p))
      );
      setSuccessMsg(`Updated ${product.name}: ${field === 'is_new_arrival' ? 'New Arrival' : 'Featured'} set to ${newValue ? 'ON' : 'OFF'}.`);
    } catch (err) {
      alert(err.message || 'Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  const handlePriorityChange = async (product, newPriority) => {
    if (!canEdit) return;
    const prio = parseInt(newPriority, 10);
    if (isNaN(prio) || prio < 0) return;

    setSavingId(product.id);
    try {
      await api(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        body: {
          priority_order: prio
        }
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, priority_order: prio } : p))
      );
      setSuccessMsg(`Updated display priority for ${product.name} to ${prio}.`);
    } catch (err) {
      alert(err.message || 'Failed to update priority');
    } finally {
      setSavingId(null);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.category_name && p.category_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterMode === 'new_only') return Boolean(p.is_new_arrival);
    if (filterMode === 'featured_only') return Boolean(p.is_featured);
    return true;
  }).sort((a, b) => {
    // Sort by priority_order descending, then by id descending
    const pA = a.priority_order || 0;
    const pB = b.priority_order || 0;
    if (pB !== pA) return pB - pA;
    return b.id - a.id;
  });

  const totalNewArrivals = products.filter((p) => p.is_new_arrival).length;
  const totalFeatured = products.filter((p) => p.is_featured).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">New Arrivals & Featured Showcases</h1>
          <p className="admin-page-subtitle">Curate storefront highlights, hero carousels, and priority ordering</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadProducts} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
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

      {/* Highlights Summary */}
      <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="admin-stat-card">
          <span className="stat-label">New Arrival Badges</span>
          <span className="stat-value" style={{ color: 'var(--admin-gold)' }}>{totalNewArrivals}</span>
          <span className="stat-detail">Displayed with "NEW" tag in catalogue</span>
        </div>
        <div className="admin-stat-card">
          <span className="stat-label">Featured Showcase</span>
          <span className="stat-value" style={{ color: '#fff' }}>{totalFeatured}</span>
          <span className="stat-detail">Rendered in homepage curated collections</span>
        </div>
        <div className="admin-stat-card">
          <span className="stat-label">Catalogue Total</span>
          <span className="stat-value">{products.length}</span>
          <span className="stat-detail">Active watches eligible for curation</span>
        </div>
      </div>

      <div className="admin-card">
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
            <input
              type="text"
              placeholder="Search watch title, brand or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="admin-select"
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="all">All Watches ({products.length})</option>
            <option value="new_only">New Arrivals Only ({totalNewArrivals})</option>
            <option value="featured_only">Featured Only ({totalFeatured})</option>
          </select>
        </div>

        {/* Table */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Display Priority</th>
                <th>Watch Title & Collection</th>
                <th>Brand</th>
                <th>Price</th>
                <th style={{ textAlign: 'center' }}>New Arrival</th>
                <th style={{ textAlign: 'center' }}>Featured</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                    No watches match the current curation filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isBusy = savingId === p.id;
                  const primaryImg = p.images?.find((img) => img.is_primary)?.thumbnail_url || p.images?.[0]?.thumbnail_url;
                  return (
                    <tr key={p.id} style={{ opacity: isBusy ? 0.6 : 1 }}>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="999"
                          disabled={!canEdit || isBusy}
                          defaultValue={p.priority_order || 0}
                          onBlur={(e) => {
                            if (parseInt(e.target.value, 10) !== (p.priority_order || 0)) {
                              handlePriorityChange(p, e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          className="admin-input"
                          style={{ width: '70px', padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}
                          title="Higher number appears earlier in catalogue (0 = default)"
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {primaryImg && (
                            <img
                              src={primaryImg}
                              alt=""
                              style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '3px', border: '1px solid var(--admin-card-border)' }}
                            />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{p.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }}>
                              {p.category_name || 'Uncategorized'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--admin-silver)' }}>{p.brand}</td>
                      <td style={{ fontWeight: 600 }}>
                        ₹{Number(p.selling_price).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={!canEdit || isBusy}
                          onClick={() => handleToggle(p, 'is_new_arrival')}
                          className="btn btn-sm"
                          style={{
                            backgroundColor: p.is_new_arrival ? 'var(--admin-gold-soft)' : 'transparent',
                            color: p.is_new_arrival ? 'var(--admin-gold)' : 'var(--admin-text-muted)',
                            border: `1px solid ${p.is_new_arrival ? 'var(--admin-gold)' : 'var(--admin-card-border)'}`,
                            minWidth: '80px'
                          }}
                        >
                          <Sparkles size={13} /> {p.is_new_arrival ? 'Active' : 'Off'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={!canEdit || isBusy}
                          onClick={() => handleToggle(p, 'is_featured')}
                          className="btn btn-sm"
                          style={{
                            backgroundColor: p.is_featured ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                            color: p.is_featured ? '#fff' : 'var(--admin-text-muted)',
                            border: `1px solid ${p.is_featured ? 'rgba(255, 255, 255, 0.4)' : 'var(--admin-card-border)'}`,
                            minWidth: '80px'
                          }}
                        >
                          <Star size={13} /> {p.is_featured ? 'Featured' : 'Off'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/admin/products/${p.id}/edit`}
                          className="btn btn-sm btn-outline"
                          title="Open full editor"
                        >
                          Edit Watch
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default NewArrivalsManagement;
