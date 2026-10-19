
require('./config'); // Load the root .env before connecting to PostgreSQL.

const { pool, closePool } = require('./pg');
const { slugify } = require('./util');

const initialProducts = [
  {
    code: 'TT-CHRONO-01',
    name: 'Aethelgard Master Chronograph',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-MC42',
    selling_price: 3499,
    original_price: 4299,
    category: 'trending',
    description: 'A striking precision chronograph built with sculpted surgical-grade stainless steel, dual sub-dial counters, and a tachymeter bezel. Engineered for commanding wrist presence.',
    specs: [
      { label: 'Case Diameter', value: '42 mm' },
      { label: 'Case Material', value: '316L Stainless Steel' },
      { label: 'Dial Window', value: 'Scratch-resistant Sapphire Mineral Glass' },
      { label: 'Movement', value: 'Multi-function Chronograph Quartz' },
      { label: 'Water Resistance', value: '50M / 5 ATM' }
    ],
    is_new_arrival: 1,
    is_featured: 1,
    variants: [
      { colour: 'Silver Sunburst Steel', min_stock: 2, stock: 8, avg_cost: 1600 },
      { colour: 'Midnight Obsidian Steel', min_stock: 2, stock: 6, avg_cost: 1600 },
      { colour: 'Deep Navy Gold & Leather', min_stock: 2, stock: 4, avg_cost: 1700 }
    ]
  },
  {
    code: 'TT-HERITAGE-02',
    name: 'Vanguard Heritage Minimalist',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-VH38',
    selling_price: 2299,
    original_price: null,
    category: 'everyday-classics',
    description: 'A masterclass in restraint. Slim profile, clean baton indices, and a genuine calfskin strap designed for seamless transition from boardroom meetings to evening engagements.',
    specs: [
      { label: 'Case Diameter', value: '39 mm' },
      { label: 'Case Thickness', value: '7.2 mm ultra-slim' },
      { label: 'Case Material', value: 'Polished Stainless Steel with PVD Gold Tone' },
      { label: 'Strap Material', value: 'Supple Grain Leather' },
      { label: 'Water Resistance', value: '30M Splash Resistant' }
    ],
    is_new_arrival: 0,
    is_featured: 1,
    variants: [
      { colour: 'Ivory Dial & Chestnut Leather', min_stock: 2, stock: 5, avg_cost: 1100 },
      { colour: 'Charcoal Dial & Black Leather', min_stock: 2, stock: 4, avg_cost: 1100 }
    ]
  },
  {
    code: 'TT-AURELIA-03',
    name: 'Aurelia Celestial Mesh',
    brand: 'TIMELESS TRENDS Privé',
    model: 'TT-AC32',
    selling_price: 2899,
    original_price: 3499,
    category: 'womens',
    description: 'Exquisite jewelry watch featuring a brushed sunray dial, delicate faceted indices, and an adjustable Milanese magnetic mesh bracelet that hugs the wrist with featherlight comfort.',
    specs: [
      { label: 'Case Diameter', value: '32 mm' },
      { label: 'Case Thickness', value: '6.8 mm' },
      { label: 'Strap', value: 'High-density Milanese Mesh with Quick-Release' },
      { label: 'Water Resistance', value: '30M Splash Resistant' }
    ],
    is_new_arrival: 1,
    is_featured: 1,
    variants: [
      { colour: 'Champagne Gold Mesh', min_stock: 2, stock: 7, avg_cost: 1350 },
      { colour: 'Rose Gold Metallic Mesh', min_stock: 2, stock: 5, avg_cost: 1350 },
      { colour: 'Polished Rhodium Silver Mesh', min_stock: 2, stock: 3, avg_cost: 1300 }
    ]
  },
  {
    code: 'TT-DIVER-04',
    name: 'Seaborne Automatic Diver Pro',
    brand: 'TIMELESS TRENDS Atelier',
    model: 'TT-SB43',
    selling_price: 4199,
    original_price: 4999,
    category: 'mens',
    description: 'A rugged maritime companion equipped with a 120-click unidirectional ceramic bezel, luminous sword hands, and an oyster-link solid stainless steel bracelet with safety deployant clasp.',
    specs: [
      { label: 'Case Diameter', value: '43 mm' },
      { label: 'Bezel', value: 'Unidirectional Ceramic Rotation Bezel' },
      { label: 'Luminescence', value: 'SuperLuminova Indices & Hands' },
      { label: 'Water Resistance', value: '100M / 10 ATM' }
    ],
    is_new_arrival: 0,
    is_featured: 1,
    variants: [
      { colour: 'Deep Sea Royal Navy', min_stock: 2, stock: 4, avg_cost: 2100 },
      { colour: 'Emerald Forest Green', min_stock: 2, stock: 3, avg_cost: 2100 },
      { colour: 'Stealth Matte Black', min_stock: 2, stock: 5, avg_cost: 2100 }
    ]
  },
  {
    code: 'TT-SLIM-05',
    name: 'Monolith Ultra-Slim Dress',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-MO40',
    selling_price: 1999,
    original_price: null,
    category: 'everyday-classics',
    description: 'Understated refinement crafted for lovers of pure minimalism. Features a satin-finished monochrome dial, flush profile, and textured genuine leather band.',
    specs: [
      { label: 'Case Diameter', value: '40 mm' },
      { label: 'Profile', value: '6.5 mm Ultra-Slim Silhouette' },
      { label: 'Strap', value: 'Genuine Italian Calfskin Leather' }
    ],
    is_new_arrival: 0,
    is_featured: 0,
    variants: [
      { colour: 'Obsidian Black & Silver', min_stock: 2, stock: 6, avg_cost: 950 },
      { colour: 'Pure Opal White & Silver', min_stock: 2, stock: 4, avg_cost: 950 }
    ]
  },
  {
    code: 'TT-SKELETON-06',
    name: 'Sovereign Skeleton Open Heart',
    brand: 'TIMELESS TRENDS Atelier',
    model: 'TT-SK41',
    selling_price: null,
    original_price: null,
    category: 'trending',
    description: 'An architectural work of mechanical art. The cutaway open-heart dial reveals intricate gears and balance wheel rhythm, accented with electroplated metallic bridge accents.',
    specs: [
      { label: 'Case Diameter', value: '41.5 mm' },
      { label: 'Dial Type', value: 'Multi-layer Open Heart Skeleton' },
      { label: 'Movement', value: 'Automatic Self-Winding Mechanical Movement' }
    ],
    is_new_arrival: 1,
    is_featured: 0,
    variants: [
      { colour: 'Gunmetal with Rose Gold Bridges', min_stock: 2, stock: 2, avg_cost: 2600 },
      { colour: 'Brushed Silver with Cobalt Hands', min_stock: 2, stock: 3, avg_cost: 2600 }
    ]
  },
  {
    code: 'TT-SERAPHINA-07',
    name: 'Seraphina Petite Diamond Index',
    brand: 'TIMELESS TRENDS Privé',
    model: 'TT-SP28',
    selling_price: 2650,
    original_price: 3100,
    category: 'womens',
    description: 'A poetic celebration of femininity with an iridescent mother-of-pearl dial, hand-set crystal indices at each hour mark, and a refined jewelry clasp mesh strap.',
    specs: [
      { label: 'Case Diameter', value: '28 mm Petite' },
      { label: 'Dial', value: 'Natural Shimmer Mother-of-Pearl Effect' },
      { label: 'Indices', value: '12 Hand-Set Zircon Crystal Markers' }
    ],
    is_new_arrival: 0,
    is_featured: 0,
    variants: [
      { colour: 'Rose Gold & Shimmering Pearl', min_stock: 2, stock: 4, avg_cost: 1250 },
      { colour: 'Polished Silver & Pearl', min_stock: 2, stock: 5, avg_cost: 1250 }
    ]
  },
  {
    code: 'TT-APEX-08',
    name: 'Apex Executive Chrono Steel',
    brand: 'TIMELESS TRENDS Signature',
    model: 'TT-AX44',
    selling_price: 3799,
    original_price: 4599,
    category: 'mens',
    description: 'Engineered for leaders and driven professionals. Features a deep matte dial, dual chrono pushers, date display, and a heavy-gauge solid link bracelet with satin and polished facets.',
    specs: [
      { label: 'Case Diameter', value: '44 mm' },
      { label: 'Finish', value: 'Ion-plated PVD Matte Black with Polished Chamfers' },
      { label: 'Complications', value: 'Chronograph, 24-Hour Indicator & Date Aperture' }
    ],
    is_new_arrival: 0,
    is_featured: 1,
    variants: [
      { colour: 'All-Black Matte PVD Steel', min_stock: 2, stock: 7, avg_cost: 1800 },
      { colour: 'Matte Black with Champagne Gold Bezel', min_stock: 2, stock: 4, avg_cost: 1850 }
    ]
  }
];

async function seedDatabase() {
  // Safety guard: never add sample products to a populated database.
  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM products'
  );

  const existingCount = countResult.rows[0].count;

  if (existingCount > 0) {
    console.log(
      `Database already has ${existingCount} products. Skipping initial seed.`
    );
    return;
  }

  console.log('Seeding initial TIMELESS TRENDS luxury catalog into PostgreSQL...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Recheck after acquiring the client to reduce the risk of a concurrent seed.
    const recheck = await client.query(
      'SELECT COUNT(*)::int AS count FROM products'
    );

    if (recheck.rows[0].count > 0) {
      await client.query('ROLLBACK');
      console.log('Products appeared before seeding. Skipping initial seed.');
      return;
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    for (const p of initialProducts) {
      const productResult = await client.query(
        `INSERT INTO products (
          code, name, brand, model, slug, category, description,
          selling_price, original_price, specs, status, is_active,
          is_new_arrival, is_featured, date_added, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          'published', 1, $11, $12, $13, $14, $15
        )
        RETURNING id`,
        [
          p.code,
          p.name,
          p.brand,
          p.model,
          slugify(p.name),
          p.category,
          p.description,
          p.selling_price,
          p.original_price,
          JSON.stringify(p.specs),
          p.is_new_arrival,
          p.is_featured,
          today,
          now,
          now
        ]
      );

      const productId = productResult.rows[0].id;
      let variantIndex = 1;

      for (const v of p.variants) {
        const sku = `${p.code}-${String(variantIndex++).padStart(2, '0')}`;

        const variantResult = await client.query(
          `INSERT INTO variants (
            product_id, sku, colour, min_stock, stock_on_hand,
            avg_cost, is_active, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
          RETURNING id`,
          [
            productId,
            sku,
            v.colour,
            v.min_stock ?? 2,
            v.stock ?? 0,
            v.avg_cost ?? null,
            now
          ]
        );

        const variantId = variantResult.rows[0].id;

        if (v.stock > 0) {
          await client.query(
            `INSERT INTO stock_movements (
              occurred_at, occurred_on, product_id, variant_id,
              movement_type, quantity_change, previous_qty,
              new_qty, unit_cost, reason
            )
            VALUES (
              $1, $2, $3, $4, 'purchase_received',
              $5, 0, $6, $7, 'Initial inventory stock receipt'
            )`,
            [
              now,
              today,
              productId,
              variantId,
              v.stock,
              v.stock,
              v.avg_cost ?? null
            ]
          );
        }
      }
    }

    // Seed the default offer only when seeding an empty product catalogue.
    await client.query(
      `INSERT INTO offers (
        title, code, discount_type, discount_value, scope,
        badge_text, banner_text, is_active, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)`,
      [
        'Inaugural Horizon Offer',
        'HORIZON10',
        'percentage',
        10,
        'all',
        'Exclusive Offer',
        'Limited season curation: Enjoy exclusive prices across our signature timepiece catalogue.',
        now
      ]
    );

    await client.query('COMMIT');
    console.log('Initial catalogue seeded successfully!');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDatabase()
    .catch((error) => {
      console.error('Seed failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}

module.exports = { seedDatabase };
