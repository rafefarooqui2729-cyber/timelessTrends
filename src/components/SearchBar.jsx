import React from 'react';
import { Search, X } from 'lucide-react';

export function SearchBar({ value, onChange, onClear, placeholder = 'Search by watch name, brand, or style...' }) {
  return (
    <div className="search-input-wrapper">
      <Search size={18} aria-hidden="true" />
      <input
        type="text"
        className="search-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search watches"
      />
      {value && (
        <button
          type="button"
          className="search-clear-btn"
          onClick={onClear}
          aria-label="Clear search query"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default SearchBar;
