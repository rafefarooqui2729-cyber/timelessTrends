import React from 'react';
import { MessageCircle, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { WhatsAppButton } from '../components/WhatsAppButton';

export function Contact() {
  return (
    <div className="contact-page section">
      <div className="container container-narrow">
        {/* Header */}
        <div className="section-header">
          <span className="section-subtitle">GET IN TOUCH</span>
          <h1 className="section-title">Direct Enquiries</h1>
          <div className="gold-divider" />
          <p className="section-description">
            Have questions about watch specifications, availability, or need recommendations? Connect with the {siteConfig.brandName} team directly on WhatsApp.
          </p>
        </div>

        {/* Primary Contact Card */}
        <div style={{
          backgroundColor: 'var(--color-white)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-card)',
          padding: 'clamp(32px, 6vw, 48px)',
          marginBottom: '48px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            padding: '20px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-whatsapp-bg-soft)',
            color: 'var(--color-whatsapp)',
            marginBottom: '20px'
          }}>
            <MessageCircle size={44} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', marginBottom: '12px' }}>
            Chat with {siteConfig.brandName}
          </h2>

          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '540px', margin: '0 auto 28px', fontSize: '1rem', lineHeight: 1.6 }}>
            {siteConfig.contact.enquiryNotice}
          </p>

          <div style={{ display: 'inline-block', marginBottom: '32px' }}>
            <WhatsAppButton
              label="Start WhatsApp Conversation"
              variantStyle="primary"
              className="btn-whatsapp"
              style={{ padding: '16px 36px', fontSize: '1rem' }}
            />
          </div>

          {/* Operating details */}
          <div style={{
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)'
          }}>
            <Clock size={16} color="var(--color-gold)" />
            <span>Operating Hours: <strong>{siteConfig.contact.operatingHours}</strong></span>
          </div>
        </div>

        {/* Enquiry Guidance Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          <div style={{ padding: '24px', backgroundColor: 'var(--color-ivory)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '1rem' }}>
              <ShieldCheck size={18} color="var(--color-gold)" />
              Genuine Products
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Every timepiece presented is verified and described with confirmed details. Enquire directly to verify availability.
            </p>
          </div>

          <div style={{ padding: '24px', backgroundColor: 'var(--color-ivory)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '1rem' }}>
              <HelpCircle size={18} color="var(--color-gold)" />
              Product Recommendations
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Looking for a specific dial diameter, steel bracelet, or color variant? Send us a message and our team will guide you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
