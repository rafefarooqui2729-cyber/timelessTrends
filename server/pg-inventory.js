
const { HttpError } = require('./util');
const { withTransaction, audit } = require('./pg-database');

async function getVariant(db, id, { forUpdate = false } = {}) {
  const variantId = Number(id);

  if (!Number.isInteger(variantId) || variantId <= 0) {
    throw new HttpError(400, 'Invalid variant ID');
  }

  const result = await db.query(
    `SELECT
       v.*,
       p.name AS product_name,
       p.is_active AS product_active
     FROM variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.id = $1
     ${forUpdate ? 'FOR UPDATE OF v' : ''}`,
    [variantId]
  );

  if (!result.rows.length) {
    throw new HttpError(404, 'Variant not found');
  }

  return result.rows[0];
}

function variantStatus(variant) {
  if (
    Number(variant.is_active) !== 1 ||
    Number(variant.product_active) !== 1
  ) {
    return 'inactive';
  }

  const available =
    Number(variant.stock_on_hand) - Number(variant.reserved);

  if (available <= 0) return 'out_of_stock';
  if (available <= Number(variant.min_stock)) return 'low_stock';

  return 'in_stock';
}

async function recordMovement(db, {
  variantId,
  type,
  delta,
  reason = null,
  unitCost = null,
  orderId = null,
  purchaseId = null,
  userId = null,
  nonSellable = 0,
  occurredOn,
}) {
  if (!Number.isInteger(delta)) {
    throw new HttpError(400, 'Stock change must be a whole number');
  }

  if (!Number.isInteger(nonSellable) || nonSellable < 0) {
    throw new HttpError(400, 'Non-sellable quantity must be a non-negative whole number');
  }

  if (
    unitCost != null &&
    (!Number.isFinite(Number(unitCost)) || Number(unitCost) < 0)
  ) {
    throw new HttpError(400, 'Unit cost must be a non-negative number');
  }

  const damagedReturnWithoutRestock =
    type === 'customer_return_damaged' &&
    delta === 0 &&
    nonSellable > 0;

  if (
    nonSellable > Math.max(0, delta) &&
    !damagedReturnWithoutRestock
  ) {
    throw new HttpError(400, 'Non-sellable quantity cannot exceed stock received');
  }

  const execute = async (client) => {
    const variant = await getVariant(client, variantId, {
      forUpdate: true,
    });

    const previous = Number(variant.stock_on_hand);
    const reserved = Number(variant.reserved);
    const next = previous + delta;

    if (next < 0) {
      throw new HttpError(409, 'Insufficient stock for this movement');
    }

    if (next < reserved) {
      throw new HttpError(409, 'Stock cannot be reduced below reserved quantity');
    }

    await client.query(
      'UPDATE variants SET stock_on_hand = $1 WHERE id = $2',
      [next, variant.id]
    );

    const now = new Date().toISOString();
    const on = occurredOn || now.slice(0, 10);

    const inserted = await client.query(
      `INSERT INTO stock_movements (
         occurred_at, occurred_on, product_id, variant_id,
         movement_type, quantity_change, previous_qty, new_qty,
         non_sellable_qty, unit_cost, reason, order_id, purchase_id, user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        now,
        on,
        variant.product_id,
        variant.id,
        type,
        delta,
        previous,
        next,
        nonSellable,
        unitCost,
        reason,
        orderId,
        purchaseId,
        userId,
      ]
    );

    await audit(client, userId, 'stock.movement', 'variant', variant.id, {
      movementType: type,
      quantityChange: delta,
      previous,
      next,
      reason,
    });

    return {
      movementId: inserted.rows[0].id,
      variantId: variant.id,
      previous,
      next,
      quantityChange: delta,
    };
  };

  if (typeof db?.release === 'function') {
    return execute(db);
  }

  return withTransaction(execute);
}

async function adjustStock(db, {
  variantId,
  newQuantity,
  reason,
  userId = null,
  occurredOn,
}) {
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new HttpError(400, 'New stock quantity must be a non-negative whole number');
  }

  if (typeof reason !== 'string' || !reason.trim()) {
    throw new HttpError(400, 'A reason is required for stock adjustment');
  }

  const execute = async (client) => {
    const variant = await getVariant(client, variantId, {
      forUpdate: true,
    });

    const previous = Number(variant.stock_on_hand);
    const delta = newQuantity - previous;

    if (delta === 0) {
      return {
        variantId: variant.id,
        previous,
        next: previous,
        quantityChange: 0,
        unchanged: true,
      };
    }

    const movement = await recordMovement(client, {
      variantId: variant.id,
      type: 'manual_correction',
      delta,
      reason: reason.trim(),
      userId,
      occurredOn,
    });

    await audit(
      client,
      userId,
      'stock.adjust',
      'variant',
      variant.id,
      {
        previous,
        next: newQuantity,
        quantityChange: delta,
        reason: reason.trim(),
      }
    );

    return movement;
  };

  if (typeof db?.release === 'function') {
    return execute(db);
  }

  return withTransaction(execute);
}


async function removeStock(db, {
  variantId,
  quantity,
  type,
  reason,
  userId = null,
  occurredOn,
}) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new HttpError(400, 'Removal quantity must be a positive whole number');
  }

  if (!['damage_loss', 'supplier_return'].includes(type)) {
    throw new HttpError(400, 'Removal type must be damage_loss or supplier_return');
  }

  if (typeof reason !== 'string' || !reason.trim()) {
    throw new HttpError(400, 'A reason is required for stock removal');
  }

  const execute = async (client) => {
    const variant = await getVariant(client, variantId, {
      forUpdate: true,
    });

    const movement = await recordMovement(client, {
      variantId: variant.id,
      type,
      delta: -quantity,
      reason: reason.trim(),
      userId,
      occurredOn,
    });

    await audit(
      client,
      userId,
      'stock.remove',
      'variant',
      variant.id,
      {
        movementType: type,
        quantityRemoved: quantity,
        previous: movement.previous,
        next: movement.next,
        reason: reason.trim(),
      }
    );

    return movement;
  };

  if (typeof db?.release === 'function') {
    return execute(db);
  }

  return withTransaction(execute);
}

async function receiveStock(db, {
  supplierId = null,
  receivedOn,
  items,
  paidAmount,
  reference = null,
  notes = null,
  userId = null,
  offerId = undefined,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'At least one stock item is required');
  }

  let totalCost = 0;
  let hasCost = false;

  for (const item of items) {
    if (!Number.isInteger(item.variantId) || item.variantId <= 0) {
      throw new HttpError(400, 'Invalid variant ID');
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new HttpError(400, 'Quantity must be a positive whole number');
    }

    if (item.unitCost != null) {
      const cost = Number(item.unitCost);

      if (!Number.isFinite(cost) || cost < 0) {
        throw new HttpError(400, 'Unit cost must be non-negative');
      }

      totalCost += item.quantity * cost;
      hasCost = true;
    }
  }

  totalCost = Math.round(totalCost * 100) / 100;

  const paid = paidAmount == null
    ? totalCost
    : Number(paidAmount);

  if (!Number.isFinite(paid) || paid < 0) {
    throw new HttpError(400, 'Invalid paid amount');
  }

  if (hasCost && paid > totalCost) {
    throw new HttpError(400, 'Paid amount cannot exceed purchase total');
  }

  const date = receivedOn || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'Invalid received date');
  }

  const execute = async (client) => {
    const now = new Date().toISOString();

    const purchaseResult = await client.query(
      `INSERT INTO purchases (
        supplier_id,
        received_on,
        reference,
        notes,
        total_cost,
        paid_amount,
        created_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        supplierId,
        date,
        reference?.trim() || null,
        notes?.trim() || null,
        hasCost ? totalCost : null,
        Math.round(paid * 100) / 100,
        userId,
        now,
      ]
    );

    const purchaseId = purchaseResult.rows[0].id;

    for (const item of items) {
      const variant = await getVariant(client, item.variantId, {
        forUpdate: true,
      });

      const oldQuantity = Number(variant.stock_on_hand);

      const oldAverageCost = variant.avg_cost == null
        ? null
        : Number(variant.avg_cost);

      if (item.unitCost != null) {
        const cost = Number(item.unitCost);
        const newQuantity = oldQuantity + item.quantity;

        const newAverageCost = (oldQuantity <= 0 || oldAverageCost == null)
          ? cost
          : (
              oldQuantity * oldAverageCost +
              item.quantity * cost
            ) / newQuantity;

        await client.query(
          'UPDATE variants SET avg_cost = $1 WHERE id = $2',
          [
            Math.round(newAverageCost * 10000) / 10000,
            variant.id,
          ]
        );
      }

      await recordMovement(client, {
        variantId: variant.id,
        type: 'purchase_received',
        delta: item.quantity,
        unitCost: item.unitCost == null
          ? null
          : Number(item.unitCost),
        reason: reference
          ? `Purchase ${reference}`
          : 'Stock received',
        purchaseId,
        userId,
        occurredOn: date,
      });
    }

        if (offerId !== undefined) {
      if (items.length !== 1) {
        throw new HttpError(400, 'An offer can only be applied to one watch per stock receipt');
      }

      const variant = await getVariant(client, items[0].variantId);

      const offer = await client.query(
        `SELECT id FROM offers
         WHERE id = $1
           AND is_active = 1
           AND (start_date IS NULL OR start_date <= CURRENT_DATE)
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)`,
        [offerId]
      );

      if (offer.rows.length === 0) {
        throw new HttpError(400, 'Selected offer is unavailable or expired');
      }

      await client.query(
        'UPDATE products SET offer_id = $1, updated_at = NOW() WHERE id = $2',
        [offerId, variant.product_id]
      );

      await audit(
        client,
        userId,
        'product.offer_apply',
        'product',
        variant.product_id,
        { offerId, purchaseId }
      );
    }
    
    await audit(
      client,
      userId,
      'stock.receive',
      'purchase',
      purchaseId,
      { items }
    );

    return purchaseId;
  };

  if (typeof db?.release === 'function') {
    return execute(db);
  }

  return withTransaction(execute);
}

async function reconcile(db, { counts, userId }) {
  const execute = async (client) => {
    const out = [];
    for (const c of counts) {
      const v = await getVariant(client, c.variantId);
      if (Number(v.stock_on_hand) === Number(c.counted)) {
        out.push({ variantId: c.variantId, changed: false });
        continue;
      }
      await adjustStock(client, {
        variantId: c.variantId,
        newQuantity: c.counted,
        reason: c.reason,
        userId,
      });
      out.push({
        variantId: c.variantId,
        changed: true,
        from: Number(v.stock_on_hand),
        to: Number(c.counted),
      });
    }
    return out;
  };

  if (typeof db?.release === 'function') {
    return execute(db);
  }

  return withTransaction(execute);
}

module.exports = {
  getVariant,
  variantStatus,
  recordMovement,
  adjustStock,
  removeStock,
  receiveStock,
  reconcile,
  returnItem: (db, args) => require('./pg-orders').returnItem(db, args),
};



