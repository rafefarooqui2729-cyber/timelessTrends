import React, { useState, useEffect } from 'react';
import {
  Boxes, Search, Filter, AlertTriangle, CheckCircle, ArrowDownUp,
  Download, Plus, RefreshCw, X, ShieldAlert, History, TrendingUp, DollarSign
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function InventoryManagement() {
  const { user, isSuperAdmin, isInventoryManager } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'movements'
  const [inventory, setInventory] = useState([]);
  const [valuation, setValuation] = useState(null);
  const [movements, setMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal states
  const [adjustModal, setAdjustModal] = useState({ open: false, item: null, newQty: '', reason: '' });
  const [receiveModal, setReceiveModal] = useState({
    open: false,
    item: null,
    supplierId: '',
    quantity: '',
    unitCost: '',
    reference: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  
const [stockModal, setStockModal] = useState({
  open: false,
  mode: 'add',
  variantId: '',
  quantity: '',
  type: 'damage_loss',
  reason: '',
  supplierId: '',
  unitCost: '',
  reference: '',
  notes: '',
  offerId: ''
});

const selectedStockVariant = inventory.find(
  (item) => String(item.variant_id) === stockModal.variantId
);

const [modalError, setModalError] = useState(null);

  const canEdit = isSuperAdmin || isInventoryManager;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const invRes = await api('/api/admin/inventory');
      setInventory(invRes.rows || []);
      setValuation(invRes.valuation || null);

      const suppRes = await api('/api/admin/suppliers').catch(() => []);
      setSuppliers(suppRes || []);
      if (isSuperAdmin) {
  const offersRes = await api('/api/admin/offers');
  setOffers((offersRes || []).filter((offer) => offer.status === 'active'));
}

      if (activeTab === 'movements') {
        const movRes = await api('/api/admin/stock/movements');
        setMovements(movRes || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);
  useEffect(() => {
  const isAnyModalOpen =
    stockModal.open ||
    adjustModal.open ||
    receiveModal.open;

  if (!isAnyModalOpen) return;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = previousOverflow;
  };
}, [
  stockModal.open,
  adjustModal.open,
  receiveModal.open
]);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustModal.item) return;
    const newQty = parseInt(adjustModal.newQty, 10);
    if (isNaN(newQty) || newQty < 0) {
      alert('Please specify a valid non-negative quantity');
      return;
    }
    if (!adjustModal.reason.trim()) {
      alert('A reason is mandatory for manual physical adjustments');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/admin/stock/adjust', {
        method: 'POST',
        body: {
          variantId: adjustModal.item.variant_id,
          newQuantity: newQty,
          reason: adjustModal.reason.trim()
        }
      });
      setSuccessMsg(`Stock for ${adjustModal.item.product} (${adjustModal.item.colour}) updated to ${newQty}.`);
      setAdjustModal({ open: false, item: null, newQty: '', reason: '' });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    if (!receiveModal.item) return;
    const qty = parseInt(receiveModal.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a positive quantity to receive');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId: receiveModal.supplierId ? parseInt(receiveModal.supplierId, 10) : null,
        reference: receiveModal.reference || null,
        notes: receiveModal.notes || null,
        items: [{
          variantId: receiveModal.item.variant_id,
          quantity: qty,
          unitCost: receiveModal.unitCost ? parseFloat(receiveModal.unitCost) : null
        }]
      };

      await api('/api/admin/stock/receive', {
        method: 'POST',
        body: payload
      });
      setSuccessMsg(`Received ${qty} units of ${receiveModal.item.product} (${receiveModal.item.colour}).`);
      setReceiveModal({
        open: false,
        item: null,
        supplierId: '',
        quantity: '',
        unitCost: '',
        reference: '',
        notes: '',
        offerId: ''
      });
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to receive stock');
    } finally {
      setSubmitting(false);
    }
  };

  
const handleStockManagementSubmit = async (e) => {
  e.preventDefault();
  setModalError(null);

  if (!stockModal.variantId) {
    setModalError('Please select a watch and variant.');
    return;
  }

  const variant = inventory.find(
    (item) => String(item.variant_id) === stockModal.variantId
  );

  if (!variant) {
    setModalError('The selected watch variant was not found. Refresh and try again.');
    return;
  }

  const quantity = Number(stockModal.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    setModalError('Quantity must be a positive whole number.');
    return;
  }

  if (stockModal.mode === 'remove' && !(stockModal.reason || '').trim()) {
    setModalError('A reason is required when removing stock.');
    return;
  }

  setSubmitting(true);
  setSuccessMsg(null);

  try {
    if (stockModal.mode === 'add') {
      const parsedCost = (isSuperAdmin && stockModal.unitCost !== '' && stockModal.unitCost != null)
        ? Number(stockModal.unitCost)
        : null;

      if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
        throw new Error('Unit cost must be a valid non-negative amount.');
      }

      const payload = {
        supplierId: stockModal.supplierId
          ? Number(stockModal.supplierId)
          : null,
        reference: (stockModal.reference || '').trim() || null,
        notes: (stockModal.notes || '').trim() || null,
        items: [
          {
            variantId: variant.variant_id,
            quantity,
            unitCost: parsedCost
          }
        ]
      };

      await api('/api/admin/stock/receive', {
        method: 'POST',
        body: payload
      });

      setSuccessMsg(
        `Added ${quantity} units to ${variant.product} (${variant.colour}).`
      );
    } else {
      await api('/api/admin/stock/remove', {
        method: 'POST',
        body: {
          variantId: variant.variant_id,
          quantity,
          type: stockModal.type,
          reason: (stockModal.reason || '').trim()
        }
      });

      setSuccessMsg(
        `Removed ${quantity} units from ${variant.product} (${variant.colour}).`
      );
    }

    setModalError(null);
    setStockModal({
      open: false,
      mode: 'add',
      variantId: '',
      quantity: '',
      type: 'damage_loss',
      reason: '',
      supplierId: '',
      unitCost: '',
      reference: '',
      notes: ''
    });

    await loadData();
  } catch (err) {
    setModalError(err.message || 'Failed to update stock.');
  } finally {
    setSubmitting(false);
  }
};

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.colour && item.colour.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'low_stock') return item.status === 'low_stock';
    if (statusFilter === 'out_of_stock') return item.status === 'out_of_stock';
    if (statusFilter === 'in_stock') return item.status === 'in_stock';
    return true;
  });

  const totalOnHand = inventory.reduce((acc, curr) => acc + (curr.stock_on_hand || 0), 0);
  const lowStockCount = inventory.filter((i) => i.status === 'low_stock').length;
  const outOfStockCount = inventory.filter((i) => i.status === 'out_of_stock').length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Inventory & Stock Tracking</h1>
          <p className="admin-page-subtitle">Real-time ledger of watch stock, safety thresholds, and physical counts</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          
{canEdit && (
  <>
    <button
      onClick={() =>
        setStockModal({
          open: true,
          mode: 'add',
          variantId: '',
          quantity: '',
          type: 'damage_loss',
          reason: '',
          supplierId: '',
          unitCost: '',
          reference: '',
          notes: ''
        })
      }
      className="btn btn-primary"
      disabled={loading}
    >
      <Plus size={15} /> Add Stock
    </button>

    <button
      onClick={() =>
        setStockModal({
          open: true,
          mode: 'remove',
          variantId: '',
          quantity: '',
          type: 'damage_loss',
          reason: '',
          supplierId: '',
          unitCost: '',
          reference: '',
          notes: ''
        })
      }
      className="btn btn-outline"
      disabled={loading}
    >
      <ArrowDownUp size={15} /> Remove Stock
    </button>
  </>
)}

          <a
            href="/api/admin/export/inventory"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            style={{ fontSize: '0.85rem' }}
          >
            <Download size={15} /> Export CSV
          </a>
          <button
            onClick={loadData}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
            disabled={loading}
          >
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

      {/* KPI Cards */}
      <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
        <div className="admin-stat-card">
          <span className="stat-label">Total Units on Hand</span>
          <span className="stat-value">{totalOnHand}</span>
          <span className="stat-detail">Across {inventory.length} watch variants</span>
        </div>
        <div className="admin-stat-card">
          <span className="stat-label">Low Stock Variants</span>
          <span className="stat-value" style={{ color: lowStockCount > 0 ? 'var(--admin-warning)' : 'inherit' }}>
            {lowStockCount}
          </span>
          <span className="stat-detail">Below safety threshold</span>
        </div>
        <div className="admin-stat-card">
          <span className="stat-label">Out of Stock</span>
          <span className="stat-value" style={{ color: outOfStockCount > 0 ? 'var(--admin-danger)' : 'inherit' }}>
            {outOfStockCount}
          </span>
          <span className="stat-detail">Unavailable for dispatch</span>
        </div>
        {valuation && isSuperAdmin && (
          <div className="admin-stat-card">
            <span className="stat-label">Total Inventory Valuation</span>
            <span className="stat-value" style={{ color: 'var(--admin-gold)' }}>
              ₹{Number(valuation.total_value_at_cost || 0).toLocaleString('en-IN')}
            </span>
            <span className="stat-detail">At average acquisition cost</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`admin-tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <Boxes size={16} /> Current Stock Ledger ({inventory.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'movements' ? 'active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          <History size={16} /> Stock Movement Audit ({movements.length})
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="admin-card">
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
              <input
                type="text"
                placeholder="Search watch title, brand, SKU or colour..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-input"
                style={{ paddingLeft: '36px' }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-select"
              style={{ width: 'auto', minWidth: '160px' }}
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">In Stock (Healthy)</option>
              <option value="low_stock">Low Stock (Needs Reorder)</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

          {/* Table */}
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product & Variant</th>
                  <th>SKU</th>
                  <th>Stock On Hand</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Min Threshold</th>
                  {isSuperAdmin && <th>Avg Cost</th>}
                  {isSuperAdmin && <th>Total Value</th>}
                  <th>Status</th>
                  {canEdit && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 10 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                      No inventory records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.variant_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{item.product}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }}>
                          {item.brand} • <span style={{ color: 'var(--admin-gold)' }}>{item.colour}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{item.sku}</td>
                      <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.stock_on_hand}</td>
                      <td style={{ color: item.reserved > 0 ? 'var(--admin-warning)' : 'var(--admin-text-muted)' }}>
                        {item.reserved}
                      </td>
                      <td style={{ fontWeight: 600, color: item.available <= 0 ? 'var(--admin-danger)' : 'inherit' }}>
                        {item.available}
                      </td>
                      <td style={{ color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
                        {item.min_stock || 2}
                      </td>
                      {isSuperAdmin && (
                        <td style={{ color: 'var(--admin-silver)', fontSize: '0.85rem' }}>
                          {item.avg_cost != null ? `₹${Number(item.avg_cost).toLocaleString('en-IN')}` : '—'}
                        </td>
                      )}
                      {isSuperAdmin && (
                        <td style={{ color: 'var(--admin-gold)', fontSize: '0.85rem', fontWeight: 600 }}>
                          {item.value_at_cost != null ? `₹${Number(item.value_at_cost).toLocaleString('en-IN')}` : '—'}
                        </td>
                      )}
                      <td>
                        {item.status === 'in_stock' && (
                          <span className="admin-badge badge-active">In Stock</span>
                        )}
                        {item.status === 'low_stock' && (
                          <span className="admin-badge badge-role-inv">Low Stock</span>
                        )}
                        {item.status === 'out_of_stock' && (
                          <span className="admin-badge badge-danger">Out of Stock</span>
                        )}
                      </td>
                      {canEdit && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => setAdjustModal({
                                open: true,
                                item,
                                newQty: item.stock_on_hand.toString(),
                                reason: ''
                              })}
                              className="btn btn-sm btn-outline"
                              title="Set physical count adjustment"
                            >
                              <ArrowDownUp size={13} /> Adjust
                            </button>
                            <button
                              onClick={() => setReceiveModal({
                                open: true,
                                item,
                                supplierId: '',
                                quantity: '',
                                unitCost: item.avg_cost ? item.avg_cost.toString() : '',
                                reference: '',
                                notes: ''
                              })}
                              className="btn btn-sm btn-secondary"
                              title="Receive stock shipment"
                            >
                              <Plus size={13} /> Receive
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
      )}

      {activeTab === 'movements' && (
        <div className="admin-card">
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Product & Variant</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Balance After</th>
                  <th>Reason / Notes</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                        {new Date(m.created_at || m.occurred_on).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{m.product_name}</span>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--admin-gold)' }}>{m.colour}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{m.sku}</td>
                      <td>
                        <span className="admin-badge" style={{ textTransform: 'capitalize' }}>
                          {m.movement_type ? m.movement_type.replace('_', ' ') : 'Adjustment'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: m.quantity > 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.balance_after}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--admin-silver)' }}>
                        {m.notes || '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                        {m.user_email || 'System'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      
{/* Stock Management Modal */}
{stockModal.open && (
  <div className="admin-modal-backdrop">
    <div className="admin-modal">
      <div className="admin-modal-header">
        <h3 className="admin-modal-title">
          {stockModal.mode === 'add' ? 'Add Stock' : 'Remove Stock'}
        </h3>

        <button
          type="button"
          onClick={() => {
            setModalError(null);
            setStockModal({ ...stockModal, open: false });
          }}
          className="admin-modal-close"
          disabled={submitting}
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleStockManagementSubmit}>
        <div className="admin-modal-body">
          <div className="admin-form-group">
            <label className="admin-label">Operation *</label>
            <select
              className="admin-select"
              value={stockModal.mode}
              onChange={(e) =>
                setStockModal({
                  ...stockModal,
                  mode: e.target.value
                })
              }
              disabled={submitting}
            >
              <option value="add">Add Stock</option>
              <option value="remove">Remove Stock</option>
            </select>
          </div>

          <div className="admin-form-group">
            <label className="admin-label">Select Watch & Variant *</label>
            <select
              className="admin-select"
              required
              value={stockModal.variantId}
              onChange={(e) =>
                setStockModal({
                  ...stockModal,
                  variantId: e.target.value
                })
              }
              disabled={submitting || loading}
            >
              <option value="">Choose a watch variant...</option>
              {inventory.map((item) => (
                <option
                  key={item.variant_id}
                  value={String(item.variant_id)}
                >
                  {item.product} — {item.colour} — SKU: {item.sku}
                  {' | On hand: '}{item.stock_on_hand}
                  {' | Available: '}{item.available}
                </option>
              ))}
            </select>
          </div>

          {selectedStockVariant && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderRadius: '4px'
              }}
            >
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {selectedStockVariant.product}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--admin-gold)',
                  marginTop: '4px'
                }}
              >
                Variant: {selectedStockVariant.colour}
                {' | SKU: '}{selectedStockVariant.sku}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  marginTop: '6px'
                }}
              >
                On hand: {selectedStockVariant.stock_on_hand}
                {' | Reserved: '}{selectedStockVariant.reserved}
                {' | Available: '}{selectedStockVariant.available}
              </div>
            </div>
          )}

          <div className="admin-form-group">
            <label className="admin-label">
              Quantity (whole units) *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={stockModal.quantity}
              onChange={(e) =>
                setStockModal({
                  ...stockModal,
                  quantity: e.target.value
                })
              }
              className="admin-input"
              placeholder="Enter quantity"
              disabled={submitting}
            />
          </div>

          {stockModal.mode === 'add' ? (
            <>
              {suppliers.length > 0 && (
                <div className="admin-form-group">
                  <label className="admin-label">Supplier</label>
                  <select
                    className="admin-select"
                    value={stockModal.supplierId}
                    onChange={(e) =>
                      setStockModal({
                        ...stockModal,
                        supplierId: e.target.value
                      })
                    }
                    disabled={submitting}
                  >
                    <option value="">No supplier selected</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isSuperAdmin && (
                <div className="admin-form-group">
                  <label className="admin-label">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockModal.unitCost}
                    onChange={(e) =>
                      setStockModal({
                        ...stockModal,
                        unitCost: e.target.value
                      })
                    }
                    className="admin-input"
                    placeholder="Optional acquisition cost"
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="admin-form-group">
                <label className="admin-label">
                  Purchase / Delivery Reference
                </label>
                <input
                  type="text"
                  maxLength="80"
                  value={stockModal.reference}
                  onChange={(e) =>
                    setStockModal({
                      ...stockModal,
                      reference: e.target.value
                    })
                  }
                  className="admin-input"
                  placeholder="e.g. INV-2026-088"
                  disabled={submitting}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Notes</label>
                <input
                  type="text"
                  maxLength="500"
                  value={stockModal.notes}
                  onChange={(e) =>
                    setStockModal({
                      ...stockModal,
                      notes: e.target.value
                    })
                  }
                  className="admin-input"
                  placeholder="Optional notes"
                  disabled={submitting}
                />
              </div>
            </>
          ) : (
            <>
              <div className="admin-form-group">
                <label className="admin-label">Removal Type *</label>
                <select
                  className="admin-select"
                  value={stockModal.type}
                  onChange={(e) =>
                    setStockModal({
                      ...stockModal,
                      type: e.target.value
                    })
                  }
                  disabled={submitting}
                >
                  <option value="damage_loss">Damaged / Lost</option>
                  <option value="supplier_return">Return to Supplier</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">
                  Reason for Removal *
                </label>
                <input
                  type="text"
                  maxLength="500"
                  required
                  value={stockModal.reason}
                  onChange={(e) =>
                    setStockModal({
                      ...stockModal,
                      reason: e.target.value
                    })
                  }
                  className="admin-input"
                  placeholder="Explain why stock is being removed"
                  disabled={submitting}
                />
              </div>
            </>
          )}
        </div>

          {modalError && (
            <div style={{
              margin: '0 24px',
              padding: '10px 14px',
              backgroundColor: 'rgba(220, 38, 38, 0.15)',
              border: '1px solid rgba(220, 38, 38, 0.4)',
              borderRadius: '6px',
              color: '#F87171',
              fontSize: '0.85rem',
              lineHeight: 1.4
            }}>
              {modalError}
            </div>
          )}

          <div className="admin-modal-footer">
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setStockModal({ ...stockModal, open: false });
            }}
            className="btn btn-outline"
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || loading || inventory.length === 0}
          >
            {submitting
              ? 'Saving...'
              : stockModal.mode === 'add'
                ? 'Confirm Add Stock'
                : 'Confirm Remove Stock'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {/* Adjust Modal */}
      {adjustModal.open && adjustModal.item && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Adjust Physical Stock Count</h3>
              <button
                onClick={() => setAdjustModal({ open: false, item: null, newQty: '', reason: '' })}
                className="admin-modal-close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit}>
              <div className="admin-modal-body">
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{adjustModal.item.product}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-gold)' }}>
                    {adjustModal.item.colour} • Current on hand: {adjustModal.item.stock_on_hand}
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">New Exact On-Hand Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adjustModal.newQty}
                    onChange={(e) => setAdjustModal({ ...adjustModal, newQty: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. 5"
                  />
                  <span className="admin-help-text">Directly sets the physical inventory count.</span>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Mandatory Reason / Audit Note *</label>
                  <input
                    type="text"
                    required
                    value={adjustModal.reason}
                    onChange={(e) => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. Physical count discrepancy, damaged display piece, audit adjustment"
                  />
                  <span className="admin-help-text">Audit law requires a non-empty explanation for all adjustments.</span>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setAdjustModal({ open: false, item: null, newQty: '', reason: '' })}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Updating...' : 'Save Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Stock Modal */}
      {receiveModal.open && receiveModal.item && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Receive Stock Shipment</h3>
              <button
                onClick={() => setReceiveModal({ open: false, item: null, supplierId: '', quantity: '', unitCost: '', reference: '', notes: '' })}
                className="admin-modal-close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReceiveSubmit}>
              <div className="admin-modal-body">
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{receiveModal.item.product}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-gold)' }}>
                    Variant: {receiveModal.item.colour} (Current On Hand: {receiveModal.item.stock_on_hand})
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Quantity to Add (Units) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={receiveModal.quantity}
                    onChange={(e) => setReceiveModal({ ...receiveModal, quantity: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. 10"
                  />
                </div>

                {suppliers.length > 0 && (
                  <div className="admin-form-group">
                    <label className="admin-label">Supplier</label>
                    <select
                      value={receiveModal.supplierId}
                      onChange={(e) => setReceiveModal({ ...receiveModal, supplierId: e.target.value })}
                      className="admin-select"
                    >
                      <option value="">Select supplier (optional)...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {isSuperAdmin && (
                  <div className="admin-form-group">
                    <label className="admin-label">Unit Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={receiveModal.unitCost}
                      onChange={(e) => setReceiveModal({ ...receiveModal, unitCost: e.target.value })}
                      className="admin-input"
                      placeholder="e.g. 12500"
                    />
                    <span className="admin-help-text">Used for weighted average acquisition cost calculation.</span>
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-label">PO / Delivery Reference</label>
                  <input
                    type="text"
                    value={receiveModal.reference}
                    onChange={(e) => setReceiveModal({ ...receiveModal, reference: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. INV-2026-088"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Notes</label>
                  <input
                    type="text"
                    value={receiveModal.notes}
                    onChange={(e) => setReceiveModal({ ...receiveModal, notes: e.target.value })}
                    className="admin-input"
                    placeholder="Optional receiving notes"
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setReceiveModal({ open: false, item: null, supplierId: '', quantity: '', unitCost: '', reference: '', notes: '' })}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Receiving...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default InventoryManagement;