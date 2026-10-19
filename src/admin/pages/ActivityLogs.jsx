import React, { useState, useEffect } from 'react';
import {
  FileText, AlertTriangle, CheckCircle, RefreshCw, X, Search, Filter
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function ActivityLogs() {
  const { isSuperAdmin } = useAdminAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/admin/audit');
      setLogs(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) loadLogs();
  }, [isSuperAdmin]);

  const filtered = logs.filter((log) => {
    const s = searchTerm.toLowerCase();
    return (
      (log.action && log.action.toLowerCase().includes(s)) ||
      (log.entity && log.entity.toLowerCase().includes(s)) ||
      (log.user_email && log.user_email.toLowerCase().includes(s))
    );
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Audit & Activity Logs</h1>
          <p className="admin-page-subtitle">Record of privileged operations performed by admins</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadLogs} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert-danger" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <div className="admin-card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
            <input
              type="text"
              placeholder="Search action, entity, user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details / Payload</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--admin-text-muted)' }}>
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{log.user_email || 'System'}</td>
                    <td style={{ color: 'var(--admin-gold)' }}>{log.action}</td>
                    <td>{log.entity}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--admin-silver)' }}>{
                      typeof log.payload === 'object' ? JSON.stringify(log.payload) : String(log.payload)
                    }</td>
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

export default ActivityLogs;
