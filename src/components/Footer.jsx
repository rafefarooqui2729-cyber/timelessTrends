import React from 'react';
import { Link } from 'react-router-dom';
import { Check, MessageCircle, Clock, ShieldCheck } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { WhatsAppButton } from './WhatsAppButton';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Column 1: Brand Identity & Closing Statement */}
          <div className="footer-brand-col">
            <h3 className="footer-brand-title">{siteConfig.brandName}</h3>
            <p className="footer-brand-tagline">{siteConfig.tagline}</p>
            <blockquote className="footer-closing-quote">
              "{siteConfig.closingStatement}"
            </blockquote>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-silver)', marginTop: '16px', lineHeight: 1.6 }}>
              Curating refined watches for those who appreciate distinction, enduring craftsmanship, and contemporary style.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="footer-col-title">Catalogue</h4>
            <ul className="footer-links-list">
              <li><Link to="/shop" className="footer-link">All Watches</Link></li>
              <li><Link to="/shop?category=everyday-classics" className="footer-link">Everyday Classics</Link></li>
              <li><Link to="/shop?category=trending" className="footer-link">Trending & Modern</Link></li>
              <li><Link to="/shop?category=mens" className="footer-link">Men's Collection</Link></li>
              <li><Link to="/shop?category=womens" className="footer-link">Women's Collection</Link></li>
              <li><Link to="/collections" className="footer-link">Browse All Collections</Link></li>
            </ul>
          </div>

          {/* Column 3: Information & Navigation */}
          <div>
            <h4 className="footer-col-title">Information</h4>
            <ul className="footer-links-list">
              <li><Link to="/about" className="footer-link">About Brand</Link></li>
              <li><Link to="/contact" className="footer-link">Contact & WhatsApp</Link></li>
              <li><Link to="/about#process" className="footer-link">How Enquiry Works</Link></li>
              <li><Link to="/admin/login" className="footer-link">Admin Login</Link></li>
            </ul>
          </div>

          {/* Column 4: Brand Values & WhatsApp CTA */}
          <div>
            <h4 className="footer-col-title">Brand Commitment</h4>
            <ul className="footer-values-list" style={{ marginBottom: '20px' }}>
              {siteConfig.brandMessage.slice(0, 4).map((value, idx) => (
                <li key={idx} className="footer-values-item">
                  <Check size={14} />
                  <span>{value}</span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: '20px' }}>
              <WhatsAppButton
                label="Direct WhatsApp Chat"
                variantStyle="primary"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom-row">
          <div>
            &copy; {currentYear} {siteConfig.brandName}. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span>Product Discovery & WhatsApp Enquiry</span>
            <span>•</span>
            <span>No Online Checkout</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
