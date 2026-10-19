import React from 'react';
import { SearchBar } from './SearchBar';
import { siteConfig } from '../config/siteConfig';
import { matchesCategory } from '../utils/products';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';

export function ProductFilters({
  products = [],
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  totalResults,
  onReset
}) {
  const configs = siteConfig.categories || [];
  const categoriesWithCounts = configs.map((cat) => {
    let count = 0;
    if (cat.id === 'all') {
      count = products.length;
    } else {
      count = products.filter((p) => matchesCategory(p, cat.id)).length;
    }
    return { ...cat, count };
  });

  const hasActiveFilters = Boolean(search.trim()) || category !== 'all' || sort !== 'featured';

  return (
    <div className="catalog-toolbar">
      {/* Primary Toolbar: Search + Sort Dropdown */}
      <div className="toolbar-primary-row">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          onClear={() => onSearchChange('')}
        />

        <div className="sort-select-wrapper">
          <label htmlFor="catalog-sort" className="sort-label">
            Sort:
          </label>
          <select
            id="catalog-sort"
            className="sort-select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="featured">Featured Curations</option>
            <option value="newest">New Arrivals</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
          </select>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="category-pills-bar" role="tablist" aria-label="Filter watches by collection">
        {categoriesWithCounts.map((cat) => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`category-pill ${isActive ? 'active' : ''}`}
              onClick={() => onCategoryChange(cat.id)}
            >
              <span>{cat.name}</span>
              <span className="category-pill-count">({cat.count})</span>
            </button>
          );
        })}
      </div>

      {/* Active Filter Summary Bar */}
      <div className="active-filters-summary">
        <span>
          Showing <strong>{totalResults}</strong> {totalResults === 1 ? 'watch' : 'watches'}
          {category !== 'all' && (
            <span> in <em>{categoriesWithCounts.find(c => c.id === category)?.name}</em></span>
          )}
          {search && (
            <span> matching "<strong>{search}</strong>"</span>
          )}
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            className="reset-filters-btn"
            onClick={onReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <RotateCcw size={13} />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}

export default ProductFilters;
