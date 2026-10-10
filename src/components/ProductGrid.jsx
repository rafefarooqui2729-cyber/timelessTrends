import React from 'react';
import { ProductCard } from './ProductCard';
import { Watch } from 'lucide-react';

export function ProductGrid({ products = [], emptyMessage, onReset }) {
  if (!products || products.length === 0) {
    return (
      <div className="empty-results-box" role="status" aria-live="polite">
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', backgroundColor: 'var(--color-ivory)', color: 'var(--color-gold)', marginBottom: '8px' }}>
          <Watch size={36} />
        </div>
        <h3>No Watches Found</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
          {emptyMessage || "We couldn't find any watches matching your current search or filter criteria."}
        </p>
        {onReset && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={onReset}
          >
            Clear All Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="product-grid" role="region" aria-label="Watches catalogue grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default ProductGrid;
