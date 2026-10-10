import { products } from '../data/products.js';
import { siteConfig } from '../config/siteConfig.js';

/**
 * Get all available products from data store.
 * @returns {Array} List of products
 */
export function getAllProducts() {
  return products || [];
}

/**
 * Find product by slug
 * @param {string} slug
 * @returns {Object|null}
 */
export function getProductBySlug(slug) {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  return products.find(p => p.slug.toLowerCase() === normalized) || null;
}

/**
 * Find product by ID
 * @param {string} id
 * @returns {Object|null}
 */
export function getProductById(id) {
  if (!id) return null;
  return products.find(p => p.id === id) || null;
}

/**
 * Get featured products for homepage showcase
 * @returns {Array}
 */
export function getFeaturedProducts() {
  return products.filter(p => p.featured);
}

/**
 * Get new arrival products
 * @returns {Array}
 */
export function getNewArrivals() {
  return products.filter(p => p.isNewArrival);
}

/**
 * Normalize category string for comparison
 * @param {string} cat
 * @returns {string}
 */
function normalizeCategory(cat) {
  return String(cat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Match a product to a category query
 * @param {Object} product
 * @param {string} categoryKey
 * @returns {boolean}
 */
export function matchesCategory(product, categoryKey) {
  if (!categoryKey || categoryKey === 'all') return true;

  const target = normalizeCategory(categoryKey);
  const prodCat = normalizeCategory(product.category);

  if (prodCat === target) return true;

  // Partial match for categories like "men", "mens", "women", "womens"
  if (target === 'mens' && (prodCat.includes('men') && !prodCat.includes('women'))) return true;
  if (target === 'womens' && prodCat.includes('women')) return true;
  if (target === 'everydayclassics' && (prodCat.includes('classic') || prodCat.includes('everyday'))) return true;
  if (target === 'trending' && (prodCat.includes('trend') || prodCat.includes('modern'))) return true;

  return false;
}

/**
 * Filter and sort products according to user criteria
 * 
 * @param {Array} items
 * @param {Object} options
 * @param {string} options.search
 * @param {string} options.category
 * @param {string} options.sort - 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'
 * @returns {Array}
 */
export function filterAndSortProducts(items, { search = '', category = 'all', sort = 'featured' } = {}) {
  let filtered = [...items];

  // Search filter (Case-insensitive matching across name, brand, model, description, category)
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(p => {
      const nameMatch = p.name && p.name.toLowerCase().includes(q);
      const brandMatch = p.brand && p.brand.toLowerCase().includes(q);
      const modelMatch = p.model && p.model.toLowerCase().includes(q);
      const categoryMatch = p.category && p.category.toLowerCase().includes(q);
      return nameMatch || brandMatch || modelMatch || categoryMatch;
    });
  }

  // Category filter
  if (category && category !== 'all') {
    filtered = filtered.filter(p => matchesCategory(p, category));
  }

  // Sort
  filtered.sort((a, b) => {
    switch (sort) {
      case 'price-asc':
        // Safe handling for missing prices: items without price placed at the end
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return Number(a.price) - Number(b.price);

      case 'price-desc':
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return Number(b.price) - Number(a.price);

      case 'name-asc':
        return a.name.localeCompare(b.name);

      case 'name-desc':
        return b.name.localeCompare(a.name);

      case 'newest':
        return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);

      case 'featured':
      default:
        // Featured first, then preserve catalog ordering
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    }
  });

  return filtered;
}

/**
 * Get related products based on category, excluding the current product
 * 
 * @param {Object} currentProduct
 * @param {number} [limit=4]
 * @returns {Array}
 */
export function getRelatedProducts(currentProduct, limit = 4) {
  if (!currentProduct) return [];

  const others = products.filter(p => p.id !== currentProduct.id);
  
  // Prefer same category first
  const sameCategory = others.filter(p => p.category === currentProduct.category);
  const differentCategory = others.filter(p => p.category !== currentProduct.category);

  return [...sameCategory, ...differentCategory].slice(0, limit);
}

/**
 * Compute real category counts dynamically based on product inventory
 * @returns {Array<{ id: string, name: string, count: number }>}
 */
export function getCategoriesWithCounts() {
  const configs = siteConfig.categories || [];
  
  return configs.map(cat => {
    let count = 0;
    if (cat.id === 'all') {
      count = products.length;
    } else {
      count = products.filter(p => matchesCategory(p, cat.id)).length;
    }
    return {
      ...cat,
      count
    };
  }).filter(cat => cat.id === 'all' || cat.count > 0); // Only show categories with inventory!
}
