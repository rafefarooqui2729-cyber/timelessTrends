import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Shield, Clock, Compass, Gem, MessageCircle, ChevronDown, Award } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { fetchPublicProducts } from '../utils/publicProductsApi';
import { ProductGrid } from '../components/ProductGrid';
import { WhatsAppButton } from '../components/WhatsAppButton';

export function Home() {
  const [featuredWatches, setFeaturedWatches] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStoreData() {
      try {
        const all = await fetchPublicProducts();
        if (cancelled) return;

        // Section 5A: Featured Watches from real database
        const featured = all.filter((p) => p.featured);
        setFeaturedWatches(featured.length > 0 ? featured.slice(0, 4) : all.slice(0, 4));

        // Section 5B: New Arrivals from real database
        const arrivals = all.filter((p) => p.isNewArrival);
        setNewArrivals(arrivals.slice(0, 4));

        // Section 5C: Real category counts
        const baseCategories = (siteConfig.categories || []).filter((c) => c.id !== 'all');
        const computed = baseCategories.map((cat) => ({
          ...cat,
          count: all.filter((p) => {
            if (cat.id === 'mens') return p.category === 'mens' || (p.name && /men/i.test(p.name));
            if (cat.id === 'womens') return p.category === 'womens' || (p.name && /women/i.test(p.name));
            return p.category === cat.id;
          }).length,
        }));
        setCategoriesWithCounts(computed);
      } catch (err) {
        console.error('Failed to load homepage watches:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStoreData();

    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToContent = () => {
    const target = document.getElementById('discover-collection');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="home-page">
      {/* ------------------------------------------------------------------
          1. CINEMATIC HERO SECTION
          Full opening viewport with luxury watch photography and independent branding
          ------------------------------------------------------------------ */}
      <section className="cinematic-hero" aria-label="Brand Introduction">
        {/* Subtle Luxury Top Bar inside Hero (since navbar is hidden initially) */}
        <div className="hero-top-bar">
          <div className="container hero-top-bar-inner">
            <div className="hero-top-brand">
              <span className="hero-brand-name">{siteConfig.brandName}</span>
              <span className="hero-brand-divider">•</span>
              <span className="hero-brand-tag">ELEGANCE IN EVERY SECOND</span>
            </div>
            <div className="hero-top-actions">
              <Link to="/shop" className="hero-top-link">
                Catalogue
              </Link>
              <WhatsAppButton
                label="WhatsApp"
                variantStyle="outline"
                className="hero-top-wa"
                showIcon={true}
              />
            </div>
          </div>
        </div>

        {/* Hero Main Content */}
        <div className="container hero-main-container">
          <div className="hero-text-block">
            {/* Eyebrow */}
            <div className="hero-eyebrow-pill">
              <span className="hero-eyebrow-dot" />
              <span className="hero-eyebrow-text">TIMELESS CRAFTSMANSHIP</span>
            </div>

            {/* Headline */}
            <h1 className="hero-heading">
              Where Every Second Speaks Style.
            </h1>

            {/* Supporting Text */}
            <p className="hero-lead">
              Discover watches that bring together character, craftsmanship, and confidence.
              Hand-selected for distinguished proportions, exquisite dial balance, and effortless refinement.
            </p>

            {/* Actions */}
            <div className="hero-cta-group">
              <Link to="/shop" className="btn btn-gold hero-primary-btn">
                <span>Explore The Collection</span>
                <ArrowRight size={17} />
              </Link>

              <WhatsAppButton
                label="Enquire on WhatsApp"
                variantStyle="outline"
                className="btn-outline-gold hero-wa-btn"
              />
            </div>

            {/* Subtle Commitments Row */}
            <div className="hero-commitments-row">
              <div className="hero-commitment-item">
                <Shield size={14} />
                <span>100% Genuine Timepieces</span>
              </div>
              <div className="hero-commitment-item">
                <Clock size={14} />
                <span>Precision Finishing</span>
              </div>
              <div className="hero-commitment-item">
                <MessageCircle size={14} />
                <span>Direct WhatsApp Consultation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator Prompt */}
        <div className="hero-scroll-indicator" onClick={scrollToContent} role="button" tabIndex={0}>
          <span className="scroll-label">Scroll To Discover</span>
          <div className="scroll-line">
            <span className="scroll-dot" />
          </div>
        </div>

        {/* Smooth visual gradient transition dissolving into deep charcoal content */}
        <div className="hero-bottom-fade" aria-hidden="true" />
      </section>

      {/* ------------------------------------------------------------------
          2. BRAND VALUE PILLARS STRIP
          ------------------------------------------------------------------ */}
      <section className="brand-pillars-strip" id="discover-collection" aria-label="Brand Pillars">
        <div className="container">
          <div className="pillars-grid">
            <div className="pillar-item">
              <div className="pillar-icon-box">
                <Gem size={20} />
              </div>
              <div>
                <h4 className="pillar-title">Curated Aesthetics</h4>
                <p className="pillar-text">Only silhouettes that balance poise, dial clarity, and enduring prestige.</p>
              </div>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon-box">
                <Award size={20} />
              </div>
              <div>
                <h4 className="pillar-title">Guaranteed Quality</h4>
                <p className="pillar-text">Every timepiece thoroughly verified for flawless operation and finish.</p>
              </div>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon-box">
                <MessageCircle size={20} />
              </div>
              <div>
                <h4 className="pillar-title">Direct WhatsApp Support</h4>
                <p className="pillar-text">Real-time availability, personalized wrist advice, and swift response.</p>
              </div>
            </div>

            <div className="pillar-item">
              <div className="pillar-icon-box">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="pillar-title">Regular New Edits</h4>
                <p className="pillar-text">Fresh catalog additions regularly introduced to elevate your signature style.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          3. FEATURED TIMEPIECES (Section 5A)
          Real verified featured products from the database
          ------------------------------------------------------------------ */}
      <section className="section featured-section" aria-label="Featured Watches">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">CURATED HIGHLIGHTS</span>
            <h2 className="section-title">Featured Timepieces</h2>
            <div className="gold-divider" />
            <p className="section-description">
              Hand-selected models celebrating superior proportions, exquisite dial balance, and versatile wearability.
            </p>
          </div>

          {featuredWatches.length > 0 ? (
            <>
              <ProductGrid products={featuredWatches} />

              <div className="section-cta-center">
                <Link to="/shop" className="btn btn-outline">
                  <span>View All Watches</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </>
          ) : (
            <div className="empty-results-box" style={{ maxWidth: '640px', margin: '32px auto', textAlign: 'center' }}>
              <span className="section-subtitle" style={{ marginBottom: '8px' }}>INCOMING CURATION</span>
              <h3 style={{ fontSize: '1.75rem', marginBottom: '12px' }}>New Collection Arriving Soon</h3>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
                We are currently cataloguing our latest shipment of fine timepieces.
                For bespoke inquiries, early reservations, or custom sourcing, please message us directly on WhatsApp.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <WhatsAppButton
                  label="Inquire on WhatsApp"
                  variantStyle="primary"
                  className="btn-whatsapp"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------
          4. BROWSE BY COLLECTION (Section 5C)
          Dynamic categories with active watch counts
          ------------------------------------------------------------------ */}
      <section className="section section-dark collections-overview-section" aria-label="Distinctive Collections">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">DISTINCTIVE EDITS</span>
            <h2 className="section-title">Browse By Collection</h2>
            <div className="gold-divider" />
            <p className="section-description">
              Explore timepieces tailored for every mood, occasion, and signature expression.
            </p>
          </div>

          <div className="collections-editorial-grid">
            {categoriesWithCounts.map((cat) => (
              <Link
                key={cat.id}
                to={`/shop?category=${cat.id}`}
                className="luxury-collection-card"
              >
                <div className="collection-card-glow" />
                <div className="collection-card-inner">
                  <span className="collection-count-badge">
                    {cat.count} {cat.count === 1 ? 'Design' : 'Designs'}
                  </span>
                  <h3 className="collection-name">{cat.name}</h3>
                  <p className="collection-desc">{cat.description}</p>
                  <div className="collection-action-link">
                    <span>Explore Edit</span>
                    <ArrowRight size={15} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          5. NEW ARRIVALS SECTION (Section 5B)
          Only displayed if new arrivals exist in database
          ------------------------------------------------------------------ */}
      {newArrivals.length > 0 && (
        <section className="section new-arrivals-section" aria-label="New Arrivals">
          <div className="container">
            <div className="section-header">
              <span className="section-subtitle">LATEST SILHOUETTES</span>
              <h2 className="section-title">New Arrivals</h2>
              <div className="gold-divider" />
              <p className="section-description">
                The newest silhouettes to join our catalogue. Modern aesthetics meeting classic poise.
              </p>
            </div>

            <ProductGrid products={newArrivals} />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------
          6. BRAND PHILOSOPHY & WHATSAPP CONSULTATION BANNER
          ------------------------------------------------------------------ */}
      <section className="section section-ivory brand-philosophy-banner" aria-label="Brand Philosophy">
        <div className="container philosophy-container">
          <span className="section-subtitle">TIMELESS TRENDS PHILOSOPHY</span>
          <h2 className="philosophy-quote">
            "{siteConfig.closingStatement}"
          </h2>

          <p className="philosophy-description">
            We believe acquiring a wristwatch should be an intimate, enjoyable experience.
            Rather than automated checkout carts, we offer direct, personal assistance through WhatsApp.
            Inquire about specific details, request wrist views, verify availability, and order with confidence.
          </p>

          <div className="philosophy-actions">
            <Link to="/shop" className="btn btn-primary">
              <span>View Full Catalogue</span>
            </Link>
            <WhatsAppButton
              label="Chat on WhatsApp"
              variantStyle="primary"
              className="btn-whatsapp"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
