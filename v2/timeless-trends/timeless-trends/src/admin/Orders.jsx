import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { Badge, Empty, Err, Field, Panel, money, today, useAction } from './ui.jsx';

const STATUS_LABEL = { enquiry: 'Enquiry', pending: 'Pending confirmation', confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready for dispatch / collection', completed: 'Completed (handed over)', cancelled: 'Cancelled' };
const FLOW = ['pending', 'confirmed', 'processing', 'ready', 'completed'];

function NewOrder({ onDone }) {
  const [sp] = useSearchParams(); const inv = useLoad(() => api.get('/api/admin/inventory'), []);
  const [f, setF] = useState({ customerName: '', customerContact: '', status: 'pending', notes: '' });
  const [items, setItems] = useState([{ variantId: sp.get('variant') || '', quantity: 1, unitPrice: '', lineDiscount: '' }]); const a = useAction();
  const setItem = (i, k, v) => setItems(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const submit = async (e) => { e.preventDefault();
    const r = await a.run(() => api.post('/api/admin/orders', { ...f, customerName: f.customerName || null, customerContact: f.customerContact || null, notes: f.notes || null, enquiryId: sp.get('enquiry') ? Number(sp.get('enquiry')) : null,
      items: items.map((it) => ({ variantId: Number(it.variantId), quantity: Number(it.quantity), unitPrice: it.unitPrice === '' ? null : Number(it.unitPrice), lineDiscount: it.lineDiscount === '' ? 0 : Number(it.lineDiscount) })) }), 'Order recorded');
    if (r) { setItems([{ variantId: '', quantity: 1, unitPrice: '', lineDiscount: '' }]); onDone(r); } };
  return <form className="form" onSubmit={submit}>
    <div className="grid2"><Field label="Customer name"><input value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} /></Field><Field label="Contact (optional)"><input value={f.customerContact} onChange={(e) => setF({ ...f, customerContact: e.target.value })} /></Field></div>
    {items.map((it, i) => <div key={i} className="grid4"><Field label="Watch & colour *"><select required value={it.variantId} onChange={(e) => setItem(i, 'variantId', e.target.value)}><option value="">Select…</option>{inv.data?.rows.filter((r) => r.status !== 'inactive').map((r) => <option key={r.variant_id} value={r.variant_id}>{r.product} — {r.colour} (available {r.available})</option>)}</select></Field>
      <Field label="Qty"><input type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} /></Field>
      <Field label="Unit price ₹" hint="Blank = use listed price"><input type="number" min="0" step="any" value={it.unitPrice} onChange={(e) => setItem(i, 'unitPrice', e.target.value)} /></Field>
      <Field label="Discount ₹ (line)"><input type="number" min="0" step="any" value={it.lineDiscount} onChange={(e) => setItem(i, 'lineDiscount', e.target.value)} /></Field></div>)}
    <button type="button" className="btn small" onClick={() => setItems([...items, { variantId: '', quantity: 1, unitPrice: '', lineDiscount: '' }])}>+ Add another watch</button>
    <div className="grid2"><Field label="Starting status"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['enquiry', 'pending', 'confirmed'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
      <Field label="Notes"><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
    {sp.get('enquiry') && <p className="muted">This order will be linked to the enquiry you selected.</p>}
    <Err e={a.error} /><button className="btn btn-dark" disabled={a.busy}>Save order</button> {a.ok && <span className="ok-text">{a.ok}</span>}</form>;
}

function Detail({ o, onChange }) {
  const [pay, setPay] = useState({ kind: 'payment', amount: '', method: '' }); const [ret, setRet] = useState({}); const a = useAction();
  const closed = ['completed', 'cancelled', 'partially_returned', 'returned'].includes(o.status);
  const go = (status) => { let cancelReason; if (status === 'cancelled') { cancelReason = window.prompt('Reason for cancelling?'); if (!cancelReason) return; }
    if (status === 'completed' && !window.confirm('Mark as completed? This records the sale and reduces stock. It cannot be undone (use a return instead).')) return;
    return a.run(async () => { await api.post(`/api/admin/orders/${o.id}/status`, { status, cancelReason }); onChange(); }, 'Status updated'); };
  return <Panel title={`${o.order_no} · ${o.customer_name || 'No name'}`} actions={<Badge s={o.status} />}>
    <div className="table-wrap"><table><thead><tr><th>Watch</th><th>Colour</th><th>Qty</th><th>Price</th><th>Discount</th><th>Line total</th><th>Stock</th><th>Returned</th><th /></tr></thead><tbody>
      {o.items.map((i) => <tr key={i.id}><td>{i.product_name}</td><td>{i.colour}</td><td>{i.quantity}</td><td>{money(i.unit_price)}</td><td>{money(i.line_discount)}</td><td>{money(i.line_total)}</td><td><Badge s={i.stock_state === 'none' ? 'not_reserved' : i.stock_state} /></td><td>{i.returned_qty}</td>
        <td>{i.stock_state === 'sold' && i.returned_qty < i.quantity && <span className="inline"><input className="mini" type="number" min="1" max={i.quantity - i.returned_qty} placeholder="qty" value={ret[i.id]?.q || ''} onChange={(e) => setRet({ ...ret, [i.id]: { ...ret[i.id], q: e.target.value } })} />
          <select value={ret[i.id]?.c || 'sellable'} onChange={(e) => setRet({ ...ret, [i.id]: { ...ret[i.id], c: e.target.value } })}><option value="sellable">Good — restock</option><option value="damaged">Damaged — don’t restock</option></select>
          <button className="btn small" onClick={() => ret[i.id]?.q && a.run(async () => { await api.post(`/api/admin/orders/${o.id}/items/${i.id}/return`, { quantity: Number(ret[i.id].q), condition: ret[i.id].c || 'sellable' }); onChange(); }, 'Return recorded')}>Return</button></span>}</td></tr>)}</tbody></table></div>
    <div className="stats"><div className="stat"><span>Order total</span><strong>{money(o.total)}</strong></div><div className="stat"><span>Refund value of returns</span><strong>{money(o.returned_value)}</strong></div><div className="stat"><span>Payments recorded (net)</span><strong>{money(o.net_received)}</strong></div><div className="stat"><span>Balance due</span><strong>{money(o.balance_due)}</strong></div><div className="stat"><span>Payment status</span><Badge s={o.payment_status} /></div></div>
    {!closed && <div className="inline wrap-row"><span className="muted">Move to:</span>{FLOW.filter((s) => s !== o.status).map((s) => <button key={s} className="btn small" disabled={a.busy} onClick={() => go(s)}>{STATUS_LABEL[s]}</button>)}<button className="btn small danger" onClick={() => go('cancelled')}>Cancel order</button></div>}
    {!closed && <p className="muted">Confirmed / Processing / Ready reserve stock. Completed deducts it. Cancelling releases the reservation.</p>}
    {o.cancel_reason && <p className="muted">Cancelled: {o.cancel_reason}</p>}
    <h3 className="sub">Payments (recorded by you — not verified)</h3>
    {o.payments.map((p) => <p key={p.id} className="muted">{p.paid_on}: {p.kind === 'refund' ? 'Refund' : 'Payment'} {money(p.amount)} {p.method && `(${p.method})`}</p>)}
    <form className="inline" onSubmit={async (e) => { e.preventDefault(); if (await a.run(async () => { await api.post(`/api/admin/orders/${o.id}/payments`, { kind: pay.kind, amount: Number(pay.amount), method: pay.method || null }); setPay({ ...pay, amount: '' }); onChange(); }, 'Payment recorded')) { /* ok */ } }}>
      <select value={pay.kind} onChange={(e) => setPay({ ...pay, kind: e.target.value })}><option value="payment">Payment received</option><option value="refund">Refund paid</option></select><input type="number" required min="0.01" step="any" placeholder="Amount ₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
      <input placeholder="Method (UPI, cash…)" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} /><button className="btn small">Add</button></form>
    <Err e={a.error} />{a.ok && <p className="alert ok">{a.ok}</p>}</Panel>;
}

export default function Orders() {
  const [status, setStatus] = useState(''); const [sel, setSel] = useState(null);
  const { data, error, reload } = useLoad(() => api.get(`/api/admin/orders${status ? `?status=${status}` : ''}`), [status]);
  const cur = data?.find((o) => o.id === sel);
  return <div className="page"><h1>Orders</h1>
    <Panel title="Record an order"><NewOrder onDone={(o) => { reload(); setSel(o.id); }} /></Panel>
    <Panel title="All orders" actions={<><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{[...Object.keys(STATUS_LABEL), 'partially_returned', 'returned'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s] || s.replace('_', ' ')}</option>)}</select> <a className="btn small" href="/api/admin/export/orders">Export CSV</a></>}>
      <Err e={error} />{data && (data.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th><th /></tr></thead><tbody>
        {data.map((o) => <tr key={o.id} className={sel === o.id ? 'sel' : ''}><td>{o.order_no}</td><td>{o.order_date}</td><td>{o.customer_name || '—'}</td><td>{money(o.total)}</td><td><Badge s={o.status} /></td><td><Badge s={o.payment_status} /></td><td><button className="btn small" onClick={() => setSel(o.id)}>Open</button></td></tr>)}</tbody></table></div> : <Empty>No orders yet. Record one when a customer confirms on WhatsApp.</Empty>)}</Panel>
    {cur && <Detail key={cur.id + cur.status + cur.returned_value + cur.net_received} o={cur} onChange={reload} />}</div>;
}
