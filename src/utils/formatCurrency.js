import { siteConfig } from '../config/siteConfig.js';

/**
 * Format a numeric price into INR currency format (e.g. ₹2,499).
 * If price is missing or unsupplied, returns "Price on request".
 * NEVER returns ₹0 for missing or undefined values.
 * 
 * @param {number|null|undefined} price - Price value in INR
 * @param {Object} options - Options
 * @param {boolean} options.fallbackOnNull - Whether to return "Price on request" if price is null/undefined
 * @returns {string} Formatted price string
 */
export function formatCurrency(price, options = { fallbackOnNull: true }) {
  if (price === null || price === undefined || isNaN(price) || price === '') {
    return options.fallbackOnNull ? 'Price on request' : '';
  }

  const num = Number(price);
  if (num <= 0) {
    return options.fallbackOnNull ? 'Price on request' : '';
  }

  try {
    return new Intl.NumberFormat(siteConfig.currencyLocale || 'en-IN', {
      style: 'currency',
      currency: siteConfig.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${siteConfig.currencySymbol || '₹'}${num.toLocaleString('en-IN')}`;
  }
}

/**
 * Check if a price is valid and confirmed.
 * 
 * @param {number|null|undefined} price 
 * @returns {boolean}
 */
export function hasValidPrice(price) {
  return price !== null && price !== undefined && !isNaN(price) && Number(price) > 0;
}
