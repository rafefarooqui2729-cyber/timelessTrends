import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { BRAND } from '../brand.js';
import ProductCard from './ProductCard.jsx';
import { WhatsAppButton } from './PublicLayout.jsx';

function Row({ title, items, to }) {
  if (!items?.length) return null;
  return (
    <section className="wrap section">
      <div className="section-head"><h2>{title}</h2><Link to={to}>View all →</Link></div>
      <div className="grid">{items.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}</div>
    </section>
  );
}
export default function Home() {
  const featured = useLoad(() => api.get('/api/public/products?featured=1'), []);
  const fresh = useLoad(() => api.get('/api/public/products?new_arrival=1'), []);
  const all = useLoad(() => api.get('/api/public/products'), []);
  const cats = useLoad(() => api.get('/api/public/collections'), []);
  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">Premium & Trending Watches</p>
          <h1>{BRAND.tagline}</h1>
          <p className="lead">Elegant designs and everyday classics. Browse the collection and enquire about any watch on WhatsApp.</p>
          <div className="actions"><Link to="/shop" className="btn btn-gold">Shop watches</Link><WhatsAppButton /></div>
        </div>
      </section>
      <Row title="Featured watches" items={featured.data} to="/shop?featured=1" />
      <Row title="New arrivals" items={fresh.data} to="/shop?new_arrival=1" />
      {all.data && all.data.length === 0 && <section className="wrap section"><p className="center-note">Our collection is being updated. Please check back soon, or message us on WhatsApp.</p></section>}
      {cats.data?.categories?.length > 0 && (
        <section className="wrap section">
          <div className="section-head"><h2>Collections</h2><Link to="/collections">All collections →</Link></div>
          <div className="chips">{cats.data.categories.map((c) => <Link key={c.name} className="chip" to={`/shop?category=${encodeURIComponent(c.name)}`}>{c.name} <small>{c.count}</small></Link>)}</div>
        </section>
      )}
      <section className="band">
        <div className="wrap"><ul className="pillars">{BRAND.pillars.map((p) => <li key={p}>{p}</li>)}</ul></div>
      </section>
      <section className="wrap section closing"><p className="quote">“{BRAND.closing}”</p><WhatsAppButton label="Start a WhatsApp chat" /></section>
    </>
  );
}
