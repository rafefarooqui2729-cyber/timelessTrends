import fs from 'fs';
import path from 'path';
import { products } from '../data/products.js';
import { siteConfig } from '../config/siteConfig.js';
import { formatCurrency, hasValidPrice } from './formatCurrency.js';
import {
  sanitizePhoneNumber,
  isWhatsAppConfigured,
  buildProductEnquiryMessage,
  getWhatsAppActionDetails
} from './whatsapp.js';
import {
  getAllProducts,
  getProductBySlug,
  getProductById,
  filterAndSortProducts,
  getCategoriesWithCounts
} from './products.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAILED: ${message}`);
  }
}

console.log('--- TEST SUITE 1: PRODUCT DATA INTEGRITY ---');

// 1. Unique IDs & Slugs
const ids = new Set();
const slugs = new Set();
let duplicatesFound = false;

products.forEach(p => {
  if (ids.has(p.id)) {
    duplicatesFound = true;
    console.error(`Duplicate ID found: ${p.id}`);
  }
  if (slugs.has(p.slug)) {
    duplicatesFound = true;
    console.error(`Duplicate Slug found: ${p.slug}`);
  }
  ids.add(p.id);
  slugs.add(p.slug);
});

assert(!duplicatesFound, 'All product IDs and Slugs must be strictly unique');
assert(products.length >= 8, `Expected at least 8 starter catalog products, found ${products.length}`);

// 2. Price rules: Never 0, valid number or null
const invalidPrices = products.filter(p => p.price === 0 || (p.price !== null && typeof p.price !== 'number'));
assert(invalidPrices.length === 0, 'No product prices are 0 or invalid types');

// 3. Image file existence check
let missingImages = [];
products.forEach(p => {
  const checkImg = (imgUrl) => {
    if (!imgUrl) return;
    const localPath = path.resolve('public' + imgUrl);
    if (!fs.existsSync(localPath)) {
      missingImages.push(`${p.name}: ${imgUrl}`);
    }
  };
  checkImg(p.mainImage);
  (p.additionalImages || []).forEach(checkImg);
  (p.variants || []).forEach(v => checkImg(v.image));
});

assert(missingImages.length === 0, `All product image paths exist on disk (Missing: ${missingImages.join(', ')})`);

console.log('\n--- TEST SUITE 2: CURRENCY FORMATTING (INR) ---');

assert(formatCurrency(2499).includes('2,499'), '2499 formats with Indian comma standard ₹2,499');
assert(formatCurrency(null) === 'Price on request', 'null price formats as "Price on request"');
assert(formatCurrency(undefined) === 'Price on request', 'undefined price formats as "Price on request"');
assert(formatCurrency(0, { fallbackOnNull: true }) === 'Price on request', '0 price falls back gracefully without displaying ₹0');
assert(hasValidPrice(3499) === true, 'hasValidPrice(3499) is true');
assert(hasValidPrice(null) === false, 'hasValidPrice(null) is false');
assert(hasValidPrice(0) === false, 'hasValidPrice(0) is false');

console.log('\n--- TEST SUITE 3: WHATSAPP MESSAGE GENERATOR ---');

const testProduct = products[0];
const testVariant = testProduct.variants[0];
const msg = buildProductEnquiryMessage({ product: testProduct, variant: testVariant });

assert(msg.includes('Hello TIMELESS TRENDS!'), 'Greeting mentions TIMELESS TRENDS');
assert(msg.includes(`Product: ${testProduct.name}`), 'Message contains product name');
assert(msg.includes(`Product ID: ${testProduct.id}`), 'Message contains product ID');
assert(msg.includes(`Colour: ${testVariant.name}`), 'Message contains selected variant name');
assert(msg.includes('Price:'), 'Message contains formatted price');
assert(!msg.includes('undefined'), 'Message has zero "undefined" values');
assert(!msg.includes('localhost'), 'Message NEVER contains localhost URL');

// WhatsApp without configured number
const unconfiguredDetails = getWhatsAppActionDetails({ product: testProduct });
assert(unconfiguredDetails.isConfigured === false, 'Unconfigured number correctly detected');
assert(unconfiguredDetails.url === null, 'Unconfigured number returns null URL to trigger modal');

console.log('\n--- TEST SUITE 4: SEARCH, FILTER, AND SORT ---');

// Search case-insensitive
const searchResults = filterAndSortProducts(products, { search: 'CHRONO' });
assert(searchResults.length >= 2, `Search "CHRONO" found ${searchResults.length} matching items`);

// Category filter
const mensWatches = filterAndSortProducts(products, { category: 'mens' });
assert(mensWatches.length > 0, `Filter "mens" returned ${mensWatches.length} items`);

// Price sort Low to High
const sortedAsc = filterAndSortProducts(products, { sort: 'price-asc' });
const pricedItems = sortedAsc.filter(p => p.price !== null);
let isAscending = true;
for (let i = 0; i < pricedItems.length - 1; i++) {
  if (pricedItems[i].price > pricedItems[i + 1].price) {
    isAscending = false;
    break;
  }
}
assert(isAscending, 'Price-asc sorting arranges items in ascending order');

// Items with null price placed at end of price-asc
const nullPriceItem = sortedAsc[sortedAsc.length - 1];
assert(nullPriceItem.price === null, 'Watches with "Price on request" (null) appear at the end of sorted list');

console.log('\n--- TEST SUMMARY ---');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll test assertions passed successfully!');
}
