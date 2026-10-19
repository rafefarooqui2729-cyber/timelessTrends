import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Watch, Boxes, AlertTriangle, XCircle, Sparkles, Tag,
  ArrowUpRight, ArrowDownRight, RefreshCw, Plus, TrendingUp,
  MessageSquare, ShieldCheck
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function DashboardOverview() {
  const { user, isSuperAdmin, isInventoryManager, isMarketingManager } = useAdminAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    try {
      setLoading(true);
      const data = await api('/api/admin/dashboard/summary');
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ color: '#999', padding: '32px 0' }}>Loading dashboard intelligence...</div>;
  }

  if (error) {
    return (
      <div style={{ color: '#F87171', padding: '24px', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #7F1D1D', borderRadius: '4px' }}>
        Failed to load dashboard metrics: {error}
      </div>
    );
  }

  const { products, inventory, marketing, enquiries, alerts, recent_movements } = summary;

  return (
    <div>
      {/* Top Welcome & Quick Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: '#fff', marginBottom: '4px' }}>
            Store Operations Overview
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
            Live database ledger for Timeless Trends. All figures reflect verified catalog inventory.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={loadSummary} className="btn-admin-ghost" title="Refresh metrics">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          {isInventoryManager && (
            <Link to="/admin/products/new" className="btn-admin-gold">
              <Plus size={16} />
              <span>Add New Watch</span>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="admin-metric-grid">
        {/* Total Products */}
        <div className="admin-metric-card">
          <div className="admin-metric-header">
            <span className="admin-metric-label">Watches In Catalog</span>
            <Watch size={20} className="admin-metric-icon" />
          </div>
          <div className="admin-metric-value">{products?.total ?? 0}</div>
          <div className="admin-metric-subtext">
            {products?.published ?? 0} published &middot; {products?.draft ?? 0} draft &middot; {products?.archived ?? 0} archived
          </div>
        </div>

        {/* Total Stock */}
        <div className="admin-metric-card">
          <div className="admin-metric-header">
            <span className="admin-metric-label">Physical Stock Units</span>
            <Boxes size={20} className="admin-metric-icon" />
          </div>
          <div className="admin-metric-value">{inventory?.total_units ?? 0}</div>
          <div className="admin-metric-subtext">
            Units available across all watch variants
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="admin-metric-card" style={{ borderColor: inventory?.low_stock > 0 ? 'rgba(217, 119, 6, 0.4)' : undefined }}>
          <div className="admin-metric-header">
            <span className="admin-metric-label">Low Stock Variants</span>
            <AlertTriangle size={20} color="#FBBF24" />
          </div>
          <div className="admin-metric-value" style={{ color: inventory?.low_stock > 0 ? '#FBBF24' : '#fff' }}>
            {inventory?.low_stock ?? 0}
          </div>
          <div className="admin-metric-subtext">
            Variants at or below reorder threshold
          </div>
        </div>

        {/* Out of Stock Alert */}
        <div className="admin-metric-card" style={{ borderColor: inventory?.out_of_stock > 0 ? 'rgba(220, 38, 38, 0.4)' : undefined }}>
          <div className="admin-metric-header">
            <span className="admin-metric-label">Out of Stock</span>
            <XCircle size={20} color="#F87171" />
          </div>
          <div className="admin-metric-value" style={{ color: inventory?.out_of_stock > 0 ? '#F87171' : '#fff' }}>
            {inventory?.out_of_stock ?? 0}
          </div>
          <div className="admin-metric-subtext">
            Marked "Out of Stock" on public store
          </div>
        </div>

        {/* New Arrivals & Promotions */}
        <div className="admin-metric-card">
          <div className="admin-metric-header">
            <span className="admin-metric-label">Active Promotions</span>
            <Tag size={20} className="admin-metric-icon" />
          </div>
          <div className="admin-metric-value">{marketing?.active_offers ?? 0}</div>
          <div className="admin-metric-subtext">
            {marketing?.new_arrivals ?? 0} new arrivals &middot; {marketing?.featured ?? 0} featured
          </div>
        </div>

        {/* Customer Enquiries */}
        <div className="admin-metric-card">
          <div className="admin-metric-header">
            <span className="admin-metric-label">Customer Inquiries</span>
            <MessageSquare size={20} className="admin-metric-icon" />
          </div>
          <div className="admin-metric-value">{enquiries?.total ?? 0}</div>
          <div className="admin-metric-subtext">
            Logged WhatsApp shopping inquiries
          </div>
        </div>
      </div>

      {/* Critical Stock Alerts Section */}
      {(alerts?.low_stock?.length > 0 || alerts?.out_of_stock?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          {/* Low Stock Warning */}
          {alerts?.low_stock?.length > 0 && (
            <div className="admin-card">
              <div className="admin-card-header" style={{ borderLeft: '4px solid #D97706' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="#FBBF24" />
                  <span className="admin-card-title">Low Stock Reorder Alerts</span>
                </div>
                <Link to="/admin/inventory" className="btn-admin-ghost" style={{ fontSize: '0.75rem' }}>
                  Manage Stock &rarr;
                </Link>
              </div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Watch</th>
                      <th>Variant Colour</th>
                      <th>On Hand</th>
                      <th>Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.low_stock.map((item) => (
                      <tr key={item.variant_id}>
                        <td style={{ fontWeight: 600 }}>{item.product_name} ({item.code})</td>
                        <td>{item.colour}</td>
                        <td style={{ color: '#FBBF24', fontWeight: 700 }}>{item.stock_on_hand}</td>
                        <td style={{ color: '#888' }}>{item.min_stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Out of Stock Warning */}
          {alerts?.out_of_stock?.length > 0 && (
            <div className="admin-card">
              <div className="admin-card-header" style={{ borderLeft: '4px solid #DC2626' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={18} color="#F87171" />
                  <span className="admin-card-title">Depleted Inventory (Out of Stock)</span>
                </div>
                <Link to="/admin/inventory" className="btn-admin-ghost" style={{ fontSize: '0.75rem' }}>
                  Restock Items &rarr;
                </Link>
              </div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Watch</th>
                      <th>Variant Colour</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.out_of_stock.map((item) => (
                      <tr key={item.variant_id}>
                        <td style={{ fontWeight: 600 }}>{item.product_name} ({item.code})</td>
                        <td>{item.colour}</td>
                        <td><span className="admin-badge badge-outstock">Depleted (0)</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Movements Ledger */}
      <div className="admin-card">
        <div className="admin-card-header">
          <span className="admin-card-title">Recent Stock Adjustments & Movements</span>
          <Link to="/admin/inventory" className="btn-admin-ghost" style={{ fontSize: '0.75rem' }}>
            Full Inventory History &rarr;
          </Link>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Watch Name</th>
                <th>SKU / Colour</th>
                <th>Movement Type</th>
                <th>Qty Change</th>
                <th>Balance</th>
                <th>Reason / Detail</th>
              </tr>
            </thead>
            <tbody>
              {recent_movements?.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#777', padding: '24px' }}>
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                recent_movements.map((mov) => (
                  <tr key={mov.id}>
                    <td style={{ color: '#888', fontSize: '0.78rem' }}>
                      {new Date(mov.occurred_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ fontWeight: 600 }}>{mov.product_name}</td>
                    <td>{mov.colour} ({mov.sku})</td>
                    <td>
                      <span className="admin-badge" style={{ backgroundColor: '#222', color: '#AEB2B7' }}>
                        {mov.movement_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: mov.quantity_change > 0 ? '#4ADE80' : '#F87171' }}>
                      {mov.quantity_change > 0 ? `+${mov.quantity_change}` : mov.quantity_change}
                    </td>
                    <td style={{ fontWeight: 600 }}>{mov.new_qty}</td>
                    <td style={{ color: '#999', fontSize: '0.8rem' }}>{mov.reason || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
