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
const inv = require('./inventory');
const ord = require('./orders');
const rep = require('./reports');
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

function getSetting(db, key, fallback = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : fallback;
}

function createApp(db, opts = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'], scriptSrc: ["'self'"], connectSrc: ["'self'"],
    formAction: ["'self'", 'https://wa.me'], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  const web = path.join(config.uploadDir, 'web');
  const orig = path.join(config.uploadDir, 'originals'); // never served publicly
  fs.mkdirSync(web, { recursive: true }); fs.mkdirSync(orig, { recursive: true });
  app.use('/uploads', express.static(web, { maxAge: '7d', index: false }));

  const noLimit = (req, res, next) => next();
  const limiter = (windowMs, max) => (opts.noRateLimit ? noLimit : rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false }));

  // ---------------- Public API (no private data: no costs, no exact stock, no suppliers) ----------------
  const pub = express.Router();
  const waNumber = () => (getSetting(db, 'whatsapp_number', '') || config.whatsappNumber || '').replace(/\D/g, '');

  pub.get('/config', (req, res) => res.json({
    businessName: getSetting(db, 'business_name', 'TIMELESS TRENDS'),
    whatsappNumber: waNumber() || null, // null => frontend shows "not configured"
    publicUrl: config.publicUrl || null,
  }));

  const publicProducts = (where = '', params = []) => {
    const products = db.prepare(`SELECT id, code, name, brand, model, slug, category, description, selling_price, original_price, specs,
      is_new_arrival, is_featured, date_added FROM products WHERE status='published' AND is_active=1 ${where}`).all(...params);
    return products.map((p) => {
      const variants = db.prepare('SELECT id, sku, colour, price_override, stock_on_hand - reserved AS avail FROM variants WHERE product_id=? AND is_active=1 ORDER BY id').all(p.id)
        .map((v) => ({ id: v.id, sku: v.sku, colour: v.colour, price: v.price_override ?? p.selling_price ?? null, available: v.avail > 0 }));
      const images = db.prepare('SELECT id, variant_id, web_path, alt FROM images WHERE product_id=? ORDER BY sort_order, id').all(p.id)
        .map((i) => ({ id: i.id, variantId: i.variant_id, url: `/uploads/${i.web_path}`, alt: i.alt }));
      const prices = variants.map((v) => v.price).filter((x) => x != null);
      return { ...p, specs: p.specs ? JSON.parse(p.specs) : [], variants, images, available: variants.some((v) => v.available),
        price_from: prices.length ? Math.min(...prices) : (p.selling_price ?? null) };
    });
  };

  pub.get('/products', (req, res) => {
    const { q, category, brand, sort, featured, new_arrival: na } = req.query;
    let list = publicProducts();
    if (q) { const s = String(q).toLowerCase(); list = list.filter((p) => [p.name, p.brand, p.model, p.category, p.description].some((x) => x && x.toLowerCase().includes(s))); }
    if (category) list = list.filter((p) => p.category === category);
    if (brand) list = list.filter((p) => p.brand === brand);
    if (featured === '1') list = list.filter((p) => p.is_featured);
    if (na === '1') list = list.filter((p) => p.is_new_arrival);
    const sorters = { price_asc: (a, b) => (a.price_from ?? Infinity) - (b.price_from ?? Infinity),
      price_desc: (a, b) => (b.price_from ?? -Infinity) - (a.price_from ?? -Infinity),
      newest: (a, b) => b.date_added.localeCompare(a.date_added) || b.id - a.id, name: (a, b) => a.name.localeCompare(b.name) };
    list.sort(sorters[sort] || sorters.newest);
    res.json(list);
  });
  pub.get('/products/:slug', (req, res) => {
    const [p] = publicProducts('AND slug = ?', [req.params.slug]);
    if (!p) throw new HttpError(404, 'Product not found');
    res.json(p);
  });
  pub.get('/collections', (req, res) => {
    const list = publicProducts();
    const count = (key) => Object.entries(list.reduce((m, p) => { if (p[key]) m[p[key]] = (m[p[key]] || 0) + 1; return m; }, {}))
      .map(([name, n]) => ({ name, count: n }));
    res.json({ categories: count('category'), brands: count('brand') });
  });
  // A button click is NOT an order. It only records website interest.
  pub.post('/enquiries/click', limiter(60_000, 30), wrap((req, res) => {
    const b = parse(z.object({ productId: z.number().int(), variantId: z.number().int().nullish(), source: z.string().max(60).nullish() }), req.body);
    const p = db.prepare("SELECT id FROM products WHERE id=? AND status='published' AND is_active=1").get(b.productId);
    if (!p) throw new HttpError(404, 'Product not found');
    if (b.variantId && !db.prepare('SELECT 1 FROM variants WHERE id=? AND product_id=?').get(b.variantId, b.productId)) throw new HttpError(400, 'Bad variant');
    const ref = `ENQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    db.prepare('INSERT INTO enquiries (ref, product_id, variant_id, status, source, created_at, created_on) VALUES (?,?,?,?,?,?,?)')
      .run(ref, b.productId, b.variantId || null, 'clicked', b.source || null, new Date().toISOString(), localDate());
    res.status(201).json({ ref });
  }));
  app.use('/api/public', pub);

  // ---------------- Auth ----------------
  const auth = express.Router();
  const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: config.sessionDays * 864e5, path: '/' };
  auth.post('/login', limiter(15 * 60_000, 10), wrap((req, res) => {
    const b = parse(z.object({ email: z.string().email(), password: z.string().min(1).max(200) }), req.body);
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(b.email.toLowerCase());
    // compare against a dummy hash when user is missing, to keep timing similar
    const ok = bcrypt.compareSync(b.password, u ? u.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
    if (!u || !ok) { audit(db, null, 'auth.login_failed', 'user', b.email); throw new HttpError(401, 'Invalid email or password'); }
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)')
      .run(sha(token), u.id, new Date(Date.now() + config.sessionDays * 864e5).toISOString(), new Date().toISOString());
    res.cookie('tt_session', token, cookieOpts);
    audit(db, u.id, 'auth.login', 'user', u.id);
    res.json({ id: u.id, email: u.email, name: u.name });
  }));
  auth.post('/logout', (req, res) => {
    if (req.cookies.tt_session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(req.cookies.tt_session));
    res.clearCookie('tt_session', { path: '/' }); res.json({ ok: true });
  });
  app.use('/api/auth', auth);

  // ---------------- Private API: everything below requires a valid session ----------------
  const admin = express.Router();
  admin.use((req, res, next) => {
    const t = req.cookies.tt_session;
    const row = t && db.prepare(`SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(t));
    if (!row || new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'Not signed in' });
    // CSRF defence in depth (SameSite=Lax cookie + required custom header on writes)
    if (!['GET', 'HEAD'].includes(req.method) && req.get('X-Requested-With') !== 'tt') return res.status(403).json({ error: 'Missing X-Requested-With header' });
    req.user = row; next();
  });
  app.get('/api/auth/me', (req, res) => {
    const t = req.cookies.tt_session;
    const row = t && db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > ?').get(sha(t), new Date().toISOString());
    row ? res.json(row) : res.status(401).json({ error: 'Not signed in' });
  });

  // Settings
  const SETTING_KEYS = ['whatsapp_number', 'business_name', 'opening_cash', 'expense_categories'];
  admin.get('/settings', (req, res) => {
    const out = {}; SETTING_KEYS.forEach((k) => { out[k] = getSetting(db, k); });
    out.expense_categories = JSON.parse(out.expense_categories || '["Advertising","Packaging","Transport","Rent","Software","Miscellaneous"]');
    out.timezone = config.timezone;
    res.json(out);
  });
  admin.put('/settings', wrap((req, res) => {
    const b = parse(z.object({ whatsapp_number: z.string().regex(/^\d{8,15}$/, 'digits only, with country code, e.g. 919876543210').or(z.literal('')).optional(),
      business_name: z.string().min(1).max(80).optional(), opening_cash: z.number().finite().optional(),
      expense_categories: z.array(z.string().min(1).max(40)).max(30).optional() }), req.body);
    const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const [k, v] of Object.entries(b)) up.run(k, k === 'expense_categories' ? JSON.stringify(v) : String(v));
    audit(db, req.user.id, 'settings.update', 'settings', '', b);
    res.json({ ok: true });
  }));

  // Products
  const productSchema = z.object({
    name: z.string().min(1).max(120), brand: nullish(z.string().max(60)), model: nullish(z.string().max(60)),
    category: nullish(z.string().max(60)), description: nullish(z.string().max(4000)),
    selling_price: nullish(money), original_price: nullish(money),
    specs: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(30).optional(),
    stock_location: nullish(z.string().max(60)), is_new_arrival: z.boolean().optional(), is_featured: z.boolean().optional(),
    status: z.enum(['draft', 'published']).optional(), is_active: z.boolean().optional(), date_added: date.optional(),
  });
  const variantSchema = z.object({ colour: z.string().min(1).max(40), price_override: nullish(money), min_stock: z.number().int().min(0).optional() });

  const uniqueSlug = (name, selfId = null) => {
    const base = slugify(name) || 'watch'; let s = base; let i = 2;
    while (db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(s, selfId ?? -1)) s = `${base}-${i++}`;
    return s;
  };
  const addVariant = (productId, code, v) => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM variants WHERE product_id = ?').get(productId).n + 1;
    try {
      return db.prepare(`INSERT INTO variants (product_id, sku, colour, price_override, min_stock, created_at) VALUES (?,?,?,?,?,?)`)
        .run(productId, `${code}-${String(n).padStart(2, '0')}`, v.colour.trim(), v.price_override ?? null, v.min_stock ?? 2, new Date().toISOString()).lastInsertRowid;
    } catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, `Colour "${v.colour}" already exists for this product`); throw e; }
  };
  const productRow = (id) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    const variants = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY id').all(id).map((v) => ({ ...v, available: v.stock_on_hand - v.reserved,
      status: inv.variantStatus({ ...v, product_active: p.is_active }) }));
    const images = db.prepare('SELECT * FROM images WHERE product_id = ? ORDER BY sort_order, id').all(id).map((i) => ({ ...i, url: `/uploads/${i.web_path}` }));
    return { ...p, specs: p.specs ? JSON.parse(p.specs) : [], variants, images };
  };

  admin.get('/products', (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    let rows = db.prepare('SELECT id FROM products ORDER BY id DESC').all().map((r) => productRow(r.id));
    if (q) rows = rows.filter((p) => [p.name, p.brand, p.code, p.model].some((x) => x && x.toLowerCase().includes(q)));
    if (req.query.status) rows = rows.filter((p) => p.status === req.query.status);
    res.json(rows);
  });
  admin.get('/products/:id', (req, res) => res.json(productRow(Number(req.params.id))));
  admin.post('/products', wrap((req, res) => {
    const b = parse(productSchema.extend({ variants: z.array(variantSchema).min(1) }), req.body);
    const id = db.transaction(() => {
      const now = new Date().toISOString();
      const pid = db.prepare(`INSERT INTO products (code, name, brand, model, slug, category, description, selling_price, original_price,
        specs, stock_location, is_new_arrival, is_featured, status, is_active, date_added, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`TMP${Math.random()}`, b.name, b.brand ?? null, b.model ?? null, uniqueSlug(b.name),
        b.category ?? null, b.description ?? null, b.selling_price ?? null, b.original_price ?? null, JSON.stringify(b.specs || []),
        b.stock_location ?? null, b.is_new_arrival ? 1 : 0, b.is_featured ? 1 : 0, b.status || 'draft', b.is_active === false ? 0 : 1,
        b.date_added || localDate(), now, now).lastInsertRowid;
      const code = `TT-P${String(pid).padStart(4, '0')}`;
      db.prepare('UPDATE products SET code = ? WHERE id = ?').run(code, pid);
      b.variants.forEach((v) => addVariant(pid, code, v));
      audit(db, req.user.id, 'product.create', 'product', pid, { name: b.name });
      return pid;
    })();
    res.status(201).json(productRow(id));
  }));
  admin.put('/products/:id', wrap((req, res) => {
    const id = Number(req.params.id); const cur = db.prepare('SELECT * FROM products WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Product not found');
    const b = parse(productSchema.partial(), req.body);
    const m = { ...b }; if (m.specs) m.specs = JSON.stringify(m.specs);
    ['is_new_arrival', 'is_featured', 'is_active'].forEach((k) => { if (k in m) m[k] = m[k] ? 1 : 0; });
    if (b.name && b.name !== cur.name) m.slug = uniqueSlug(b.name, id);
    const keys = Object.keys(m);
    if (keys.length) {
      db.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...keys.map((k) => m[k]), new Date().toISOString(), id);
      audit(db, req.user.id, 'product.update', 'product', id, b);
    }
    res.json(productRow(id));
  }));
  admin.post('/products/:id/variants', wrap((req, res) => {
    const id = Number(req.params.id); const p = db.prepare('SELECT code FROM products WHERE id=?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    const vid = addVariant(id, p.code, parse(variantSchema, req.body));
    audit(db, req.user.id, 'variant.create', 'variant', vid); res.status(201).json(productRow(id));
  }));
  admin.put('/variants/:id', wrap((req, res) => {
    const id = Number(req.params.id); const v = inv.getVariant(db, id);
    const b = parse(variantSchema.partial().extend({ is_active: z.boolean().optional() }), req.body);
    const m = { ...b }; if ('is_active' in m) m.is_active = m.is_active ? 1 : 0; if (m.colour) m.colour = m.colour.trim();
    const keys = Object.keys(m);
    if (keys.length) { db.prepare(`UPDATE variants SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => m[k]), id); audit(db, req.user.id, 'variant.update', 'variant', id, b); }
    res.json(productRow(v.product_id));
  }));
  admin.delete('/variants/:id', wrap((req, res) => {
    const v = inv.getVariant(db, Number(req.params.id));
    if (db.prepare('SELECT 1 FROM stock_movements WHERE variant_id=?').get(v.id) || db.prepare('SELECT 1 FROM order_items WHERE variant_id=?').get(v.id)) {
      throw new HttpError(409, 'This colour has stock history or orders, so it cannot be deleted. Mark it inactive instead.');
    }
    db.prepare('DELETE FROM variants WHERE id=?').run(v.id); audit(db, req.user.id, 'variant.delete', 'variant', v.id);
    res.json(productRow(v.product_id));
  }));

  // Images: original kept untouched; an optimised copy (no content edits) is served on the website.
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (req, f, cb) => cb(/^image\/(jpeg|png|webp)$/.test(f.mimetype) ? null : new HttpError(400, 'Only JPG, PNG or WebP images'), /^image\/(jpeg|png|webp)$/.test(f.mimetype)) });
  admin.post('/products/:id/images', upload.single('image'), wrap(async (req, res) => {
    const pid = Number(req.params.id); productRow(pid);
    if (!req.file) throw new HttpError(400, 'image file required');
    const variantId = req.body.variantId ? Number(req.body.variantId) : null;
    if (variantId && !db.prepare('SELECT 1 FROM variants WHERE id=? AND product_id=?').get(variantId, pid)) throw new HttpError(400, 'Variant does not belong to product');
    const meta = await sharp(req.file.buffer).metadata(); // rejects non-images
    const ext = { jpeg: 'jpg', png: 'png', webp: 'webp' }[meta.format]; if (!ext) throw new HttpError(400, 'Unsupported image');
    const name = crypto.randomBytes(10).toString('hex');
    fs.writeFileSync(path.join(orig, `${name}.${ext}`), req.file.buffer);
    // Presentation only: rotate per EXIF, fit within 1600px, convert to WebP. No retouching of the watch itself.
    await sharp(req.file.buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(web, `${name}.webp`));
    const id = db.prepare('INSERT INTO images (product_id, variant_id, original_path, web_path, alt, sort_order, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(pid, variantId, `${name}.${ext}`, `${name}.webp`, req.body.alt || null, Number(req.body.sortOrder) || 0, new Date().toISOString()).lastInsertRowid;
    audit(db, req.user.id, 'image.upload', 'product', pid, { imageId: id });
    res.status(201).json(productRow(pid));
  }));
  admin.delete('/images/:id', wrap((req, res) => {
    const img = db.prepare('SELECT * FROM images WHERE id=?').get(Number(req.params.id));
    if (!img) throw new HttpError(404, 'Image not found');
    db.prepare('DELETE FROM images WHERE id=?').run(img.id);
    try { fs.unlinkSync(path.join(web, img.web_path)); } catch { /* original is intentionally kept */ }
    audit(db, req.user.id, 'image.delete', 'product', img.product_id, { imageId: img.id });
    res.json(productRow(img.product_id));
  }));

  // Inventory
  admin.get('/inventory', (req, res) => {
    const rows = db.prepare(`SELECT v.*, p.name AS product_name, p.brand, p.code, p.is_active AS product_active FROM variants v JOIN products p ON p.id=v.product_id ORDER BY p.name, v.colour`).all()
      .map((v) => ({ variant_id: v.id, product_id: v.product_id, product: v.product_name, brand: v.brand, code: v.code, sku: v.sku, colour: v.colour,
        stock_on_hand: v.stock_on_hand, reserved: v.reserved, available: v.stock_on_hand - v.reserved, min_stock: v.min_stock, avg_cost: v.avg_cost,
        value_at_cost: v.avg_cost == null ? null : Math.round(v.stock_on_hand * v.avg_cost * 100) / 100, status: inv.variantStatus(v) }));
    res.json({ rows, valuation: rep.inventoryValue(db) });
  });
  const receiveSchema = z.object({ supplierId: z.number().int().nullish(), receivedOn: date.optional(), reference: z.string().max(80).nullish(), notes: z.string().max(500).nullish(),
    paidAmount: money.nullish(), items: z.array(z.object({ variantId: z.number().int(), quantity: z.number().int().positive(), unitCost: money.nullish() })).min(1) });
  admin.post('/stock/receive', wrap((req, res) => { const b = parse(receiveSchema, req.body);
    res.status(201).json({ purchaseId: inv.receiveStock(db, { ...b, userId: req.user.id }) }); }));
  admin.post('/stock/adjust', wrap((req, res) => { const b = parse(z.object({ variantId: z.number().int(), newQuantity: z.number().int().min(0), reason: z.string() }), req.body);
    res.json(inv.adjustStock(db, { ...b, userId: req.user.id })); }));
  admin.post('/stock/remove', wrap((req, res) => { const b = parse(z.object({ variantId: z.number().int(), quantity: z.number().int().positive(), type: z.enum(['damage_loss', 'supplier_return']), reason: z.string() }), req.body);
    inv.removeStock(db, { ...b, userId: req.user.id }); res.json({ ok: true }); }));
  admin.post('/stock/reconcile', wrap((req, res) => { const b = parse(z.object({ counts: z.array(z.object({ variantId: z.number().int(), counted: z.number().int().min(0), reason: z.string().optional() })).min(1) }), req.body);
    res.json(inv.reconcile(db, { counts: b.counts, userId: req.user.id })); }));
  admin.get('/stock/movements', (req, res) => {
    const { from, to, variantId, type } = req.query; const w = []; const p = [];
    if (from) { w.push('m.occurred_on >= ?'); p.push(checkDate(from)); } if (to) { w.push('m.occurred_on <= ?'); p.push(checkDate(to)); }
    if (variantId) { w.push('m.variant_id = ?'); p.push(Number(variantId)); } if (type) { w.push('m.movement_type = ?'); p.push(type); }
    res.json(db.prepare(`SELECT m.*, v.sku, v.colour, pr.name AS product_name, u.email AS user_email FROM stock_movements m JOIN variants v ON v.id=m.variant_id
      JOIN products pr ON pr.id=m.product_id LEFT JOIN users u ON u.id=m.user_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY m.id DESC LIMIT 1000`).all(...p));
  });
  admin.get('/stock/daily', (req, res) => { const d = checkDate(req.query.date || localDate()); res.json(rep.stockSummary(db, d, d)); });

  // Suppliers
  admin.get('/suppliers', (req, res) => res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all()));
  admin.post('/suppliers', wrap((req, res) => { const b = parse(z.object({ name: z.string().min(1).max(100), phone: z.string().max(30).nullish(), notes: z.string().max(500).nullish() }), req.body);
    const id = db.prepare('INSERT INTO suppliers (name, phone, notes, created_at) VALUES (?,?,?,?)').run(b.name, b.phone ?? null, b.notes ?? null, new Date().toISOString()).lastInsertRowid;
    audit(db, req.user.id, 'supplier.create', 'supplier', id); res.status(201).json({ id }); }));

  // Enquiries (manual recording; a click is not a confirmed enquiry)
  admin.get('/enquiries', (req, res) => res.json(db.prepare(`SELECT e.*, p.name AS product_name, v.colour FROM enquiries e LEFT JOIN products p ON p.id=e.product_id
    LEFT JOIN variants v ON v.id=e.variant_id ${req.query.status ? 'WHERE e.status = ?' : ''} ORDER BY e.id DESC LIMIT 500`).all(...(req.query.status ? [req.query.status] : []))));
  admin.post('/enquiries', wrap((req, res) => { const b = parse(z.object({ productId: z.number().int().nullish(), variantId: z.number().int().nullish(), customerName: z.string().max(100).nullish(),
    customerContact: z.string().max(100).nullish(), notes: z.string().max(1000).nullish(), source: z.string().max(60).nullish() }), req.body);
    const ref = `ENQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; const now = new Date().toISOString();
    const id = db.prepare(`INSERT INTO enquiries (ref, product_id, variant_id, status, source, customer_name, customer_contact, notes, created_at, created_on, confirmed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(ref, b.productId ?? null, b.variantId ?? null, 'received', b.source || 'manual', b.customerName ?? null, b.customerContact ?? null, b.notes ?? null, now, localDate(), now).lastInsertRowid;
    audit(db, req.user.id, 'enquiry.create', 'enquiry', id); res.status(201).json({ id, ref }); }));
  admin.patch('/enquiries/:id', wrap((req, res) => { const id = Number(req.params.id);
    const b = parse(z.object({ status: z.enum(['clicked', 'received', 'closed']).optional(), customerName: z.string().max(100).nullish(), customerContact: z.string().max(100).nullish(), notes: z.string().max(1000).nullish() }), req.body);
    const cur = db.prepare('SELECT * FROM enquiries WHERE id=?').get(id); if (!cur) throw new HttpError(404, 'Enquiry not found');
    if (cur.status === 'converted') throw new HttpError(409, 'Enquiry already converted to an order');
    db.prepare(`UPDATE enquiries SET status=?, customer_name=?, customer_contact=?, notes=?, confirmed_at = CASE WHEN ? = 'received' AND confirmed_at IS NULL THEN ? ELSE confirmed_at END WHERE id=?`)
      .run(b.status ?? cur.status, b.customerName ?? cur.customer_name, b.customerContact ?? cur.customer_contact, b.notes ?? cur.notes, b.status ?? cur.status, new Date().toISOString(), id);
    audit(db, req.user.id, 'enquiry.update', 'enquiry', id, b); res.json({ ok: true }); }));

  // Orders
  admin.get('/orders', (req, res) => {
    const w = []; const p = [];
    if (req.query.status) { w.push('status = ?'); p.push(req.query.status); }
    if (req.query.from) { w.push('order_date >= ?'); p.push(checkDate(req.query.from)); } if (req.query.to) { w.push('order_date <= ?'); p.push(checkDate(req.query.to)); }
    res.json(db.prepare(`SELECT id FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`).all(...p).map((r) => ord.getOrder(db, r.id)));
  });
  admin.get('/orders/:id', (req, res) => { const o = ord.getOrder(db, Number(req.params.id)); if (!o) throw new HttpError(404, 'Order not found'); res.json(o); });
  admin.post('/orders', wrap((req, res) => {
    const b = parse(z.object({ customerName: z.string().max(100).nullish(), customerContact: z.string().max(100).nullish(), orderDate: date.optional(), notes: z.string().max(1000).nullish(),
      enquiryId: z.number().int().nullish(), status: z.enum(['enquiry', 'pending', 'confirmed', 'processing', 'ready', 'completed']).optional(),
      items: z.array(z.object({ variantId: z.number().int(), quantity: z.number().int().positive(), unitPrice: money.nullish(), lineDiscount: money.optional() })).min(1) }), req.body);
    const id = ord.createOrder(db, { ...b, userId: req.user.id }); res.status(201).json(ord.getOrder(db, id)); }));
  admin.patch('/orders/:id', wrap((req, res) => { const id = Number(req.params.id);
    const b = parse(z.object({ customerName: z.string().max(100).nullish(), customerContact: z.string().max(100).nullish(), notes: z.string().max(1000).nullish() }), req.body);
    const cur = db.prepare('SELECT * FROM orders WHERE id=?').get(id); if (!cur) throw new HttpError(404, 'Order not found');
    db.prepare('UPDATE orders SET customer_name=?, customer_contact=?, notes=?, updated_at=? WHERE id=?').run(b.customerName ?? cur.customer_name, b.customerContact ?? cur.customer_contact, b.notes ?? cur.notes, new Date().toISOString(), id);
    audit(db, req.user.id, 'order.update', 'order', id); res.json(ord.getOrder(db, id)); }));
  admin.post('/orders/:id/status', wrap((req, res) => { const b = parse(z.object({ status: z.string(), cancelReason: z.string().max(300).optional(), date: date.optional() }), req.body);
    ord.setOrderStatus(db, Number(req.params.id), b.status, { userId: req.user.id, cancelReason: b.cancelReason, date: b.date }); res.json(ord.getOrder(db, Number(req.params.id))); }));
  admin.post('/orders/:id/payments', wrap((req, res) => { const b = parse(z.object({ kind: z.enum(['payment', 'refund']), amount: z.number().positive(), paidOn: date.optional(), method: z.string().max(40).nullish(), note: z.string().max(300).nullish() }), req.body);
    ord.addPayment(db, Number(req.params.id), { ...b, userId: req.user.id }); res.status(201).json(ord.getOrder(db, Number(req.params.id))); }));
  admin.post('/orders/:id/items/:itemId/return', wrap((req, res) => { const b = parse(z.object({ quantity: z.number().int().positive(), condition: z.enum(['sellable', 'damaged']), reason: z.string().max(300).nullish(), returnedOn: date.optional() }), req.body);
    const it = db.prepare('SELECT order_id FROM order_items WHERE id=? AND order_id=?').get(Number(req.params.itemId), Number(req.params.id)); if (!it) throw new HttpError(404, 'Order item not found');
    inv.returnItem(db, { orderItemId: Number(req.params.itemId), ...b, reason: b.reason ?? undefined, userId: req.user.id }); res.json(ord.getOrder(db, Number(req.params.id))); }));

  // Expenses & savings
  admin.get('/expenses', (req, res) => { const { from, to } = req.query; const w = []; const p = [];
    if (from) { w.push('expense_on >= ?'); p.push(checkDate(from)); } if (to) { w.push('expense_on <= ?'); p.push(checkDate(to)); }
    res.json(db.prepare(`SELECT * FROM expenses ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY expense_on DESC, id DESC LIMIT 1000`).all(...p)); });
  admin.post('/expenses', wrap((req, res) => { const b = parse(z.object({ expenseOn: date.optional(), category: z.string().min(1).max(40), amount: z.number().positive(), description: z.string().max(300).nullish(), paymentMethod: z.string().max(40).nullish(), supplierId: z.number().int().nullish() }), req.body);
    const id = db.prepare('INSERT INTO expenses (expense_on, category, amount, description, payment_method, supplier_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(b.expenseOn || localDate(), b.category, b.amount, b.description ?? null, b.paymentMethod ?? null, b.supplierId ?? null, req.user.id, new Date().toISOString()).lastInsertRowid;
    audit(db, req.user.id, 'expense.create', 'expense', id, b); res.status(201).json({ id }); }));
  admin.delete('/expenses/:id', wrap((req, res) => { const e = db.prepare('SELECT * FROM expenses WHERE id=?').get(Number(req.params.id)); if (!e) throw new HttpError(404, 'Expense not found');
    db.prepare('DELETE FROM expenses WHERE id=?').run(e.id); audit(db, req.user.id, 'expense.delete', 'expense', e.id, e); res.json({ ok: true }); }));
  admin.get('/savings', (req, res) => res.json({ entries: db.prepare('SELECT * FROM savings_entries ORDER BY entry_on DESC, id DESC LIMIT 500').all(), balance: rep.savingsBalance(db, '9999-12-31') }));
  admin.post('/savings', wrap((req, res) => { const b = parse(z.object({ entryOn: date.optional(), direction: z.enum(['deposit', 'withdrawal']), amount: z.number().positive(), note: z.string().max(300).nullish() }), req.body);
    const id = db.prepare('INSERT INTO savings_entries (entry_on, direction, amount, note, created_at) VALUES (?,?,?,?,?)').run(b.entryOn || localDate(), b.direction, b.amount, b.note ?? null, new Date().toISOString()).lastInsertRowid;
    audit(db, req.user.id, 'savings.create', 'savings', id, b); res.status(201).json({ id }); }));

  // Reports
  admin.get('/reports/overview', (req, res) => {
    const today = localDate(); const month = today.slice(0, 7);
    const m = rep.monthly(db, month);
    res.json({ today: rep.daily(db, today), month: { ...m, stock_by_variant: undefined } });
  });
  admin.get('/reports/daily', (req, res) => res.json(rep.daily(db, req.query.date || localDate())));
  admin.get('/reports/monthly', (req, res) => res.json(rep.monthly(db, req.query.month || localDate().slice(0, 7))));
  admin.get('/reports/range', (req, res) => { const from = checkDate(req.query.from, 'from'); const to = checkDate(req.query.to, 'to');
    if (from > to) throw new HttpError(400, 'from must not be after to'); res.json({ financials: rep.financials(db, from, to), stock: rep.stockSummary(db, from, to), inventory_now: rep.inventoryValue(db) }); });
  admin.get('/audit', (req, res) => res.json(db.prepare('SELECT a.*, u.email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 500').all()));

  // CSV exports
  const exporters = {
    products: () => db.prepare(`SELECT p.code, p.name, p.brand, p.model, p.category, p.selling_price, p.original_price, p.status, p.is_active, p.date_added,
      v.sku, v.colour, v.stock_on_hand, v.reserved, v.min_stock, v.avg_cost FROM products p JOIN variants v ON v.product_id=p.id ORDER BY p.id, v.id`).all(),
    'stock-movements': () => db.prepare(`SELECT m.id, m.occurred_at, m.occurred_on, v.sku, m.movement_type, m.quantity_change, m.previous_qty, m.new_qty, m.non_sellable_qty, m.unit_cost, m.reason, m.order_id, m.purchase_id, m.user_id
      FROM stock_movements m JOIN variants v ON v.id=m.variant_id ORDER BY m.id`).all(),
    orders: () => db.prepare(`SELECT o.order_no, o.order_date, o.status, o.customer_name, o.customer_contact, v.sku, oi.quantity, oi.unit_price, oi.line_discount, oi.returned_qty, oi.sold_on, oi.unit_cost_at_sale, o.notes
      FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN variants v ON v.id=oi.variant_id ORDER BY o.id, oi.id`).all(),
    expenses: () => db.prepare('SELECT id, expense_on, category, amount, description, payment_method FROM expenses ORDER BY expense_on, id').all(),
  };
  admin.get('/export/:what', (req, res) => {
    const fn = exporters[req.params.what]; if (!fn) throw new HttpError(404, 'Unknown export');
    audit(db, req.user.id, 'export', 'csv', req.params.what);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${req.params.what}-${localDate()}.csv"` }).send('\ufeff' + toCsv(fn()));
  });
  app.use('/api/admin', admin);

  // Frontend (production build), if present
  const dist = path.join(config.root, 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (/SQLITE_CONSTRAINT/.test(String(err.code || err.message))) return res.status(409).json({ error: 'Database constraint violated: ' + err.message });
    console.error(err); res.status(500).json({ error: 'Server error' });
  });
  return app;
}

module.exports = { createApp };
