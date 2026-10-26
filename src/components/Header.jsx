import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, MessageCircle } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { WhatsAppButton } from './WhatsAppButton';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [scrolled, setScrolled] = useState(!isHome);

  // Scroll detection on Home page
  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const isPastThreshold = window.scrollY > 180;
          setScrolled(isPastThreshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle Escape key to close navigation drawer
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

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
    { to: '/', label: 'Home', end: true },
    { to: '/shop', label: 'All Watches', end: true },
    { to: '/shop?category=mens', label: "Men's", end: false },
    { to: '/shop?category=womens', label: "Women's", end: false },
    { to: '/collections', label: 'Collections', end: false },
    { to: '/about', label: 'About Us', end: false },
    { to: '/contact', label: 'Contact', end: false },
  ];

  const headerClass = [
    'site-header',
    isHome ? 'site-header-home' : 'site-header-standard',
    scrolled ? 'is-scrolled' : 'is-initial',
  ].filter(Boolean).join(' ');

  return (
    <>
      <header className={headerClass} role="banner">
        <div className="container header-inner">
          {/* Brand Wordmark & Tagline */}
          <Link to="/" className="brand-logo-link" aria-label="TIMELESS TRENDS Homepage">
            <span className="brand-wordmark">{siteConfig.brandName}</span>
            <span className="brand-submark">ELEGANCE IN EVERY SECOND</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="nav-desktop" aria-label="Primary Navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
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
            {/* Quick Search Shortcut */}
            <Link
              to="/shop"
              className="header-search-link"
              aria-label="Search watches catalogue"
              title="Search catalogue"
            >
              <Search size={18} />
            </Link>

            {/* Direct WhatsApp Enquiry */}
            <WhatsAppButton
              label="WhatsApp"
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
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
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
              <div className="mobile-brand-title">
                {siteConfig.brandName}
              </div>
              <div className="mobile-brand-submark">
                HAUTE HORLOGERIE & STYLE
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="mobile-nav-close"
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>

          <div className="mobile-search-bar">
            <Link
              to="/shop"
              onClick={() => setMobileMenuOpen(false)}
              className="mobile-search-btn"
            >
              <Search size={16} />
              <span>Search watches & collections...</span>
            </Link>
          </div>

          <nav className="mobile-nav-links" aria-label="Mobile Primary Navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  isActive ? 'mobile-nav-link active' : 'mobile-nav-link'
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mobile-nav-footer">
            <p className="mobile-nav-tagline">
              "{siteConfig.tagline}"
            </p>
            <WhatsAppButton
              label="Enquire on WhatsApp"
              variantStyle="primary"
              className="btn-whatsapp"
              style={{ width: '100%' }}
            />

            {/* Creator Credit Badge */}
            <div className="menu-creator-credit">
              <span className="credit-label">CRAFTSMANSHIP &amp; DESIGN</span>
              <a
                href="https://rafefarooqui.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="credit-link"
                aria-label="Designed and developed by Rafe Farooqui (opens in new tab)"
              >
                <span className="credit-sub">Designed &amp; Developed by</span>
                <span className="credit-author">Rafe Farooqui</span>
              </a>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default Header;
