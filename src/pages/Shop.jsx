import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllProducts, filterAndSortProducts } from '../utils/products';
import { ProductFilters } from '../components/ProductFilters';
import { ProductGrid } from '../components/ProductGrid';

export function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const allProducts = getAllProducts();

  // Initialize state from URL params
  const initialCategory = searchParams.get('category') || 'all';
  const initialQuery = searchParams.get('q') || '';
  const initialSort = searchParams.get('sort') || 'featured';

  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);

  // Sync state when URL params change externally (e.g. navbar clicks)
  useEffect(() => {
    const urlCategory = searchParams.get('category') || 'all';
    const urlQuery = searchParams.get('q') || '';
    const urlSort = searchParams.get('sort') || 'featured';

    setCategory(urlCategory);
    setSearch(urlQuery);
    setSort(urlSort);
  }, [searchParams]);

  // Update URL params when local filter state changes
  const updateUrlParams = (newCat, newSearch, newSort) => {
    const params = new URLSearchParams();
    if (newCat && newCat !== 'all') params.set('category', newCat);
    if (newSearch && newSearch.trim()) params.set('q', newSearch.trim());
    if (newSort && newSort !== 'featured') params.set('sort', newSort);
    setSearchParams(params, { replace: true });
  };

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    updateUrlParams(newCat, search, sort);
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

  const filteredProducts = filterAndSortProducts(allProducts, {
    category,
    search,
    sort
  });

  return (
    <div className="shop-page section">
      <div className="container">
        {/* Editorial Header */}
        <div className="section-header" style={{ marginBottom: '36px' }}>
          <span className="section-subtitle">TIMELESS TRENDS CATALOGUE</span>
          <h1 className="section-title">All Watches</h1>
          <div className="gold-divider" />
          <p className="section-description">
            Explore our curated selection of fine timepieces. Select any model to view detailed photos, colour variants, and initiate a direct enquiry on WhatsApp.
          </p>
        </div>

        {/* Toolbar: Search, Filters & Sorters */}
        <ProductFilters
          search={search}
          onSearchChange={handleSearchChange}
          category={category}
          onCategoryChange={handleCategoryChange}
          sort={sort}
          onSortChange={handleSortChange}
          totalResults={filteredProducts.length}
          onReset={handleReset}
        />

        {/* Results Product Grid */}
        <ProductGrid
          products={filteredProducts}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}

export default Shop;
