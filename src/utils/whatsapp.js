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
 * Generates the clean prefilled product enquiry message according to brand standards.
 * Excludes any undefined, null, or placeholder fields.
 * 
 * @param {Object} params
 * @param {Object} params.product - Product object
 * @param {Object} [params.variant] - Currently selected colour variant
 * @returns {string} Unencoded plain text message
 */
export function buildProductEnquiryMessage({ product, variant = null }) {
  if (!product) return 'Hello TIMELESS TRENDS! I would like to enquire about your watches.';

  const lines = [
    `Hello ${siteConfig.brandName}!`,
    '',
    'I am interested in this watch:',
    '',
    `Product: ${product.name}`
  ];

  if (product.brand && product.brand.trim()) {
    lines.push(`Brand: ${product.brand}`);
  }

  if (product.id) {
    lines.push(`Product ID: ${product.id}`);
  }

  // Selected variant
  if (variant && variant.name) {
    lines.push(`Colour: ${variant.name}`);
  }

  // Price (only if verified)
  if (hasValidPrice(product.price)) {
    lines.push(`Price: ${formatCurrency(product.price)}`);
  }

  // Public URL check: ONLY include if configured and NOT localhost / 127.0.0.1
  const publicUrl = siteConfig.publicUrl ? siteConfig.publicUrl.trim().replace(/\/$/, '') : '';
  const isLocalOrInvalid = !publicUrl || 
    publicUrl.includes('localhost') || 
    publicUrl.includes('127.0.0.1') || 
    publicUrl.startsWith('http://0.0.0.0');

  if (publicUrl && !isLocalOrInvalid && product.slug) {
    lines.push(`Product link: ${publicUrl}/product/${product.slug}`);
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
  return [
    `Hello ${siteConfig.brandName}!`,
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
 * @returns {{ url: string|null, messageText: string, isConfigured: boolean }}
 */
export function getWhatsAppActionDetails({ product = null, variant = null, customMessage = null } = {}) {
  const isConfigured = isWhatsAppConfigured();
  const phone = sanitizePhoneNumber(siteConfig.whatsappNumber);

  let messageText = '';
  if (customMessage) {
    messageText = customMessage;
  } else if (product) {
    messageText = buildProductEnquiryMessage({ product, variant });
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
