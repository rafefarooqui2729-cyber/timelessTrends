
/**
 * TIMELESS TRENDS - Central Site Configuration
 *
 * Update this file to configure the business details, WhatsApp number,
 * currency, and public domain for the catalogue website.
 */

export const siteConfig = {
  // Brand Identity
  brandName: 'TIMELESS TRENDS',
  tagline: 'Where every second speaks style, class & confidence.',
  closingStatement: "Don't just tell the time — make a statement.",

  brandMessage: [
    'Premium & Trending Watches',
    'Elegant Designs',
    'Everyday Classics',
    'Best Deals & Exclusive Offers',
    'New Collections Regularly',
    'Genuine Products — Trusted Service'
  ],

  // WhatsApp Order & Enquiry Configuration
  // International format without + or spaces.
  // Business WhatsApp: +91 8014445111
  whatsappNumber: '918014445111',

  // Currency Configuration
  currency: 'INR',
  currencySymbol: '₹',
  currencyLocale: 'en-IN',

  // Public Domain
  // Set this only after deploying your website.
  // Example: 'https://yourdomain.com'
  publicUrl: '',

  // Default contact info
  contact: {
    enquiryNotice:
      'WhatsApp is our primary enquiry channel. Tap any product to start a direct chat with our team.',
    operatingHours: 'Mon – Sat: 10:00 AM – 8:00 PM IST',
  },

  // Catalogue Category Definitions
  categories: [
    {
      id: 'all',
      name: 'All Watches',
      description: 'Explore the complete TIMELESS TRENDS catalogue'
    },
    {
      id: 'everyday-classics',
      name: 'Everyday Classics',
      description: 'Timeless dials and versatile designs crafted for effortless daily wear'
    },
    {
      id: 'trending',
      name: 'Trending & Modern',
      description: 'Contemporary silhouettes and bold aesthetics making waves right now'
    },
    {
      id: 'mens',
      name: "Men's Collection",
      description: 'Sophisticated chronographs, robust bracelets, and masculine accents'
    },
    {
      id: 'womens',
      name: "Women's Collection",
      description: 'Delicate dials, elegant mesh bracelets, and graceful finishes'
    }
  ]
};

export default siteConfig;