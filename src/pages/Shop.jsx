
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPublicProducts } from '../utils/publicProductsApi';
import { filterAndSortProducts } from '../utils/products';
import { ProductFilters } from '../components/ProductFilters';
import { ProductGrid } from '../components/ProductGrid';

export function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Initialize filter state from URL parameters.
  const [category, setCategory] = useState(
    () => searchParams.get('category') || 'all'
  );
  const [search, setSearch] = useState(
    () => searchParams.get('q') || ''
  );
  const [sort, setSort] = useState(
    () => searchParams.get('sort') || 'featured'
  );

  // Fetch the real, published catalogue from the backend.
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      setError('');

      try {
        const data = await fetchPublicProducts();

        if (!cancelled) {
          setProducts(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load watches.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Sync filter state when URL parameters change externally.
  useEffect(() => {
    setCategory(searchParams.get('category') || 'all');
    setSearch(searchParams.get('q') || '');
    setSort(searchParams.get('sort') || 'featured');
  }, [searchParams]);

  // Update URL parameters when a filter changes.
  const updateUrlParams = (newCategory, newSearch, newSort) => {
    const params = new URLSearchParams();

    if (newCategory && newCategory !== 'all') {
      params.set('category', newCategory);
    }

    if (newSearch && newSearch.trim()) {
      params.set('q', newSearch.trim());
    }

    if (newSort && newSort !== 'featured') {
      params.set('sort', newSort);
    }

    setSearchParams(params, { replace: true });
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    updateUrlParams(newCategory, search, sort);
  };

  const handleSearchChange = (newSearch) => {
    setSearch(newSearch);
    updateUrlParams(category, newSearch, sort);
  };

  const handleSortChange = (newSort) => {
    setSort(newSort);
    updateUrlParams(category, search, newSort);
  };

  const handleReset = () => {
    setCategory('all');
    setSearch('');
    setSort('featured');
    setSearchParams({}, { replace: true });
  };

  const filteredProducts = filterAndSortProducts(products, {
    category,
    search,
    sort,
  });

  return (
    <div className="shop-page section">
      <div className="container">
        <div
          className="section-header"
          style={{ marginBottom: '36px' }}
        >
          <span className="section-subtitle">
            TIMELESS TRENDS CATALOGUE
          </span>

          <h1 className="section-title">All Watches</h1>

          <div className="gold-divider" />

          <p className="section-description">
            Explore our curated selection of fine timepieces. Select any
            model to view detailed photos, colour variants, and initiate
            a direct enquiry on WhatsApp.
          </p>
        </div>

        <ProductFilters
          products={products}
          search={search}
          onSearchChange={handleSearchChange}
          category={category}
          onCategoryChange={handleCategoryChange}
          sort={sort}
          onSortChange={handleSortChange}
          totalResults={filteredProducts.length}
          onReset={handleReset}
        />

        {loading ? (
          <div
            className="section"
            role="status"
            style={{ textAlign: 'center' }}
          >
            Loading watches from our catalogue...
          </div>
        ) : error ? (
          <div
            className="section"
            role="alert"
            style={{ textAlign: 'center' }}
          >
            <p>We couldn't load the watches.</p>
            <p>{error}</p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Try Again
            </button>
          </div>
        ) : filteredProducts.length > 0 ? (
          <ProductGrid
            products={filteredProducts}
            onReset={handleReset}
          />
        ) : products.length === 0 ? (
          <div
            className="empty-results-box"
            style={{ maxWidth: '640px', margin: '48px auto' }}
          >
            <span className="section-subtitle" style={{ marginBottom: '8px' }}>CATALOGUE PREPARATION</span>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>New Timepieces Arriving Soon</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
              Our upcoming horological edit is currently being catalogued and will be listed shortly.
              To inquire about specific models, incoming stock, or private appointments, contact us directly on WhatsApp.
            </p>
            <WhatsAppButton
              label="Inquire on WhatsApp"
              variantStyle="primary"
              className="btn-whatsapp"
            />
          </div>
        ) : (
          <div
            className="section"
            style={{ textAlign: 'center' }}
          >
            <h2>No watches found</h2>
            <p>
              Try a different search or remove some filters to explore
              the available catalogue.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleReset}
            >
              Show All Watches
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Shop;
