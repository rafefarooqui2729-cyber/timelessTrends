import React, { useState } from 'react';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { Badge, Empty, Err, Field, Panel, money, useAction } from './ui.jsx';

function NewProduct({ onDone }) {
  const [f, setF] = useState({ name: '', brand: '', category: '', price: '', colours: '', status: 'draft' }); const a = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault();
    const variants = f.colours.split(',').map((c) => c.trim()).filter(Boolean).map((colour) => ({ colour }));
    const r = await a.run(() => api.post('/api/admin/products', { name: f.name, brand: f.brand || null, category: f.category || null, selling_price: f.price === '' ? null : Number(f.price), status: f.status, variants }));
    if (r) { setF({ name: '', brand: '', category: '', price: '', colours: '', status: 'draft' }); onDone(r); } };
  return (
    <form className="form grid2" onSubmit={submit}>
      <Field label="Watch name *"><input required value={f.name} onChange={set('name')} /></Field>
      <Field label="Brand (only if confirmed)"><input value={f.brand} onChange={set('brand')} /></Field>
      <Field label="Category"><input value={f.category} onChange={set('category')} placeholder="e.g. Chronograph" /></Field>
      <Field label="Selling price (₹)" hint="Leave blank if not decided — shown as “Price on enquiry”"><input type="number" min="0" step="any" value={f.price} onChange={set('price')} /></Field>
      <Field label="Colours * (comma separated)" hint="Each colour tracks its own stock"><input required value={f.colours} onChange={set('colours')} placeholder="Black, Silver" /></Field>
      <Field label="Visibility"><select value={f.status} onChange={set('status')}><option value="draft">Draft (hidden)</option><option value="published">Published</option></select></Field>
      <Err e={a.error} /><div><button className="btn btn-dark" disabled={a.busy}>Add product</button></div>
    </form>
  );
}

function Editor({ id, onChange }) {
  const { data: p, reload } = useLoad(() => api.get(`/api/admin/products/${id}`), [id]); const a = useAction();
  const [v, setV] = useState(''); const [file, setFile] = useState({});
  if (!p) return null;
  const save = (patch) => a.run(async () => { await api.put(`/api/admin/products/${id}`, patch); await reload(); onChange(); });
  const upload = (variantId) => a.run(async () => { const fd = new FormData(); fd.append('image', file[variantId || 'all']); if (variantId) fd.append('variantId', variantId); fd.append('alt', `${p.name}${variantId ? ' ' + p.variants.find((x) => x.id === variantId).colour : ''}`); await api.upload(`/api/admin/products/${id}/images`, fd); setFile({}); await reload(); }, 'Image uploaded');
  return (
    <Panel title={`${p.name} · ${p.code}`}>
      <div className="form grid2">
        <Field label="Name"><input defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && save({ name: e.target.value })} /></Field>
        <Field label="Brand"><input defaultValue={p.brand || ''} onBlur={(e) => e.target.value !== (p.brand || '') && save({ brand: e.target.value || null })} /></Field>
        <Field label="Selling price (₹)"><input type="number" min="0" step="any" defaultValue={p.selling_price ?? ''} onBlur={(e) => save({ selling_price: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <Field label="Original price (₹, only if confirmed)"><input type="number" min="0" step="any" defaultValue={p.original_price ?? ''} onBlur={(e) => save({ original_price: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <Field label="Category"><input defaultValue={p.category || ''} onBlur={(e) => save({ category: e.target.value || null })} /></Field>
        <Field label="Model"><input defaultValue={p.model || ''} onBlur={(e) => save({ model: e.target.value || null })} /></Field>
        <Field label="Description (confirmed facts only)"><textarea rows="3" defaultValue={p.description || ''} onBlur={(e) => save({ description: e.target.value || null })} /></Field>
        <Field label="Specifications (one per line, Label: Value)"><textarea rows="3" defaultValue={p.specs.map((s) => `${s.label}: ${s.value}`).join('\n')}
          onBlur={(e) => save({ specs: e.target.value.split('\n').map((l) => l.split(/:(.*)/s)).filter((x) => x[0].trim() && x[1]?.trim()).map((x) => ({ label: x[0].trim(), value: x[1].trim() })) })} /></Field>
      </div>
      <div className="toggles">
        {[['status', 'Published on website', p.status === 'published', (c) => ({ status: c ? 'published' : 'draft' })], ['is_new_arrival', 'New arrival', !!p.is_new_arrival, (c) => ({ is_new_arrival: c })],
          ['is_featured', 'Featured', !!p.is_featured, (c) => ({ is_featured: c })], ['is_active', 'Active', !!p.is_active, (c) => ({ is_active: c })]].map(([k, l, on, fn]) =>
          <label key={k} className="check"><input type="checkbox" checked={on} onChange={(e) => save(fn(e.target.checked))} /> {l}</label>)}
      </div>
      <h3 className="sub">Colours & variant stock</h3>
      <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Colour</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Alert at ≤</th><th>Price override</th><th>Status</th><th>Photo</th></tr></thead><tbody>
        {p.variants.map((x) => <tr key={x.id}><td>{x.sku}</td><td>{x.colour}</td><td>{x.stock_on_hand}</td><td>{x.reserved}</td><td>{x.available}</td>
          <td><input className="mini" type="number" min="0" defaultValue={x.min_stock} onBlur={(e) => a.run(async () => { await api.put(`/api/admin/variants/${x.id}`, { min_stock: Number(e.target.value) }); await reload(); })} /></td>
          <td><input className="mini" type="number" min="0" step="any" defaultValue={x.price_override ?? ''} onBlur={(e) => a.run(async () => { await api.put(`/api/admin/variants/${x.id}`, { price_override: e.target.value === '' ? null : Number(e.target.value) }); await reload(); })} /></td>
          <td><Badge s={x.status} /> <label className="check"><input type="checkbox" checked={!!x.is_active} onChange={(e) => a.run(async () => { await api.put(`/api/admin/variants/${x.id}`, { is_active: e.target.checked }); await reload(); })} /> active</label></td>
          <td><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile({ ...file, [x.id]: e.target.files[0] })} />{file[x.id] && <button className="btn small" onClick={() => upload(x.id)}>Upload</button>}</td></tr>)}
      </tbody></table></div>
      <form className="inline" onSubmit={async (e) => { e.preventDefault(); if (await a.run(async () => { await api.post(`/api/admin/products/${id}/variants`, { colour: v }); setV(''); await reload(); })) onChange(); }}>
        <input placeholder="New colour" value={v} onChange={(e) => setV(e.target.value)} required /><button className="btn small">Add colour</button></form>
      <h3 className="sub">Photos</h3>
      <p className="muted">Your original file is kept untouched. The website shows an optimised copy (resized and compressed only — the watch itself is never edited).</p>
      <div className="thumbs admin">{p.images.map((i) => <figure key={i.id}><img src={i.url} alt="" /><figcaption>{i.variant_id ? p.variants.find((x) => x.id === i.variant_id)?.colour : 'General'}</figcaption>
        <button className="link" onClick={() => a.run(async () => { await api.del(`/api/admin/images/${i.id}`); await reload(); })}>Remove</button></figure>)}</div>
      <div className="inline"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile({ ...file, all: e.target.files[0] })} />{file.all && <button className="btn small" onClick={() => upload(null)}>Upload general photo</button>}</div>
      <Err e={a.error} />{a.ok && <p className="alert ok">{a.ok}</p>}
    </Panel>
  );
}

export default function Products() {
  const [q, setQ] = useState(''); const [sel, setSel] = useState(null);
  const { data, error, reload } = useLoad(() => api.get(`/api/admin/products?q=${encodeURIComponent(q)}`), [q]);
  return (
    <div className="page"><h1>Products</h1>
      <Panel title="Add a product"><NewProduct onDone={(p) => { reload(); setSel(p.id); }} /></Panel>
      <Panel title="All products" actions={<><input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /> <a className="btn small" href="/api/admin/export/products">Export CSV</a></>}>
        <Err e={error} />
        {data && (data.length ? <div className="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Brand</th><th>Price</th><th>Available</th><th>Website</th><th /></tr></thead><tbody>
          {data.map((p) => <tr key={p.id} className={sel === p.id ? 'sel' : ''}><td>{p.code}</td><td>{p.name} {p.is_new_arrival ? <span className="tag">New</span> : null}</td><td>{p.brand || '—'}</td><td>{money(p.selling_price)}</td>
            <td>{p.variants.reduce((s, v) => s + v.available, 0)}</td><td><Badge s={p.is_active ? p.status : 'inactive'} /></td><td><button className="btn small" onClick={() => setSel(p.id)}>Edit</button></td></tr>)}</tbody></table></div>
          : <Empty>No products yet. Add your first watch above.</Empty>)}
      </Panel>
      {sel && <Editor key={sel} id={sel} onChange={reload} />}
    </div>
  );
}
