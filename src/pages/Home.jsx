import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Shield, Clock, Compass, Gem } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { fetchPublicProducts } from '../utils/publicProductsApi';
import { ProductGrid } from '../components/ProductGrid';
import { WhatsAppButton } from '../components/WhatsAppButton';

export function Home() {
  const [featuredWatches, setFeaturedWatches] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const categories = (siteConfig.categories || []).filter(c => c.id !== 'all');

  useEffect(() => {
    let cancelled = false;
    fetchPublicProducts()
      .then((all) => {
        if (!cancelled) {
          setFeaturedWatches(all.filter((p) => p.featured).slice(0, 4));
          setNewArrivals(all.filter((p) => p.isNewArrival).slice(0, 4));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-page">
      {/* Editorial Hero Section */}
      <section className="hero-section" aria-label="Brand Introduction">
        <div className="container">
          <div className="hero-grid">
            {/* Left Hero Narrative */}
            <div className="hero-content">
              <div className="hero-badge">
                <Sparkles size={14} />
                <span>Haute Horlogerie & Style</span>
              </div>

              <h1 className="hero-title">
                Find your style. Choose your watch.
                <span>Explore watches for every occasion.</span>
              </h1>

              <p className="hero-tagline">
                Discover curated luxury timepieces, trending modern silhouettes, and timeless everyday classics. Hand-selected for exceptional aesthetic refinement.
              </p>

              <div className="hero-actions">
                <Link to="/shop" className="btn btn-gold">
                  <span>Explore Collection</span>
                  <ArrowRight size={16} />
                </Link>

                <WhatsAppButton
                  label="Enquire on WhatsApp"
                  variantStyle="outline"
                  className="btn-whatsapp-outline"
                />
              </div>

              {/* Brand Commitments */}
              <div className="hero-perks">
                <div className="hero-perk-item">
                  <Gem size={16} />
                  <span>Curated Aesthetics</span>
                </div>
                <div className="hero-perk-item">
                  <Shield size={16} />
                  <span>Genuine Products</span>
                </div>
                <div className="hero-perk-item">
                  <Clock size={16} />
                  <span>Trusted Service</span>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Showcase */}
            <div className="hero-visual">
              <div className="hero-image-wrapper">
                <img
                  src="/images/products/chronograph-silver.svg"
                  alt="Aethelgard Master Chronograph - Signature Timepiece"
                />
              </div>

              {/* Editorial Floating Accent Card */}
              <div className="hero-floating-card">
                <span className="card-label">Signature Piece</span>
                <div className="card-title">Aethelgard Master Chrono</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-silver)' }}>
                  Sunburst Steel &amp; Sapphire Glass
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Value Pillars Section */}
      <section className="section section-ivory" style={{ padding: '40px 0', borderBottom: '1px solid var(--color-border)' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '24px',
            alignItems: 'center'
          }}>
            {siteConfig.brandMessage.map((msg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-gold)',
                  flexShrink: 0
                }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-charcoal)', letterSpacing: '0.02em' }}>
                  {msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Watches Showcase */}
      <section className="section" aria-label="Featured Watches">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Curated Highlights</span>
            <h2 className="section-title">Signature Selections</h2>
            <div className="gold-divider" />
            <p className="section-description">
              Hand-picked models celebrating superior proportions, exquisite dial balance, and versatile wearability.
            </p>
          </div>

          <ProductGrid products={featuredWatches} />

          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <Link to="/shop" className="btn btn-outline">
              <span>View All Watches</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Curated Categories / Collections Banner */}
      <section className="section section-dark" aria-label="Collections Overview">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Distinctive Categories</span>
            <h2 className="section-title">Browse By Collection</h2>
            <div className="gold-divider" />
            <p className="section-description" style={{ color: 'var(--color-silver)' }}>
              Explore timepieces tailored for every mood, occasion, and signature expression.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px'
          }}>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/shop?category=${cat.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '32px 28px',
                  backgroundColor: '#191919',
                  border: '1px solid var(--color-border-dark)',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all var(--transition-normal)'
                }}
                className="collection-card-item"
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
                  {cat.count} {cat.count === 1 ? 'Design' : 'Designs'}
                </span>
                <h3 style={{ color: '#fff', margin: '10px 0 8px', fontSize: '1.4rem' }}>
                  {cat.name}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-silver)', marginBottom: '20px', lineHeight: 1.5 }}>
                  {cat.description}
                </p>
                <div style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                  <span>Explore Series</span>
                  <ArrowRight size={14} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* New Arrivals Section */}
      {newArrivals.length > 0 && (
        <section className="section" aria-label="New Arrivals">
          <div className="container">
            <div className="section-header">
              <span className="section-subtitle">Fresh Additions</span>
              <h2 className="section-title">Latest Arrivals</h2>
              <div className="gold-divider" />
              <p className="section-description">
                The newest silhouettes to join our catalogue. Modern aesthetics meeting classic poise.
              </p>
            </div>

            <ProductGrid products={newArrivals} />
          </div>
        </section>
      )}

      {/* Brand Closing Editorial Banner */}
      <section className="section section-ivory" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '780px' }}>
          <span className="section-subtitle">TIMELESS TRENDS PHILOSOPHY</span>
          <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', margin: '16px 0 24px' }}>
            "{siteConfig.closingStatement}"
          </h2>
          
<p style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)', marginBottom: '32px', lineHeight: 1.7 }}>
  Discover a variety of watch designs for everyday wear, work, and special occasions. Explore the collection and contact us on WhatsApp for product details, pricing, and availability.
</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/shop" className="btn btn-primary">
              <span>View Full Catalogue</span>
            </Link>
            <WhatsAppButton
              label="Chat on WhatsApp"
              variantStyle="primary"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
