import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { BRAND } from '../brand.js';
import { WhatsAppButton, useSite } from './PublicLayout.jsx';

export function Collections() {
  const { data } = useLoad(() => api.get('/api/public/collections'), []);
  return (
    <div className="wrap section">
      <h1 className="page-title">Collections</h1>
      {data && !data.categories.length && !data.brands.length && <p className="center-note">Collections will appear here as watches are added.</p>}
      {data?.categories.length > 0 && <><h2>By category</h2><div className="chips">{data.categories.map((c) => <Link key={c.name} className="chip" to={`/shop?category=${encodeURIComponent(c.name)}`}>{c.name} <small>{c.count}</small></Link>)}</div></>}
      {data?.brands.length > 0 && <><h2>By brand</h2><div className="chips">{data.brands.map((c) => <Link key={c.name} className="chip" to={`/shop?brand=${encodeURIComponent(c.name)}`}>{c.name} <small>{c.count}</small></Link>)}</div></>}
    </div>
  );
}
export function About() {
  return (
    <div className="wrap section narrow">
      <h1 className="page-title">About {BRAND.name}</h1>
      <p className="lead">{BRAND.tagline}</p>
      <ul className="pillars light">{BRAND.pillars.map((p) => <li key={p}>{p}</li>)}</ul>
      <p className="quote">“{BRAND.closing}”</p>
    </div>
  );
}
export function Contact() {
  const { config } = useSite();
  return (
    <div className="wrap section narrow">
      <h1 className="page-title">Contact</h1>
      <p>The quickest way to reach us is WhatsApp. Tell us which watch you like and we will share availability and details.</p>
      {config && (config.whatsappNumber ? <p>WhatsApp: <strong>+{config.whatsappNumber}</strong></p> : <p className="muted">Our WhatsApp number will be shown here soon.</p>)}
      <WhatsAppButton label="Chat on WhatsApp" />
    </div>
  );
}
export function NotFound() {
  return (
    <div className="wrap section center-note">
      <h1 className="page-title">We couldn’t find that page</h1>
      <p>The watch or page you’re looking for doesn’t exist or is no longer available.</p>
      <Link className="btn btn-gold" to="/shop">Back to the shop</Link>
    </div>
  );
}
