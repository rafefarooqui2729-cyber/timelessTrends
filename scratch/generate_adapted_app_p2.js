const fs = require('fs');

let code = fs.readFileSync('scratch/intermediate_code.js', 'utf8');

// 9. Dashboard overview
code = code.replace(
`  admin.get('/dashboard/summary', wrap((req, res) => {
    const totalProducts = db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active=1').get().count;
    const publishedProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='published' AND is_active=1").get().count;
    const draftProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='draft' AND is_active=1").get().count;
    const archivedProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='archived'").get().count;

    const inventoryAgg = db.prepare(\`
      SELECT
        COALESCE(SUM(v.stock_on_hand), 0) AS total_units,
        COUNT(CASE WHEN v.stock_on_hand = 0 THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN v.stock_on_hand > 0 AND v.stock_on_hand <= v.min_stock THEN 1 END) AS low_stock
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active = 1 AND p.is_active = 1
    \`).get();

    const newArrivals = db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_new_arrival=1 AND is_active=1').get().count;
    const featured = db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_featured=1 AND is_active=1').get().count;
    const activeOffers = db.prepare('SELECT COUNT(*) AS count FROM offers WHERE is_active=1').get().count;
    const enquiries = db.prepare('SELECT COUNT(*) AS count FROM enquiries').get().count;

    // Alerts
    const lowStockAlerts = db.prepare(\`
      SELECT v.id AS variant_id, v.sku, v.colour, v.stock_on_hand, v.min_stock, p.name AS product_name, p.code
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active=1 AND p.is_active=1 AND v.stock_on_hand > 0 AND v.stock_on_hand <= v.min_stock
      ORDER BY v.stock_on_hand ASC LIMIT 10
    \`).all();

    const outOfStockAlerts = db.prepare(\`
      SELECT v.id AS variant_id, v.sku, v.colour, v.stock_on_hand, p.name AS product_name, p.code
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active=1 AND p.is_active=1 AND v.stock_on_hand = 0
      ORDER BY p.name ASC LIMIT 10
    \`).all();

    const recentMovements = db.prepare(\`
      SELECT m.*, v.sku, v.colour, pr.name AS product_name, u.email AS user_email
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      JOIN products pr ON pr.id=m.product_id
      LEFT JOIN users u ON u.id=m.user_id
      ORDER BY m.id DESC LIMIT 8
    \`).all();

    res.json({
      products: { total: totalProducts, published: publishedProducts, draft: draftProducts, archived: archivedProducts },
      inventory: { total_units: inventoryAgg.total_units, low_stock: inventoryAgg.low_stock, out_of_stock: inventoryAgg.out_of_stock },
      marketing: { new_arrivals: newArrivals, featured, active_offers: activeOffers },
      enquiries: { total: enquiries },
      alerts: { low_stock: lowStockAlerts, out_of_stock: outOfStockAlerts },
      recent_movements: recentMovements
    });
  }));`,
`  admin.get('/dashboard/summary', wrap(async (req, res) => {
    const totalProducts = (await db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active=1').get()).count;
    const publishedProducts = (await db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='published' AND is_active=1").get()).count;
    const draftProducts = (await db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='draft' AND is_active=1").get()).count;
    const archivedProducts = (await db.prepare("SELECT COUNT(*) AS count FROM products WHERE status='archived'").get()).count;

    const inventoryAgg = await db.prepare(\`
      SELECT
        COALESCE(SUM(v.stock_on_hand), 0) AS total_units,
        COUNT(CASE WHEN v.stock_on_hand = 0 THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN v.stock_on_hand > 0 AND v.stock_on_hand <= v.min_stock THEN 1 END) AS low_stock
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active = 1 AND p.is_active = 1
    \`).get();

    const newArrivals = (await db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_new_arrival=1 AND is_active=1').get()).count;
    const featured = (await db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_featured=1 AND is_active=1').get()).count;
    const activeOffers = (await db.prepare('SELECT COUNT(*) AS count FROM offers WHERE is_active=1').get()).count;
    const enquiries = (await db.prepare('SELECT COUNT(*) AS count FROM enquiries').get()).count;

    // Alerts
    const lowStockAlerts = await db.prepare(\`
      SELECT v.id AS variant_id, v.sku, v.colour, v.stock_on_hand, v.min_stock, p.name AS product_name, p.code
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active=1 AND p.is_active=1 AND v.stock_on_hand > 0 AND v.stock_on_hand <= v.min_stock
      ORDER BY v.stock_on_hand ASC LIMIT 10
    \`).all();

    const outOfStockAlerts = await db.prepare(\`
      SELECT v.id AS variant_id, v.sku, v.colour, v.stock_on_hand, p.name AS product_name, p.code
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active=1 AND p.is_active=1 AND v.stock_on_hand = 0
      ORDER BY p.name ASC LIMIT 10
    \`).all();

    const recentMovements = await db.prepare(\`
      SELECT m.*, v.sku, v.colour, pr.name AS product_name, u.email AS user_email
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      JOIN products pr ON pr.id=m.product_id
      LEFT JOIN users u ON u.id=m.user_id
      ORDER BY m.id DESC LIMIT 8
    \`).all();

    res.json({
      products: { total: totalProducts, published: publishedProducts, draft: draftProducts, archived: archivedProducts },
      inventory: { total_units: inventoryAgg.total_units, low_stock: inventoryAgg.low_stock, out_of_stock: inventoryAgg.out_of_stock },
      marketing: { new_arrivals: newArrivals, featured, active_offers: activeOffers },
      enquiries: { total: enquiries },
      alerts: { low_stock: lowStockAlerts, out_of_stock: outOfStockAlerts },
      recent_movements: recentMovements
    });
  }));`
);

// 10. Staff & Admins
code = code.replace(
`  admin.get('/admins', requireRole(['super_admin']), wrap((req, res) => {
    const users = db.prepare('SELECT id, email, name, role, is_active, created_at FROM users ORDER BY id ASC').all()
      .map(u => ({ ...u, role: u.role === 'owner' ? 'super_admin' : u.role }));
    res.json(users);
  }));

  admin.post('/admins', requireRole(['super_admin']), wrap((req, res) => {
    const b = parse(z.object({
      email: z.string().email(),
      name: z.string().min(1).max(80),
      role: z.enum(['super_admin', 'inventory_manager', 'marketing_manager']),
      password: z.string().min(10, 'Password must be at least 10 characters')
    }), req.body);

    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(b.email.toLowerCase());
    if (existing) throw new HttpError(409, 'An administrator with this email already exists');

    const id = db.prepare(\`
      INSERT INTO users (email, name, password_hash, role, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    \`).run(b.email.toLowerCase(), b.name, bcrypt.hashSync(b.password, 12), b.role, new Date().toISOString()).lastInsertRowid;

    audit(db, req.user.id, 'admin.create', 'user', id, { email: b.email, role: b.role });
    res.status(201).json({ id, email: b.email, name: b.name, role: b.role, is_active: 1 });
  }));

  admin.patch('/admins/:id', requireRole(['super_admin']), wrap((req, res) => {
    const targetId = Number(req.params.id);
    const target = db.prepare('SELECT * FROM users WHERE id=?').get(targetId);
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
      db.prepare(\`UPDATE users SET \${keys.map(k => \`\${k}=?\`).join(', ')} WHERE id=?\`)
        .run(...keys.map(k => updates[k]), targetId);
      audit(db, req.user.id, 'admin.update', 'user', targetId, updates);
    }

    const updated = db.prepare('SELECT id, email, name, role, is_active, created_at FROM users WHERE id=?').get(targetId);
    res.json({ ...updated, role: updated.role === 'owner' ? 'super_admin' : updated.role });
  }));

  admin.post('/admins/:id/reset-password', requireRole(['super_admin']), wrap((req, res) => {
    const targetId = Number(req.params.id);
    const target = db.prepare('SELECT * FROM users WHERE id=?').get(targetId);
    if (!target) throw new HttpError(404, 'Administrator not found');

    const b = parse(z.object({
      password: z.string().min(10, 'Password must be at least 10 characters')
    }), req.body);

    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(b.password, 12), targetId);
    // Invalidate any active sessions for security
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(targetId);

    audit(db, req.user.id, 'admin.password_reset', 'user', targetId);
    res.json({ ok: true, message: 'Password reset and sessions invalidated' });
  }));`,
`  admin.get('/admins', requireRole(['super_admin']), wrap(async (req, res) => {
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

    const resInsert = await db.prepare(\`
      INSERT INTO users (email, name, password_hash, role, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    \`).run(b.email.toLowerCase(), b.name, bcrypt.hashSync(b.password, 12), b.role, new Date().toISOString());
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
      await db.prepare(\`UPDATE users SET \${keys.map(k => \`\${k}=?\`).join(', ')} WHERE id=?\`)
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
  }));`
);

// 11. Categories
code = code.replace(
`  admin.get('/categories', (req, res) => {
    res.json(db.prepare('SELECT * FROM categories ORDER BY display_order ASC, id ASC').all());
  });

  admin.post('/categories', requirePermission('categories:write'), wrap((req, res) => {
    const b = parse(z.object({
      name: z.string().min(1).max(80),
      slug: z.string().min(1).max(80).optional(),
      description: z.string().max(500).nullish(),
      image_url: z.string().max(300).nullish(),
      display_order: z.number().int().optional(),
      is_active: z.boolean().optional()
    }), req.body);

    const s = slugify(b.slug || b.name);
    const existing = db.prepare('SELECT id FROM categories WHERE slug=?').get(s);
    if (existing) throw new HttpError(409, \`Category slug '\${s}' already exists\`);

    const id = db.prepare(\`
      INSERT INTO categories (name, slug, description, image_url, display_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    \`).run(b.name, s, b.description ?? null, b.image_url ?? null, b.display_order ?? 0, b.is_active === false ? 0 : 1, new Date().toISOString()).lastInsertRowid;

    audit(db, req.user.id, 'category.create', 'category', id, b);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(id));
  }));

  admin.put('/categories/:id', requirePermission('categories:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
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
      db.prepare(\`UPDATE categories SET \${keys.map(k => \`\${k}=?\`).join(', ')} WHERE id=?\`)
        .run(...keys.map(k => m[k]), id);
      audit(db, req.user.id, 'category.update', 'category', id, b);
    }
    res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(id));
  }));

  admin.delete('/categories/:id', requirePermission('categories:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Category not found');

    // Prevent accidental deletion if products depend on category
    const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE category = ?').get(cur.slug).count;
    if (count > 0) {
      throw new HttpError(409, \`Cannot delete category '\${cur.name}': \${count} products currently assigned to this category. Reassign or archive them first.\`);
    }

    db.prepare('DELETE FROM categories WHERE id=?').run(id);
    audit(db, req.user.id, 'category.delete', 'category', id, { slug: cur.slug });
    res.json({ ok: true });
  }));`,
`  admin.get('/categories', wrap(async (req, res) => {
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
    if (existing) throw new HttpError(409, \`Category slug '\${s}' already exists\`);

    const resInsert = await db.prepare(\`
      INSERT INTO categories (name, slug, description, image_url, display_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    \`).run(b.name, s, b.description ?? null, b.image_url ?? null, b.display_order ?? 0, b.is_active === false ? 0 : 1, new Date().toISOString());
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
      await db.prepare(\`UPDATE categories SET \${keys.map(k => \`\${k}=?\`).join(', ')} WHERE id=?\`)
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
      throw new HttpError(409, \`Cannot delete category '\${cur.name}': \${count} products currently assigned to this category. Reassign or archive them first.\`);
    }

    await db.prepare('DELETE FROM categories WHERE id=?').run(id);
    await audit(db, req.user.id, 'category.delete', 'category', id, { slug: cur.slug });
    res.json({ ok: true });
  }));`
);

fs.writeFileSync('scratch/intermediate_code.js', code);
console.log('Checkpoint 2 written');
