import { siteConfig } from '../config/siteConfig.js';
import { formatCurrency, hasValidPrice } from './formatCurrency.js';

/**
 * Sanitize and clean phone number for wa.me URL
 * Strips '+', spaces, dashes, and parentheses.
 * 
 * @param {string} phone 
 * @returns {string} Clean digits
 */
export function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^\d]/g, '');
}

/**
 * Check if the site has a configured WhatsApp number
 * 
 * @returns {boolean}
 */
export function isWhatsAppConfigured() {
  const cleaned = sanitizePhoneNumber(siteConfig.whatsappNumber);
  // Valid international numbers are typically at least 10 digits
  return Boolean(cleaned && cleaned.length >= 10);
}

/**
 * Helper to determine if a URL is localhost / loopback
 * 
 * @param {string} url 
 * @returns {boolean}
 */
export function isLocalUrl(url) {
  if (!url) return true;
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url);
}

/**
 * Generates the clean prefilled product enquiry message according to brand standards.
 * Excludes any undefined, null, or placeholder fields.
 * 
 * @param {Object} params
 * @param {Object} params.product - Product object
 * @param {Object} [params.variant] - Currently selected colour variant
 * @param {string} [params.publicUrl] - Optional public URL override
 * @returns {string} Unencoded plain text message
 */
export function buildProductEnquiryMessage({ product, variant = null, publicUrl: urlOverride = null }) {
  if (!product) return `Hello ${siteConfig.brandName || 'TIMELESS TRENDS'}! I would like to enquire about your watches.`;

  const brandName = siteConfig.brandName || 'TIMELESS TRENDS';
  const lines = [
    `Hello ${brandName}!`,
    '',
    'I am interested in this watch:',
    '',
    `Product: ${product.name || 'TIMELESS TRENDS Timepiece'}`
  ];

  if (product.brand && String(product.brand).trim()) {
    lines.push(`Brand: ${String(product.brand).trim()}`);
  }

  const productId = product.code || product.id;
  if (productId) {
    lines.push(`Product ID: ${productId}`);
  }

  // Selected variant: omit if generic or missing
  const variantName = variant?.name || variant?.colour;
  if (
    variantName &&
    String(variantName).trim() &&
    !/^default(\s+finish)?$/i.test(String(variantName).trim())
  ) {
    lines.push(`Colour: ${String(variantName).trim()}`);
  }

  // Price (resolve displayed price: variant override or product base/effective price)
  const price = variant?.price ?? product.price ?? product.selling_price ?? product.effective_price ?? product.priceFrom ?? product.price_from;
  if (hasValidPrice(price)) {
    lines.push(`Price: ${formatCurrency(price)}`);
  }

  // Canonical public URL check: ONLY include if configured and NOT localhost / 127.0.0.1
  const rawBaseUrl = urlOverride ?? siteConfig.publicUrl ?? (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  const cleanBase = String(rawBaseUrl || '').trim().replace(/\/$/, '');

  if (cleanBase && !isLocalUrl(cleanBase) && product.slug) {
    lines.push(`Product link: ${cleanBase}/product/${product.slug}`);
  }

  // Publicly accessible product image URL (selected variant image or primary product image)
  const rawImage = variant?.image || product.mainImage || (Array.isArray(product.images) && product.images[0]?.url) || null;
  if (rawImage && typeof rawImage === 'string' && rawImage.trim().length > 0) {
    const trimmed = rawImage.trim();
    let absoluteImg = null;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (!isLocalUrl(trimmed)) {
        absoluteImg = trimmed;
      }
    } else if (trimmed.startsWith('/') && cleanBase && !isLocalUrl(cleanBase)) {
      absoluteImg = `${cleanBase}${trimmed}`;
    }

    if (absoluteImg) {
      lines.push(`Product image: ${absoluteImg}`);
    }
  }

  lines.push('');
  lines.push('Please share the availability and further details.');
  lines.push('');
  lines.push('Thank you.');

  return lines.join('\n');
}

/**
 * Generates a general enquiry message for TIMELESS TRENDS
 * 
 * @returns {string} Plain text general enquiry message
 */
export function buildGeneralEnquiryMessage() {
  const brandName = siteConfig.brandName || 'TIMELESS TRENDS';
  return [
    `Hello ${brandName}!`,
    '',
    'I am browsing your watch catalogue and would like to enquire about your latest collections and availability.',
    '',
    'Thank you.'
  ].join('\n');
}

/**
 * Constructs the final wa.me click-to-chat URL.
 * Returns an object with url, message text, and setup status.
 * 
 * @param {Object} options
 * @param {Object} [options.product]
 * @param {Object} [options.variant]
 * @param {string} [options.customMessage]
 * @param {string} [options.publicUrl]
 * @returns {{ url: string|null, messageText: string, isConfigured: boolean, configuredNumber: string }}
 */
export function getWhatsAppActionDetails({ product = null, variant = null, customMessage = null, publicUrl = null } = {}) {
  const isConfigured = isWhatsAppConfigured();
  const phone = sanitizePhoneNumber(siteConfig.whatsappNumber);

  let messageText = '';
  if (customMessage) {
    messageText = customMessage;
  } else if (product) {
    messageText = buildProductEnquiryMessage({ product, variant, publicUrl });
  } else {
    messageText = buildGeneralEnquiryMessage();
  }

  if (!isConfigured) {
    return {
      url: null,
      messageText,
      isConfigured: false,
      configuredNumber: siteConfig.whatsappNumber
    };
  }

  const encodedMessage = encodeURIComponent(messageText);
  const url = `https://wa.me/${phone}?text=${encodedMessage}`;

  return {
    url,
    messageText,
    isConfigured: true,
    configuredNumber: phone
  };
}
