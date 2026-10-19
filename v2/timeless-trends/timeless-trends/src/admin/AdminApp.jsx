import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Err, useAction, Field } from './ui.jsx';
import Overview from './Overview.jsx';
import Products from './Products.jsx';
import { Inventory, Movements, Arrivals } from './Inventory.jsx';
import Orders from './Orders.jsx';
import { Enquiries, Expenses, Savings, Settings } from './Misc.jsx';
import { MonthlyReports, SalesProfit } from './Reports.jsx';

function Login({ onDone }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const a = useAction();
  const submit = async (e) => { e.preventDefault(); const u = await a.run(() => api.post('/api/auth/login', { email, password }), ''); if (u) onDone(u); };
  return (
    <div className="login"><form onSubmit={submit} className="login-card">
      <h1>TIMELESS <span>TRENDS</span></h1><p className="muted">Owner sign in</p>
      <Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Err e={a.error} /><button className="btn btn-dark block" disabled={a.busy}>{a.busy ? 'Signing in…' : 'Sign in'}</button>
    </form></div>
  );
}
const NAV = [['', 'Overview'], ['products', 'Products'], ['inventory', 'Inventory'], ['movements', 'Stock Movements'], ['arrivals', 'New Arrivals'], ['enquiries', 'Enquiries'],
  ['orders', 'Orders'], ['expenses', 'Expenses'], ['sales', 'Sales & Profit'], ['reports', 'Monthly Reports'], ['savings', 'Savings Tracker'], ['settings', 'Settings']];

export default function AdminApp() {
  const [user, setUser] = useState(undefined); const [open, setOpen] = useState(false); const nav = useNavigate();
  useEffect(() => { document.title = 'Dashboard · TIMELESS TRENDS'; const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m);
    api.get('/api/auth/me').then(setUser, () => setUser(null)); return () => m.remove(); }, []);
  if (user === undefined) return <p className="center-note">Loading…</p>;
  if (!user) return <Login onDone={setUser} />;
  const logout = async () => { await api.post('/api/auth/logout'); setUser(null); nav('/admin'); };
  return (
    <div className="dash">
      <aside className={open ? 'open' : ''}>
        <p className="foot-logo">TIMELESS <span>TRENDS</span></p>
        <nav onClick={() => setOpen(false)}>{NAV.map(([to, l]) => <NavLink key={to} to={`/admin/${to}`} end={to === ''}>{l}</NavLink>)}</nav>
        <div className="side-foot"><small>{user.email}</small><button className="btn small" onClick={logout}>Sign out</button><a href="/" target="_blank" rel="noreferrer">View website ↗</a></div>
      </aside>
      <div className="dash-main">
        <div className="topbar"><button className="menu-btn dark" onClick={() => setOpen(!open)} aria-label="Menu">☰</button><strong>Dashboard</strong></div>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="movements" element={<Movements />} />
          <Route path="arrivals" element={<Arrivals />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="orders" element={<Orders />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="sales" element={<SalesProfit />} />
          <Route path="reports" element={<MonthlyReports />} />
          <Route path="savings" element={<Savings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  );
}
