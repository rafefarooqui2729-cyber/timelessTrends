import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, MessageCircle } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { WhatsAppButton } from './WhatsAppButton';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'All Watches' },
    { to: '/collections', label: 'Collections' },
    { to: '/about', label: 'About Us' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <header className="site-header">
      <div className="container header-inner">
        {/* Brand Wordmark & Tagline */}
        <Link to="/" className="brand-logo-link" aria-label="TIMELESS TRENDS Homepage">
          <span className="brand-wordmark">{siteConfig.brandName}</span>
          <span className="brand-submark">HAUTE HORLOGERIE & STYLE</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="nav-desktop" aria-label="Primary Navigation">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Header Right Actions */}
        <div className="header-actions">
          <WhatsAppButton
            label="WhatsApp Enquiry"
            variantStyle="outline"
            className="header-wa-btn"
            ariaLabel="Contact Timeless Trends on WhatsApp"
          />

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />

      {/* Mobile Drawer Panel */}
      <div
        className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        <div className="mobile-nav-header">
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
              {siteConfig.brandName}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-gold)', letterSpacing: '0.2em' }}>
              COLLECTIONS
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            style={{ color: '#fff', padding: '4px' }}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="mobile-nav-links">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                isActive ? 'mobile-nav-link active' : 'mobile-nav-link'
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--color-border-dark)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-silver)', marginBottom: '16px' }}>
            {siteConfig.tagline}
          </p>
          <WhatsAppButton
            label="Enquire on WhatsApp"
            variantStyle="primary"
            className="btn-whatsapp"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </header>
  );
}

export default Header;
