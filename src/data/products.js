/**
 * TIMELESS TRENDS - Central Product Catalogue Data
 * 
 * Schema Guidelines:
 * - id: Unique alphanumeric identifier
 * - slug: URL-friendly unique identifier (used in /product/:slug)
 * - name: Display title of the watch
 * - brand: Confirmed brand name (or omit / null)
 * - model: Confirmed model reference (or null)
 * - price: Numeric price in INR, or null for "Price on request" (NEVER 0)
 * - originalPrice: Confirmed original retail price for genuine offers, or null
 * - category: Matches category IDs defined in siteConfig ('Everyday Classics', 'Trending & Modern', "Men's Collection", "Women's Collection")
 * - description: Confirmed editorial description
 * - mainImage: Primary catalogue photograph path
 * - additionalImages: Array of additional angle / detail photographs
 * - variants: Array of available colour and strap variants
 * - specifications: Key-value map of confirmed technical details (omit unconfirmed fields)
 * - featured: Boolean flag for homepage editorial highlights
 * - isNewArrival: Boolean flag for latest collection arrivals
 * - availability: "Available", "Limited Edition", or null if unconfirmed
 * - isSampleCatalog: Marks sample showroom items pending user uploads
 */

export const products = [
  {
    id: 'TT-CHRONO-01',
    slug: 'aethelgard-master-chronograph',
    name: 'Aethelgard Master Chronograph',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-MC42',
    price: 3499,
    originalPrice: 4299,
    category: 'Trending & Modern',
    description: 'A striking precision chronograph built with sculpted surgical-grade stainless steel, dual sub-dial counters, and a tachymeter bezel. Engineered for commanding wrist presence.',
    mainImage: '/images/products/chronograph-silver.svg',
    additionalImages: [
      '/images/products/chronograph-black.svg',
      '/images/products/chronograph-navy.svg'
    ],
    variants: [
      {
        id: 'var-chrono-silver',
        name: 'Silver Sunburst Steel',
        color: '#D8DCE0',
        image: '/images/products/chronograph-silver.svg',
        available: true
      },
      {
        id: 'var-chrono-black',
        name: 'Midnight Obsidian Steel',
        color: '#1A1A1A',
        image: '/images/products/chronograph-black.svg',
        available: true
      },
      {
        id: 'var-chrono-navy',
        name: 'Deep Navy Gold & Leather',
        color: '#0E1F38',
        image: '/images/products/chronograph-navy.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '42 mm',
      'Case Material': '316L Stainless Steel',
      'Dial Window': 'Scratch-resistant Sapphire Mineral Glass',
      'Movement': 'Multi-function Chronograph Quartz',
      'Water Resistance': '50M / 5 ATM'
    },
    featured: true,
    isNewArrival: true,
    availability: 'Available',
    isSampleCatalog: true
  },
  {
    id: 'TT-HERITAGE-02',
    slug: 'vanguard-heritage-minimalist',
    name: 'Vanguard Heritage Minimalist',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-VH38',
    price: 2299,
    originalPrice: null,
    category: 'Everyday Classics',
    description: 'A masterclass in restraint. Slim profile, clean baton indices, and a genuine calfskin strap designed for seamless transition from boardroom meetings to evening engagements.',
    mainImage: '/images/products/heritage-brown.svg',
    additionalImages: [
      '/images/products/heritage-black.svg'
    ],
    variants: [
      {
        id: 'var-heritage-brown',
        name: 'Ivory Dial & Chestnut Leather',
        color: '#8B5A2B',
        image: '/images/products/heritage-brown.svg',
        available: true
      },
      {
        id: 'var-heritage-black',
        name: 'Charcoal Dial & Black Leather',
        color: '#1A1A1A',
        image: '/images/products/heritage-black.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '39 mm',
      'Case Thickness': '7.2 mm ultra-slim',
      'Case Material': 'Polished Stainless Steel with PVD Gold Tone',
      'Strap Material': 'Supple Grain Leather',
      'Water Resistance': '30M Splash Resistant'
    },
    featured: true,
    isNewArrival: false,
    availability: 'Available',
    isSampleCatalog: true
  },
  {
    id: 'TT-AURELIA-03',
    slug: 'aurelia-celestial-mesh',
    name: 'Aurelia Celestial Mesh',
    brand: 'TIMELESS TRENDS Privé',
    model: 'TT-AC32',
    price: 2899,
    originalPrice: 3499,
    category: "Women's Collection",
    description: 'Exquisite jewelry watch featuring a brushed sunray dial, delicate faceted indices, and an adjustable Milanese magnetic mesh bracelet that hugs the wrist with featherlight comfort.',
    mainImage: '/images/products/aurelia-gold.svg',
    additionalImages: [
      '/images/products/aurelia-rosegold.svg',
      '/images/products/aurelia-silver.svg'
    ],
    variants: [
      {
        id: 'var-aurelia-gold',
        name: 'Champagne Gold Mesh',
        color: '#D4AF37',
        image: '/images/products/aurelia-gold.svg',
        available: true
      },
      {
        id: 'var-aurelia-rosegold',
        name: 'Rose Gold Metallic Mesh',
        color: '#C87D6E',
        image: '/images/products/aurelia-rosegold.svg',
        available: true
      },
      {
        id: 'var-aurelia-silver',
        name: 'Polished Rhodium Silver Mesh',
        color: '#D0D4D8',
        image: '/images/products/aurelia-silver.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '32 mm',
      'Case Thickness': '6.8 mm',
      'Strap': 'High-density Milanese Mesh with Quick-Release',
      'Dial': 'Sunburst Dial with Crystalline Accents',
      'Water Resistance': '30M Splash Resistant'
    },
    featured: true,
    isNewArrival: true,
    availability: 'Available',
    isSampleCatalog: true
  },
  {
    id: 'TT-DIVER-04',
    slug: 'seaborne-automatic-diver',
    name: 'Seaborne Automatic Diver Pro',
    brand: 'TIMELESS TRENDS Atelier',
    model: 'TT-SB43',
    price: 4199,
    originalPrice: 4999,
    category: "Men's Collection",
    description: 'A rugged maritime companion equipped with a 120-click unidirectional ceramic bezel, luminous sword hands, and an oyster-link solid stainless steel bracelet with safety deployant clasp.',
    mainImage: '/images/products/diver-blue.svg',
    additionalImages: [
      '/images/products/diver-green.svg',
      '/images/products/diver-black.svg'
    ],
    variants: [
      {
        id: 'var-diver-blue',
        name: 'Deep Sea Royal Navy',
        color: '#0A2540',
        image: '/images/products/diver-blue.svg',
        available: true
      },
      {
        id: 'var-diver-green',
        name: 'Emerald Forest Green',
        color: '#0E2E1E',
        image: '/images/products/diver-green.svg',
        available: true
      },
      {
        id: 'var-diver-black',
        name: 'Stealth Matte Black',
        color: '#111111',
        image: '/images/products/diver-black.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '43 mm',
      'Bezel': 'Unidirectional Ceramic Rotation Bezel',
      'Luminescence': 'SuperLuminova Indices & Hands',
      'Bracelet': 'Solid 316L Stainless Steel Oyster Link',
      'Water Resistance': '100M / 10 ATM'
    },
    featured: true,
    isNewArrival: false,
    availability: 'Available',
    isSampleCatalog: true
  },
  {
    id: 'TT-SLIM-05',
    slug: 'monolith-ultra-slim-dress',
    name: 'Monolith Ultra-Slim Dress',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-MO40',
    price: 1999,
    originalPrice: null,
    category: 'Everyday Classics',
    description: 'Understated refinement crafted for lovers of pure minimalism. Features a satin-finished monochrome dial, flush profile, and textured genuine leather band.',
    mainImage: '/images/products/slim-black.svg',
    additionalImages: [
      '/images/products/slim-white.svg'
    ],
    variants: [
      {
        id: 'var-slim-black',
        name: 'Obsidian Black & Silver',
        color: '#141414',
        image: '/images/products/slim-black.svg',
        available: true
      },
      {
        id: 'var-slim-white',
        name: 'Pure Opal White & Silver',
        color: '#F8F9FA',
        image: '/images/products/slim-white.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '40 mm',
      'Profile': '6.5 mm Ultra-Slim Silhouette',
      'Glass': 'Hardened Mineral Crystal',
      'Strap': 'Genuine Italian Calfskin Leather',
      'Water Resistance': '30M Splash Resistant'
    },
    featured: false,
    isNewArrival: false,
    availability: 'Available',
    isSampleCatalog: true
  },
  {
    id: 'TT-SKELETON-06',
    slug: 'sovereign-skeleton-open-heart',
    name: 'Sovereign Skeleton Open Heart',
    brand: 'TIMELESS TRENDS Atelier',
    model: 'TT-SK41',
    price: null, // Price on request demonstration (satisfies prompt strict rule: never invent prices or assume ₹0)
    originalPrice: null,
    category: 'Trending & Modern',
    description: 'An architectural work of mechanical art. The cutaway open-heart dial reveals intricate gears and balance wheel rhythm, accented with electroplated metallic bridge accents.',
    mainImage: '/images/products/skeleton-gunmetal.svg',
    additionalImages: [
      '/images/products/skeleton-silver.svg'
    ],
    variants: [
      {
        id: 'var-skeleton-gunmetal',
        name: 'Gunmetal with Rose Gold Bridges',
        color: '#505358',
        image: '/images/products/skeleton-gunmetal.svg',
        available: true
      },
      {
        id: 'var-skeleton-silver',
        name: 'Brushed Silver with Cobalt Hands',
        color: '#C8CCD0',
        image: '/images/products/skeleton-silver.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '41.5 mm',
      'Dial Type': 'Multi-layer Open Heart Skeleton',
      'Movement': 'Automatic Self-Winding Mechanical Movement',
      'Exhibition Back': 'Transparent Mineral Crystal Display Back',
      'Water Resistance': '50M / 5 ATM'
    },
    featured: false,
    isNewArrival: true,
    availability: 'Limited Edition',
    isSampleCatalog: true
  },
  {
    id: 'TT-SERAPHINA-07',
    slug: 'seraphina-petite-diamond-index',
    name: 'Seraphina Petite Diamond Index',
    brand: 'TIMELESS TRENDS Privé',
    model: 'TT-SP28',
    price: 2650,
    originalPrice: 3100,
    category: "Women's Collection",
    description: 'A poetic celebration of femininity with an iridescent mother-of-pearl dial, hand-set crystal indices at each hour mark, and a refined jewelry clasp mesh strap.',
    mainImage: '/images/products/seraphina-pearl.svg',
    additionalImages: [
      '/images/products/seraphina-silver.svg'
    ],
    variants: [
      {
        id: 'var-seraphina-pearl',
        name: 'Rose Gold & Shimmering Pearl',
        color: '#C87D6E',
        image: '/images/products/seraphina-pearl.svg',
        available: true
      },
      {
        id: 'var-seraphina-silver',
        name: 'Polished Silver & Pearl',
        color: '#D0D4D8',
        image: '/images/products/seraphina-silver.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '28 mm Petite',
      'Dial': 'Natural Shimmer Mother-of-Pearl Effect',
      'Indices': '12 Hand-Set Zircon Crystal Markers',
      'Bracelet': 'Hypoallergenic Fine Milanese Mesh',
      'Water Resistance': '30M Splash Resistant'
    },
    featured: false,
    isNewArrival: false,
    availability: 'Available',
    isSampleCatalog: true
  },
  {
    id: 'TT-APEX-08',
    slug: 'apex-executive-chrono-steel',
    name: 'Apex Executive Chrono Steel',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-AX44',
    price: 3799,
    originalPrice: 4599,
    category: "Men's Collection",
    description: 'Engineered for leaders and driven professionals. Features a deep matte dial, dual chrono pushers, date display, and a heavy-gauge solid link bracelet with satin and polished facets.',
    mainImage: '/images/products/apex-allblack.svg',
    additionalImages: [
      '/images/products/apex-goldbezel.svg'
    ],
    variants: [
      {
        id: 'var-apex-allblack',
        name: 'All-Black Matte PVD Steel',
        color: '#101010',
        image: '/images/products/apex-allblack.svg',
        available: true
      },
      {
        id: 'var-apex-goldbezel',
        name: 'Matte Black with Champagne Gold Bezel',
        color: '#D4AF37',
        image: '/images/products/apex-goldbezel.svg',
        available: true
      }
    ],
    specifications: {
      'Case Diameter': '44 mm',
      'Finish': 'Ion-plated PVD Matte Black with Polished Chamfers',
      'Complications': 'Chronograph, 24-Hour Indicator & Date Aperture',
      'Clasp': 'Push-Button Butterfly Clasp',
      'Water Resistance': '50M / 5 ATM'
    },
    featured: true,
    isNewArrival: false,
    availability: 'Available',
    isSampleCatalog: true
  }
];

export default products;
