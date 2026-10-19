import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Watch, Plus, Search, Filter, Copy, Archive, CheckCircle,
  Eye, Download, RefreshCw, AlertCircle, Edit, ExternalLink
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function ProductsList() {
  const { isInventoryManager } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedStockStatus, setSelectedStockStatus] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [selectedCategory, selectedStatus, selectedStockStatus]);

  async function loadCategories() {
    try {
      const data = await api('/api/admin/categories');
      setCategories(data);
    } catch {}
  }

  async function loadProducts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedStatus) params.set('status', selectedStatus);
      if (selectedStockStatus) params.set('stock_status', selectedStockStatus);

      const data = await api(`/api/admin/products?${params.toString()}`);
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Duplicate this watch and create a draft copy?')) return;
    try {
      const newProduct = await api(`/api/admin/products/${id}/duplicate`, { method: 'POST' });
      navigate(`/admin/products/${newProduct.id}/edit`);
    } catch (err) {
      alert('Failed to duplicate: ' + err.message);
    }
  };

  const handleArchive = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Archive this watch? It will be removed from the public website.')) return;
    try {
      await api(`/api/admin/products/${id}/archive`, { method: 'POST' });
      loadProducts();
    } catch (err) {
      alert('Failed to archive: ' + err.message);
    }
  };

  const handleRestore = async (id, e) => {
    e.stopPropagation();
    try {
      await api(`/api/admin/products/${id}/restore`, { method: 'POST' });
      loadProducts();
    } catch (err) {
      alert('Failed to restore: ' + err.message);
    }
  };

  const handleBulkSubmit = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one watch.');
      return;
    }
    if (!bulkAction) {
      alert('Please select an action to perform.');
      return;
    }
    if (!window.confirm(`Perform '${bulkAction}' on ${selectedIds.length} selected watches?`)) return;

    try {
      await api('/api/admin/products/bulk', {
        method: 'POST',
        body: {
          action: bulkAction,
          productIds: selectedIds,
          category: bulkCategory || undefined
        }
      });
      setSelectedIds([]);
      setBulkAction('');
      loadProducts();
    } catch (err) {
      alert('Bulk action failed: ' + err.message);
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(products.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [p.name, p.brand, p.code, p.model].some((k) => k && k.toLowerCase().includes(q));
  });

  return (
    <div>
      {/* Title & Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: '#fff', marginBottom: '4px' }}>
            Watches Catalog Management
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
            Create, edit, duplicate, and archive timepieces across the active catalog.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="/api/admin/export/products"
            className="btn-admin-ghost"
            title="Download CSV export"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </a>

          {isInventoryManager && (
            <Link to="/admin/products/new" className="btn-admin-gold">
              <Plus size={16} />
              <span>Add New Watch</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="admin-input"
              style={{ paddingLeft: '34px' }}
              placeholder="Search by watch name, brand, or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          </div>

          {/* Category Filter */}
          <select
            className="admin-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="admin-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          {/* Stock Status Filter */}
          <select
            className="admin-select"
            value={selectedStockStatus}
            onChange={(e) => setSelectedStockStatus(e.target.value)}
          >
            <option value="">All Stock Levels</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock Warning</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedIds.length > 0 && isInventoryManager && (
        <div style={{
          backgroundColor: 'rgba(184, 155, 98, 0.1)',
          border: '1px solid rgba(184, 155, 98, 0.3)',
          borderRadius: '4px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
            {selectedIds.length} {selectedIds.length === 1 ? 'watch' : 'watches'} selected
          </span>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="admin-select"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
            >
              <option value="">Choose bulk action...</option>
              <option value="publish">Publish</option>
              <option value="archive">Archive</option>
              <option value="activate">Activate</option>
              <option value="deactivate">Deactivate</option>
              <option value="set_category">Change Category</option>
            </select>

            {bulkAction === 'set_category' && (
              <select
                className="admin-select"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
              >
                <option value="">Select Target Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleBulkSubmit}
              className="btn-admin-gold"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              Apply Action
            </button>
          </div>
        </div>
      )}

      {/* Product Data Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === products.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={{ width: '60px' }}>Visual</th>
                <th>Code / SKU</th>
                <th>Watch Title</th>
                <th>Category</th>
                <th>Selling Price</th>
                <th>Total Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                    Loading catalog watches...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                    No watches match the current filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const totalStock = p.variants.reduce((acc, v) => acc + (v.stock_on_hand || 0), 0);
                  const isLow = p.variants.some((v) => v.stock_on_hand > 0 && v.stock_on_hand <= v.min_stock);
                  const isOut = totalStock === 0;

                  return (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelectOne(p.id)}
                        />
                      </td>

                      <td>
                        <div style={{
                          width: '44px',
                          height: '52px',
                          backgroundColor: '#111',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #333'
                        }}>
                          {p.images && p.images.length > 0 ? (
                            <img
                              src={p.images[0].url}
                              alt={p.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Watch size={18} color="#666" />
                          )}
                        </div>
                      </td>

                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#AEB2B7' }}>
                        {p.code}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>
                          <Link to={`/admin/products/${p.id}/edit`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {p.name}
                          </Link>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#888' }}>
                          {p.brand} {p.model ? `· ${p.model}` : ''}
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#AEB2B7', textTransform: 'capitalize' }}>
                          {p.category ? p.category.replace(/-/g, ' ') : '—'}
                        </span>
                      </td>

                      <td style={{ fontWeight: 600 }}>
                        {p.selling_price != null ? `₹${p.selling_price.toLocaleString('en-IN')}` : (
                          <span style={{ fontStyle: 'italic', color: '#888', fontSize: '0.78rem' }}>On request</span>
                        )}
                        {p.original_price && p.original_price > p.selling_price && (
                          <span style={{ fontSize: '0.72rem', color: '#666', textDecoration: 'line-through', marginLeft: '6px' }}>
                            ₹{p.original_price.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      <td>
                        <span className={`admin-badge ${isOut ? 'badge-outstock' : isLow ? 'badge-lowstock' : 'badge-instock'}`}>
                          {isOut ? 'Out of Stock' : `${totalStock} units`}
                        </span>
                        <div style={{ fontSize: '0.68rem', color: '#777', marginTop: '2px' }}>
                          {p.variants.length} {p.variants.length === 1 ? 'colour' : 'colours'}
                        </div>
                      </td>

                      <td>
                        <span className={`admin-badge badge-${p.status}`}>
                          {p.status}
                        </span>
                        {p.is_new_arrival === 1 && (
                          <span className="admin-badge" style={{ backgroundColor: 'rgba(184, 155, 98, 0.2)', color: '#E5C384', marginLeft: '4px' }}>
                            New
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {p.status === 'published' && (
                            <Link
                              to={`/product/${p.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-admin-ghost"
                              style={{ padding: '6px' }}
                              title="View on store"
                            >
                              <ExternalLink size={13} />
                            </Link>
                          )}

                          <Link
                            to={`/admin/products/${p.id}`}
                            className="btn-admin-ghost"
                            style={{ padding: '6px' }}
                            title="Edit watch"
                          >
                            <Edit size={13} />
                          </Link>

                          {isInventoryManager && (
                            <button
                              type="button"
                              onClick={(e) => handleDuplicate(p.id, e)}
                              className="btn-admin-ghost"
                              style={{ padding: '6px' }}
                              title="Duplicate watch"
                            >
                              <Copy size={13} />
                            </button>
                          )}

                          {isInventoryManager && (
                            p.status === 'archived' ? (
                              <button
                                type="button"
                                onClick={(e) => handleRestore(p.id, e)}
                                className="btn-admin-ghost"
                                style={{ padding: '6px', color: '#4ADE80' }}
                                title="Restore from archive"
                              >
                                <CheckCircle size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleArchive(p.id, e)}
                                className="btn-admin-ghost"
                                style={{ padding: '6px', color: '#F87171' }}
                                title="Archive watch"
                              >
                                <Archive size={13} />
                              </button>
                            )
                          )}
                        </div>
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

export default ProductsList;
