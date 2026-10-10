import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MessageCircle, Sparkles, Check, ArrowRight } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { WhatsAppButton } from '../components/WhatsAppButton';

export function About() {
  return (
    <div className="about-page section">
      <div className="container container-narrow">
        {/* Header */}
        <div className="section-header">
          <span className="section-subtitle">ABOUT THE BRAND</span>
          <h1 className="section-title">{siteConfig.brandName}</h1>
          <div className="gold-divider" />
          <p className="section-description" style={{ fontSize: '1.2rem', color: 'var(--color-charcoal)', fontStyle: 'italic' }}>
            "{siteConfig.tagline}"
          </p>
        </div>

        {/* Narrative Section */}
        <div style={{ marginBottom: '56px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '16px' }}>
            Our Brand Philosophy
          </h2>
          <p style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '20px' }}>
            At <strong>{siteConfig.brandName}</strong>, we curate timepieces that bridge the elegance of classical horology with the dynamic pulse of modern style. We believe a watch is far more than a functional accessory — it is an extension of personal identity, an expression of taste, and a mark of quiet confidence.
          </p>
          <p style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)', lineHeight: 1.8, marginBottom: '20px' }}>
            Whether you are seeking a refined chronograph for celebratory occasions, an ultra-slim dress watch for daily professional wear, or an eye-catching open-heart mechanical design, each piece in our catalogue is chosen for aesthetic harmony and reliable craftsmanship.
          </p>
        </div>

        {/* Brand Commitments */}
        <div style={{
          backgroundColor: 'var(--color-ivory)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: 'clamp(28px, 5vw, 48px)',
          marginBottom: '56px'
        }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', marginBottom: '24px' }}>
            What We Stand For
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {siteConfig.brandMessage.map((message, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-white)',
                  border: '1px solid var(--color-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold)',
                  flexShrink: 0
                }}>
                  <Check size={14} />
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                  {message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* How the WhatsApp Process Works */}
        <div id="process" style={{ marginBottom: '56px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '20px' }}>
            The Discovery &amp; Enquiry Process
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '28px' }}>
            TIMELESS TRENDS operates as a dedicated product discovery catalogue. We prioritize personalised, direct customer conversations rather than impersonal, automated checkouts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
            <div style={{ padding: '24px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-white)' }}>
              <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-serif)', color: 'var(--color-gold)', fontWeight: 700 }}>01</span>
              <h4 style={{ margin: '8px 0 6px', fontSize: '1.1rem' }}>Browse the Catalogue</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Explore watches by collection, view photography, and choose your preferred colour finish.
              </p>
            </div>

            <div style={{ padding: '24px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-white)' }}>
              <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-serif)', color: 'var(--color-gold)', fontWeight: 700 }}>02</span>
              <h4 style={{ margin: '8px 0 6px', fontSize: '1.1rem' }}>Select &amp; Click Enquiry</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Tap the WhatsApp enquiry button on any watch card or details page.
              </p>
            </div>

            <div style={{ padding: '24px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-white)' }}>
              <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-serif)', color: 'var(--color-gold)', fontWeight: 700 }}>03</span>
              <h4 style={{ margin: '8px 0 6px', fontSize: '1.1rem' }}>Direct Conversation</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                WhatsApp opens with your selected product details prefilled. You review and send it to our team.
              </p>
            </div>
          </div>
        </div>

        {/* Closing Banner */}
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          backgroundColor: 'var(--color-matte-black)',
          color: '#fff',
          borderRadius: 'var(--radius-sm)'
        }}>
          <h3 style={{ color: '#fff', fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '16px' }}>
            "{siteConfig.closingStatement}"
          </h3>
          <p style={{ color: 'var(--color-silver)', maxWidth: '520px', margin: '0 auto 28px', fontSize: '0.95rem' }}>
            Ready to find your next statement timepiece? Explore our full range of curated watches.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/shop" className="btn btn-gold">
              <span>View Catalogue</span>
              <ArrowRight size={16} />
            </Link>
            <WhatsAppButton
              label="Contact on WhatsApp"
              variantStyle="outline"
              className="btn-whatsapp-outline"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default About;
