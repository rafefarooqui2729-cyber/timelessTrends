const fs = require('fs');

let code = fs.readFileSync('scratch/intermediate_code.js', 'utf8');

// 12. Offers
code = code.replace(
`admin.get(
  '/offers',
  requirePermission('offers:read'),
  (req, res) => {
    const today = localDate();

    const rows = db.prepare(
      'SELECT * FROM offers ORDER BY id DESC'
    ).all().map((o) => {
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
  }
);


  admin.post('/offers', requirePermission('offers:write'), wrap((req, res) => {
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

    const id = db.prepare(\`
      INSERT INTO offers (title, code, discount_type, discount_value, scope, target_id, badge_text, banner_text, start_date, end_date, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
      b.title, b.code || null, b.discount_type, b.discount_value, b.scope, b.target_id || null,
      b.badge_text || null, b.banner_text || null, b.start_date || null, b.end_date || null,
      b.is_active === false ? 0 : 1, new Date().toISOString()
    ).lastInsertRowid;

    audit(db, req.user.id, 'offer.create', 'offer', id, b);
    res.status(201).json(db.prepare('SELECT * FROM offers WHERE id=?').get(id));
  }));

  admin.put('/offers/:id', requirePermission('offers:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM offers WHERE id=?').get(id);
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
      db.prepare(\`UPDATE offers SET \${keys.map(k => \`\${k}=?\`).join(', ')} WHERE id=?\`)
        .run(...keys.map(k => m[k]), id);
      audit(db, req.user.id, 'offer.update', 'offer', id, b);
    }
    res.json(db.prepare('SELECT * FROM offers WHERE id=?').get(id));
  }));

  admin.delete('/offers/:id', requirePermission('offers:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM offers WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Offer not found');
    db.prepare('DELETE FROM offers WHERE id=?').run(id);
    audit(db, req.user.id, 'offer.delete', 'offer', id, { title: cur.title });
    res.json({ ok: true });
  }));`,
`admin.get(
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

    const resInsert = await db.prepare(\`
      INSERT INTO offers (title, code, discount_type, discount_value, scope, target_id, badge_text, banner_text, start_date, end_date, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
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
      await db.prepare(\`UPDATE offers SET \${keys.map(k => \`\${k}=?\`).join(', ')} WHERE id=?\`)
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
  }));`
);

// 13. Media & Settings
code = code.replace(
`  // ---------------- Media Management ----------------
  admin.get('/media', (req, res) => {
    const images = db.prepare(\`
      SELECT i.*, p.name AS product_name, p.code AS product_code, v.colour AS variant_colour
      FROM images i
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN variants v ON v.id = i.variant_id
      ORDER BY i.id DESC
    \`).all().map(img => ({ ...img, url: \`/uploads/\${img.web_path}\` }));
    res.json(images);
  });

  // Settings
  const SETTING_KEYS = ['whatsapp_number', 'business_name', 'opening_cash', 'expense_categories', 'public_url'];
  admin.get('/settings', (req, res) => {
    const out = {};
    SETTING_KEYS.forEach((k) => { out[k] = getSetting(db, k); });
    out.expense_categories = JSON.parse(out.expense_categories || '["Advertising","Packaging","Transport","Rent","Software","Miscellaneous"]');
    out.timezone = config.timezone;
    out.whatsapp_number = out.whatsapp_number || config.whatsappNumber;
    out.public_url = out.public_url || config.publicUrl;
    res.json(out);
  });

  admin.put('/settings', requireRole(['super_admin']), wrap((req, res) => {
    const b = parse(z.object({
      whatsapp_number: z.string().regex(/^\\d{8,15}$/, 'digits only, with country code, e.g. 919876543210').or(z.literal('')).optional(),
      business_name: z.string().min(1).max(80).optional(),
      public_url: z.string().max(200).optional(),
      opening_cash: z.number().finite().optional(),
      expense_categories: z.array(z.string().min(1).max(40)).max(30).optional()
    }), req.body);

    const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const [k, v] of Object.entries(b)) {
      up.run(k, k === 'expense_categories' ? JSON.stringify(v) : String(v));
    }
    audit(db, req.user.id, 'settings.update', 'settings', '', b);
    res.json({ ok: true });
  }));`,
`  // ---------------- Media Management ----------------
  admin.get('/media', wrap(async (req, res) => {
    const rawImages = await db.prepare(\`
      SELECT i.*, p.name AS product_name, p.code AS product_code, v.colour AS variant_colour
      FROM images i
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN variants v ON v.id = i.variant_id
      ORDER BY i.id DESC
    \`).all();
    const images = rawImages.map(img => ({ ...img, url: \`/uploads/\${img.web_path}\` }));
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
      whatsapp_number: z.string().regex(/^\\d{8,15}$/, 'digits only, with country code, e.g. 919876543210').or(z.literal('')).optional(),
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
  }));`
);

// 14. uniqueSlug and addVariant
code = code.replace(
`  const uniqueSlug = (name, selfId = null) => {
    const base = slugify(name) || 'watch';
    let s = base;
    let i = 2;
    while (db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(s, selfId ?? -1)) s = \`\${base}-\${i++}\`;
    return s;
  };

  const addVariant = (productId, code, v) => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM variants WHERE product_id = ?').get(productId).n + 1;
    try {
      const vid = db.prepare(\`
        INSERT INTO variants (product_id, sku, colour, price_override, min_stock, stock_on_hand, avg_cost, created_at)
        VALUES (?,?,?,?,?,?,?,?)
      \`).run(
        productId,
        \`\${code}-\${String(n).padStart(2, '0')}\`,
        v.colour.trim(),
        v.price_override ?? null,
        v.min_stock ?? 2,
        v.stock_on_hand ?? 0,
        v.avg_cost ?? null,
        new Date().toISOString()
      ).lastInsertRowid;

      if (v.stock_on_hand > 0) {
        db.prepare(\`
          INSERT INTO stock_movements (occurred_at, occurred_on, product_id, variant_id, movement_type, quantity_change, previous_qty, new_qty, unit_cost, reason)
          VALUES (?,?,?,?,'purchase_received',?,0,?,?,'Initial stock receipt')
        \`).run(new Date().toISOString(), localDate(), productId, vid, v.stock_on_hand, v.stock_on_hand, v.avg_cost ?? null);
      }
      return vid;
    } catch (e) {
      if (/UNIQUE/.test(e.message)) throw new HttpError(409, \`Colour "\${v.colour}" already exists for this product\`);
      throw e;
    }
  };`,
`  const uniqueSlug = async (name, selfId = null) => {
    const base = slugify(name) || 'watch';
    let s = base;
    let i = 2;
    while (await db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(s, selfId ?? -1)) s = \`\${base}-\${i++}\`;
    return s;
  };

  const addVariant = async (productId, code, v) => {
    const countRow = await db.prepare('SELECT COUNT(*) AS n FROM variants WHERE product_id = ?').get(productId);
    const n = Number(countRow?.n || 0) + 1;
    try {
      const resInsert = await db.prepare(\`
        INSERT INTO variants (product_id, sku, colour, price_override, min_stock, stock_on_hand, avg_cost, created_at)
        VALUES (?,?,?,?,?,?,?,?)
      \`).run(
        productId,
        \`\${code}-\${String(n).padStart(2, '0')}\`,
        v.colour.trim(),
        v.price_override ?? null,
        v.min_stock ?? 2,
        v.stock_on_hand ?? 0,
        v.avg_cost ?? null,
        new Date().toISOString()
      );
      const vid = resInsert.lastInsertRowid;

      if (v.stock_on_hand > 0) {
        await db.prepare(\`
          INSERT INTO stock_movements (occurred_at, occurred_on, product_id, variant_id, movement_type, quantity_change, previous_qty, new_qty, unit_cost, reason)
          VALUES (?,?,?,?,'purchase_received',?,0,?,?,'Initial stock receipt')
        \`).run(new Date().toISOString(), localDate(), productId, vid, v.stock_on_hand, v.stock_on_hand, v.avg_cost ?? null);
      }
      return vid;
    } catch (e) {
      if (/unique|duplicate key/i.test(e.message)) throw new HttpError(409, \`Colour "\${v.colour}" already exists for this product\`);
      throw e;
    }
  };`
);

// 15. productRow
code = code.replace(
`const productRow = (id, requesterRole = 'super_admin') => {
  const p = db.prepare(
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

  const variants = db.prepare(
    'SELECT * FROM variants WHERE product_id = ? ORDER BY id'
  ).all(id).map((v) => {
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
      result.status = inv.variantStatus({
        ...v,
        product_active: p.is_active
      });
    }

    return result;
  });

  const images = db.prepare(
    'SELECT * FROM images WHERE product_id = ? ORDER BY sort_order, id'
  ).all(id).map((i) => ({
    id: i.id,
    variant_id: i.variant_id,
    web_path: i.web_path,
    alt: i.alt,
    sort_order: i.sort_order,
    url: \`/uploads/\${i.web_path}\`
  }));

  return {
    ...p,
    specs: p.specs ? JSON.parse(p.specs) : [],
    variants,
    images
  };
};`,
`const productRow = async (id, requesterRole = 'super_admin') => {
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
    url: \`/uploads/\${i.web_path}\`
  }));

  return {
    ...p,
    specs: typeof p.specs === 'string' ? JSON.parse(p.specs) : (p.specs || []),
    variants,
    images
  };
};`
);

// 16. admin product routes: get, get/:id, post, put, archive, restore, duplicate, bulk
code = code.replace(
`  admin.get('/products', (req, res) => {
    const q = String(req.query.q || '').toLowerCase();
    let rows = db.prepare('SELECT id FROM products ORDER BY display_priority DESC, id DESC').all()
      .map((r) => productRow(r.id, req.user.role));

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
  });

  admin.get('/products/:id', (req, res) => res.json(productRow(Number(req.params.id), req.user.role)));

  admin.post('/products', requirePermission('products:write'), wrap((req, res) => {
    const b = parse(productSchema.extend({ variants: z.array(variantSchema).min(1) }), req.body);
    const id = db.transaction(() => {
      const now = new Date().toISOString();
      const pid = db.prepare(\`
        INSERT INTO products (code, name, brand, model, slug, category, description, selling_price, original_price,
          specs, stock_location, is_new_arrival, is_featured, display_priority, new_arrival_start, new_arrival_end,
          status, is_active, date_added, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      \`).run(
        \`TMP\${Math.random()}\`, b.name, b.brand ?? null, b.model ?? null, uniqueSlug(b.name),
        b.category ?? null, b.description ?? null, b.selling_price ?? null, b.original_price ?? null,
        JSON.stringify(b.specs || []), b.stock_location ?? null, b.is_new_arrival ? 1 : 0, b.is_featured ? 1 : 0,
        b.display_priority ?? 0, b.new_arrival_start ?? null, b.new_arrival_end ?? null,
        b.status || 'draft', b.is_active === false ? 0 : 1, b.date_added || localDate(), now, now
      ).lastInsertRowid;

      const code = \`TT-P\${String(pid).padStart(4, '0')}\`;
      db.prepare('UPDATE products SET code = ? WHERE id = ?').run(code, pid);
      b.variants.forEach((v) => addVariant(pid, code, v));
      audit(db, req.user.id, 'product.create', 'product', pid, { name: b.name });
      return pid;
    })();
    res.status(201).json(productRow(id, req.user.role));
  }));

  admin.put('/products/:id', requirePermission('products:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM products WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Product not found');
    const b = parse(productSchema.partial(), req.body);

    const m = { ...b };
    if (m.specs) m.specs = JSON.stringify(m.specs);
    ['is_new_arrival', 'is_featured', 'is_active'].forEach((k) => { if (k in m) m[k] = m[k] ? 1 : 0; });
    if (b.name && b.name !== cur.name) m.slug = uniqueSlug(b.name, id);

    const keys = Object.keys(m);
    if (keys.length) {
      db.prepare(\`UPDATE products SET \${keys.map((k) => \`\${k} = ?\`).join(', ')}, updated_at = ? WHERE id = ?\`)
        .run(...keys.map((k) => m[k]), new Date().toISOString(), id);
      audit(db, req.user.id, 'product.update', 'product', id, b);
    }
    res.json(productRow(id, req.user.role));
  }));

  admin.post('/products/:id/archive', requirePermission('products:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const p = db.prepare('SELECT id FROM products WHERE id=?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    db.prepare("UPDATE products SET status='archived', updated_at=? WHERE id=?").run(new Date().toISOString(), id);
    audit(db, req.user.id, 'product.archive', 'product', id);
    res.json(productRow(id, req.user.role));
  }));

  admin.post('/products/:id/restore', requirePermission('products:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const p = db.prepare('SELECT id FROM products WHERE id=?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    db.prepare("UPDATE products SET status='published', updated_at= ? WHERE id=?").run(new Date().toISOString(), id);
    audit(db, req.user.id, 'product.restore', 'product', id);
    res.json(productRow(id, req.user.role));
  }));

  admin.post('/products/:id/duplicate', requirePermission('products:write'), wrap((req, res) => {
    const sourceId = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM products WHERE id=?').get(sourceId);
    if (!cur) throw new HttpError(404, 'Product not found');

    const newId = db.transaction(() => {
      const now = new Date().toISOString();
      const newName = \`\${cur.name} (Copy)\`;
      const newSlug = uniqueSlug(newName);

      const pid = db.prepare(\`
        INSERT INTO products (code, name, brand, model, slug, category, description, selling_price, original_price,
          specs, stock_location, is_new_arrival, is_featured, display_priority, status, is_active, date_added, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',1,?,?,?)
      \`).run(
        \`TMP\${Math.random()}\`, newName, cur.brand, cur.model, newSlug, cur.category, cur.description,
        cur.selling_price, cur.original_price, cur.specs, cur.stock_location, cur.is_new_arrival,
        cur.is_featured, cur.display_priority, localDate(), now, now
      ).lastInsertRowid;

      const code = \`TT-P\${String(pid).padStart(4, '0')}\`;
      db.prepare('UPDATE products SET code = ? WHERE id = ?').run(code, pid);

      const variants = db.prepare('SELECT * FROM variants WHERE product_id=?').all(sourceId);
      variants.forEach(v => {
        addVariant(pid, code, {
          colour: v.colour,
          price_override: v.price_override,
          min_stock: v.min_stock,
          stock_on_hand: 0,
          avg_cost: v.avg_cost
        });
      });

      audit(db, req.user.id, 'product.duplicate', 'product', pid, { sourceId });
      return pid;
    })();

    res.status(201).json(productRow(newId, req.user.role));
  }));

  admin.post('/products/bulk', requirePermission('products:write'), wrap((req, res) => {
    const b = parse(z.object({
      action: z.enum(['activate', 'deactivate', 'archive', 'publish', 'set_category']),
      productIds: z.array(z.number().int()).min(1),
      category: z.string().max(60).optional()
    }), req.body);

    db.transaction(() => {
      const now = new Date().toISOString();
      if (b.action === 'activate') {
        b.productIds.forEach(id => db.prepare('UPDATE products SET is_active=1, updated_at=? WHERE id=?').run(now, id));
      } else if (b.action === 'deactivate') {
        b.productIds.forEach(id => db.prepare('UPDATE products SET is_active=0, updated_at=? WHERE id=?').run(now, id));
      } else if (b.action === 'archive') {
        b.productIds.forEach(id => db.prepare("UPDATE products SET status='archived', updated_at=? WHERE id=?").run(now, id));
      } else if (b.action === 'publish') {
        b.productIds.forEach(id => db.prepare("UPDATE products SET status='published', updated_at=? WHERE id=?").run(now, id));
      } else if (b.action === 'set_category' && b.category) {
        b.productIds.forEach(id => db.prepare('UPDATE products SET category=?, updated_at=? WHERE id=?').run(b.category, now, id));
      }
      audit(db, req.user.id, 'product.bulk_action', 'products', b.productIds.join(','), b);
    })();

    res.json({ ok: true, modifiedCount: b.productIds.length });
  }));`,
`  admin.get('/products', wrap(async (req, res) => {
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
    const tx = db.transaction(async (txDb) => {
      const now = new Date().toISOString();
      const slug = await uniqueSlug(b.name);
      const resInsert = await txDb.prepare(\`
        INSERT INTO products (code, name, brand, model, slug, category, description, selling_price, original_price,
          specs, stock_location, is_new_arrival, is_featured, display_priority, new_arrival_start, new_arrival_end,
          status, is_active, date_added, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      \`).run(
        \`TMP\${Math.random()}\`, b.name, b.brand ?? null, b.model ?? null, slug,
        b.category ?? null, b.description ?? null, b.selling_price ?? null, b.original_price ?? null,
        JSON.stringify(b.specs || []), b.stock_location ?? null, b.is_new_arrival ? 1 : 0, b.is_featured ? 1 : 0,
        b.display_priority ?? 0, b.new_arrival_start ?? null, b.new_arrival_end ?? null,
        b.status || 'draft', b.is_active === false ? 0 : 1, b.date_added || localDate(), now, now
      );
      const pid = resInsert.lastInsertRowid;

      const code = \`TT-P\${String(pid).padStart(4, '0')}\`;
      await txDb.prepare('UPDATE products SET code = ? WHERE id = ?').run(code, pid);
      for (const v of b.variants) {
        await addVariant(pid, code, v);
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

    const m = { ...b };
    if (m.specs) m.specs = JSON.stringify(m.specs);
    ['is_new_arrival', 'is_featured', 'is_active'].forEach((k) => { if (k in m) m[k] = m[k] ? 1 : 0; });
    if (b.name && b.name !== cur.name) m.slug = await uniqueSlug(b.name, id);

    const keys = Object.keys(m);
    if (keys.length) {
      await db.prepare(\`UPDATE products SET \${keys.map((k) => \`\${k} = ?\`).join(', ')}, updated_at = ? WHERE id = ?\`)
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
      const newName = \`\${cur.name} (Copy)\`;
      const newSlug = await uniqueSlug(newName);

      const resInsert = await txDb.prepare(\`
        INSERT INTO products (code, name, brand, model, slug, category, description, selling_price, original_price,
          specs, stock_location, is_new_arrival, is_featured, display_priority, status, is_active, date_added, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',1,?,?,?)
      \`).run(
        \`TMP\${Math.random()}\`, newName, cur.brand, cur.model, newSlug, cur.category, cur.description,
        cur.selling_price, cur.original_price, cur.specs, cur.stock_location, cur.is_new_arrival,
        cur.is_featured, cur.display_priority, localDate(), now, now
      );
      const pid = resInsert.lastInsertRowid;

      const code = \`TT-P\${String(pid).padStart(4, '0')}\`;
      await txDb.prepare('UPDATE products SET code = ? WHERE id = ?').run(code, pid);

      const variants = await txDb.prepare('SELECT * FROM variants WHERE product_id=?').all(sourceId);
      for (const v of variants) {
        await addVariant(pid, code, {
          colour: v.colour,
          price_override: v.price_override,
          min_stock: v.min_stock,
          stock_on_hand: 0,
          avg_cost: v.avg_cost
        });
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
  }));`
);

fs.writeFileSync('scratch/intermediate_code.js', code);
console.log('Checkpoint 3 written');
