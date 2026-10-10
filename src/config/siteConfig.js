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
  // IMPORTANT: Set your official WhatsApp number here (international format without + or spaces)
  // Example for India (+91 98765 43210): '919876543210'
  // Leave as empty string '' if not yet configured — the site will show a helpful setup modal instead of failing.
  whatsappNumber: '',

  // Currency Configuration
  currency: 'INR',
  currencySymbol: '₹',
  currencyLocale: 'en-IN',

  // Public Domain (Set only when deployed to production, e.g., 'https://timelesstrends.com')
  // MUST remain empty in local development to avoid sending localhost URLs to customers.
  publicUrl: '',

  // Default contact info (only verified channels)
  contact: {
    enquiryNotice: 'WhatsApp is our primary enquiry channel. Tap any product to start a direct chat with our team.',
    operatingHours: 'Mon – Sat: 10:00 AM – 8:00 PM IST',
  },

  // Catalogue Category Definitions (only categories that match actual products)
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
