import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { Badge, Bars, Card, Empty, Err, Field, Panel, money, today, useAction } from './ui.jsx';

export function Enquiries() {
  const { data, error, reload } = useLoad(() => api.get('/api/admin/enquiries'), []); const [mp, setMp] = useState({}); const a = useAction();
  const prods = useLoad(() => api.get('/api/admin/inventory'), []); const [f, setF] = useState({ variantId: '', customerName: '', customerContact: '', notes: '' });
  const label = { clicked: 'WhatsApp button clicked', received: 'Enquiry received', converted: 'Became an order', closed: 'Closed' };
  return <div className="page"><h1>Enquiries</h1>
    <p className="muted">A WhatsApp button click only means someone tapped the button. It is not an order. Mark it “received” once the customer actually messages you.</p>
    <Panel title="Record an enquiry from WhatsApp"><form className="form grid2" onSubmit={async (e) => { e.preventDefault(); const row = prods.data.rows.find((r) => String(r.variant_id) === f.variantId);
      if (await a.run(() => api.post('/api/admin/enquiries', { productId: row?.product_id ?? null, variantId: row?.variant_id ?? null, customerName: f.customerName || null, customerContact: f.customerContact || null, notes: f.notes || null }), 'Recorded')) { setF({ variantId: '', customerName: '', customerContact: '', notes: '' }); reload(); } }}>
      <Field label="Watch"><select value={f.variantId} onChange={(e) => setF({ ...f, variantId: e.target.value })}><option value="">—</option>{prods.data?.rows.map((r) => <option key={r.variant_id} value={r.variant_id}>{r.product} — {r.colour}</option>)}</select></Field>
      <Field label="Customer name"><input value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} /></Field>
      <Field label="Contact (optional)"><input value={f.customerContact} onChange={(e) => setF({ ...f, customerContact: e.target.value })} /></Field>
      <Field label="Notes"><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field><Err e={a.error} /><div><button className="btn btn-dark">Save enquiry</button></div></form></Panel>
    <Panel title="All enquiries"><Err e={error} />{data && (data.length ? <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Date</th><th>Watch</th><th>Customer</th><th>Status</th><th /></tr></thead><tbody>
      {data.map((e) => <tr key={e.id}><td>{e.ref}</td><td>{e.created_on}</td><td>{e.product_name || '—'} {e.colour && `· ${e.colour}`}</td><td>{e.customer_name || '—'}</td><td><Badge s={e.status} /> <small>{label[e.status]}</small></td>
        <td>{e.status === 'clicked' && <button className="btn small" onClick={() => a.run(async () => { await api.patch(`/api/admin/enquiries/${e.id}`, { status: 'received' }); reload(); }, '')}>Mark received</button>}
          {['clicked', 'received'].includes(e.status) && <> <Link className="btn small" to={`/admin/orders?enquiry=${e.id}${e.variant_id ? `&variant=${e.variant_id}` : ''}`}>Create order</Link> <button className="btn small" onClick={() => a.run(async () => { await api.patch(`/api/admin/enquiries/${e.id}`, { status: 'closed' }); reload(); }, '')}>Close</button></>}</td></tr>)}</tbody></table></div> : <Empty>No enquiries yet.</Empty>)}</Panel></div>;
}

export function Expenses() {
  const s = useLoad(() => api.get('/api/admin/settings'), []); const { data, error, reload } = useLoad(() => api.get('/api/admin/expenses'), []);
  const [f, setF] = useState({ expenseOn: today(), category: '', amount: '', description: '', paymentMethod: '' }); const a = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const byCat = Object.entries((data || []).reduce((m, e) => ({ ...m, [e.category]: (m[e.category] || 0) + e.amount }), {})).map(([name, amount]) => ({ name, amount }));
  return <div className="page"><h1>Expenses</h1>
    <Panel title="Record an expense"><form className="form grid2" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api.post('/api/admin/expenses', { expenseOn: f.expenseOn, category: f.category, amount: Number(f.amount), description: f.description || null, paymentMethod: f.paymentMethod || null }))) { setF({ ...f, amount: '', description: '' }); reload(); } }}>
      <Field label="Date"><input type="date" value={f.expenseOn} onChange={set('expenseOn')} /></Field>
      <Field label="Category *"><select required value={f.category} onChange={set('category')}><option value="">Select…</option>{s.data?.expense_categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Amount ₹ *"><input required type="number" min="0.01" step="any" value={f.amount} onChange={set('amount')} /></Field>
      <Field label="Description"><input value={f.description} onChange={set('description')} /></Field>
      <Field label="Payment method"><input value={f.paymentMethod} onChange={set('paymentMethod')} placeholder="UPI, cash…" /></Field><Err e={a.error} /><div><button className="btn btn-dark">Save expense</button></div></form>
      <p className="muted">Stock purchases are not expenses — record them under New Arrivals.</p></Panel>
    {byCat.length > 0 && <Panel title="Expenses by category (listed period)"><Bars rows={byCat} /></Panel>}
    <Panel title="Expense list" actions={<a className="btn small" href="/api/admin/export/expenses">Export CSV</a>}><Err e={error} />{data && (data.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Description</th><th /></tr></thead><tbody>
      {data.map((e) => <tr key={e.id}><td>{e.expense_on}</td><td>{e.category}</td><td>{money(e.amount)}</td><td>{e.description}</td><td><button className="link" onClick={() => window.confirm('Delete this expense? The deletion is logged.') && a.run(async () => { await api.del(`/api/admin/expenses/${e.id}`); reload(); }, '')}>Delete</button></td></tr>)}</tbody></table></div> : <Empty>No expenses recorded yet.</Empty>)}</Panel></div>;
}

export function Savings() {
  const { data, error, reload } = useLoad(() => api.get('/api/admin/savings'), []); const [f, setF] = useState({ direction: 'deposit', amount: '', note: '', entryOn: today() }); const a = useAction();
  const m = useLoad(() => api.get(`/api/admin/reports/monthly?month=${today().slice(0, 7)}`), []);
  return <div className="page"><h1>Savings Tracker</h1>
    <p className="muted">Savings here means money <strong>you moved</strong> into a savings account or fund. It is separate from profit, cash balance and inventory value.</p>
    {m.data && <div className="stats"><Card label="Money in savings fund (recorded)" value={money(data?.balance)} tone="gold" /><Card label="Business cash balance (calculated)" value={money(m.data.cash_balance_end_of_month)} hint="Opening cash + payments received − refunds − expenses − supplier payments" />
      <Card label="Est. operating profit this month" value={money(m.data.financials.estimated_operating_profit)} hint="Not the same as savings" /><Card label="Unsold inventory value (at cost)" value={money(m.data.inventory_now.value_at_cost)} hint="Not cash" /></div>}
    <Panel title="Record a transfer"><form className="form grid2" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api.post('/api/admin/savings', { direction: f.direction, amount: Number(f.amount), note: f.note || null, entryOn: f.entryOn }))) { setF({ ...f, amount: '', note: '' }); reload(); m.reload(); } }}>
      <Field label="Type"><select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="deposit">Moved into savings</option><option value="withdrawal">Taken out of savings</option></select></Field>
      <Field label="Amount ₹"><input required type="number" min="0.01" step="any" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
      <Field label="Date"><input type="date" value={f.entryOn} onChange={(e) => setF({ ...f, entryOn: e.target.value })} /></Field><Field label="Note"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field><Err e={a.error} /><div><button className="btn btn-dark">Save</button></div></form></Panel>
    <Panel title="History"><Err e={error} />{data && (data.entries.length ? <table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead><tbody>{data.entries.map((e) => <tr key={e.id}><td>{e.entry_on}</td><td>{e.direction === 'deposit' ? 'Moved in' : 'Taken out'}</td><td>{money(e.amount)}</td><td>{e.note}</td></tr>)}</tbody></table> : <Empty>No savings entries yet.</Empty>)}</Panel></div>;
}

export function Settings() {
  const { data, reload } = useLoad(() => api.get('/api/admin/settings'), []); const [f, setF] = useState(null); const a = useAction();
  const cur = f || (data && { whatsapp_number: data.whatsapp_number || '', business_name: data.business_name || 'TIMELESS TRENDS', opening_cash: data.opening_cash || '0', expense_categories: data.expense_categories.join(', ') });
  if (!cur) return null; const set = (k) => (e) => setF({ ...cur, [k]: e.target.value });
  return <div className="page"><h1>Settings</h1><Panel title="Business settings"><form className="form grid2" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api.put('/api/admin/settings', { whatsapp_number: cur.whatsapp_number, business_name: cur.business_name, opening_cash: Number(cur.opening_cash || 0), expense_categories: cur.expense_categories.split(',').map((x) => x.trim()).filter(Boolean) }))) reload(); }}>
    <Field label="Business WhatsApp number" hint="Digits only with country code, e.g. 919876543210 (India = 91). Used by every enquiry button."><input value={cur.whatsapp_number} onChange={set('whatsapp_number')} inputMode="numeric" /></Field>
    <Field label="Business name"><input value={cur.business_name} onChange={set('business_name')} /></Field>
    <Field label="Opening cash balance ₹" hint="Cash in the business when you started recording"><input type="number" step="any" value={cur.opening_cash} onChange={set('opening_cash')} /></Field>
    <Field label="Expense categories (comma separated)"><input value={cur.expense_categories} onChange={set('expense_categories')} /></Field>
    <p className="muted">Reports use the {data.timezone} timezone for all dates.</p><Err e={a.error} /><div><button className="btn btn-dark">Save settings</button> {a.ok && <span className="ok-text">{a.ok}</span>}</div></form></Panel></div>;
}
