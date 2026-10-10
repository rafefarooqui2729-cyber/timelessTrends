import React from 'react';
import { Link } from 'react-router-dom';
import { Watch, ArrowLeft, Home } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';

export function NotFound() {
  return (
    <div className="not-found-page section" style={{ minHeight: '65vh', display: 'flex', alignItems: 'center' }}>
      <div className="container container-narrow" style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex',
          padding: '24px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-ivory)',
          color: 'var(--color-gold)',
          marginBottom: '20px'
        }}>
          <Watch size={48} />
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginBottom: '8px' }}>
          404
        </h1>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: 'var(--color-charcoal)', marginBottom: '16px' }}>
          Time Stands Still Here
        </h2>

        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '520px', margin: '0 auto 36px', fontSize: '1.05rem', lineHeight: 1.6 }}>
          The page or watch you are looking for does not exist, has been moved, or the link may be outdated. Return to our catalogue to continue exploring.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link to="/shop" className="btn btn-primary">
            <ArrowLeft size={16} />
            <span>Browse All Watches</span>
          </Link>
          <Link to="/" className="btn btn-outline">
            <Home size={16} />
            <span>Go to Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
