import React, { createContext, useContext, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { BRAND } from '../brand.js';
import { buildEnquiryMessage, whatsappUrl } from '../whatsapp.mjs';

const Ctx = createContext({ config: null });
export const useSite = () => useContext(Ctx);

export function WhatsAppButton({ product, variant, label = 'Enquire on WhatsApp', className = '' }) {
  const { config } = useSite();
  if (!config) return null;
  const msg = product ? buildEnquiryMessage({ product, variant, publicUrl: config.publicUrl })
    : 'Hello TIMELESS TRENDS! I would like to know more about your watches.';
  const href = whatsappUrl(config.whatsappNumber, msg);
  if (!href) return <span className={`btn btn-wa disabled ${className}`} title="WhatsApp number not configured yet">WhatsApp coming soon</span>;
  const track = () => {
    if (!product) return;
    const source = new URLSearchParams(window.location.search).get('utm_source') || undefined;
    api.post('/api/public/enquiries/click', { productId: product.id, variantId: variant?.id ?? null, source }).catch(() => {});
  };
  return <a className={`btn btn-wa ${className}`} href={href} target="_blank" rel="noopener noreferrer" onClick={track}>{label}</a>;
}

export default function PublicLayout() {
  const { data: config } = useLoad(() => api.get('/api/public/config'), []);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  React.useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const link = ({ isActive }) => (isActive ? 'active' : undefined);
  return (
    <Ctx.Provider value={{ config }}>
      <header className="site-header">
        <div className="wrap bar">
          <Link to="/" className="logo" aria-label={`${BRAND.name} home`}>TIMELESS <span>TRENDS</span></Link>
          <button className="menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
          <nav className={open ? 'open' : ''}>
            <NavLink to="/shop" className={link}>Shop</NavLink>
            <NavLink to="/collections" className={link}>Collections</NavLink>
            <NavLink to="/about" className={link}>About</NavLink>
            <NavLink to="/contact" className={link}>Contact</NavLink>
            <WhatsAppButton label="WhatsApp" className="small" />
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="site-footer">
        <div className="wrap">
          <p className="foot-logo">TIMELESS <span>TRENDS</span></p>
          <p>{BRAND.tagline}</p>
          <p className="muted">© {new Date().getFullYear()} {BRAND.name}</p>
        </div>
      </footer>
    </Ctx.Provider>
  );
}
