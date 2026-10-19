import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import ProductCard from './ProductCard.jsx';

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const qs = sp.toString();
  const { data, loading, error } = useLoad(() => api.get(`/api/public/products?${qs}`), [qs]);
  const cols = useLoad(() => api.get('/api/public/collections'), []);
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  return (
    <div className="wrap section">
      <h1 className="page-title">Shop</h1>
      <div className="filters">
        <input type="search" placeholder="Search watches" aria-label="Search" defaultValue={sp.get('q') || ''} onChange={(e) => set('q', e.target.value)} />
        <select aria-label="Category" value={sp.get('category') || ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>{cols.data?.categories.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <select aria-label="Brand" value={sp.get('brand') || ''} onChange={(e) => set('brand', e.target.value)}>
          <option value="">All brands</option>{cols.data?.brands.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <select aria-label="Sort" value={sp.get('sort') || 'newest'} onChange={(e) => set('sort', e.target.value)}>
          <option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="name">Name</option>
        </select>
      </div>
      {error && <p className="center-note">Could not load products. Please try again.</p>}
      {loading && !data && <p className="center-note">Loading…</p>}
      {data && (data.length ? <div className="grid">{data.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        : <p className="center-note">No watches match your search.</p>)}
    </div>
  );
}
