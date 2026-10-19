// Order workflow and the ONE stock policy:
//   enquiry / pending   -> no stock effect
//   confirmed / processing / ready -> units RESERVED (still on hand, but not available to others)
//   completed (handed over)        -> units SOLD: stock_on_hand drops, a 'sale' movement is written,
//                                     cost-at-sale and sale date are captured
//   cancelled (before completion)  -> reservation released, nothing sold
//   returns (after completion)     -> restocked only if returned 'sellable'; 'damaged' is not restocked
// Each order item carries stock_state (none/reserved/sold/released), so repeating a status
// update can never deduct or reserve twice.
const inv = require('./inventory');
const { HttpError, localDate, audit, round2 } = require('./util');

const STATUSES = ['enquiry', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled',
  'partially_returned', 'returned'];
const RESERVING = ['confirmed', 'processing', 'ready'];

function itemPrice(db, it) {
  if (it.unitPrice != null) return it.unitPrice;
  const row = db.prepare(`SELECT v.price_override, p.selling_price FROM variants v JOIN products p ON p.id = v.product_id
    WHERE v.id = ?`).get(it.variantId);
  const price = row && (row.price_override ?? row.selling_price);
  if (price == null) throw new HttpError(400, 'No price known for this watch; enter the unit price (missing prices are never treated as zero)');
  return price;
}

function createOrder(db, { customerName, customerContact, orderDate, items, notes, enquiryId, status = 'pending', userId }) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'At least one item is required');
  return db.transaction(() => {
    const now = new Date().toISOString();
    const id = db.prepare(`INSERT INTO orders (order_no, order_date, customer_name, customer_contact, status, notes,
      enquiry_id, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(`TMP-${Math.random()}`, orderDate || localDate(), customerName || null, customerContact || null, 'pending',
        notes || null, enquiryId || null, userId, now, now).lastInsertRowid;
    db.prepare('UPDATE orders SET order_no = ? WHERE id = ?').run(`TT-${String(id).padStart(5, '0')}`, id);
    for (const it of items) {
      if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new HttpError(400, 'quantity must be a positive whole number');
      const v = inv.getVariant(db, it.variantId);
      const price = itemPrice(db, it);
      const disc = it.lineDiscount || 0;
      if (disc < 0 || disc > price * it.quantity) throw new HttpError(400, 'Invalid discount');
      db.prepare(`INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, line_discount)
        VALUES (?,?,?,?,?,?)`).run(id, v.product_id, v.id, it.quantity, price, disc);
    }
    if (enquiryId) {
      db.prepare("UPDATE enquiries SET status = 'converted', order_id = ?, confirmed_at = COALESCE(confirmed_at, ?) WHERE id = ?")
        .run(id, now, enquiryId);
    }
    audit(db, userId, 'order.create', 'order', id, { items });
    if (status !== 'pending') setOrderStatus(db, id, status, { userId });
    return id;
  })();
}

function setOrderStatus(db, orderId, newStatus, { userId, cancelReason, date } = {}) {
  if (!STATUSES.includes(newStatus) || ['partially_returned', 'returned'].includes(newStatus)) {
    throw new HttpError(400, 'Invalid status (returns are recorded through the return action)');
  }
  return db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new HttpError(404, 'Order not found');
    if (order.status === newStatus) return order; // repeated update: no-op
    if (['completed', 'partially_returned', 'returned'].includes(order.status)) {
      throw new HttpError(409, 'A completed order cannot change status; record a return instead');
    }
    if (order.status === 'cancelled') throw new HttpError(409, 'A cancelled order cannot be reopened; create a new order');
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const on = date || localDate();
    if (RESERVING.includes(newStatus)) items.forEach((i) => inv.reserveItem(db, i));
    else if (newStatus === 'completed') {
      items.forEach((i) => inv.sellItem(db, i, { orderId, userId, soldOn: on }));
    } else items.forEach((i) => inv.releaseItem(db, i)); // enquiry, pending, cancelled
    if (newStatus === 'cancelled' && !(cancelReason && cancelReason.trim())) {
      throw new HttpError(400, 'A cancellation reason is required');
    }
    db.prepare(`UPDATE orders SET status = ?, cancel_reason = ?, completed_on = ?, updated_at = ? WHERE id = ?`)
      .run(newStatus, newStatus === 'cancelled' ? cancelReason.trim() : order.cancel_reason,
        newStatus === 'completed' ? on : order.completed_on, new Date().toISOString(), orderId);
    audit(db, userId, 'order.status', 'order', orderId, { from: order.status, to: newStatus });
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  })();
}

function addPayment(db, orderId, { kind, amount, paidOn, method, note, userId }) {
  if (!['payment', 'refund'].includes(kind)) throw new HttpError(400, "kind must be 'payment' or 'refund'");
  if (!(amount > 0)) throw new HttpError(400, 'amount must be greater than zero');
  if (!db.prepare('SELECT 1 FROM orders WHERE id = ?').get(orderId)) throw new HttpError(404, 'Order not found');
  const id = db.prepare(`INSERT INTO payments (order_id, kind, amount, paid_on, method, note, user_id, created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(orderId, kind, amount, paidOn || localDate(), method || null, note || null, userId,
    new Date().toISOString()).lastInsertRowid;
  audit(db, userId, `payment.${kind}`, 'order', orderId, { amount });
  return id;
}

// Payment status is derived from the owner's recorded payment entries (it is a record, not proof of payment).
function getOrder(db, id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!o) return null;
  const items = db.prepare(`SELECT oi.*, p.name AS product_name, p.code AS product_code, v.colour, v.sku
    FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN variants v ON v.id = oi.variant_id
    WHERE oi.order_id = ?`).all(id)
    .map((i) => ({ ...i, line_total: round2(i.quantity * i.unit_price - i.line_discount) }));
  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id').all(id);
  const total = round2(items.reduce((s, i) => s + i.line_total, 0));
  const returned = db.prepare(`SELECT COALESCE(SUM(r.refund_value),0) AS v FROM returns r
    JOIN order_items oi ON oi.id = r.order_item_id WHERE oi.order_id = ?`).get(id).v;
  const received = payments.filter((p) => p.kind === 'payment').reduce((s, p) => s + p.amount, 0);
  const refunded = payments.filter((p) => p.kind === 'refund').reduce((s, p) => s + p.amount, 0);
  const net = round2(received - refunded);
  const due = round2(total - returned);
  let payment_status = 'unpaid';
  if (refunded > 0 && net <= 0) payment_status = 'refunded';
  else if (net <= 0) payment_status = 'unpaid';
  else if (net >= due - 0.005) payment_status = 'paid';
  else payment_status = 'partially_paid';
  return { ...o, items, payments, total, returned_value: round2(returned), net_received: net,
    balance_due: round2(Math.max(0, due - net)), payment_status };
}

module.exports = { STATUSES, createOrder, setOrderStatus, addPayment, getOrder };
