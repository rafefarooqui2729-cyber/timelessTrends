const fs = require('fs');

let code = fs.readFileSync('scratch/intermediate_code.js', 'utf8');

// 17. Variants routes
code = code.replace(
`  admin.post('/products/:id/variants', requirePermission('products:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const p = db.prepare('SELECT code FROM products WHERE id=?').get(id);
    if (!p) throw new HttpError(404, 'Product not found');
    const vid = addVariant(id, p.code, parse(variantSchema, req.body));
    audit(db, req.user.id, 'variant.create', 'variant', vid);
    res.status(201).json(productRow(id, req.user.role));
  }));

  
  admin.put('/variants/:id', requirePermission('products:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const v = inv.getVariant(db, id);

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
      db.prepare(
        \`UPDATE variants SET \${keys.map((k) => \`\${k} = ?\`).join(', ')} WHERE id = ?\`
      ).run(...keys.map((k) => m[k]), id);

      audit(db, req.user.id, 'variant.update', 'variant', id, b);
    }

    res.json(productRow(v.product_id, req.user.role));
  }));


  admin.delete('/variants/:id', requirePermission('products:write'), wrap((req, res) => {
    const v = inv.getVariant(db, Number(req.params.id));
    if (db.prepare('SELECT 1 FROM stock_movements WHERE variant_id=?').get(v.id) || db.prepare('SELECT 1 FROM order_items WHERE variant_id=?').get(v.id)) {
      throw new HttpError(409, 'This colour has stock history or orders, so it cannot be deleted. Mark it inactive instead.');
    }
    db.prepare('DELETE FROM variants WHERE id=?').run(v.id);
    audit(db, req.user.id, 'variant.delete', 'variant', v.id);
    res.json(productRow(v.product_id, req.user.role));
  }));`,
`  admin.post('/products/:id/variants', requirePermission('products:write'), wrap(async (req, res) => {
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
        \`UPDATE variants SET \${keys.map((k) => \`\${k} = ?\`).join(', ')} WHERE id = ?\`
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
  }));`
);

// 18. Image upload and delete
code = code.replace(
`    wrap(async (req, res) => {
      const pid = Number(req.params.id);
      productRow(pid);

      if (!req.files || req.files.length === 0) {
        throw new HttpError(400, 'At least one image file is required');
      }

      const variantId = req.body.variantId
        ? Number(req.body.variantId)
        : null;

      if (
        variantId &&
        !db.prepare(
          'SELECT 1 FROM variants WHERE id=? AND product_id=?'
        ).get(variantId, pid)
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
          const originalPath = \`\${name}.\${ext}\`;
          const webPath = \`\${name}.webp\`;

          fs.writeFileSync(
            path.join(orig, originalPath),
            file.buffer
          );

          await sharp(file.buffer)
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 82 })
            .toFile(path.join(web, webPath));

          savedFiles.push({
            originalPath,
            webPath,
            alt: Array.isArray(req.body.alt)
              ? req.body.alt[index] || null
              : req.body.alt || null,
            sortOrder: (Number(req.body.sortOrder) || 0) + index
          });
        }

        const insertImage = db.prepare(\`
          INSERT INTO images
          (product_id, variant_id, original_path, web_path, alt, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        \`);

        const now = new Date().toISOString();

        const saveImages = db.transaction(() => {
          for (const file of savedFiles) {
            insertImage.run(
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

        saveImages();

        audit(db, req.user.id, 'image.upload', 'product', pid, {
          imageCount: savedFiles.length
        });

        res.status(201).json(productRow(pid, req.user.role));
      } catch (e) {
        // Remove newly created files if image processing or saving fails.
        for (const file of savedFiles) {
          try {
            fs.unlinkSync(path.join(orig, file.originalPath));
          } catch {}

          try {
            fs.unlinkSync(path.join(web, file.webPath));
          } catch {}
        }

        if (e instanceof HttpError) throw e;

        throw new HttpError(
          400,
          'Failed to process images: ' + (e.message || 'Invalid file')
        );
      }
    })
  );


  admin.delete('/images/:id', requirePermission('media:write'), wrap((req, res) => {
    const img = db.prepare('SELECT * FROM images WHERE id=?').get(Number(req.params.id));
    if (!img) throw new HttpError(404, 'Image not found');
    db.prepare('DELETE FROM images WHERE id=?').run(img.id);
    try { fs.unlinkSync(path.join(web, img.web_path)); } catch {}
    audit(db, req.user.id, 'image.delete', 'product', img.product_id, { imageId: img.id });
    res.json(productRow(img.product_id, req.user.role));
  }));`,
`    wrap(async (req, res) => {
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
          const originalPath = \`\${name}.\${ext}\`;
          const webPath = \`\${name}.webp\`;

          fs.writeFileSync(
            path.join(orig, originalPath),
            file.buffer
          );

          await sharp(file.buffer)
            .rotate()
            .resize({
              width: 1600,
              height: 1600,
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 82 })
            .toFile(path.join(web, webPath));

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
            await txDb.prepare(\`
              INSERT INTO images
              (product_id, variant_id, original_path, web_path, alt, sort_order, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            \`).run(
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
        // Remove newly created files if image processing or saving fails.
        for (const file of savedFiles) {
          try {
            fs.unlinkSync(path.join(orig, file.originalPath));
          } catch {}

          try {
            fs.unlinkSync(path.join(web, file.webPath));
          } catch {}
        }

        if (e instanceof HttpError) throw e;

        throw new HttpError(
          400,
          'Failed to process images: ' + (e.message || 'Invalid file')
        );
      }
    })
  );


  admin.delete('/images/:id', requirePermission('media:write'), wrap(async (req, res) => {
    const img = await db.prepare('SELECT * FROM images WHERE id=?').get(Number(req.params.id));
    if (!img) throw new HttpError(404, 'Image not found');
    await db.prepare('DELETE FROM images WHERE id=?').run(img.id);
    try { fs.unlinkSync(path.join(web, img.web_path)); } catch {}
    await audit(db, req.user.id, 'image.delete', 'product', img.product_id, { imageId: img.id });
    res.json(await productRow(img.product_id, req.user.role));
  }));`
);

// 19. Inventory routes
code = code.replace(
`  // Inventory Management
  admin.get('/inventory', requirePermission('inventory:read'), (req, res) => {
    const canSeeCost = ['super_admin', 'owner', 'inventory_manager'].includes(req.user.role);
    const rows = db.prepare(\`
      SELECT v.*, p.name AS product_name, p.brand, p.code, p.is_active AS product_active
      FROM variants v
      JOIN products p ON p.id=v.product_id
      ORDER BY p.name, v.colour
    \`).all().map((v) => ({
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
      status: inv.variantStatus(v)
    }));
    res.json({ rows, valuation: canSeeCost ? rep.inventoryValue(db) : undefined });
  });

  const receiveSchema = z.object({
    supplierId: z.number().int().nullish(),
    receivedOn: date.optional(),
    reference: z.string().max(80).nullish(),
    notes: z.string().max(500).nullish(),
    paidAmount: money.nullish(),
    items: z.array(z.object({ variantId: z.number().int(), quantity: z.number().int().positive(), unitCost: money.nullish() })).min(1)
  });

  admin.post('/stock/receive', requirePermission('inventory:write'), wrap((req, res) => {
    const b = parse(receiveSchema, req.body);
    res.status(201).json({ purchaseId: inv.receiveStock(db, { ...b, userId: req.user.id }) });
  }));

  admin.post('/stock/adjust', requirePermission('inventory:write'), wrap((req, res) => {
    const b = parse(z.object({
      variantId: z.number().int(),
      newQuantity: z.number().int().min(0),
      reason: z.string().refine((s) => s.trim().length > 0, 'A non-empty reason is mandatory for physical adjustments')
    }), req.body);
    res.json(inv.adjustStock(db, { ...b, userId: req.user.id }));
  }));

  admin.post('/stock/remove', requirePermission('inventory:write'), wrap((req, res) => {
    const b = parse(z.object({
      variantId: z.number().int(),
      quantity: z.number().int().positive(),
      type: z.enum(['damage_loss', 'supplier_return']),
      reason: z.string().refine((s) => s.trim().length > 0, 'A non-empty reason is mandatory')
    }), req.body);
    inv.removeStock(db, { ...b, userId: req.user.id });
    res.json({ ok: true });
  }));

  admin.post('/stock/reconcile', requirePermission('inventory:write'), wrap((req, res) => {
    const b = parse(z.object({
      counts: z.array(z.object({
        variantId: z.number().int(),
        counted: z.number().int().min(0),
        reason: z.string().optional()
      })).min(1)
    }), req.body);
    res.json(inv.reconcile(db, { counts: b.counts, userId: req.user.id }));
  }));

  admin.get('/stock/movements', requirePermission('inventory:read'), (req, res) => {
    const { from, to, variantId, type } = req.query;
    const w = [];
    const p = [];
    if (from) { w.push('m.occurred_on >= ?'); p.push(checkDate(from)); }
    if (to) { w.push('m.occurred_on <= ?'); p.push(checkDate(to)); }
    if (variantId) { w.push('m.variant_id = ?'); p.push(Number(variantId)); }
    if (type) { w.push('m.movement_type = ?'); p.push(type); }

    res.json(db.prepare(\`
      SELECT m.*, v.sku, v.colour, pr.name AS product_name, u.email AS user_email
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      JOIN products pr ON pr.id=m.product_id
      LEFT JOIN users u ON u.id=m.user_id
      \${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY m.id DESC LIMIT 1000
    \`).all(...p));
  });

  admin.get('/stock/daily', requirePermission('inventory:read'), (req, res) => {
    const d = checkDate(req.query.date || localDate());
    res.json(rep.stockSummary(db, d, d));
  });`,
`  // Inventory Management
  admin.get('/inventory', requirePermission('inventory:read'), wrap(async (req, res) => {
    const canSeeCost = ['super_admin', 'owner', 'inventory_manager'].includes(req.user.role);
    const rawRows = await db.prepare(\`
      SELECT v.*, p.name AS product_name, p.brand, p.code, p.is_active AS product_active
      FROM variants v
      JOIN products p ON p.id=v.product_id
      ORDER BY p.name, v.colour
    \`).all();
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
    const b = parse(receiveSchema, req.body);
    const purchaseId = await currentInv.receiveStock(db, { ...b, userId: req.user.id });
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

    res.json(await db.prepare(\`
      SELECT m.*, v.sku, v.colour, pr.name AS product_name, u.email AS user_email
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      JOIN products pr ON pr.id=m.product_id
      LEFT JOIN users u ON u.id=m.user_id
      \${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY m.id DESC LIMIT 1000
    \`).all(...p));
  }));

  admin.get('/stock/daily', requirePermission('inventory:read'), wrap(async (req, res) => {
    const d = checkDate(req.query.date || localDate());
    res.json(await currentRep.stockSummary(db, d, d));
  }));`
);

// 20. Suppliers & Enquiries
code = code.replace(
`  // Suppliers
  admin.get('/suppliers', (req, res) => res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all()));
  admin.post('/suppliers', requirePermission('inventory:write'), wrap((req, res) => {
    const b = parse(z.object({ name: z.string().min(1).max(100), phone: z.string().max(30).nullish(), notes: z.string().max(500).nullish() }), req.body);
    const id = db.prepare('INSERT INTO suppliers (name, phone, notes, created_at) VALUES (?,?,?,?)')
      .run(b.name, b.phone ?? null, b.notes ?? null, new Date().toISOString()).lastInsertRowid;
    audit(db, req.user.id, 'supplier.create', 'supplier', id);
    res.status(201).json({ id });
  }));

  // Enquiries & Customer WhatsApp Registry
  admin.get('/enquiries', requirePermission('enquiries:read'), (req, res) => {
    res.json(db.prepare(\`
      SELECT e.*, p.name AS product_name, p.code AS product_code, v.colour
      FROM enquiries e
      LEFT JOIN products p ON p.id=e.product_id
      LEFT JOIN variants v ON v.id=e.variant_id
      \${req.query.status ? 'WHERE e.status = ?' : ''}
      ORDER BY e.id DESC LIMIT 500
    \`).all(...(req.query.status ? [req.query.status] : [])));
  });

  admin.post('/enquiries', requirePermission('enquiries:write'), wrap((req, res) => {
    const b = parse(z.object({
      productId: z.number().int().nullish(),
      variantId: z.number().int().nullish(),
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(1000).nullish(),
      source: z.string().max(60).nullish()
    }), req.body);

    const ref = \`ENQ-\${crypto.randomBytes(4).toString('hex').toUpperCase()}\`;
    const now = new Date().toISOString();
    const id = db.prepare(\`
      INSERT INTO enquiries (ref, product_id, variant_id, status, source, customer_name, customer_contact, notes, created_at, created_on, confirmed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    \`).run(ref, b.productId ?? null, b.variantId ?? null, 'received', b.source || 'manual', b.customerName ?? null, b.customerContact ?? null, b.notes ?? null, now, localDate(), now).lastInsertRowid;

    audit(db, req.user.id, 'enquiry.create', 'enquiry', id);
    res.status(201).json({ id, ref });
  }));

  admin.patch('/enquiries/:id', requirePermission('enquiries:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const b = parse(z.object({
      status: z.enum(['clicked', 'received', 'converted', 'closed']).optional(),
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(1000).nullish()
    }), req.body);

    const cur = db.prepare('SELECT * FROM enquiries WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Enquiry not found');

    db.prepare(\`
      UPDATE enquiries
      SET status=?, customer_name=?, customer_contact=?, notes=?,
          confirmed_at = CASE WHEN ? = 'received' AND confirmed_at IS NULL THEN ? ELSE confirmed_at END
      WHERE id=?
    \`).run(
      b.status ?? cur.status,
      b.customerName ?? cur.customer_name,
      b.customerContact ?? cur.customer_contact,
      b.notes ?? cur.notes,
      b.status ?? cur.status,
      new Date().toISOString(),
      id
    );

    audit(db, req.user.id, 'enquiry.update', 'enquiry', id, b);
    res.json({ ok: true });
  }));`,
`  // Suppliers
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
    res.json(await db.prepare(\`
      SELECT e.*, p.name AS product_name, p.code AS product_code, v.colour
      FROM enquiries e
      LEFT JOIN products p ON p.id=e.product_id
      LEFT JOIN variants v ON v.id=e.variant_id
      \${req.query.status ? 'WHERE e.status = ?' : ''}
      ORDER BY e.id DESC LIMIT 500
    \`).all(...(req.query.status ? [req.query.status] : [])));
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

    const ref = \`ENQ-\${crypto.randomBytes(4).toString('hex').toUpperCase()}\`;
    const now = new Date().toISOString();
    const resInsert = await db.prepare(\`
      INSERT INTO enquiries (ref, product_id, variant_id, status, source, customer_name, customer_contact, notes, created_at, created_on, confirmed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    \`).run(ref, b.productId ?? null, b.variantId ?? null, 'received', b.source || 'manual', b.customerName ?? null, b.customerContact ?? null, b.notes ?? null, now, localDate(), now);
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

    await db.prepare(\`
      UPDATE enquiries
      SET status=?, customer_name=?, customer_contact=?, notes=?,
          confirmed_at = CASE WHEN ? = 'received' AND confirmed_at IS NULL THEN ? ELSE confirmed_at END
      WHERE id=?
    \`).run(
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
  }));`
);

// 21. Orders
code = code.replace(
`  // Orders
  admin.get('/orders', requirePermission('orders:read'), (req, res) => {
    const w = [];
    const p = [];
    if (req.query.status) { w.push('status = ?'); p.push(req.query.status); }
    if (req.query.from) { w.push('order_date >= ?'); p.push(checkDate(req.query.from)); }
    if (req.query.to) { w.push('order_date <= ?'); p.push(checkDate(req.query.to)); }

    res.json(db.prepare(\`SELECT id FROM orders \${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 500\`)
      .all(...p).map((r) => ord.getOrder(db, r.id)));
  });

  admin.get('/orders/:id', requirePermission('orders:read'), (req, res) => {
    const o = ord.getOrder(db, Number(req.params.id));
    if (!o) throw new HttpError(404, 'Order not found');
    res.json(o);
  });

  admin.post('/orders', requirePermission('orders:write'), wrap((req, res) => {
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

    const id = ord.createOrder(db, { ...b, userId: req.user.id });
    res.status(201).json(ord.getOrder(db, id));
  }));

  admin.patch('/orders/:id', requirePermission('orders:write'), wrap((req, res) => {
    const id = Number(req.params.id);
    const b = parse(z.object({
      customerName: z.string().max(100).nullish(),
      customerContact: z.string().max(100).nullish(),
      notes: z.string().max(1000).nullish()
    }), req.body);

    const cur = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if (!cur) throw new HttpError(404, 'Order not found');

    db.prepare('UPDATE orders SET customer_name=?, customer_contact=?, notes=?, updated_at=? WHERE id=?')
      .run(b.customerName ?? cur.customer_name, b.customerContact ?? cur.customer_contact, b.notes ?? cur.notes, new Date().toISOString(), id);
    audit(db, req.user.id, 'order.update', 'order', id);
    res.json(ord.getOrder(db, id));
  }));

  admin.post('/orders/:id/status', requirePermission('orders:write'), wrap((req, res) => {
    const b = parse(z.object({
      status: z.string(),
      cancelReason: z.string().max(300).optional(),
      date: date.optional()
    }), req.body);
    ord.setOrderStatus(db, Number(req.params.id), b.status, { userId: req.user.id, cancelReason: b.cancelReason, date: b.date });
    res.json(ord.getOrder(db, Number(req.params.id)));
  }));

  admin.post('/orders/:id/payments', requirePermission('orders:write'), wrap((req, res) => {
    const b = parse(z.object({
      kind: z.enum(['payment', 'refund']),
      amount: z.number().positive(),
      paidOn: date.optional(),
      method: z.string().max(40).nullish(),
      note: z.string().max(300).nullish()
    }), req.body);
    ord.addPayment(db, Number(req.params.id), { ...b, userId: req.user.id });
    res.status(201).json(ord.getOrder(db, Number(req.params.id)));
  }));

  admin.post('/orders/:id/items/:itemId/return', requirePermission('orders:write'), wrap((req, res) => {
    const b = parse(z.object({
      quantity: z.number().int().positive(),
      condition: z.enum(['sellable', 'damaged']),
      reason: z.string().max(300).nullish(),
      returnedOn: date.optional()
    }), req.body);
    const it = db.prepare('SELECT order_id FROM order_items WHERE id=? AND order_id=?').get(Number(req.params.itemId), Number(req.params.id));
    if (!it) throw new HttpError(404, 'Order item not found');
    inv.returnItem(db, { orderItemId: Number(req.params.itemId), ...b, reason: b.reason ?? undefined, userId: req.user.id });
    res.json(ord.getOrder(db, Number(req.params.id)));
  }));`,
`  // Orders
  admin.get('/orders', requirePermission('orders:read'), wrap(async (req, res) => {
    const w = [];
    const p = [];
    if (req.query.status) { w.push('status = ?'); p.push(req.query.status); }
    if (req.query.from) { w.push('order_date >= ?'); p.push(checkDate(req.query.from)); }
    if (req.query.to) { w.push('order_date <= ?'); p.push(checkDate(req.query.to)); }

    const rawRows = await db.prepare(\`SELECT id FROM orders \${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 500\`).all(...p);
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
  }));`
);

// 22. Expenses & Savings
code = code.replace(
`  // Expenses & Savings
  admin.get('/expenses', requireRole(['super_admin']), (req, res) => {
    const { from, to } = req.query;
    const w = [];
    const p = [];
    if (from) { w.push('expense_on >= ?'); p.push(checkDate(from)); }
    if (to) { w.push('expense_on <= ?'); p.push(checkDate(to)); }
    res.json(db.prepare(\`SELECT * FROM expenses \${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY expense_on DESC, id DESC LIMIT 1000\`).all(...p));
  });

  admin.post('/expenses', requireRole(['super_admin']), wrap((req, res) => {
    const b = parse(z.object({
      expenseOn: date.optional(),
      category: z.string().min(1).max(40),
      amount: z.number().positive(),
      description: z.string().max(300).nullish(),
      paymentMethod: z.string().max(40).nullish(),
      supplierId: z.number().int().nullish()
    }), req.body);

    const id = db.prepare('INSERT INTO expenses (expense_on, category, amount, description, payment_method, supplier_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(b.expenseOn || localDate(), b.category, b.amount, b.description ?? null, b.paymentMethod ?? null, b.supplierId ?? null, req.user.id, new Date().toISOString()).lastInsertRowid;
    audit(db, req.user.id, 'expense.create', 'expense', id, b);
    res.status(201).json({ id });
  }));

  admin.delete('/expenses/:id', requireRole(['super_admin']), wrap((req, res) => {
    const e = db.prepare('SELECT * FROM expenses WHERE id=?').get(Number(req.params.id));
    if (!e) throw new HttpError(404, 'Expense not found');
    db.prepare('DELETE FROM expenses WHERE id=?').run(e.id);
    audit(db, req.user.id, 'expense.delete', 'expense', e.id, e);
    res.json({ ok: true });
  }));

  admin.get('/savings', requireRole(['super_admin']), (req, res) => {
    res.json({ entries: db.prepare('SELECT * FROM savings_entries ORDER BY entry_on DESC, id DESC LIMIT 500').all(), balance: rep.savingsBalance(db, '9999-12-31') });
  });

  admin.post('/savings', requireRole(['super_admin']), wrap((req, res) => {
    const b = parse(z.object({ entryOn: date.optional(), direction: z.enum(['deposit', 'withdrawal']), amount: z.number().positive(), note: z.string().max(300).nullish() }), req.body);
    const id = db.prepare('INSERT INTO savings_entries (entry_on, direction, amount, note, created_at) VALUES (?,?,?,?,?)')
      .run(b.entryOn || localDate(), b.direction, b.amount, b.note ?? null, new Date().toISOString()).lastInsertRowid;
    audit(db, req.user.id, 'savings.create', 'savings', id, b);
    res.status(201).json({ id });
  }));`,
`  // Expenses & Savings
  admin.get('/expenses', requireRole(['super_admin']), wrap(async (req, res) => {
    const { from, to } = req.query;
    const w = [];
    const p = [];
    if (from) { w.push('expense_on >= ?'); p.push(checkDate(from)); }
    if (to) { w.push('expense_on <= ?'); p.push(checkDate(to)); }
    res.json(await db.prepare(\`SELECT * FROM expenses \${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY expense_on DESC, id DESC LIMIT 1000\`).all(...p));
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
  }));`
);

// 23. Reports, Audit & Export
code = code.replace(
`  // Reports
  admin.get('/reports/overview', requireRole(['super_admin']), (req, res) => {
    const today = localDate();
    const month = today.slice(0, 7);
    const m = rep.monthly(db, month);
    res.json({ today: rep.daily(db, today), month: { ...m, stock_by_variant: undefined } });
  });

  admin.get('/reports/daily', requireRole(['super_admin']), (req, res) => res.json(rep.daily(db, req.query.date || localDate())));
  admin.get('/reports/monthly', requireRole(['super_admin']), (req, res) => res.json(rep.monthly(db, req.query.month || localDate().slice(0, 7))));
  admin.get('/reports/range', requireRole(['super_admin']), (req, res) => {
    const from = checkDate(req.query.from, 'from');
    const to = checkDate(req.query.to, 'to');
    if (from > to) throw new HttpError(400, 'from must not be after to');
    res.json({ financials: rep.financials(db, from, to), stock: rep.stockSummary(db, from, to), inventory_now: rep.inventoryValue(db) });
  });

  // Audit Logs
  admin.get('/audit', (req, res) => {
    const { action, entity, user_id } = req.query;
    const w = [];
    const p = [];
    if (action) { w.push('a.action LIKE ?'); p.push(\`%\${action}%\`); }
    if (entity) { w.push('a.entity = ?'); p.push(entity); }
    if (user_id) { w.push('a.user_id = ?'); p.push(Number(user_id)); }

    res.json(db.prepare(\`
      SELECT a.*, u.email, u.name AS user_name, u.role AS user_role
      FROM audit_logs a
      LEFT JOIN users u ON u.id=a.user_id
      \${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY a.id DESC LIMIT 500
    \`).all(...p));
  });

  // CSV Exports
  const exporters = {
    products: (role) => {
      const canSeeCost = ['super_admin', 'owner', 'inventory_manager'].includes(role);
      const rows = db.prepare(\`
        SELECT p.code, p.name, p.brand, p.model, p.category, p.selling_price, p.original_price, p.status, p.is_active, p.date_added,
               v.sku, v.colour, v.stock_on_hand, v.reserved, v.min_stock \${canSeeCost ? ', v.avg_cost' : ''}
        FROM products p
        JOIN variants v ON v.product_id=p.id
        ORDER BY p.id, v.id
      \`).all();
      return rows;
    },
    'stock-movements': () => db.prepare(\`
      SELECT m.id, m.occurred_at, m.occurred_on, v.sku, m.movement_type, m.quantity_change, m.previous_qty, m.new_qty, m.non_sellable_qty, m.unit_cost, m.reason, m.order_id, m.purchase_id, m.user_id
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      ORDER BY m.id
    \`).all(),
    orders: () => db.prepare(\`
      SELECT o.order_no, o.order_date, o.status, o.customer_name, o.customer_contact, v.sku, oi.quantity, oi.unit_price, oi.line_discount, oi.returned_qty, oi.sold_on, oi.unit_cost_at_sale, o.notes
      FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      JOIN variants v ON v.id=oi.variant_id
      ORDER BY o.id, oi.id
    \`).all(),
    expenses: () => db.prepare('SELECT id, expense_on, category, amount, description, payment_method FROM expenses ORDER BY expense_on, id').all()
  };

  admin.get('/export/:what', (req, res) => {
    const fn = exporters[req.params.what];
    if (!fn) throw new HttpError(404, 'Unknown export');
    if (['expenses', 'stock-movements', 'orders'].includes(req.params.what) && req.user.role === 'marketing_manager') {
      throw new HttpError(403, 'Forbidden: marketing managers cannot export internal financial ledgers');
    }
    audit(db, req.user.id, 'export', 'csv', req.params.what);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': \`attachment; filename="\${req.params.what}-\${localDate()}.csv"\`
    }).send('\\ufeff' + toCsv(fn(req.user.role)));
  });`,
`  // Reports
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
    if (action) { w.push('a.action LIKE ?'); p.push(\`%\${action}%\`); }
    if (entity) { w.push('a.entity = ?'); p.push(entity); }
    if (user_id) { w.push('a.user_id = ?'); p.push(Number(user_id)); }

    res.json(await db.prepare(\`
      SELECT a.*, u.email, u.name AS user_name, u.role AS user_role
      FROM audit_logs a
      LEFT JOIN users u ON u.id=a.user_id
      \${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY a.id DESC LIMIT 500
    \`).all(...p));
  }));

  // CSV Exports
  const exporters = {
    products: async (role) => {
      const canSeeCost = ['super_admin', 'owner', 'inventory_manager'].includes(role);
      const rows = await db.prepare(\`
        SELECT p.code, p.name, p.brand, p.model, p.category, p.selling_price, p.original_price, p.status, p.is_active, p.date_added,
               v.sku, v.colour, v.stock_on_hand, v.reserved, v.min_stock \${canSeeCost ? ', v.avg_cost' : ''}
        FROM products p
        JOIN variants v ON v.product_id=p.id
        ORDER BY p.id, v.id
      \`).all();
      return rows;
    },
    'stock-movements': async () => await db.prepare(\`
      SELECT m.id, m.occurred_at, m.occurred_on, v.sku, m.movement_type, m.quantity_change, m.previous_qty, m.new_qty, m.non_sellable_qty, m.unit_cost, m.reason, m.order_id, m.purchase_id, m.user_id
      FROM stock_movements m
      JOIN variants v ON v.id=m.variant_id
      ORDER BY m.id
    \`).all(),
    orders: async () => await db.prepare(\`
      SELECT o.order_no, o.order_date, o.status, o.customer_name, o.customer_contact, v.sku, oi.quantity, oi.unit_price, oi.line_discount, oi.returned_qty, oi.sold_on, oi.unit_cost_at_sale, o.notes
      FROM orders o
      JOIN order_items oi ON oi.order_id=o.id
      JOIN variants v ON v.id=oi.variant_id
      ORDER BY o.id, oi.id
    \`).all(),
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
      'Content-Disposition': \`attachment; filename="\${req.params.what}-\${localDate()}.csv"\`
    }).send('\\ufeff' + toCsv(data));
  }));`
);

// 24. Global Error handler constraint regex
code = code.replace(
  "if (/SQLITE_CONSTRAINT/.test(String(err.code || err.message))) return res.status(409).json({ error: 'Database constraint violated: ' + err.message });",
  "if (/SQLITE_CONSTRAINT|23505|23503|23514|duplicate key|violates/i.test(String(err.code || err.message))) return res.status(409).json({ error: 'Database constraint violated: ' + err.message });"
);

fs.writeFileSync('server/app.adapted.js', code);
console.log('Final server/app.adapted.js written successfully!');
