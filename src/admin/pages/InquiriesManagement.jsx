import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Search, Filter, RefreshCw, AlertTriangle, CheckCircle,
  ExternalLink, Edit2, Phone, User, Calendar, Clock, ArrowRight, X
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function InquiriesManagement() {
  const { isSuperAdmin, isInventoryManager, isMarketingManager } = useAdminAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Status edit modal
  const [editModal, setEditModal] = useState({
    open: false,
    item: null,
    status: '',
    customerName: '',
    customerContact: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const canEdit = isSuperAdmin || isInventoryManager || isMarketingManager;

  const loadEnquiries = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter !== 'all'
        ? `/api/admin/enquiries?status=${encodeURIComponent(statusFilter)}`
        : '/api/admin/enquiries';
      const data = await api(url);
      setEnquiries(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
  }, [statusFilter]);

  const openEdit = (enq) => {
    setEditModal({
      open: true,
      item: enq,
      status: enq.status || 'received',
      customerName: enq.customer_name || '',
      customerContact: enq.customer_contact || '',
      notes: enq.notes || ''
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editModal.item) return;

    setSubmitting(true);
    try {
      await api(`/api/admin/enquiries/${editModal.item.id}`, {
        method: 'PATCH',
        body: {
          status: editModal.status,
          customerName: editModal.customerName.trim() || null,
          customerContact: editModal.customerContact.trim() || null,
          notes: editModal.notes.trim() || null
        }
      });

      setSuccessMsg(`Enquiry ${editModal.item.ref} updated successfully.`);
      setEditModal({ open: false, item: null, status: '', customerName: '', customerContact: '', notes: '' });
      await loadEnquiries();
    } catch (err) {
      alert(err.message || 'Failed to update enquiry');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEnquiries = enquiries.filter((e) => {
    const s = searchTerm.toLowerCase();
    return (
      (e.ref && e.ref.toLowerCase().includes(s)) ||
      (e.product_name && e.product_name.toLowerCase().includes(s)) ||
      (e.customer_name && e.customer_name.toLowerCase().includes(s)) ||
      (e.customer_contact && e.customer_contact.toLowerCase().includes(s)) ||
      (e.colour && e.colour.toLowerCase().includes(s))
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'clicked':
        return <span className="admin-badge badge-role-inv">WhatsApp Click</span>;
      case 'received':
        return <span className="admin-badge badge-role-mkt">Conversation Open</span>;
      case 'converted':
        return <span className="admin-badge badge-active">Order Converted</span>;
      case 'closed':
        return <span className="admin-badge">Closed / Passed</span>;
      default:
        return <span className="admin-badge">{status}</span>;
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Customer WhatsApp Inquiries</h1>
          <p className="admin-page-subtitle">Track incoming watch consultations, client enquiries, and conversation status</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadEnquiries} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
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
        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
            <input
              type="text"
              placeholder="Search reference, watch name, customer name or phone..."
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
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="all">All Inquiries</option>
            <option value="clicked">WhatsApp Clicks</option>
            <option value="received">Conversations Open</option>
            <option value="converted">Converted Orders</option>
            <option value="closed">Closed / Archived</option>
          </select>
        </div>

        {/* Table */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Enquired Watch</th>
                <th>Client / Contact</th>
                <th>Source</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Internal Notes</th>
                {canEdit && <th style={{ textAlign: 'right' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                    No customer inquiry logs found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEnquiries.map((enq) => (
                  <tr key={enq.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--admin-gold)', fontSize: '0.82rem' }}>
                      {enq.ref}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>
                        {enq.product_name || 'General Inquiry'}
                      </div>
                      {enq.colour && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--admin-gold)' }}>
                          Variant: {enq.colour}
                        </div>
                      )}
                    </td>
                    <td>
                      {enq.customer_name ? (
                        <div style={{ fontWeight: 600, color: '#fff' }}>{enq.customer_name}</div>
                      ) : (
                        <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.82rem' }}>Anonymous</div>
                      )}
                      {enq.customer_contact && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--admin-silver)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={11} /> {enq.customer_contact}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--admin-silver)', textTransform: 'capitalize' }}>
                      {enq.source || 'WhatsApp'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                      {new Date(enq.created_at).toLocaleString()}
                    </td>
                    <td>{getStatusBadge(enq.status)}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--admin-silver)', maxWidth: '200px' }}>
                      {enq.notes || '—'}
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => openEdit(enq)}
                          className="btn btn-sm btn-outline"
                          title="Update Status & Client Notes"
                        >
                          <Edit2 size={13} /> Update
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal.open && editModal.item && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Update Inquiry: {editModal.item.ref}</h3>
              <button onClick={() => setEditModal({ open: false, item: null, status: '', customerName: '', customerContact: '', notes: '' })} className="admin-modal-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="admin-modal-body">
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{editModal.item.product_name || 'Store Inquiry'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-gold)' }}>
                    {editModal.item.colour ? `Colour: ${editModal.item.colour}` : 'General Inquiry'} • Logged: {new Date(editModal.item.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Inquiry Progression Status *</label>
                  <select
                    value={editModal.status}
                    onChange={(e) => setEditModal({ ...editModal, status: e.target.value })}
                    className="admin-select"
                  >
                    <option value="clicked">Clicked WhatsApp Link</option>
                    <option value="received">In Active Conversation</option>
                    <option value="converted">Confirmed / Converted to Sale</option>
                    <option value="closed">Closed / Not Interested</option>
                  </select>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Customer Name</label>
                  <input
                    type="text"
                    value={editModal.customerName}
                    onChange={(e) => setEditModal({ ...editModal, customerName: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Customer Phone / WhatsApp Number</label>
                  <input
                    type="text"
                    value={editModal.customerContact}
                    onChange={(e) => setEditModal({ ...editModal, customerContact: e.target.value })}
                    className="admin-input"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Consultation Notes & Delivery Address</label>
                  <textarea
                    rows={3}
                    value={editModal.notes}
                    onChange={(e) => setEditModal({ ...editModal, notes: e.target.value })}
                    className="admin-input"
                    placeholder="Notes from WhatsApp chat, requested customization, delivery PIN code..."
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, item: null, status: '', customerName: '', customerContact: '', notes: '' })}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Updating...' : 'Save Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InquiriesManagement;
