// Core stock logic. EVERY change to variants.stock_on_hand goes through recordMovement(),
// so the audit trail (stock_movements) can never drift from the balances.
// Reservations (variants.reserved) are NOT stock movements: units still physically exist.
//   available (sellable now) = stock_on_hand - reserved
const { HttpError, localDate, audit } = require('./util');

function getVariant(db, id) {
  const v = db.prepare(`SELECT v.*, p.is_active AS product_active, p.name AS product_name
    FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`).get(id);
  if (!v) throw new HttpError(404, `Variant ${id} not found`);
  return v;
}

function variantStatus(v) {
  if (!v.is_active || !v.product_active) return 'inactive';
  const available = v.stock_on_hand - v.reserved;
  if (available <= 0) return 'out_of_stock';
  if (available <= v.min_stock) return 'low_stock'; // "at or below the reorder level"
  return 'in_stock';
}

function recordMovement(db, { variantId, type, delta, reason = null, unitCost = null, orderId = null,
  purchaseId = null, userId = null, nonSellable = 0, occurredOn }) {
  const v = getVariant(db, variantId);
  const prev = v.stock_on_hand;
  const next = prev + delta;
  if (next < 0) throw new HttpError(409, `Not enough stock for ${v.sku}: have ${prev}, change ${delta}`);
  if (next < v.reserved) {
    throw new HttpError(409, `Would drop ${v.sku} below its ${v.reserved} reserved unit(s)`);
  }
  db.prepare('UPDATE variants SET stock_on_hand = ? WHERE id = ?').run(next, variantId);
  const now = new Date();
  db.prepare(`INSERT INTO stock_movements (occurred_at, occurred_on, product_id, variant_id, movement_type,
    quantity_change, previous_qty, new_qty, non_sellable_qty, unit_cost, reason, order_id, purchase_id, user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(now.toISOString(), occurredOn || localDate(now), v.product_id,
    variantId, type, delta, prev, next, nonSellable, unitCost, reason, orderId, purchaseId, userId);
  return { previous: prev, next };
}

const posInt = (n, name) => {
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} must be a positive whole number`);
  return n;
};
const needReason = (r) => {
  if (!r || !String(r).trim()) throw new HttpError(400, 'A reason is required for this stock change');
  return String(r).trim();
};

// Supplier purchase: increases stock, updates weighted-average cost, records cash paid out.
function receiveStock(db, { supplierId = null, receivedOn, items, paidAmount, reference, notes, userId }) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'items required');
  return db.transaction(() => {
    const on = receivedOn || localDate();
    let total = 0; let anyCost = false;
    for (const it of items) {
      posInt(it.quantity, 'quantity');
      if (it.unitCost != null && !(it.unitCost >= 0)) throw new HttpError(400, 'unitCost must be >= 0');
      if (it.unitCost != null) { total += it.quantity * it.unitCost; anyCost = true; }
    }
    const paid = paidAmount != null ? paidAmount : total; // default: paid in full for costed lines
    if (!(paid >= 0)) throw new HttpError(400, 'paidAmount must be >= 0');
    const pid = db.prepare(`INSERT INTO purchases (supplier_id, received_on, reference, notes, total_cost,
      paid_amount, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(supplierId, on, reference || null, notes || null, anyCost ? total : null, paid, userId,
        new Date().toISOString()).lastInsertRowid;
    for (const it of items) {
      const v = getVariant(db, it.variantId);
      if (it.unitCost != null) {
        const avg = (v.avg_cost == null || v.stock_on_hand <= 0) ? it.unitCost
          : (v.stock_on_hand * v.avg_cost + it.quantity * it.unitCost) / (v.stock_on_hand + it.quantity);
        db.prepare('UPDATE variants SET avg_cost = ? WHERE id = ?').run(Math.round(avg * 10000) / 10000, v.id);
      }
      recordMovement(db, { variantId: v.id, type: 'purchase_received', delta: it.quantity, unitCost: it.unitCost ?? null,
        reason: reference ? `Purchase ${reference}` : 'Stock received', purchaseId: pid, userId, occurredOn: on });
    }
    audit(db, userId, 'stock.receive', 'purchase', pid, { items });
    return pid;
  })();
}

// Manual correction to a physical count. Reason mandatory; history preserved.
function adjustStock(db, { variantId, newQuantity, reason, userId }) {
  return db.transaction(() => {
    needReason(reason);
    if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new HttpError(400, 'newQuantity must be a whole number >= 0');
    const v = getVariant(db, variantId);
    const delta = newQuantity - v.stock_on_hand;
    if (delta === 0) throw new HttpError(400, 'Counted quantity equals recorded quantity; nothing to adjust');
    recordMovement(db, { variantId, type: 'manual_correction', delta, reason: String(reason).trim(), userId });
    audit(db, userId, 'stock.adjust', 'variant', variantId, { from: v.stock_on_hand, to: newQuantity, reason });
    return { previous: v.stock_on_hand, next: newQuantity };
  })();
}

function removeStock(db, { variantId, quantity, type, reason, userId }) {
  if (!['damage_loss', 'supplier_return'].includes(type)) throw new HttpError(400, 'bad type');
  return db.transaction(() => {
    posInt(quantity, 'quantity'); needReason(reason);
    recordMovement(db, { variantId, type, delta: -quantity, reason: String(reason).trim(), userId });
    audit(db, userId, `stock.${type}`, 'variant', variantId, { quantity, reason });
  })();
}

// Reconcile physical counts: only discrepancies are adjusted; each needs a reason.
function reconcile(db, { counts, userId }) {
  return db.transaction(() => {
    const out = [];
    for (const c of counts) {
      const v = getVariant(db, c.variantId);
      if (v.stock_on_hand === c.counted) { out.push({ variantId: c.variantId, changed: false }); continue; }
      adjustStock(db, { variantId: c.variantId, newQuantity: c.counted, reason: c.reason, userId });
      out.push({ variantId: c.variantId, changed: true, from: v.stock_on_hand, to: c.counted });
    }
    return out;
  })();
}

// ---- order-driven stock states (idempotent: guarded by order_items.stock_state) ----
function reserveItem(db, item) {
  if (item.stock_state === 'reserved' || item.stock_state === 'sold') return;
  const v = getVariant(db, item.variant_id);
  if (!v.is_active || !v.product_active) throw new HttpError(409, `${v.sku} is inactive`);
  if (v.stock_on_hand - v.reserved < item.quantity) {
    throw new HttpError(409, `Not enough available stock for ${v.sku} (available ${v.stock_on_hand - v.reserved}, needed ${item.quantity})`);
  }
  db.prepare('UPDATE variants SET reserved = reserved + ? WHERE id = ?').run(item.quantity, item.variant_id);
  db.prepare("UPDATE order_items SET stock_state = 'reserved' WHERE id = ?").run(item.id);
  item.stock_state = 'reserved';
}

function releaseItem(db, item) {
  if (item.stock_state !== 'reserved') return;
  db.prepare('UPDATE variants SET reserved = reserved - ? WHERE id = ?').run(item.quantity, item.variant_id);
  db.prepare("UPDATE order_items SET stock_state = 'released' WHERE id = ?").run(item.id);
  item.stock_state = 'released';
}

function sellItem(db, item, { orderId, userId, soldOn }) {
  if (item.stock_state === 'sold') return;
  reserveItem(db, item);
  const v = getVariant(db, item.variant_id);
  db.prepare('UPDATE variants SET reserved = reserved - ? WHERE id = ?').run(item.quantity, item.variant_id);
  recordMovement(db, { variantId: item.variant_id, type: 'sale', delta: -item.quantity, orderId, userId,
    reason: `Sale (order ${orderId})`, occurredOn: soldOn, unitCost: v.avg_cost });
  db.prepare("UPDATE order_items SET stock_state = 'sold', unit_cost_at_sale = ?, sold_on = ? WHERE id = ?")
    .run(v.avg_cost, soldOn, item.id);
  item.stock_state = 'sold';
}

function returnItem(db, { orderItemId, quantity, condition, reason, userId, returnedOn }) {
  return db.transaction(() => {
    posInt(quantity, 'quantity');
    if (!['sellable', 'damaged'].includes(condition)) throw new HttpError(400, "condition must be 'sellable' or 'damaged'");
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(orderItemId);
    if (!item) throw new HttpError(404, 'Order item not found');
    if (item.stock_state !== 'sold') throw new HttpError(409, 'Only items that were sold can be returned');
    if (quantity > item.quantity - item.returned_qty) throw new HttpError(409, 'Return quantity exceeds units sold');
    const on = returnedOn || localDate();
    const netUnit = (item.quantity * item.unit_price - item.line_discount) / item.quantity;
    const refundValue = Math.round(netUnit * quantity * 100) / 100;
    if (condition === 'sellable') {
      recordMovement(db, { variantId: item.variant_id, type: 'customer_return', delta: quantity, orderId: item.order_id,
        reason: reason || 'Customer return (sellable)', userId, occurredOn: on });
    } else {
      recordMovement(db, { variantId: item.variant_id, type: 'customer_return_damaged', delta: 0, nonSellable: quantity,
        orderId: item.order_id, reason: reason || 'Customer return (damaged, not restocked)', userId, occurredOn: on });
    }
    db.prepare('UPDATE order_items SET returned_qty = returned_qty + ? WHERE id = ?').run(quantity, item.id);
    db.prepare(`INSERT INTO returns (order_item_id, quantity, condition, returned_on, refund_value, reason, user_id, created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(item.id, quantity, condition, on, refundValue, reason || null, userId, new Date().toISOString());
    const rem = db.prepare(`SELECT SUM(quantity - returned_qty) AS left FROM order_items
      WHERE order_id = ? AND stock_state = 'sold'`).get(item.order_id).left;
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .run(rem === 0 ? 'returned' : 'partially_returned', new Date().toISOString(), item.order_id);
    audit(db, userId, 'order.return', 'order_item', item.id, { quantity, condition, refundValue });
    return { refundValue };
  })();
}

module.exports = { getVariant, variantStatus, recordMovement, receiveStock, adjustStock, removeStock, reconcile,
  reserveItem, releaseItem, sellItem, returnItem };
