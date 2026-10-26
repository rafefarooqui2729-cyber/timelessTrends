const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const config = require('./config');
const {
  uploadImage,
  deleteImage,
  getPublicImageUrl
} = require('./supabase-storage');

function safePublicImageUrl(filePath) {
  try {
    return getPublicImageUrl(filePath);
  } catch (error) {
    if (error.message === 'Supabase Storage configuration is missing') {
      return null;
    }
    throw error;
  }
}

const { createAdapter } = require('./db-adapter');
const inv = require('./inventory');
const ord = require('./orders');
const rep = require('./reports');
let pgInv;
let pgOrd;
let pgRep;
const toCsv = require('./csv');
const { HttpError, localDate, slugify, audit, checkDate } = require('./util');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const wrap = (fn) => (req, res, next) => { try { Promise.resolve(fn(req, res, next)).catch(next); } catch (e) { next(e); } };
const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
  return r.data;
};
const money = z.number().finite().nonnegative();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullish = (s) => s.nullable().optional();

async function getSetting(db, key, fallback = null) {
  const r = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : fallback;
}

// ---------------- RBAC Permission Matrix ----------------
const ROLES = {
  super_admin: ['*'],
  owner: ['*'], // backward compatibility with v2
  inventory_manager: [
    'products:read', 'products:write',
    'inventory:read', 'inventory:write',
    'categories:read', 'categories:write',
    'media:read', 'media:write',
    'orders:read', 'orders:write',
    'enquiries:read', 'enquiries:write'
  ],
  marketing_manager: [
    'products:read',
    'marketing:read', 'marketing:write',
    'categories:read', 'categories:write',
    'offers:read', 'offers:write',
    'media:read', 'media:write',
    'enquiries:read', 'enquiries:write'
  ]
};

function hasPermission(role, permission) {
  const perms = ROLES[role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' });
    if (!hasPermission(req.user.role, perm)) {
      return res.status(403).json({ error: `Forbidden: role '${req.user.role}' lacks permission '${perm}'` });
    }
    next();
  };
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' });
    const userRole = req.user.role === 'owner' ? 'super_admin' : req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: role '${req.user.role}' cannot perform this action` });
    }
    next();
  };
}

// ---------------- Offer Calculation Helpers ----------------
async function getActiveOffers(db) {
  const today = localDate();
  return await db.prepare(`
    SELECT * FROM offers
    WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY discount_value DESC
  `).all(today, today);
}

function calculateDiscount(price, offer) {
  if (price == null || price <= 0 || !offer) return price;
  if (offer.discount_type === 'percentage') {
    const discounted = price * (1 - offer.discount_value / 100);
    return Math.max(0, Math.round(discounted));
  }
  if (offer.discount_type === 'fixed') {
    const discounted = price - offer.discount_value;
    return Math.max(0, Math.round(discounted));
  }
  return price;
}

function applyBestOfferToProduct(product, activeOffers) {
  if (!product) return product;

  const normalPrice = product.selling_price;

  // No manually assigned offer = no discount.
  if (product.offer_id == null || normalPrice == null) {
    return {
      ...product,
      effective_price: normalPrice,
      active_offer: null
    };
  }

  // getActiveOffers() already excludes disabled,
  // not-yet-started, and expired offers.
  const assignedOffer = activeOffers.find(
    (offer) => Number(offer.id) === Number(product.offer_id)
  );

  if (!assignedOffer) {
    return {
      ...product,
      effective_price: normalPrice,
      active_offer: null
    };
  }

  return {
    ...product,
    effective_price: calculateDiscount(normalPrice, assignedOffer),
    active_offer: {
      id: assignedOffer.id,
      title: assignedOffer.title,
      badge_text: assignedOffer.badge_text,
      discount_type: assignedOffer.discount_type,
      discount_value: assignedOffer.discount_value
    }
  };
}

function createApp(rawDb, opts = {}) {
  const storage = opts.storage || {
    uploadImage,
    deleteImage,
    getPublicImageUrl
  };

  const db = createAdapter(rawDb);

let currentInv = inv;
let currentOrd = ord;
let currentRep = rep;

if (db.isPg) {
  pgInv = require('./pg-inventory');
  pgOrd = require('./pg-orders');
  pgRep = require('./pg-reports');

  currentInv = pgInv;
  currentOrd = pgOrd;
  currentRep = pgRep;
}
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'self'", 'https://wa.me'],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' }
  }));
  app.use(express.json({ limit: '500kb' }));
  app.use(cookieParser());

  const web = path.join(config.uploadDir, 'web');
  const orig = path.join(config.uploadDir, 'originals'); // never served publicly
  fs.mkdirSync(web, { recursive: true });
  fs.mkdirSync(orig, { recursive: true });
  app.use('/uploads', express.static(web, { maxAge: '7d', index: false }));

  const noLimit = (req, res, next) => next();
  const limiter = (windowMs, max) => (opts.noRateLimit ? noLimit : rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false }));

  // ---------------- Public API (no private costs, exact stock, or suppliers) ----------------
  const pub = express.Router();
  const waNumber = () => (getSetting(db, 'whatsapp_number', '') || config.whatsappNumber || '').replace(/\D/g, '');

  pub.get('/config', wrap(async (req, res) => {
    const rawWa = await getSetting(db, 'whatsapp_number', '');
    const wa = (rawWa || config.whatsappNumber || '').replace(/\D/g, '');
    const bName = await getSetting(db, 'business_name', 'TIMELESS TRENDS');
    res.json({
      businessName: bName,
      tagline: 'Where every second speaks style, class & confidence.',
      closingStatement: "Don't just tell the time — make a statement.",
      whatsappNumber: wa || null,
      publicUrl: config.publicUrl || null,
      currency: 'INR',
      currencySymbol: '₹'
    });
  }));

  const publicProducts = async (where = '', params = []) => {
    const products = await db.prepare(`
      SELECT id, code, name, brand, model, slug, category, description, selling_price, original_price, offer_id, specs,
       is_new_arrival, is_featured, display_priority, date_added
      FROM products
      WHERE status='published' AND is_active=1 ${where}
      ORDER BY display_priority DESC, id DESC
    `).all(...params);

    const activeOffers = await getActiveOffers(db);

    const result = [];
    for (const p of products) {
      const rawVariants = await db.prepare('SELECT id, sku, colour, price_override, stock_on_hand - reserved AS avail FROM variants WHERE product_id=? AND is_active=1 ORDER BY id').all(p.id);
      const variants = rawVariants.map((v) => ({ id: v.id, sku: v.sku, colour: v.colour, price: v.price_override ?? p.selling_price ?? null, available: v.avail > 0 }));
      const rawImages = await db.prepare('SELECT id, variant_id, web_path, alt FROM images WHERE product_id=? ORDER BY sort_order, id').all(p.id);
      const images = rawImages.map((i) => ({
  id: i.id,
  variantId: i.variant_id,
  url: storage.getPublicImageUrl(i.web_path),
  alt: i.alt
}));

      const pricedProduct = applyBestOfferToProduct(p, activeOffers);
      const prices = variants.map((v) => v.price).filter((x) => x != null);

      result.push({
        ...pricedProduct,
        specs: typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || []),
        variants,
        images,
        available: variants.some((v) => v.available),
        price_from: pricedProduct.effective_price ?? (prices.length ? Math.min(...prices) : null)
      });
    }
    return result;
  };

  pub.get('/products', wrap(async (req, res) => {
    const { q, category, brand, sort, featured, new_arrival: na } = req.query;
    let list = await publicProducts();
    if (q) {
      const s = String(q).toLowerCase();
      list = list.filter((p) => [p.name, p.brand, p.model, p.category, p.description].some((x) => x && x.toLowerCase().includes(s)));
    }
    if (category && category !== 'all') list = list.filter((p) => p.category === category);
    if (brand) list = list.filter((p) => p.brand === brand);
    if (featured === '1') list = list.filter((p) => p.is_featured);
    if (na === '1') list = list.filter((p) => p.is_new_arrival);

    const sorters = {
      price_asc: (a, b) => (a.price_from ?? Infinity) - (b.price_from ?? Infinity),
      price_desc: (a, b) => (b.price_from ?? -Infinity) - (a.price_from ?? -Infinity),
      newest: (a, b) => b.date_added.localeCompare(a.date_added) || b.id - a.id,
      name: (a, b) => a.name.localeCompare(b.name)
    };
    list.sort(sorters[sort] || sorters.newest);
    res.json(list);
  }));

  pub.get('/products/:slug', wrap(async (req, res) => {
    const [p] = await publicProducts('AND slug = ?', [req.params.slug]);
    if (!p) throw new HttpError(404, 'Product not found');
    res.json(p);
  }));

  pub.get('/categories', wrap(async (req, res) => {
    const categories = await db.prepare('SELECT * FROM categories WHERE is_active=1 ORDER BY display_order ASC, id ASC').all();
    const list = await publicProducts();
    const categoriesWithCount = categories.map(cat => ({
      ...cat,
      count: list.filter(p => p.category === cat.slug).length
    }));
    res.json(categoriesWithCount);
  }));

  pub.get('/offers', wrap(async (req, res) => {
    res.json(await getActiveOffers(db));
  }));

  pub.get('/collections', wrap(async (req, res) => {
    const list = await publicProducts();
    const count = (key) => Object.entries(list.reduce((m, p) => { if (p[key]) m[p[key]] = (m[p[key]] || 0) + 1; return m; }, {}))
      .map(([name, n]) => ({ name, count: n }));
    res.json({ categories: count('category'), brands: count('brand') });
  }));

  // A WhatsApp click only records website interest; never deducts stock or creates confirmed orders
  pub.post('/enquiries/click', limiter(60_000, 40), wrap(async (req, res) => {
    const b = parse(z.object({
      productId: z.number().int().optional().nullable(),
      variantId: z.number().int().optional().nullable(),
      source: z.string().max(60).nullish(),
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(500).nullish()
    }), req.body);

    if (b.productId) {
      const p = await db.prepare("SELECT id FROM products WHERE id=? AND status='published' AND is_active=1").get(b.productId);
      if (!p) throw new HttpError(404, 'Product not found');
    }

    const ref = `ENQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await db.prepare('INSERT INTO enquiries (ref, product_id, variant_id, status, source, customer_name, customer_contact, notes, created_at, created_on) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(ref, b.productId || null, b.variantId || null, 'clicked', b.source || 'whatsapp_button', b.customerName || null, b.customerContact || null, b.notes || null, new Date().toISOString(), localDate());
    res.status(201).json({ ref });
  }));

  app.use('/api/public', pub);

  // ---------------- Authentication ----------------
  const auth = express.Router();
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.sessionDays * 864e5,
    path: '/'
  };

  auth.post('/login', limiter(15 * 60_000, 10), wrap(async (req, res) => {
    const b = parse(z.object({ email: z.string().email(), password: z.string().min(1).max(200) }), req.body);
  const u = await db.prepare('SELECT * FROM users WHERE email = ?').get(b.email.toLowerCase());    const ok = bcrypt.compareSync(b.password, u ? u.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');

    if (!u || !ok) {
      await audit(db, null, 'auth.login_failed', 'user', b.email);
      throw new HttpError(401, 'Invalid email or password');
    }
    if (u.is_active === 0) {
      await audit(db, u.id, 'auth.login_deactivated', 'user', u.id);
      throw new HttpError(403, 'Your administrator account has been deactivated. Please contact the Super Admin.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)')
      .run(sha(token), u.id, new Date(Date.now() + config.sessionDays * 864e5).toISOString(), new Date().toISOString());

    res.cookie('tt_session', token, cookieOpts);
    await audit(db, u.id, 'auth.login', 'user', u.id);
    res.json({ id: u.id, email: u.email, name: u.name, role: u.role === 'owner' ? 'super_admin' : u.role });
  }));

  auth.post('/logout', wrap(async (req, res) => {
    if (req.cookies.tt_session) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(req.cookies.tt_session));
    }
    res.clearCookie('tt_session', { path: '/' });
    res.json({ ok: true });
  }));

  app.use('/api/auth', auth);

  // ---------------- Private Admin API (Session + CSRF Protection) ----------------
  const admin = express.Router();
  admin.use(wrap(async (req, res, next) => {
    const t = req.cookies.tt_session;
    const row = t && (await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.is_active, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `).get(sha(t)));

    if (!row || new Date(row.expires_at) < new Date() || row.is_active === 0) {
      return res.status(401).json({ error: 'Not signed in or session expired' });
    }

    // CSRF defense-in-depth: custom header required on state-changing requests
    if (!['GET', 'HEAD'].includes(req.method) && req.get('X-Requested-With') !== 'tt') {
      return res.status(403).json({ error: 'Missing required security header (X-Requested-With: tt)' });
    }

    req.user = { ...row, role: row.role === 'owner' ? 'super_admin' : row.role };
    next();
  }));

  app.get('/api/auth/me', wrap(async (req, res) => {
    const t = req.cookies.tt_session;
    const row = t && (await db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.is_active
      FROM sessions s
      JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at > ?
    `).get(sha(t), new Date().toISOString()));

    if (!row || row.is_active === 0) {
      return res.status(401).json({ error: 'Not signed in' });
    }
    res.json({ id: row.id, email: row.email, name: row.name, role: row.role === 'owner' ? 'super_admin' : row.role });
  }));

  // ---------------- Dashboard Overview Metrics ----------------
  admin.get('/dashboard/summary', wrap(async (req, res) => {
    const totalProducts = (await db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active=1').get()).count;
    const publishedProducts = (await db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='published' AND is_active=1").get()).count;
    const draftProducts = (await db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='draft' AND is_active=1").get()).count;
    const archivedProducts = (await db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='archived'").get()).count;

    const inventoryAgg = await db.prepare(`
      SELECT
        COALESCE(SUM(v.stock_on_hand), 0) AS total_units,
        COUNT(CASE WHEN v.stock_on_hand = 0 THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN v.stock_on_hand > 0 AND v.stock_on_hand <= v.min_stock THEN 1 END) AS low_stock
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active = 1 AND p.is_active = 1
    `).get();

    const newArrivals = (await db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_new_arrival=1 AND is_active=1').get()).count;
    const featured = (await db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_featured=1 AND is_active=1').get()).count;
    const activeOffers = (await db.prepare('SELECT COUNT(*) AS count FROM offers WHERE is_active=1').get()).count;
    const enquiries = (await db.prepare('SELECT COUNT(*) AS count FROM enquiries').get()).count;

    // Alerts
    const lowStockAlerts = await db.prepare(`
      SELECT v.id AS variant_id, v.sku, v.colour, v.stock_on_hand, v.min_stock, p.name AS product_name, p.code
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active=1 AND p.is_active=1 AND v.stock_on_hand > 0 AND v.stock_on_hand <= v.min_stock
      ORDER BY v.stock_on_hand ASC LIMIT 10
    `).all();

    const outOfStockAlerts = await db.prepare(`
      SELECT v.id AS variant_id, v.sku, v.colour, v.stock_on_hand, p.name AS product_name, p.code
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active=1 AND p.is_active=1 AND v.stock_on_hand = 0
      ORDER BY p.name ASC LIMIT 10
    `).all();

    const recentMovements = await db.prepare(`
      SELECT m.*, v.sku, v.colour, pr.name AS product_name, u.email AS user_email
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      JOIN products pr ON pr.id=m.product_id
      LEFT JOIN users u ON u.id=m.user_id
      ORDER BY m.id DESC LIMIT 8
    `).all();

    res.json({
      products: { total: totalProducts, published: publishedProducts, draft: draftProducts, archived: archivedProducts },
      inventory: { total_units: inventoryAgg.total_units, low_stock: inventoryAgg.low_stock, out_of_stock: inventoryAgg.out_of_stock },
      marketing: { new_arrivals: newArrivals, featured, active_offers: activeOffers },
      enquiries: { total: enquiries },
      alerts: { low_stock: lowStockAlerts, out_of_stock: outOfStockAlerts },
      recent_movements: recentMovements
    });
  }));

  // ---------------- Staff & Administrator Management (Super Admin Only) ----------------
  admin.get('/admins', requireRole(['super_admin']), wrap(async (req, res) => {
    const rawUsers = await db.prepare('SELECT id, email, name, role, is_active, created_at FROM users ORDER BY id ASC').all();
    const users = rawUsers.map(u => ({ ...u, role: u.role === 'owner' ? 'super_admin' : u.role }));
    res.json(users);
  }));

  admin.post('/admins', requireRole(['super_admin']), wrap(async (req, res) => {
    const b = parse(z.object({
      email: z.string().email(),
      name: z.string().min(1).max(80),
      role: z.enum(['super_admin', 'inventory_manager', 'marketing_manager']),
      password: z.string().min(10, 'Password must be at least 10 characters')
    }), req.body);

    const existing = await db.prepare('SELECT id FROM users WHERE email=?').get(b.email.toLowerCase());
    if (existing) throw new HttpError(409, 'An administrator with this email already exists');

    const resInsert = await db.prepare(`
      INSERT INTO users (email, name, password_hash, role, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(b.email.toLowerCase(), b.name, bcrypt.hashSync(b.password, 12), b.role, new Date().toISOString());
    const id = resInsert.lastInsertRowid;

    await audit(db, req.user.id, 'admin.create', 'user', id, { email: b.email, role: b.role });
    res.status(201).json({ id, email: b.email, name: b.name, role: b.role, is_active: 1 });
  }));

  admin.patch('/admins/:id', requireRole(['super_admin']), wrap(async (req, res) => {
    const targetId = Number(req.params.id);
    const target = await db.prepare('SELECT * FROM users WHERE id=?').get(targetId);
    if (!target) throw new HttpError(404, 'Administrator not found');

    const b = parse(z.object({
      name: z.string().min(1).max(80).optional(),
      role: z.enum(['super_admin', 'inventory_manager', 'marketing_manager']).optional(),
      is_active: z.boolean().optional()
    }), req.body);

    if (targetId === req.user.id) {
  if (b.is_active === false) {
    throw new HttpError(
      400,
      'You cannot deactivate your own Super Admin account'
    );
  }

  if (b.role && b.role !== 'super_admin') {
    throw new HttpError(
      400,
      'You cannot change your own Super Admin role'
    );
  }
}

    const updates = {};
    if (b.name) updates.name = b.name;
    if (b.role) updates.role = b.role;
    if (b.is_active !== undefined) updates.is_active = b.is_active ? 1 : 0;

    const keys = Object.keys(updates);
    if (keys.length > 0) {
      await db.prepare(`UPDATE users SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id=?`)
        .run(...keys.map(k => updates[k]), targetId);
      await audit(db, req.user.id, 'admin.update', 'user', targetId, updates);
    }

    const updated = await db.prepare('SELECT id, email, name, role, is_active, created_at FROM users WHERE id=?').get(targetId);
    res.json({ ...updated, role: updated.role === 'owner' ? 'super_admin' : updated.role });
  }));

  admin.post('/admins/:id/reset-password', requireRole(['super_admin']), wrap(async (req, res) => {
    const targetId = Number(req.params.id);
    const target = await db.prepare('SELECT * FROM users WHERE id=?').get(targetId);
    if (!target) throw new HttpError(404, 'Administrator not found');

    const b = parse(z.object({
      password: z.string().min(10, 'Password must be at least 10 characters')
    }), req.body);

    await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(b.password, 12), targetId);
    // Invalidate any active sessions for security
    await db.prepare('DELETE FROM sessions WHERE user_id=?').run(targetId);

    await audit(db, req.user.id, 'admin.password_reset', 'user', targetId);
    res.json({ ok: true, message: 'Password reset and sessions invalidated' });
  }));

  // ---------------- Categories Management ----------------
  admin.get('/categories', wrap(async (req, res) => {
    res.json(await db.prepare('SELECT * FROM categories ORDER BY display_order ASC, id ASC').all());
  }));

  admin.post('/categories', requirePermission('categories:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      name: z.string().min(1).max(80),
      slug: z.string().min(1).max(80).optional(),
      description: z.string().max(500).nullish(),
      image_url: z.string().max(300).nullish(),
      display_order: z.number().int().optional(),
      is_active: z.boolean().optional()
    }), req.body);

    const s = slugify(b.slug || b.name);
    const existing = await db.prepare('SELECT id FROM categories WHERE slug=?').get(s);
    if (existing) throw new HttpError(409, `Category slug '${s}' already exists`);

    const resInsert = await db.prepare(`
      INSERT INTO categories (name, slug, description, image_url, display_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(b.name, s, b.description ?? null, b.image_url ?? null, b.display_order ?? 0, b.is_active === false ? 0 : 1, new Date().toISOString());
    const id = resInsert.lastInsertRowid;

    await audit(db, req.user.id, 'category.create', 'category', id, b);
    res.status(201).json(await db.prepare('SELECT * FROM categories WHERE id=?').get(id));
  }));

  admin.put('/categories/:id', requirePermission('categories:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const cur = await db.prepare('SELECT * FROM categories WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Category not found');

    const b = parse(z.object({
      name: z.string().min(1).max(80).optional(),
      slug: z.string().min(1).max(80).optional(),
      description: z.string().max(500).nullish(),
      image_url: z.string().max(300).nullish(),
      display_order: z.number().int().optional(),
      is_active: z.boolean().optional()
    }), req.body);

    const m = { ...b };
    if (m.slug) m.slug = slugify(m.slug);
    if (m.is_active !== undefined) m.is_active = m.is_active ? 1 : 0;

    const keys = Object.keys(m);
    if (keys.length > 0) {
      await db.prepare(`UPDATE categories SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id=?`)
        .run(...keys.map(k => m[k]), id);
      await audit(db, req.user.id, 'category.update', 'category', id, b);
    }
    res.json(await db.prepare('SELECT * FROM categories WHERE id=?').get(id));
  }));

  admin.delete('/categories/:id', requirePermission('categories:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const cur = await db.prepare('SELECT * FROM categories WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Category not found');

    // Prevent accidental deletion if products depend on category
    const count = (await db.prepare('SELECT COUNT(*) AS count FROM products WHERE category = ?').get(cur.slug)).count;
    if (count > 0) {
      throw new HttpError(409, `Cannot delete category '${cur.name}': ${count} products currently assigned to this category. Reassign or archive them first.`);
    }

    await db.prepare('DELETE FROM categories WHERE id=?').run(id);
    await audit(db, req.user.id, 'category.delete', 'category', id, { slug: cur.slug });
    res.json({ ok: true });
  }));

  // ---------------- Offers & Promotions ----------------
  
admin.get(
  '/offers',
  requirePermission('offers:read'),
  wrap(async (req, res) => {
    const today = localDate();

    const rawRows = await db.prepare(
      'SELECT * FROM offers ORDER BY id DESC'
    ).all();
    const rows = rawRows.map((o) => {
      let status = 'active';

      if (!o.is_active) status = 'disabled';
      else if (o.start_date && o.start_date > today) {
        status = 'scheduled';
      } else if (o.end_date && o.end_date < today) {
        status = 'expired';
      }

      return { ...o, status };
    });

    res.json(rows);
  })
);


  admin.post('/offers', requirePermission('offers:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      title: z.string().min(1).max(100),
      code: z.string().max(40).nullish(),
      discount_type: z.enum(['percentage', 'fixed']),
      discount_value: z.number().positive(),
      scope: z.enum(['all', 'category', 'product']).default('all'),
      target_id: z.string().max(80).nullish(),
      badge_text: z.string().max(40).nullish(),
      banner_text: z.string().max(200).nullish(),
      start_date: nullish(date),
      end_date: nullish(date),
      is_active: z.boolean().optional()
    }), req.body);

    if (b.discount_type === 'percentage' && b.discount_value > 90) {
      throw new HttpError(400, 'Percentage discount cannot exceed 90%');
    }

    const resInsert = await db.prepare(`
      INSERT INTO offers (title, code, discount_type, discount_value, scope, target_id, badge_text, banner_text, start_date, end_date, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.title, b.code || null, b.discount_type, b.discount_value, b.scope, b.target_id || null,
      b.badge_text || null, b.banner_text || null, b.start_date || null, b.end_date || null,
      b.is_active === false ? 0 : 1, new Date().toISOString()
    );
    const id = resInsert.lastInsertRowid;

    await audit(db, req.user.id, 'offer.create', 'offer', id, b);
    res.status(201).json(await db.prepare('SELECT * FROM offers WHERE id=?').get(id));
  }));

  admin.put('/offers/:id', requirePermission('offers:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const cur = await db.prepare('SELECT * FROM offers WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Offer not found');

    const b = parse(z.object({
      title: z.string().min(1).max(100).optional(),
      code: z.string().max(40).nullish(),
      discount_type: z.enum(['percentage', 'fixed']).optional(),
      discount_value: z.number().positive().optional(),
      scope: z.enum(['all', 'category', 'product']).optional(),
      target_id: z.string().max(80).nullish(),
      badge_text: z.string().max(40).nullish(),
      banner_text: z.string().max(200).nullish(),
      start_date: nullish(date),
      end_date: nullish(date),
      is_active: z.boolean().optional()
    }), req.body);

    const m = { ...b };
    if (m.is_active !== undefined) m.is_active = m.is_active ? 1 : 0;

    const keys = Object.keys(m);
    if (keys.length > 0) {
      await db.prepare(`UPDATE offers SET ${keys.map(k => `${k}=?`).join(', ')} WHERE id=?`)
        .run(...keys.map(k => m[k]), id);
      await audit(db, req.user.id, 'offer.update', 'offer', id, b);
    }
    res.json(await db.prepare('SELECT * FROM offers WHERE id=?').get(id));
  }));

  admin.delete('/offers/:id', requirePermission('offers:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const cur = await db.prepare('SELECT * FROM offers WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Offer not found');
    await db.prepare('DELETE FROM offers WHERE id=?').run(id);
    await audit(db, req.user.id, 'offer.delete', 'offer', id, { title: cur.title });
    res.json({ ok: true });
  }));

  // ---------------- Media Management ----------------
  admin.get('/media', wrap(async (req, res) => {
    const rawImages = await db.prepare(`
      SELECT i.*, p.name AS product_name, p.code AS product_code, v.colour AS variant_colour
      FROM images i
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN variants v ON v.id = i.variant_id
      ORDER BY i.id DESC
    `).all();
    const images = rawImages.map(img => ({
  ...img,
  url: getPublicImageUrl(img.web_path)
}));
    res.json(images);
  }));

  // Settings
  const SETTING_KEYS = ['whatsapp_number', 'business_name', 'opening_cash', 'expense_categories', 'public_url'];
  admin.get('/settings', wrap(async (req, res) => {
    const out = {};
    for (const k of SETTING_KEYS) {
      out[k] = await getSetting(db, k);
    }
    out.expense_categories = typeof out.expense_categories === 'string' ? JSON.parse(out.expense_categories || '["Advertising","Packaging","Transport","Rent","Software","Miscellaneous"]') : (out.expense_categories || []);
    out.timezone = config.timezone;
    out.whatsapp_number = out.whatsapp_number || config.whatsappNumber;
    out.public_url = out.public_url || config.publicUrl;
    res.json(out);
  }));

  admin.put('/settings', requireRole(['super_admin']), wrap(async (req, res) => {
    const b = parse(z.object({
      whatsapp_number: z.string().regex(/^\d{8,15}$/, 'digits only, with country code, e.g. 919876543210').or(z.literal('')).optional(),
      business_name: z.string().min(1).max(80).optional(),
      public_url: z.string().max(200).optional(),
      opening_cash: z.number().finite().optional(),
      expense_categories: z.array(z.string().min(1).max(40)).max(30).optional()
    }), req.body);

    const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const [k, v] of Object.entries(b)) {
      await up.run(k, k === 'expense_categories' ? JSON.stringify(v) : String(v));
    }
    await audit(db, req.user.id, 'settings.update', 'settings', '', b);
    res.json({ ok: true });
  }));

  // Products
    const productSchema = z.object({
    name: z.string().min(1).max(120),
    offer_id: z.number().int().positive().nullable().optional(),
    brand: nullish(z.string().max(60)),
    model: nullish(z.string().max(60)),
    category: nullish(z.string().max(60)),
    description: nullish(z.string().max(4000)),
    selling_price: nullish(money),
    original_price: nullish(money),
    specs: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(30).optional(),
    stock_location: nullish(z.string().max(60)),
    is_new_arrival: z.boolean().optional(),
    is_featured: z.boolean().optional(),
    display_priority: z.number().int().optional(),
    new_arrival_start: nullish(date),
    new_arrival_end: nullish(date),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    is_active: z.boolean().optional(),
    date_added: date.optional()
  });

    const validateSelectedOffer = async (offerId) => {
    if (offerId == null) return;

    const offer = await db.prepare(
      'SELECT id FROM offers WHERE id = ?'
    ).get(offerId);

    if (!offer) {
      throw new HttpError(400, 'Selected offer does not exist');
    }

    const activeOffers = await getActiveOffers(db);
    const isActive = activeOffers.some(
      (o) => Number(o.id) === Number(offerId)
    );

    if (!isActive) {
      throw new HttpError(
        400,
        'Selected offer is disabled, expired, or not yet active'
      );
    }
  };

  const variantSchema = z.object({
    colour: z.string().min(1).max(40),
    price_override: nullish(money),
    min_stock: z.number().int().min(0).optional(),
    stock_on_hand: z.number().int().min(0).optional(),
    avg_cost: nullish(money)
  });

  const uniqueSlug = async (name, selfId = null) => {
    const base = slugify(name) || 'watch';
    let s = base;
    let i = 2;
    while (await db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(s, selfId ?? -1)) s = `${base}-${i++}`;
    return s;
  };


  const addVariant = async (productId, code, v, txDb = db) => {
    // Use the same transaction connection for the count and insert.
    const countRow = await txDb
      .prepare('SELECT COUNT(*) AS n FROM variants WHERE product_id = ?')
      .get(productId);

    const n = Number(countRow?.n || 0) + 1;
    const sku = `${code}-${String(n).padStart(2, '0')}`;

    try {
      const resInsert = await txDb.prepare(`
        INSERT INTO variants (
          product_id,
          sku,
          colour,
          price_override,
          min_stock,
          stock_on_hand,
          avg_cost,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        sku,
        v.colour.trim(),
        v.price_override ?? null,
        v.min_stock ?? 2,
        v.stock_on_hand ?? 0,
        v.avg_cost ?? null,
        new Date().toISOString()
      );

      const variantId = resInsert.lastInsertRowid;

      if (v.stock_on_hand > 0) {
        await txDb.prepare(`
          INSERT INTO stock_movements (
            occurred_at,
            occurred_on,
            product_id,
            variant_id,
            movement_type,
            quantity_change,
            previous_qty,
            new_qty,
            unit_cost,
            reason
          )
          VALUES (?, ?, ?, ?, 'purchase_received', ?, 0, ?, ?, ?)
        `).run(
          new Date().toISOString(),
          localDate(),
          productId,
          variantId,
          v.stock_on_hand,
          v.stock_on_hand,
          v.avg_cost ?? null,
          'Initial stock receipt'
        );
      }

      return variantId;
    } catch (e) {
      if (/unique|duplicate key/i.test(e.message)) {
        throw new HttpError(
          409,
          `Colour "${v.colour}" already exists for this product`
        );
      }

      throw e;
    }
  };

  
const productRow = async (id, requesterRole = 'super_admin') => {
  const p = await db.prepare(
    'SELECT * FROM products WHERE id = ?'
  ).get(id);

  if (!p) throw new HttpError(404, 'Product not found');

  const canSeeCosts = [
    'super_admin',
    'owner',
    'inventory_manager'
  ].includes(requesterRole);

  const canSeeInventory = [
    'super_admin',
    'owner',
    'inventory_manager'
  ].includes(requesterRole);

  const rawVariants = await db.prepare(
    'SELECT * FROM variants WHERE product_id = ? ORDER BY id'
  ).all(id);
  const variants = rawVariants.map((v) => {
    const result = {
      id: v.id,
      product_id: v.product_id,
      sku: v.sku,
      colour: v.colour,
      price_override: v.price_override,
      is_active: v.is_active
    };

    if (canSeeCosts) {
      result.avg_cost = v.avg_cost;
    }

    if (canSeeInventory) {
      result.stock_on_hand = v.stock_on_hand;
      result.reserved = v.reserved;
      result.min_stock = v.min_stock;
      result.available = v.stock_on_hand - v.reserved;
      result.status = currentInv.variantStatus({
        ...v,
        product_active: p.is_active
      });
    }

    return result;
  });

  const rawImages = await db.prepare(
    'SELECT * FROM images WHERE product_id = ? ORDER BY sort_order, id'
  ).all(id);
  const images = rawImages.map((i) => ({
    id: i.id,
    variant_id: i.variant_id,
    web_path: i.web_path,
    alt: i.alt,
    sort_order: i.sort_order,
    url: storage.getPublicImageUrl(i.web_path)
  }));

  return {
    ...p,
    specs: typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || []),
    variants,
    images
  };
};

  admin.get('/products', wrap(async (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    const rawIds = await db.prepare('SELECT id FROM products ORDER BY display_priority DESC, id DESC').all();
    let rows = [];
    for (const r of rawIds) {
      rows.push(await productRow(r.id, req.user.role));
    }

    if (q) rows = rows.filter((p) => [p.name, p.brand, p.code, p.model, p.category].some((x) => x && x.toLowerCase().includes(q)));
    if (req.query.status) rows = rows.filter((p) => p.status === req.query.status);
    if (req.query.category) rows = rows.filter((p) => p.category === req.query.category);
    if (req.query.stock_status) {
      rows = rows.filter((p) => {
        const hasStock = p.variants.some(v => v.stock_on_hand > v.min_stock);
        const isLow = p.variants.some(v => v.stock_on_hand > 0 && v.stock_on_hand <= v.min_stock);
        const isOut = p.variants.every(v => v.stock_on_hand === 0);
        if (req.query.stock_status === 'in_stock') return hasStock;
        if (req.query.stock_status === 'low_stock') return isLow;
        if (req.query.stock_status === 'out_of_stock') return isOut;
        return true;
      });
    }
    res.json(rows);
  }));

  admin.get('/products/:id', wrap(async (req, res) => res.json(await productRow(Number(req.params.id), req.user.role))));

  admin.post('/products', requirePermission('products:write'), wrap(async (req, res) => {
   const b = parse(productSchema.extend({ variants: z.array(variantSchema).min(1) }), req.body);

if (b.offer_id != null) {
  await validateSelectedOffer(b.offer_id);

  if (!hasPermission(req.user.role, 'offers:write')) {
    throw new HttpError(403, 'You do not have permission to apply offers');
  }
}
    const tx = db.transaction(async (txDb) => {
      const now = new Date().toISOString();
      const slug = await uniqueSlug(b.name);
      const resInsert = await txDb.prepare(`
        INSERT INTO products (code, name, brand, model, slug, category, description, selling_price, original_price,
  offer_id, specs, stock_location, is_new_arrival, is_featured, display_priority, new_arrival_start, new_arrival_end,
  status, is_active, date_added, created_at, updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        `TMP${Math.random()}`, b.name, b.brand ?? null, b.model ?? null, slug,
      b.category ?? null, b.description ?? null, b.selling_price ?? null, b.original_price ?? null,
      b.offer_id ?? null,
      JSON.stringify(b.specs || []), b.stock_location ?? null, b.is_new_arrival ? 1 : 0, b.is_featured ? 1 : 0,
        b.display_priority ?? 0, b.new_arrival_start ?? null, b.new_arrival_end ?? null,
        b.status || 'draft', b.is_active === false ? 0 : 1, b.date_added || localDate(), now, now
      );
      const pid = resInsert.lastInsertRowid;

      const code = `TT-P${String(pid).padStart(4, '0')}`;
      await txDb.prepare('UPDATE products SET code = ? WHERE id = ?').run(code, pid);
      for (const v of b.variants) {
  await addVariant(pid, code, v, txDb);
}
      await audit(txDb, req.user.id, 'product.create', 'product', pid, { name: b.name });
      return pid;
    });
    const id = await tx();
    res.status(201).json(await productRow(id, req.user.role));
  }));

  admin.put('/products/:id', requirePermission('products:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const cur = await db.prepare('SELECT * FROM products WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Product not found');
    const b = parse(productSchema.partial(), req.body);

if (b.offer_id !== undefined) {
  if (!hasPermission(req.user.role, 'offers:write')) {
    throw new HttpError(403, 'You do not have permission to change offers');
  }

  if (b.offer_id !== null) {
    await validateSelectedOffer(b.offer_id);
  }
}

const m = { ...b };
    if (m.specs) m.specs = JSON.stringify(m.specs);
    ['is_new_arrival', 'is_featured', 'is_active'].forEach((k) => { if (k in m) m[k] = m[k] ? 1 : 0; });
    if (b.name && b.name !== cur.name) m.slug = await uniqueSlug(b.name, id);

    const keys = Object.keys(m);
    if (keys.length) {
      await db.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
        .run(...keys.map((k) => m[k]), new Date().toISOString(), id);
      await audit(db, req.user.id, 'product.update', 'product', id, b);
    }
    res.json(await productRow(id, req.user.role));
  }));

  admin.post('/products/:id/archive', requirePermission('products:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const p = await db.prepare('SELECT id FROM products WHERE id=?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    await db.prepare("UPDATE products SET status='archived', updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    await audit(db, req.user.id, 'product.archive', 'product', id);
    res.json(await productRow(id, req.user.role));
  }));

  admin.post('/products/:id/restore', requirePermission('products:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const p = await db.prepare('SELECT id FROM products WHERE id=?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    await db.prepare("UPDATE products SET status='published', updated_at= ? WHERE id=?").run(new Date().toISOString(), id);
    await audit(db, req.user.id, 'product.restore', 'product', id);
    res.json(await productRow(id, req.user.role));
  }));

  admin.post('/products/:id/duplicate', requirePermission('products:write'), wrap(async (req, res) => {
    const sourceId = Number(req.params.id);
    const cur = await db.prepare('SELECT * FROM products WHERE id=?').get(sourceId);
    if (!cur) throw new HttpError(404, 'Product not found');

    const tx = db.transaction(async (txDb) => {
      const now = new Date().toISOString();
      const newName = `${cur.name} (Copy)`;
      const newSlug = await uniqueSlug(newName);

      const resInsert = await txDb.prepare(`
        INSERT INTO products (code, name, brand, model, slug, category, description, selling_price, original_price,
          specs, stock_location, is_new_arrival, is_featured, display_priority, status, is_active, date_added, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',1,?,?,?)
      `).run(
        `TMP${Math.random()}`, newName, cur.brand, cur.model, newSlug, cur.category, cur.description,
        cur.selling_price, cur.original_price, cur.specs, cur.stock_location, cur.is_new_arrival,
        cur.is_featured, cur.display_priority, localDate(), now, now
      );
      const pid = resInsert.lastInsertRowid;

      const code = `TT-P${String(pid).padStart(4, '0')}`;
      await txDb.prepare('UPDATE products SET code = ? WHERE id = ?').run(code, pid);

      const variants = await txDb.prepare('SELECT * FROM variants WHERE product_id=?').all(sourceId);
      for (const v of variants) {
  await addVariant(pid, code, {
    colour: v.colour,
    price_override: v.price_override,
    min_stock: v.min_stock,
    stock_on_hand: 0,
    avg_cost: v.avg_cost
  }, txDb);
}

      await audit(txDb, req.user.id, 'product.duplicate', 'product', pid, { sourceId });
      return pid;
    });

    const newId = await tx();
    res.status(201).json(await productRow(newId, req.user.role));
  }));

  admin.post('/products/bulk', requirePermission('products:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      action: z.enum(['activate', 'deactivate', 'archive', 'publish', 'set_category']),
      productIds: z.array(z.number().int()).min(1),
      category: z.string().max(60).optional()
    }), req.body);

    const tx = db.transaction(async (txDb) => {
      const now = new Date().toISOString();
      if (b.action === 'activate') {
        for (const id of b.productIds) await txDb.prepare('UPDATE products SET is_active=1, updated_at=? WHERE id=?').run(now, id);
      } else if (b.action === 'deactivate') {
        for (const id of b.productIds) await txDb.prepare('UPDATE products SET is_active=0, updated_at=? WHERE id=?').run(now, id);
      } else if (b.action === 'archive') {
        for (const id of b.productIds) await txDb.prepare("UPDATE products SET status='archived', updated_at=? WHERE id=?").run(now, id);
      } else if (b.action === 'publish') {
        for (const id of b.productIds) await txDb.prepare("UPDATE products SET status='published', updated_at=? WHERE id=?").run(now, id);
      } else if (b.action === 'set_category' && b.category) {
        for (const id of b.productIds) await txDb.prepare('UPDATE products SET category=?, updated_at=? WHERE id=?').run(b.category, now, id);
      }
      await audit(txDb, req.user.id, 'product.bulk_action', 'products', b.productIds.join(','), b);
    });
    await tx();

    res.json({ ok: true, modifiedCount: b.productIds.length });
  }));

  admin.post('/products/:id/variants', requirePermission('products:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const p = await db.prepare('SELECT code FROM products WHERE id=?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    const vid = await addVariant(id, p.code, parse(variantSchema, req.body));
    await audit(db, req.user.id, 'variant.create', 'variant', vid);
    res.status(201).json(await productRow(id, req.user.role));
  }));

  
  admin.put('/variants/:id', requirePermission('products:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const v = await currentInv.getVariant(db, id);

    // Variant edits must not directly change physical stock or average cost.
    // Stock changes must use the inventory endpoints.
    const variantUpdateSchema = z.object({
      colour: z.string().min(1).max(40).optional(),
      price_override: nullish(money),
      min_stock: z.number().int().min(0).optional(),
      is_active: z.boolean().optional()
    }).strict();

    const b = parse(variantUpdateSchema, req.body);
    const m = { ...b };

    if ('is_active' in m) {
      m.is_active = m.is_active ? 1 : 0;
    }

    if (m.colour !== undefined) {
      m.colour = m.colour.trim();

      if (!m.colour) {
        throw new HttpError(400, 'Colour cannot be empty');
      }
    }

    const keys = Object.keys(m);

    if (keys.length > 0) {
      await db.prepare(
        `UPDATE variants SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`
      ).run(...keys.map((k) => m[k]), id);

      await audit(db, req.user.id, 'variant.update', 'variant', id, b);
    }

    res.json(await productRow(v.product_id, req.user.role));
  }));


  admin.delete('/variants/:id', requirePermission('products:write'), wrap(async (req, res) => {
    const v = await currentInv.getVariant(db, Number(req.params.id));
    if ((await db.prepare('SELECT 1 FROM stock_movements WHERE variant_id=?').get(v.id)) || (await db.prepare('SELECT 1 FROM order_items WHERE variant_id=?').get(v.id))) {
      throw new HttpError(409, 'This colour has stock history or orders, so it cannot be deleted. Mark it inactive instead.');
    }
    await db.prepare('DELETE FROM variants WHERE id=?').run(v.id);
    await audit(db, req.user.id, 'variant.delete', 'variant', v.id);
    res.json(await productRow(v.product_id, req.user.role));
  }));

  // Images upload and management
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (req, f, cb) => cb(/^image\/(jpeg|png|webp)$/.test(f.mimetype) ? null : new HttpError(400, 'Only JPG, PNG or WebP images'), /^image\/(jpeg|png|webp)$/.test(f.mimetype))
  });

  
  admin.post(
    '/products/:id/images',
    requirePermission('media:write'),
    upload.array('image', 3),
    wrap(async (req, res) => {
      const pid = Number(req.params.id);
      await productRow(pid);

      if (!req.files || req.files.length === 0) {
        throw new HttpError(400, 'At least one image file is required');
      }

      const variantId = req.body.variantId
        ? Number(req.body.variantId)
        : null;

      if (
        variantId &&
        !(await db.prepare(
          'SELECT 1 FROM variants WHERE id=? AND product_id=?'
        ).get(variantId, pid))
      ) {
        throw new HttpError(400, 'Variant does not belong to product');
      }

      const savedFiles = [];

      try {
        for (const [index, file] of req.files.entries()) {
          const meta = await sharp(file.buffer).metadata();
          const ext = {
            jpeg: 'jpg',
            png: 'png',
            webp: 'webp'
          }[meta.format];

          if (!ext) {
            throw new HttpError(400, 'Unsupported image format');
          }

          const name = crypto.randomBytes(10).toString('hex');
          const originalPath = `${name}.${ext}`;
          const webPath = `${name}.webp`;

          // Optimize the uploaded image into WebP format.
const optimizedBuffer = await sharp(file.buffer)
  .rotate()
  .resize({
    width: 1600,
    height: 1600,
    fit: 'inside',
    withoutEnlargement: true
  })
  .webp({ quality: 82 })
  .toBuffer();

// Save the optimized image permanently in Supabase Storage.
await storage.uploadImage(webPath, optimizedBuffer);
          savedFiles.push({
            originalPath,
            webPath,
            alt: Array.isArray(req.body.alt)
              ? req.body.alt[index] || null
              : req.body.alt || null,
            sortOrder: (Number(req.body.sortOrder) || 0) + index
          });
        }

        const now = new Date().toISOString();

        const tx = db.transaction(async (txDb) => {
          for (const file of savedFiles) {
            await txDb.prepare(`
              INSERT INTO images
              (product_id, variant_id, original_path, web_path, alt, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              pid,
              variantId,
              file.originalPath,
              file.webPath,
              file.alt,
              file.sortOrder,
              now
            );
          }
        });

        await tx();

        await audit(db, req.user.id, 'image.upload', 'product', pid, {
          imageCount: savedFiles.length
        });

        res.status(201).json(await productRow(pid, req.user.role));
      } catch (e) {
  // Remove uploaded Supabase objects if processing or saving fails.
  for (const file of savedFiles) {
    try {
await storage.deleteImage(file.webPath);
    } catch (cleanupError) {
      console.error(
        'Supabase image cleanup failed:',
        cleanupError.message
      );
    }
  }

  if (e instanceof HttpError) {
    throw e;
  }

  console.error('Image upload failed:', e);

  throw new HttpError(
    500,
    'Failed to upload product images'
  );
}
})
  );

  admin.patch(
    '/images/:id',
    requirePermission('media:write'),
    wrap(async (req, res) => {
      const imageId = Number(req.params.id);

      const img = await db.prepare(
        'SELECT * FROM images WHERE id=?'
      ).get(imageId);

      if (!img) {
        throw new HttpError(404, 'Image not found');
      }

      const body = parse(
        z.object({
          variantId: z.number().int().positive().nullable()
        }),
        req.body
      );

      if (body.variantId !== null) {
        const variant = await db.prepare(
          'SELECT 1 FROM variants WHERE id=? AND product_id=?'
        ).get(body.variantId, img.product_id);

        if (!variant) {
          throw new HttpError(
            400,
            'Variant does not belong to product'
          );
        }
      }

      await db.prepare(
        'UPDATE images SET variant_id=? WHERE id=?'
      ).run(body.variantId, imageId);

      await audit(
        db,
        req.user.id,
        'image.assign_variant',
        'product',
        img.product_id,
        {
          imageId,
          previousVariantId: img.variant_id,
          variantId: body.variantId
        }
      );

      res.json(
        await productRow(img.product_id, req.user.role)
      );
    })
  );
  
  admin.delete(
  '/images/:id',
  requirePermission('media:write'),
  wrap(async (req, res) => {
    const img = await db.prepare(
      'SELECT * FROM images WHERE id=?'
    ).get(Number(req.params.id));

    if (!img) {
      throw new HttpError(404, 'Image not found');
    }

    // Delete image from Supabase Storage first.
await storage.deleteImage(img.web_path);

    // Delete image metadata from PostgreSQL.
    await db.prepare(
      'DELETE FROM images WHERE id=?'
    ).run(img.id);

    await audit(
      db,
      req.user.id,
      'image.delete',
      'product',
      img.product_id,
      { imageId: img.id }
    );

    res.json(await productRow(img.product_id, req.user.role));
  })
);

  // Inventory Management
  admin.get('/inventory', requirePermission('inventory:read'), wrap(async (req, res) => {
    const canSeeCost = ['super_admin', 'owner', 'inventory_manager'].includes(req.user.role);
    const rawRows = await db.prepare(`
      SELECT v.*, p.name AS product_name, p.brand, p.code, p.is_active AS product_active
      FROM variants v
      JOIN products p ON p.id=v.product_id
      ORDER BY p.name, v.colour
    `).all();
    const rows = rawRows.map((v) => ({
      variant_id: v.id,
      product_id: v.product_id,
      product: v.product_name,
      brand: v.brand,
      code: v.code,
      sku: v.sku,
      colour: v.colour,
      stock_on_hand: v.stock_on_hand,
      reserved: v.reserved,
      available: v.stock_on_hand - v.reserved,
      min_stock: v.min_stock,
      avg_cost: canSeeCost ? v.avg_cost : undefined,
      value_at_cost: canSeeCost && v.avg_cost != null ? Math.round(v.stock_on_hand * v.avg_cost * 100) / 100 : undefined,
      status: currentInv.variantStatus(v)
    }));
    res.json({ rows, valuation: canSeeCost ? await currentRep.inventoryValue(db) : undefined });
  }));

  const receiveSchema = z.object({
    supplierId: z.number().int().nullish(),
    receivedOn: date.optional(),
    reference: z.string().max(80).nullish(),
    notes: z.string().max(500).nullish(),
    paidAmount: money.nullish(),
    items: z.array(z.object({ variantId: z.number().int(), quantity: z.number().int().positive(), unitCost: money.nullish() })).min(1)
  });

    admin.post('/stock/receive', requirePermission('inventory:write'), wrap(async (req, res) => {
    const b = parse(receiveSchema.extend({
      offerId: z.number().int().positive().optional()
    }), req.body);

    if (b.offerId !== undefined) {
      if (!hasPermission(req.user.role, 'offers:write')) {
        throw new HttpError(403, 'You do not have permission to apply offers');
      }

      await validateSelectedOffer(b.offerId);
    }

    const purchaseId = await currentInv.receiveStock(db, {
      ...b,
      userId: req.user.id
    });

    res.status(201).json({ purchaseId });
  }));

  admin.post('/stock/adjust', requirePermission('inventory:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      variantId: z.number().int(),
      newQuantity: z.number().int().min(0),
      reason: z.string().refine((s) => s.trim().length > 0, 'A non-empty reason is mandatory for physical adjustments')
    }), req.body);
    res.json(await currentInv.adjustStock(db, { ...b, userId: req.user.id }));
  }));

  admin.post('/stock/remove', requirePermission('inventory:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      variantId: z.number().int(),
      quantity: z.number().int().positive(),
      type: z.enum(['damage_loss', 'supplier_return']),
      reason: z.string().refine((s) => s.trim().length > 0, 'A non-empty reason is mandatory')
    }), req.body);
    await currentInv.removeStock(db, { ...b, userId: req.user.id });
    res.json({ ok: true });
  }));

  admin.post('/stock/reconcile', requirePermission('inventory:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      counts: z.array(z.object({
        variantId: z.number().int(),
        counted: z.number().int().min(0),
        reason: z.string().optional()
      })).min(1)
    }), req.body);
    res.json(await currentInv.reconcile(db, { counts: b.counts, userId: req.user.id }));
  }));

  admin.get('/stock/movements', requirePermission('inventory:read'), wrap(async (req, res) => {
    const { from, to, variantId, type } = req.query;
    const w = [];
    const p = [];
    if (from) { w.push('m.occurred_on >= ?'); p.push(checkDate(from)); }
    if (to) { w.push('m.occurred_on <= ?'); p.push(checkDate(to)); }
    if (variantId) { w.push('m.variant_id = ?'); p.push(Number(variantId)); }
    if (type) { w.push('m.movement_type = ?'); p.push(type); }

    res.json(await db.prepare(`
      SELECT m.*, v.sku, v.colour, pr.name AS product_name, u.email AS user_email
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      JOIN products pr ON pr.id=m.product_id
      LEFT JOIN users u ON u.id=m.user_id
      ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY m.id DESC LIMIT 1000
    `).all(...p));
  }));

  admin.get('/stock/daily', requirePermission('inventory:read'), wrap(async (req, res) => {
    const d = checkDate(req.query.date || localDate());
    res.json(await currentRep.stockSummary(db, d, d));
  }));

  // Suppliers
  admin.get('/suppliers', wrap(async (req, res) => res.json(await db.prepare('SELECT * FROM suppliers ORDER BY name').all())));
  admin.post('/suppliers', requirePermission('inventory:write'), wrap(async (req, res) => {
    const b = parse(z.object({ name: z.string().min(1).max(100), phone: z.string().max(30).nullish(), notes: z.string().max(500).nullish() }), req.body);
    const resInsert = await db.prepare('INSERT INTO suppliers (name, phone, notes, created_at) VALUES (?,?,?,?)')
      .run(b.name, b.phone ?? null, b.notes ?? null, new Date().toISOString());
    const id = resInsert.lastInsertRowid;
    await audit(db, req.user.id, 'supplier.create', 'supplier', id);
    res.status(201).json({ id });
  }));

  // Enquiries & Customer WhatsApp Registry
  admin.get('/enquiries', requirePermission('enquiries:read'), wrap(async (req, res) => {
    res.json(await db.prepare(`
      SELECT e.*, p.name AS product_name, p.code AS product_code, v.colour
      FROM enquiries e
      LEFT JOIN products p ON p.id=e.product_id
      LEFT JOIN variants v ON v.id=e.variant_id
      ${req.query.status ? 'WHERE e.status = ?' : ''}
      ORDER BY e.id DESC LIMIT 500
    `).all(...(req.query.status ? [req.query.status] : [])));
  }));

  admin.post('/enquiries', requirePermission('enquiries:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      productId: z.number().int().nullish(),
      variantId: z.number().int().nullish(),
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(1000).nullish(),
      source: z.string().max(60).nullish()
    }), req.body);

    const ref = `ENQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    const resInsert = await db.prepare(`
      INSERT INTO enquiries (ref, product_id, variant_id, status, source, customer_name, customer_contact, notes, created_at, created_on, confirmed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(ref, b.productId ?? null, b.variantId ?? null, 'received', b.source || 'manual', b.customerName ?? null, b.customerContact ?? null, b.notes ?? null, now, localDate(), now);
    const id = resInsert.lastInsertRowid;

    await audit(db, req.user.id, 'enquiry.create', 'enquiry', id);
    res.status(201).json({ id, ref });
  }));

  admin.patch('/enquiries/:id', requirePermission('enquiries:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const b = parse(z.object({
      status: z.enum(['clicked', 'received', 'converted', 'closed']).optional(),
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(1000).nullish()
    }), req.body);

    const cur = await db.prepare('SELECT * FROM enquiries WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Enquiry not found');

    await db.prepare(`
      UPDATE enquiries
      SET status=?, customer_name=?, customer_contact=?, notes=?,
          confirmed_at = CASE WHEN ? = 'received' AND confirmed_at IS NULL THEN ? ELSE confirmed_at END
      WHERE id=?
    `).run(
      b.status ?? cur.status,
      b.customerName ?? cur.customer_name,
      b.customerContact ?? cur.customer_contact,
      b.notes ?? cur.notes,
      b.status ?? cur.status,
      new Date().toISOString(),
      id
    );

    await audit(db, req.user.id, 'enquiry.update', 'enquiry', id, b);
    res.json({ ok: true });
  }));

  // Orders
  admin.get('/orders', requirePermission('orders:read'), wrap(async (req, res) => {
    const w = [];
    const p = [];
    if (req.query.status) { w.push('status = ?'); p.push(req.query.status); }
    if (req.query.from) { w.push('order_date >= ?'); p.push(checkDate(req.query.from)); }
    if (req.query.to) { w.push('order_date <= ?'); p.push(checkDate(req.query.to)); }

    const rawRows = await db.prepare(`SELECT id FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`).all(...p);
    const orders = [];
    for (const r of rawRows) {
      orders.push(await currentOrd.getOrder(db, r.id));
    }
    res.json(orders);
  }));

  admin.get('/orders/:id', requirePermission('orders:read'), wrap(async (req, res) => {
    const o = await currentOrd.getOrder(db, Number(req.params.id));
    if (!o) throw new HttpError(404, 'Order not found');
    res.json(o);
  }));

  admin.post('/orders', requirePermission('orders:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      orderDate: date.optional(),
      notes: z.string().max(1000).nullish(),
      enquiryId: z.number().int().nullish(),
      status: z.enum(['enquiry', 'pending', 'confirmed', 'processing', 'ready', 'completed']).optional(),
      items: z.array(z.object({
        variantId: z.number().int(),
        quantity: z.number().int().positive(),
        unitPrice: money.nullish(),
        lineDiscount: money.optional()
      })).min(1)
    }), req.body);

    const id = await currentOrd.createOrder(db, { ...b, userId: req.user.id });
    res.status(201).json(await currentOrd.getOrder(db, id));
  }));

  admin.patch('/orders/:id', requirePermission('orders:write'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    const b = parse(z.object({
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(1000).nullish()
    }), req.body);

    const cur = await db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Order not found');

    await db.prepare('UPDATE orders SET customer_name=?, customer_contact=?, notes=?, updated_at=? WHERE id=?')
      .run(b.customerName ?? cur.customer_name, b.customerContact ?? cur.customer_contact, b.notes ?? cur.notes, new Date().toISOString(), id);
    await audit(db, req.user.id, 'order.update', 'order', id);
    res.json(await currentOrd.getOrder(db, id));
  }));

  admin.post('/orders/:id/status', requirePermission('orders:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      status: z.string(),
      cancelReason: z.string().max(300).optional(),
      date: date.optional()
    }), req.body);
    await currentOrd.setOrderStatus(db, Number(req.params.id), b.status, { userId: req.user.id, cancelReason: b.cancelReason, date: b.date });
    res.json(await currentOrd.getOrder(db, Number(req.params.id)));
  }));

  admin.post('/orders/:id/payments', requirePermission('orders:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      kind: z.enum(['payment', 'refund']),
      amount: z.number().positive(),
      paidOn: date.optional(),
      method: z.string().max(40).nullish(),
      note: z.string().max(300).nullish()
    }), req.body);
    await currentOrd.addPayment(db, Number(req.params.id), { ...b, userId: req.user.id });
    res.status(201).json(await currentOrd.getOrder(db, Number(req.params.id)));
  }));

  admin.post('/orders/:id/items/:itemId/return', requirePermission('orders:write'), wrap(async (req, res) => {
    const b = parse(z.object({
      quantity: z.number().int().positive(),
      condition: z.enum(['sellable', 'damaged']),
      reason: z.string().max(300).nullish(),
      returnedOn: date.optional()
    }), req.body);
    const it = await db.prepare('SELECT order_id FROM order_items WHERE id=? AND order_id=?').get(Number(req.params.itemId), Number(req.params.id));
    if (!it) throw new HttpError(404, 'Order item not found');
    await currentInv.returnItem(db, { orderItemId: Number(req.params.itemId), ...b, reason: b.reason ?? undefined, userId: req.user.id });
    res.json(await currentOrd.getOrder(db, Number(req.params.id)));
  }));

  // Expenses & Savings
  admin.get('/expenses', requireRole(['super_admin']), wrap(async (req, res) => {
    const { from, to } = req.query;
    const w = [];
    const p = [];
    if (from) { w.push('expense_on >= ?'); p.push(checkDate(from)); }
    if (to) { w.push('expense_on <= ?'); p.push(checkDate(to)); }
    res.json(await db.prepare(`SELECT * FROM expenses ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY expense_on DESC, id DESC LIMIT 1000`).all(...p));
  }));

  admin.post('/expenses', requireRole(['super_admin']), wrap(async (req, res) => {
    const b = parse(z.object({
      expenseOn: date.optional(),
      category: z.string().min(1).max(40),
      amount: z.number().positive(),
      description: z.string().max(300).nullish(),
      paymentMethod: z.string().max(40).nullish(),
      supplierId: z.number().int().nullish()
    }), req.body);

    const resInsert = await db.prepare('INSERT INTO expenses (expense_on, category, amount, description, payment_method, supplier_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(b.expenseOn || localDate(), b.category, b.amount, b.description ?? null, b.paymentMethod ?? null, b.supplierId ?? null, req.user.id, new Date().toISOString());
    const id = resInsert.lastInsertRowid;
    await audit(db, req.user.id, 'expense.create', 'expense', id, b);
    res.status(201).json({ id });
  }));

  admin.delete('/expenses/:id', requireRole(['super_admin']), wrap(async (req, res) => {
    const e = await db.prepare('SELECT * FROM expenses WHERE id=?').get(Number(req.params.id));
    if (!e) throw new HttpError(404, 'Expense not found');
    await db.prepare('DELETE FROM expenses WHERE id=?').run(e.id);
    await audit(db, req.user.id, 'expense.delete', 'expense', e.id, e);
    res.json({ ok: true });
  }));

  admin.get('/savings', requireRole(['super_admin']), wrap(async (req, res) => {
    const entries = await db.prepare('SELECT * FROM savings_entries ORDER BY entry_on DESC, id DESC LIMIT 500').all();
    const balance = await currentRep.savingsBalance(db, '9999-12-31');
    res.json({ entries, balance });
  }));

  admin.post('/savings', requireRole(['super_admin']), wrap(async (req, res) => {
    const b = parse(z.object({ entryOn: date.optional(), direction: z.enum(['deposit', 'withdrawal']), amount: z.number().positive(), note: z.string().max(300).nullish() }), req.body);
    const resInsert = await db.prepare('INSERT INTO savings_entries (entry_on, direction, amount, note, created_at) VALUES (?,?,?,?,?)')
      .run(b.entryOn || localDate(), b.direction, b.amount, b.note ?? null, new Date().toISOString());
    const id = resInsert.lastInsertRowid;
    await audit(db, req.user.id, 'savings.create', 'savings', id, b);
    res.status(201).json({ id });
  }));

  // Reports
  admin.get('/reports/overview', requireRole(['super_admin']), wrap(async (req, res) => {
    const today = localDate();
    const month = today.slice(0, 7);
    const m = await currentRep.monthly(db, month);
    const d = await currentRep.daily(db, today);
    res.json({ today: d, month: { ...m, stock_by_variant: undefined } });
  }));

  admin.get('/reports/daily', requireRole(['super_admin']), wrap(async (req, res) => res.json(await currentRep.daily(db, req.query.date || localDate()))));
  admin.get('/reports/monthly', requireRole(['super_admin']), wrap(async (req, res) => res.json(await currentRep.monthly(db, req.query.month || localDate().slice(0, 7)))));
  admin.get('/reports/range', requireRole(['super_admin']), wrap(async (req, res) => {
    const from = checkDate(req.query.from, 'from');
    const to = checkDate(req.query.to, 'to');
    if (from > to) throw new HttpError(400, 'from must not be after to');
    const fin = await currentRep.financials(db, from, to);
    const stk = await currentRep.stockSummary(db, from, to);
    const invVal = await currentRep.inventoryValue(db);
    res.json({ financials: fin, stock: stk, inventory_now: invVal });
  }));

  // Audit Logs
  admin.get('/audit', wrap(async (req, res) => {
    const { action, entity, user_id } = req.query;
    const w = [];
    const p = [];
    if (action) { w.push('a.action LIKE ?'); p.push(`%${action}%`); }
    if (entity) { w.push('a.entity = ?'); p.push(entity); }
    if (user_id) { w.push('a.user_id = ?'); p.push(Number(user_id)); }

    res.json(await db.prepare(`
      SELECT a.*, u.email, u.name AS user_name, u.role AS user_role
      FROM audit_logs a
      LEFT JOIN users u ON u.id=a.user_id
      ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY a.id DESC LIMIT 500
    `).all(...p));
  }));

  // CSV Exports
  const exporters = {
    products: async (role) => {
      const canSeeCost = ['super_admin', 'owner', 'inventory_manager'].includes(role);
      const rows = await db.prepare(`
        SELECT p.code, p.name, p.brand, p.model, p.category, p.selling_price, p.original_price, p.status, p.is_active, p.date_added,
               v.sku, v.colour, v.stock_on_hand, v.reserved, v.min_stock ${canSeeCost ? ', v.avg_cost' : ''}
        FROM products p
        JOIN variants v ON v.product_id=p.id
        ORDER BY p.id, v.id
      `).all();
      return rows;
    },
    'stock-movements': async () => await db.prepare(`
      SELECT m.id, m.occurred_at, m.occurred_on, v.sku, m.movement_type, m.quantity_change, m.previous_qty, m.new_qty, m.non_sellable_qty, m.unit_cost, m.reason, m.order_id, m.purchase_id, m.user_id
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      ORDER BY m.id
    `).all(),
    orders: async () => await db.prepare(`
      SELECT o.order_no, o.order_date, o.status, o.customer_name, o.customer_contact, v.sku, oi.quantity, oi.unit_price, oi.line_discount, oi.returned_qty, oi.sold_on, oi.unit_cost_at_sale, o.notes
      FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      JOIN variants v ON v.id=oi.variant_id
      ORDER BY o.id, oi.id
    `).all(),
    expenses: async () => await db.prepare('SELECT id, expense_on, category, amount, description, payment_method FROM expenses ORDER BY expense_on, id').all()
  };

  admin.get('/export/:what', wrap(async (req, res) => {
    const fn = exporters[req.params.what];
    if (!fn) throw new HttpError(404, 'Unknown export');
    if (['expenses', 'stock-movements', 'orders'].includes(req.params.what) && req.user.role === 'marketing_manager') {
      throw new HttpError(403, 'Forbidden: marketing managers cannot export internal financial ledgers');
    }
    await audit(db, req.user.id, 'export', 'csv', req.params.what);
    const data = await fn(req.user.role);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${req.params.what}-${localDate()}.csv"`
    }).send('\ufeff' + toCsv(data));
  }));

  app.use('/api/admin', admin);

    // Public health check for hosting-platform monitoring.
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Frontend (production build) serving
  const dist = path.join(config.root, 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Global Error Handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (/SQLITE_CONSTRAINT|23505|23503|23514|duplicate key|violates/i.test(String(err.code || err.message))) return res.status(409).json({ error: 'Database constraint violated: ' + err.message });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
