const fs = require('fs');

// We will construct the adapted app file with precision
const original = fs.readFileSync('server/app.js', 'utf8');

let code = original;

// 1. Add required imports
code = code.replace(
  "const inv = require('./inventory');\nconst ord = require('./orders');\nconst rep = require('./reports');",
  "const { createAdapter } = require('./db-adapter');\nconst inv = require('./inventory');\nconst ord = require('./orders');\nconst rep = require('./reports');\nconst pgInv = require('./pg-inventory');\nconst pgOrd = require('./pg-orders');\nconst pgRep = require('./pg-reports');"
);

// 2. Update getSetting
code = code.replace(
  "function getSetting(db, key, fallback = null) {\n  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);\n  return r ? r.value : fallback;\n}",
  "async function getSetting(db, key, fallback = null) {\n  const r = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);\n  return r ? r.value : fallback;\n}"
);

// 3. Update getActiveOffers
code = code.replace(
  "function getActiveOffers(db) {\n  const today = localDate();\n  return db.prepare(`\n    SELECT * FROM offers\n    WHERE is_active = 1\n      AND (start_date IS NULL OR start_date <= ?)\n      AND (end_date IS NULL OR end_date >= ?)\n    ORDER BY discount_value DESC\n  `).all(today, today);\n}",
  "async function getActiveOffers(db) {\n  const today = localDate();\n  return await db.prepare(`\n    SELECT * FROM offers\n    WHERE is_active = 1\n      AND (start_date IS NULL OR start_date <= ?)\n      AND (end_date IS NULL OR end_date >= ?)\n    ORDER BY discount_value DESC\n  `).all(today, today);\n}"
);

// 4. Update createApp signature
code = code.replace(
  "function createApp(db, opts = {}) {",
  "function createApp(rawDb, opts = {}) {\n  const db = createAdapter(rawDb);\n  const currentInv = db.isPg ? pgInv : inv;\n  const currentOrd = db.isPg ? pgOrd : ord;\n  const currentRep = db.isPg ? pgRep : rep;"
);

// 5. Public API: /config
code = code.replace(
  "  pub.get('/config', (req, res) => res.json({\n    businessName: getSetting(db, 'business_name', 'TIMELESS TRENDS'),\n    tagline: 'Where every second speaks style, class & confidence.',\n    closingStatement: \"Don't just tell the time — make a statement.\",\n    whatsappNumber: waNumber() || null,\n    publicUrl: config.publicUrl || null,\n    currency: 'INR',\n    currencySymbol: '₹'\n  }));",
  "  pub.get('/config', wrap(async (req, res) => {\n    const rawWa = await getSetting(db, 'whatsapp_number', '');\n    const wa = (rawWa || config.whatsappNumber || '').replace(/\\D/g, '');\n    const bName = await getSetting(db, 'business_name', 'TIMELESS TRENDS');\n    res.json({\n      businessName: bName,\n      tagline: 'Where every second speaks style, class & confidence.',\n      closingStatement: \"Don't just tell the time — make a statement.\",\n      whatsappNumber: wa || null,\n      publicUrl: config.publicUrl || null,\n      currency: 'INR',\n      currencySymbol: '₹'\n    });\n  }));"
);

// 6. Public API: publicProducts function
code = code.replace(
`  const publicProducts = (where = '', params = []) => {
    const products = db.prepare(\`
      SELECT id, code, name, brand, model, slug, category, description, selling_price, original_price, specs,
             is_new_arrival, is_featured, display_priority, date_added
      FROM products
      WHERE status='published' AND is_active=1 \${where}
      ORDER BY display_priority DESC, id DESC
    \`).all(...params);

    const activeOffers = getActiveOffers(db);

    return products.map((p) => {
      const variants = db.prepare('SELECT id, sku, colour, price_override, stock_on_hand - reserved AS avail FROM variants WHERE product_id=? AND is_active=1 ORDER BY id').all(p.id)
        .map((v) => ({ id: v.id, sku: v.sku, colour: v.colour, price: v.price_override ?? p.selling_price ?? null, available: v.avail > 0 }));
      const images = db.prepare('SELECT id, variant_id, web_path, alt FROM images WHERE product_id=? ORDER BY sort_order, id').all(p.id)
        .map((i) => ({ id: i.id, variantId: i.variant_id, url: \`/uploads/\${i.web_path}\`, alt: i.alt }));

      const pricedProduct = applyBestOfferToProduct(p, activeOffers);
      const prices = variants.map((v) => v.price).filter((x) => x != null);

      return {
        ...pricedProduct,
        specs: p.specs ? JSON.parse(p.specs) : [],
        variants,
        images,
        available: variants.some((v) => v.available),
        price_from: pricedProduct.effective_price ?? (prices.length ? Math.min(...prices) : null)
      };
    });
  };`,
`  const publicProducts = async (where = '', params = []) => {
    const products = await db.prepare(\`
      SELECT id, code, name, brand, model, slug, category, description, selling_price, original_price, specs,
             is_new_arrival, is_featured, display_priority, date_added
      FROM products
      WHERE status='published' AND is_active=1 \${where}
      ORDER BY display_priority DESC, id DESC
    \`).all(...params);

    const activeOffers = await getActiveOffers(db);

    const result = [];
    for (const p of products) {
      const rawVariants = await db.prepare('SELECT id, sku, colour, price_override, stock_on_hand - reserved AS avail FROM variants WHERE product_id=? AND is_active=1 ORDER BY id').all(p.id);
      const variants = rawVariants.map((v) => ({ id: v.id, sku: v.sku, colour: v.colour, price: v.price_override ?? p.selling_price ?? null, available: v.avail > 0 }));
      const rawImages = await db.prepare('SELECT id, variant_id, web_path, alt FROM images WHERE product_id=? ORDER BY sort_order, id').all(p.id);
      const images = rawImages.map((i) => ({ id: i.id, variantId: i.variant_id, url: \`/uploads/\${i.web_path}\`, alt: i.alt }));

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
  };`
);

// 7. Public API: /products, /products/:slug, /categories, /offers, /collections, /enquiries/click
code = code.replace(
`  pub.get('/products', (req, res) => {
    const { q, category, brand, sort, featured, new_arrival: na } = req.query;
    let list = publicProducts();
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
  });

  pub.get('/products/:slug', (req, res) => {
    const [p] = publicProducts('AND slug = ?', [req.params.slug]);
    if (!p) throw new HttpError(404, 'Product not found');
    res.json(p);
  });

  pub.get('/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories WHERE is_active=1 ORDER BY display_order ASC, id ASC').all();
    const list = publicProducts();
    const categoriesWithCount = categories.map(cat => ({
      ...cat,
      count: list.filter(p => p.category === cat.slug).length
    }));
    res.json(categoriesWithCount);
  });

  pub.get('/offers', (req, res) => {
    res.json(getActiveOffers(db));
  });

  pub.get('/collections', (req, res) => {
    const list = publicProducts();
    const count = (key) => Object.entries(list.reduce((m, p) => { if (p[key]) m[p[key]] = (m[p[key]] || 0) + 1; return m; }, {}))
      .map(([name, n]) => ({ name, count: n }));
    res.json({ categories: count('category'), brands: count('brand') });
  });

  // A WhatsApp click only records website interest; never deducts stock or creates confirmed orders
  pub.post('/enquiries/click', limiter(60_000, 40), wrap((req, res) => {
    const b = parse(z.object({
      productId: z.number().int().optional().nullable(),
      variantId: z.number().int().optional().nullable(),
      source: z.string().max(60).nullish(),
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(500).nullish()
    }), req.body);

    if (b.productId) {
      const p = db.prepare("SELECT id FROM products WHERE id=? AND status='published' AND is_active=1").get(b.productId);
      if (!p) throw new HttpError(404, 'Product not found');
    }

    const ref = \`ENQ-\${crypto.randomBytes(4).toString('hex').toUpperCase()}\`;
    db.prepare('INSERT INTO enquiries (ref, product_id, variant_id, status, source, customer_name, customer_contact, notes, created_at, created_on) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(ref, b.productId || null, b.variantId || null, 'clicked', b.source || 'whatsapp_button', b.customerName || null, b.customerContact || null, b.notes || null, new Date().toISOString(), localDate());
    res.status(201).json({ ref });
  }));`,
`  pub.get('/products', wrap(async (req, res) => {
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

    const ref = \`ENQ-\${crypto.randomBytes(4).toString('hex').toUpperCase()}\`;
    await db.prepare('INSERT INTO enquiries (ref, product_id, variant_id, status, source, customer_name, customer_contact, notes, created_at, created_on) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(ref, b.productId || null, b.variantId || null, 'clicked', b.source || 'whatsapp_button', b.customerName || null, b.customerContact || null, b.notes || null, new Date().toISOString(), localDate());
    res.status(201).json({ ref });
  }));`
);

// 8. Auth: login, logout, session middleware, me
code = code.replace(
`  auth.post('/login', limiter(15 * 60_000, 10), wrap((req, res) => {
    const b = parse(z.object({ email: z.string().email(), password: z.string().min(1).max(200) }), req.body);
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(b.email.toLowerCase());
    const ok = bcrypt.compareSync(b.password, u ? u.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');

    if (!u || !ok) {
      audit(db, null, 'auth.login_failed', 'user', b.email);
      throw new HttpError(401, 'Invalid email or password');
    }
    if (u.is_active === 0) {
      audit(db, u.id, 'auth.login_deactivated', 'user', u.id);
      throw new HttpError(403, 'Your administrator account has been deactivated. Please contact the Super Admin.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)')
      .run(sha(token), u.id, new Date(Date.now() + config.sessionDays * 864e5).toISOString(), new Date().toISOString());

    res.cookie('tt_session', token, cookieOpts);
    audit(db, u.id, 'auth.login', 'user', u.id);
    res.json({ id: u.id, email: u.email, name: u.name, role: u.role === 'owner' ? 'super_admin' : u.role });
  }));

  auth.post('/logout', (req, res) => {
    if (req.cookies.tt_session) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(req.cookies.tt_session));
    }
    res.clearCookie('tt_session', { path: '/' });
    res.json({ ok: true });
  });

  app.use('/api/auth', auth);

  // ---------------- Private Admin API (Session + CSRF Protection) ----------------
  const admin = express.Router();
  admin.use((req, res, next) => {
    const t = req.cookies.tt_session;
    const row = t && db.prepare(\`
      SELECT u.id, u.email, u.name, u.role, u.is_active, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    \`).get(sha(t));

    if (!row || new Date(row.expires_at) < new Date() || row.is_active === 0) {
      return res.status(401).json({ error: 'Not signed in or session expired' });
    }

    // CSRF defense-in-depth: custom header required on state-changing requests
    if (!['GET', 'HEAD'].includes(req.method) && req.get('X-Requested-With') !== 'tt') {
      return res.status(403).json({ error: 'Missing required security header (X-Requested-With: tt)' });
    }

    req.user = { ...row, role: row.role === 'owner' ? 'super_admin' : row.role };
    next();
  });

  app.get('/api/auth/me', (req, res) => {
    const t = req.cookies.tt_session;
    const row = t && db.prepare(\`
      SELECT u.id, u.email, u.name, u.role, u.is_active
      FROM sessions s
      JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at > ?
    \`).get(sha(t), new Date().toISOString());

    if (!row || row.is_active === 0) {
      return res.status(401).json({ error: 'Not signed in' });
    }
    res.json({ id: row.id, email: row.email, name: row.name, role: row.role === 'owner' ? 'super_admin' : row.role });
  });`,
`  auth.post('/login', limiter(15 * 60_000, 10), wrap(async (req, res) => {
    const b = parse(z.object({ email: z.string().email(), password: z.string().min(1).max(200) }), req.body);
    const u = await db.prepare('SELECT * FROM users WHERE email = ?').get(b.email.toLowerCase());
    const ok = bcrypt.compareSync(b.password, u ? u.password_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');

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
    const row = t && (await db.prepare(\`
      SELECT u.id, u.email, u.name, u.role, u.is_active, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    \`).get(sha(t)));

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
    const row = t && (await db.prepare(\`
      SELECT u.id, u.email, u.name, u.role, u.is_active
      FROM sessions s
      JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at > ?
    \`).get(sha(t), new Date().toISOString()));

    if (!row || row.is_active === 0) {
      return res.status(401).json({ error: 'Not signed in' });
    }
    res.json({ id: row.id, email: row.email, name: row.name, role: row.role === 'owner' ? 'super_admin' : row.role });
  }));`
);

fs.writeFileSync('scratch/intermediate_code.js', code);
console.log('Checkpoint 1 written to scratch/intermediate_code.js');
