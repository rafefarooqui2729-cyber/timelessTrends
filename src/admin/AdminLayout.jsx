import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Watch, Boxes, Layers, Sparkles, Tag,
  Image as ImageIcon, MessageSquare, ShieldCheck, FileText,
  Settings, LogOut, ExternalLink, Menu, X, Bell
} from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import './admin.css';

export function AdminLayout() {
  const { user, loading, logout, isSuperAdmin } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D0D0D', color: '#B89B62' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', letterSpacing: '0.15em', display: 'block', marginBottom: '8px' }}>
            TIMELESS TRENDS
          </span>
          <span style={{ fontSize: '0.85rem', color: '#9E9E9E', letterSpacing: '0.1em' }}>
            Verifying administrative session...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/products', label: 'Watches Catalog', icon: Watch },
    { to: '/admin/inventory', label: 'Inventory & Stock', icon: Boxes },
    { to: '/admin/categories', label: 'Categories', icon: Layers },
    { to: '/admin/new-arrivals', label: 'New & Featured', icon: Sparkles },
    { to: '/admin/offers', label: 'Offers & Promos', icon: Tag },
    { to: '/admin/media', label: 'Media Library', icon: ImageIcon },
    { to: '/admin/inquiries', label: 'Inquiries (WhatsApp)', icon: MessageSquare },
    ...(isSuperAdmin ? [{ to: '/admin/admins', label: 'Staff & Admins', icon: ShieldCheck }] : []),
    { to: '/admin/activity-logs', label: 'Activity Logs', icon: FileText },
    ...(isSuperAdmin ? [{ to: '/admin/settings', label: 'Store Settings', icon: Settings }] : [])
  ];

  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
      case 'owner':
        return <span className="admin-badge badge-role-super">Super Admin</span>;
      case 'inventory_manager':
        return <span className="admin-badge badge-role-inv">Inventory Mgr</span>;
      case 'marketing_manager':
        return <span className="admin-badge badge-role-mkt">Marketing Mgr</span>;
      default:
        return <span className="admin-badge">{role}</span>;
    }
  };

  return (
    <div className="admin-shell">
      {/* Sidebar Navigation */}
      <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <span className="admin-brand-title">TIMELESS TRENDS</span>
          <span className="admin-brand-subtitle">Management Console</span>
        </div>

        <nav className="admin-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-pill">
            <div className="admin-user-info">
              <span className="admin-user-name">{user.name || user.email.split('@')[0]}</span>
              <span className="admin-user-role">{getRoleBadge(user.role)}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-admin-ghost"
              style={{ padding: '6px', border: 'none' }}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Administrative Work Area */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              type="button"
              className="btn-admin-ghost"
              style={{ padding: '8px', display: 'flex' }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle mobile sidebar"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="admin-topbar-title">Timeless Trends Administration</span>
          </div>

          <div className="admin-topbar-actions">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-admin-ghost"
              style={{ fontSize: '0.8rem' }}
            >
              <ExternalLink size={14} />
              <span>View Public Store</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="btn-admin-ghost"
              style={{ fontSize: '0.8rem' }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
