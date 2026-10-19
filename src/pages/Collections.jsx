import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { matchesCategory } from '../utils/products';
import { fetchPublicProducts } from '../utils/publicProductsApi';

export function Collections() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicProducts()
      .then((all) => {
        if (!cancelled) setProducts(all);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const configs = (siteConfig.categories || []).filter((c) => c.id !== 'all');
  const collections = configs.map((col) => ({
    ...col,
    count: products.filter((p) => matchesCategory(p, col.id)).length,
  }));

  return (
    <div className="collections-page section">
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <span className="section-subtitle">CURATED CATEGORIES</span>
          <h1 className="section-title">The Collections</h1>
          <div className="gold-divider" />
          <p className="section-description">
            Explore dedicated horological edits crafted for distinct occasions, tastes, and lifestyle moments.
          </p>
        </div>

        {/* Collections Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px'
        }}>
          {collections.map((col) => {
            const bannerImage = `/images/collections/${col.id}.svg`;

            return (
              <div
                key={col.id}
                style={{
                  backgroundColor: 'var(--color-white)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all var(--transition-normal)'
                }}
              >
                {/* Banner Image */}
                <div style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#141414', overflow: 'hidden' }}>
                  <img
                    src={bannerImage}
                    alt={`${col.name} Banner`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      // Fallback if banner image fails
                      e.target.style.display = 'none';
                    }}
                  />
                </div>

                <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gold)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                      Curation
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      {col.count} {col.count === 1 ? 'Watch' : 'Watches'}
                    </span>
                  </div>

                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', margin: '4px 0 12px' }}>
                    {col.name}
                  </h2>

                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                    {col.description}
                  </p>

                  <div style={{ marginTop: 'auto' }}>
                    <Link
                      to={`/shop?category=${col.id}`}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      <span>Explore {col.name}</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Collections;
