import React, { useState } from 'react';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { Badge, Card, Empty, Err, Field, Panel, money, today, useAction } from './ui.jsx';

export function Inventory() {
  const { data, error, reload } = useLoad(() => api.get('/api/admin/inventory'), []);
  const daily = useLoad(() => api.get(`/api/admin/stock/daily?date=${today()}`), []);
  const [dt, setDt] = useState(today()); const [counts, setCounts] = useState({}); const a = useAction();
  const [d, setD] = useState(null);
  const loadDaily = async (x) => { setDt(x); setD(await api.get(`/api/admin/stock/daily?date=${x}`)); };
  const s = d || daily.data;
  return (
    <div className="page"><h1>Inventory</h1><Err e={error} />
      {data && <div className="stats"><Card label="Units on hand" value={data.valuation.units_on_hand} /><Card label="Inventory value (at cost)" value={money(data.valuation.value_at_cost)} hint="Money tied up in unsold stock — not cash" />
        {data.valuation.units_with_unknown_cost > 0 && <Card label="Units with no cost recorded" value={data.valuation.units_with_unknown_cost} tone="warn" hint="Excluded from the value" />}</div>}
      <Panel title="Daily stock summary" actions={<input type="date" value={dt} onChange={(e) => loadDaily(e.target.value)} />}>
        {s && <><div className="stats"><Card label="Opening stock" value={s.opening_stock} /><Card label="+ Received" value={s.stock_received} /><Card label="+ Returned to sellable stock" value={s.returns_to_sellable_stock} /><Card label="− Sold" value={s.units_sold} />
          <Card label="− Damaged / lost / supplier returns" value={s.other_reductions} /><Card label="± Adjustments" value={s.adjustments} /><Card label="Closing stock" value={s.closing_stock} tone="gold" /></div>
          <p className="muted">Closing = opening + received + returned to sellable − sold − other reductions ± adjustments. Damaged customer returns ({s.damaged_returns_not_restocked}) are not added back to sellable stock. Reserved units are still on hand until the order is completed.</p></>}
      </Panel>
      <Panel title="Stock by colour" actions={<button className="btn small" onClick={() => setCounts(Object.fromEntries(data.rows.map((r) => [r.variant_id, { counted: r.stock_on_hand, reason: '' }])))}>Start stock count</button>}>
        {data && (data.rows.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Colour</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Alert ≤</th><th>Avg cost</th><th>Value</th><th>Status</th>{Object.keys(counts).length > 0 && <th>Physical count</th>}</tr></thead><tbody>
          {data.rows.map((r) => <tr key={r.variant_id}><td>{r.product}</td><td>{r.colour}</td><td>{r.stock_on_hand}</td><td>{r.reserved}</td><td>{r.available}</td><td>{r.min_stock}</td><td>{money(r.avg_cost)}</td><td>{money(r.value_at_cost)}</td><td><Badge s={r.status} /></td>
            {counts[r.variant_id] && <td className="count"><input type="number" min="0" value={counts[r.variant_id].counted} onChange={(e) => setCounts({ ...counts, [r.variant_id]: { ...counts[r.variant_id], counted: Number(e.target.value) } })} />
              {counts[r.variant_id].counted !== r.stock_on_hand && <input placeholder="Reason required" value={counts[r.variant_id].reason} onChange={(e) => setCounts({ ...counts, [r.variant_id]: { ...counts[r.variant_id], reason: e.target.value } })} />}</td>}</tr>)}</tbody></table></div> : <Empty>No stock yet. Add a product, then record stock under New Arrivals.</Empty>)}
        {Object.keys(counts).length > 0 && <div className="inline"><button className="btn btn-dark" disabled={a.busy} onClick={async () => { const list = data.rows.filter((r) => counts[r.variant_id].counted !== r.stock_on_hand).map((r) => ({ variantId: r.variant_id, counted: counts[r.variant_id].counted, reason: counts[r.variant_id].reason }));
          if (!list.length) return a.run(async () => { throw new Error('Counts match the records. Nothing to adjust.'); }); if (await a.run(() => api.post('/api/admin/stock/reconcile', { counts: list }), 'Adjustments recorded')) { setCounts({}); reload(); } }}>Save count differences</button><button className="btn" onClick={() => setCounts({})}>Cancel</button></div>}
        <Err e={a.error} />{a.ok && <p className="alert ok">{a.ok}</p>}
      </Panel>
      {data && data.rows.length > 0 && <StockActions rows={data.rows} onDone={reload} />}
    </div>
  );
}

function StockActions({ rows, onDone }) {
  const [f, setF] = useState({ variantId: '', type: 'damage_loss', quantity: 1, reason: '' }); const a = useAction();
  return <Panel title="Record damaged, lost, or supplier-returned units"><form className="form grid2" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api.post('/api/admin/stock/remove', { variantId: Number(f.variantId), type: f.type, quantity: Number(f.quantity), reason: f.reason }))) { setF({ ...f, reason: '' }); onDone(); } }}>
    <Field label="Watch"><select required value={f.variantId} onChange={(e) => setF({ ...f, variantId: e.target.value })}><option value="">Select…</option>{rows.map((r) => <option key={r.variant_id} value={r.variant_id}>{r.product} — {r.colour} ({r.stock_on_hand})</option>)}</select></Field>
    <Field label="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="damage_loss">Damaged or lost</option><option value="supplier_return">Returned to supplier</option></select></Field>
    <Field label="Quantity"><input type="number" min="1" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
    <Field label="Reason *"><input required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
    <Err e={a.error} /><div><button className="btn btn-dark" disabled={a.busy}>Record</button> {a.ok && <span className="ok-text">{a.ok}</span>}</div></form></Panel>;
}

export function Movements() {
  const [f, setF] = useState({ from: '', to: '', type: '' });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, error } = useLoad(() => api.get(`/api/admin/stock/movements?${qs}`), [qs]);
  return <div className="page"><h1>Stock Movements</h1><p className="muted">Every stock change is recorded here and cannot be edited.</p>
    <div className="filters"><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From" /><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To" />
      <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">All types</option>{['purchase_received', 'sale', 'customer_return', 'customer_return_damaged', 'supplier_return', 'damage_loss', 'manual_correction'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
      <a className="btn small" href="/api/admin/export/stock-movements">Export CSV</a></div><Err e={error} />
    {data && (data.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th>Colour</th><th>Type</th><th>Change</th><th>Before → After</th><th>Reason</th><th>By</th></tr></thead><tbody>
      {data.map((m) => <tr key={m.id}><td>{m.occurred_at.slice(0, 16).replace('T', ' ')} UTC</td><td>{m.product_name}</td><td>{m.colour}</td><td>{m.movement_type.replace(/_/g, ' ')}</td><td>{m.quantity_change > 0 ? '+' : ''}{m.quantity_change}{m.non_sellable_qty ? ` (${m.non_sellable_qty} damaged)` : ''}</td><td>{m.previous_qty} → {m.new_qty}</td><td>{m.reason}</td><td>{m.user_email || '—'}</td></tr>)}</tbody></table></div> : <Empty>No stock movements for this filter.</Empty>)}</div>;
}

export function Arrivals() {
  const inv = useLoad(() => api.get('/api/admin/inventory'), []); const sup = useLoad(() => api.get('/api/admin/suppliers'), []);
  const [f, setF] = useState({ variantId: '', quantity: '', unitCost: '', receivedOn: today(), supplierId: '', reference: '', newArrival: true, publish: false, price: '' }); const [newSup, setNewSup] = useState(''); const a = useAction();
  const row = inv.data?.rows.find((r) => String(r.variant_id) === String(f.variantId));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => { e.preventDefault(); const ok = await a.run(async () => {
    await api.post('/api/admin/stock/receive', { receivedOn: f.receivedOn, supplierId: f.supplierId ? Number(f.supplierId) : null, reference: f.reference || null, items: [{ variantId: Number(f.variantId), quantity: Number(f.quantity), unitCost: f.unitCost === '' ? null : Number(f.unitCost) }] });
    const patch = {}; if (f.newArrival) patch.is_new_arrival = true; if (f.publish) patch.status = 'published'; if (f.price !== '') patch.selling_price = Number(f.price);
    if (Object.keys(patch).length) await api.put(`/api/admin/products/${row.product_id}`, patch); }, 'Stock recorded'); if (ok !== null) { setF({ ...f, quantity: '', unitCost: '', reference: '' }); inv.reload(); } };
  return <div className="page"><h1>New Arrivals</h1>
    <Panel title="Record stock received"><form className="form grid2" onSubmit={submit}>
      <Field label="Watch & colour *" hint="New watch? Add it under Products first."><select required value={f.variantId} onChange={set('variantId')}><option value="">Select…</option>{inv.data?.rows.map((r) => <option key={r.variant_id} value={r.variant_id}>{r.product} — {r.colour} (on hand {r.stock_on_hand})</option>)}</select></Field>
      <Field label="Quantity received *"><input required type="number" min="1" value={f.quantity} onChange={set('quantity')} /></Field>
      <Field label="Purchase cost per unit (₹)" hint="Private. Used for profit and inventory value. Leave blank if unknown."><input type="number" min="0" step="any" value={f.unitCost} onChange={set('unitCost')} /></Field>
      <Field label="Date received"><input type="date" value={f.receivedOn} onChange={set('receivedOn')} /></Field>
      <Field label="Supplier"><select value={f.supplierId} onChange={set('supplierId')}><option value="">—</option>{sup.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <Field label="Bill / reference"><input value={f.reference} onChange={set('reference')} /></Field>
      <Field label="Selling price (₹)" hint={row ? 'Updates the product price. Leave blank to keep it.' : ''}><input type="number" min="0" step="any" value={f.price} onChange={set('price')} /></Field>
      <div className="toggles"><label className="check"><input type="checkbox" checked={f.newArrival} onChange={set('newArrival')} /> Mark as new arrival</label><label className="check"><input type="checkbox" checked={f.publish} onChange={set('publish')} /> Publish on website now</label></div>
      <Err e={a.error} /><div><button className="btn btn-dark" disabled={a.busy}>Record stock</button> {a.ok && <span className="ok-text">{a.ok}</span>}</div></form>
      <p className="muted">Photos are uploaded on the product’s page under Products → Edit.</p></Panel>
    <Panel title="Add a supplier"><form className="inline" onSubmit={async (e) => { e.preventDefault(); if (await a.run(() => api.post('/api/admin/suppliers', { name: newSup }), 'Supplier added')) { setNewSup(''); sup.reload(); } }}><input placeholder="Supplier name" required value={newSup} onChange={(e) => setNewSup(e.target.value)} /><button className="btn small">Add</button></form></Panel></div>;
}
