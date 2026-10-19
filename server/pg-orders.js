/**
 * Reuse a supplied PostgreSQL transaction client.
 * Otherwise, start and manage a new transaction.
 */
function runTransaction(db, callback) {
  if (
    db &&
    typeof db.query === 'function' &&
    typeof db.release === 'function'
  ) {
    return callback(db);
  }

  return withTransaction(callback);
}
const { randomUUID } = require('node:crypto');
const {
  withTransaction,
  query,
  audit,
} = require('./pg-database');const inv = require('./pg-inventory');
const config = require('./config');

const STATUSES = [
  'enquiry',
  'pending',
  'confirmed',
  'processing',
  'ready',
  'completed',
  'cancelled',
  'partially_returned',
  'returned',
];

const RESERVING = ['confirmed', 'processing', 'ready'];
const RETURN_STATUSES = ['partially_returned', 'returned'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function positiveId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return n;
}

function money(value, field, { allowZero = true } = {}) {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    (!allowZero && n === 0)
  ) {
    throw new HttpError(400, `${field} must be a valid ${allowZero ? 'non-negative' : 'positive'} amount`);
  }
  return round2(n);
}

async function itemPrice(db, item) {
  if (item.unitPrice != null) {
    return money(item.unitPrice, 'unitPrice');
  }

  const result = await db.query(
    `SELECT v.price_override, p.selling_price
       FROM variants v
       JOIN products p ON p.id = v.product_id
      WHERE v.id = $1`,
    [positiveId(item.variantId, 'variantId')]
  );

  const row = result.rows[0];
  const price = row && (row.price_override ?? row.selling_price);

  if (price == null) {
    throw new HttpError(
      400,
      'No price is configured for this watch. Enter a unit price; missing prices are never treated as zero.'
    );
  }

  return money(price, 'unit price');
}

async function reserveItem(db, item) {
  if (item.stock_state === 'reserved' || item.stock_state === 'sold') {
    return;
  }

  const variant = await inv.getVariant(db, item.variant_id, {
    forUpdate: true,
  });

  if (!variant.is_active || !variant.product_active) {
    throw new HttpError(409, `${variant.sku} is inactive`);
  }

  const available = Number(variant.stock_on_hand) - Number(variant.reserved);

  if (available < Number(item.quantity)) {
    throw new HttpError(
      409,
      `Not enough available stock for ${variant.sku} (available ${available}, needed ${item.quantity})`
    );
  }

  await db.query(
    'UPDATE variants SET reserved = reserved + $1 WHERE id = $2',
    [item.quantity, item.variant_id]
  );

  await db.query(
    "UPDATE order_items SET stock_state = 'reserved' WHERE id = $1",
    [item.id]
  );

  item.stock_state = 'reserved';
}

async function releaseItem(db, item) {
  if (item.stock_state !== 'reserved') {
    return;
  }

  const result = await db.query(
    `UPDATE variants
        SET reserved = reserved - $1
      WHERE id = $2 AND reserved >= $1
      RETURNING id`,
    [item.quantity, item.variant_id]
  );

  if (result.rowCount !== 1) {
    throw new HttpError(409, 'Reserved stock is inconsistent; the order was not changed');
  }

  await db.query(
    "UPDATE order_items SET stock_state = 'released' WHERE id = $1",
    [item.id]
  );

  item.stock_state = 'released';
}

async function sellItem(db, item, { orderId, userId, soldOn }) {
  if (item.stock_state === 'sold') {
    return;
  }

  await reserveItem(db, item);

  const variant = await inv.getVariant(db, item.variant_id, {
    forUpdate: true,
  });

  const reservedUpdate = await db.query(
    `UPDATE variants
        SET reserved = reserved - $1
      WHERE id = $2 AND reserved >= $1
      RETURNING id`,
    [item.quantity, item.variant_id]
  );

  if (reservedUpdate.rowCount !== 1) {
    throw new HttpError(409, 'Reserved stock is inconsistent; the sale was not completed');
  }

  await inv.recordMovement(db, {
    variantId: item.variant_id,
    type: 'sale',
    delta: -Number(item.quantity),
    orderId,
    userId,
    reason: `Sale (order ${orderId})`,
    occurredOn: soldOn,
    unitCost: variant.avg_cost,
  });

  await db.query(
    `UPDATE order_items
        SET stock_state = 'sold',
            unit_cost_at_sale = $1,
            sold_on = $2
      WHERE id = $3`,
    [variant.avg_cost, soldOn, item.id]
  );

  item.stock_state = 'sold';
}

async function setOrderStatusInTransaction(db, orderId, newStatus, {
  userId,
  cancelReason,
  date,
} = {}) {
  if (!STATUSES.includes(newStatus) || RETURN_STATUSES.includes(newStatus)) {
    throw new HttpError(
      400,
      'Invalid status. Returns must be recorded through the return action.'
    );
  }

  const orderResult = await db.query(
    'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
    [orderId]
  );

  const order = orderResult.rows[0];

  if (!order) {
    throw new HttpError(404, 'Order not found');
  }

  if (order.status === newStatus) {
    return order;
  }

  if (['completed', ...RETURN_STATUSES].includes(order.status)) {
    throw new HttpError(
      409,
      'A completed order cannot change status; record a return instead'
    );
  }

  if (order.status === 'cancelled') {
    throw new HttpError(
      409,
      'A cancelled order cannot be reopened; create a new order'
    );
  }

  if (newStatus === 'cancelled' && !(cancelReason && cancelReason.trim())) {
    throw new HttpError(400, 'A cancellation reason is required');
  }

  const itemsResult = await db.query(
    'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id FOR UPDATE',
    [orderId]
  );

  const items = itemsResult.rows;
  const on = date || localDate();

  if (RESERVING.includes(newStatus)) {
    for (const item of items) {
      await reserveItem(db, item);
    }
  } else if (newStatus === 'completed') {
    for (const item of items) {
      await sellItem(db, item, { orderId, userId, soldOn: on });
    }
  } else {
    for (const item of items) {
      await releaseItem(db, item);
    }
  }

  const updatedAt = new Date().toISOString();

  await db.query(
    `UPDATE orders
        SET status = $1,
            cancel_reason = $2,
            completed_on = $3,
            updated_at = $4
      WHERE id = $5`,
    [
      newStatus,
      newStatus === 'cancelled'
        ? cancelReason.trim()
        : order.cancel_reason,
      newStatus === 'completed' ? on : order.completed_on,
      updatedAt,
      orderId,
    ]
  );

  await audit(db, userId, 'order.status', 'order', orderId, {
    from: order.status,
    to: newStatus,
  });

  const updated = await db.query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId]
  );

  return updated.rows[0];
}

async function createOrder(db, {
  customerName,
  customerContact,
  orderDate,
  items,
  notes,
  enquiryId,
  status = 'pending',
  userId,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'At least one item is required');
  }

  if (!STATUSES.includes(status) || RETURN_STATUSES.includes(status)) {
    throw new HttpError(400, 'Invalid initial order status');
  }

  return runTransaction(db, async (client) => {
    const now = new Date().toISOString();
    const temporaryOrderNo = `TMP-${randomUUID()}`;

    const inserted = await client.query(
      `INSERT INTO orders
        (order_no, order_date, customer_name, customer_contact,
         status, notes, enquiry_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $8)
       RETURNING id`,
      [
        temporaryOrderNo,
        orderDate || localDate(),
        customerName || null,
        customerContact || null,
        notes || null,
        enquiryId == null ? null : positiveId(enquiryId, 'enquiryId'),
        userId ?? null,
        now,
      ]
    );

    const id = Number(inserted.rows[0].id);
    const orderNo = `TT-${String(id).padStart(5, '0')}`;

    await client.query(
      'UPDATE orders SET order_no = $1 WHERE id = $2',
      [orderNo, id]
    );

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new HttpError(400, 'quantity must be a positive whole number');
      }

      const variant = await inv.getVariant(
        client,
        positiveId(item.variantId, 'variantId'),
        { forUpdate: true }
      );

      const price = await itemPrice(client, item);
      const discount = money(item.lineDiscount ?? 0, 'lineDiscount');

      if (discount > price * quantity) {
        throw new HttpError(400, 'Discount cannot exceed the item total');
      }

      await client.query(
        `INSERT INTO order_items
          (order_id, product_id, variant_id, quantity, unit_price, line_discount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, variant.product_id, variant.id, quantity, price, discount]
      );
    }

    if (enquiryId != null) {
      const enquiry = await client.query(
        `UPDATE enquiries
            SET status = 'converted',
                order_id = $1,
                confirmed_at = COALESCE(confirmed_at, $2)
          WHERE id = $3
          RETURNING id`,
        [id, now, positiveId(enquiryId, 'enquiryId')]
      );

      if (enquiry.rowCount !== 1) {
        throw new HttpError(404, 'Enquiry not found');
      }
    }

    await audit(client, userId, 'order.create', 'order', id, { items });

    if (status !== 'pending') {
      await setOrderStatusInTransaction(client, id, status, { userId });
    }

    return id;
  });
}

async function setOrderStatus(db, orderId, newStatus, options = {}) {
  return runTransaction(db, (client) =>
    setOrderStatusInTransaction(
      client,
      positiveId(orderId, 'orderId'),
      newStatus,
      options
    )
  );
}

async function addPayment(db, orderId, {
  kind,
  amount,
  paidOn,
  method,
  note,
  userId,
}) {
  if (!['payment', 'refund'].includes(kind)) {
    throw new HttpError(400, "kind must be 'payment' or 'refund'");
  }

  const validAmount = money(amount, 'amount', { allowZero: false });
  const id = positiveId(orderId, 'orderId');

  return runTransaction(db, async (client) => {
    const order = await client.query(
      'SELECT id FROM orders WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (!order.rowCount) {
      throw new HttpError(404, 'Order not found');
    }

    const inserted = await client.query(
      `INSERT INTO payments
        (order_id, kind, amount, paid_on, method, note, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        id,
        kind,
        validAmount,
        paidOn || localDate(),
        method || null,
        note || null,
        userId ?? null,
        new Date().toISOString(),
      ]
    );

    await audit(client, userId, `payment.${kind}`, 'order', id, {
      amount: validAmount,
    });

    return Number(inserted.rows[0].id);
  });
}

async function returnItem(db, {
  orderItemId,
  quantity,
  condition,
  reason,
  userId,
  returnedOn,
}) {
  const itemId = positiveId(orderItemId, 'orderItemId');
  const qty = Number(quantity);

  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new HttpError(400, 'quantity must be a positive whole number');
  }

  if (!['sellable', 'damaged'].includes(condition)) {
    throw new HttpError(400, "condition must be 'sellable' or 'damaged'");
  }

  return runTransaction(db, async (client) => {
    const result = await client.query(
      'SELECT * FROM order_items WHERE id = $1 FOR UPDATE',
      [itemId]
    );

    const item = result.rows[0];

    if (!item) {
      throw new HttpError(404, 'Order item not found');
    }

    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [item.order_id]
    );

    if (!orderResult.rowCount) {
      throw new HttpError(404, 'Order not found');
    }

    if (item.stock_state !== 'sold') {
      throw new HttpError(409, 'Only items that were sold can be returned');
    }

    if (qty > Number(item.quantity) - Number(item.returned_qty)) {
      throw new HttpError(409, 'Return quantity exceeds units sold');
    }

    const on = returnedOn || localDate();
    const netUnit =
      (
        Number(item.quantity) * Number(item.unit_price) -
        Number(item.line_discount)
      ) / Number(item.quantity);

    const refundValue = round2(netUnit * qty);
    const movementReason = reason || (
      condition === 'sellable'
        ? 'Customer return (sellable)'
        : 'Customer return (damaged, not restocked)'
    );

    await inv.recordMovement(client, {
      variantId: Number(item.variant_id),
      type: condition === 'sellable'
        ? 'customer_return'
        : 'customer_return_damaged',
      delta: condition === 'sellable' ? qty : 0,
      nonSellable: condition === 'damaged' ? qty : 0,
      orderId: Number(item.order_id),
      reason: movementReason,
      userId,
      occurredOn: on,
    });

    await client.query(
      `UPDATE order_items
          SET returned_qty = returned_qty + $1
        WHERE id = $2`,
      [qty, itemId]
    );

    await client.query(
      `INSERT INTO returns
        (order_item_id, quantity, condition, returned_on,
         refund_value, reason, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        itemId,
        qty,
        condition,
        on,
        refundValue,
        reason || null,
        userId ?? null,
        new Date().toISOString(),
      ]
    );

    const remaining = await client.query(
      `SELECT COALESCE(SUM(quantity - returned_qty), 0) AS remaining
         FROM order_items
        WHERE order_id = $1 AND stock_state = 'sold'`,
      [item.order_id]
    );

    const newStatus = Number(remaining.rows[0].remaining) === 0
      ? 'returned'
      : 'partially_returned';

    await client.query(
      'UPDATE orders SET status = $1, updated_at = $2 WHERE id = $3',
      [newStatus, new Date().toISOString(), item.order_id]
    );

    await audit(client, userId, 'order.return', 'order_item', itemId, {
      quantity: qty,
      condition,
      refundValue,
    });

    return { refundValue, status: newStatus };
  });
}

async function getOrder(db, orderId) {
  const id = positiveId(orderId, 'orderId');

  const orderResult = await query(
    'SELECT * FROM orders WHERE id = $1',
    [id]
  );

  const order = orderResult.rows[0];

  if (!order) {
    return null;
  }

  const itemResult = await query(
    `SELECT oi.*,
            p.name AS product_name,
            p.code AS product_code,
            v.colour,
            v.sku
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN variants v ON v.id = oi.variant_id
      WHERE oi.order_id = $1
      ORDER BY oi.id`,
    [id]
  );

  const items = itemResult.rows.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    line_discount: Number(item.line_discount),
    returned_qty: Number(item.returned_qty),
    line_total: round2(
      Number(item.quantity) * Number(item.unit_price) -
      Number(item.line_discount)
    ),
  }));

  const paymentResult = await query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY id',
    [id]
  );

  const payments = paymentResult.rows.map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
  }));

  const returnResult = await query(
    `SELECT COALESCE(SUM(r.refund_value), 0) AS value
       FROM returns r
       JOIN order_items oi ON oi.id = r.order_item_id
      WHERE oi.order_id = $1`,
    [id]
  );

  const total = round2(items.reduce((sum, item) => sum + item.line_total, 0));
  const returnedValue = round2(Number(returnResult.rows[0].value));

  const received = round2(
    payments
      .filter((payment) => payment.kind === 'payment')
      .reduce((sum, payment) => sum + payment.amount, 0)
  );

  const refunded = round2(
    payments
      .filter((payment) => payment.kind === 'refund')
      .reduce((sum, payment) => sum + payment.amount, 0)
  );

  const net = round2(received - refunded);
  const due = round2(total - returnedValue);

  let payment_status = 'unpaid';

  if (refunded > 0 && net <= 0) {
    payment_status = 'refunded';
  } else if (net <= 0) {
    payment_status = 'unpaid';
  } else if (net >= due - 0.005) {
    payment_status = 'paid';
  } else {
    payment_status = 'partially_paid';
  }

  return {
    ...order,
    items,
    payments,
    total,
    returned_value: returnedValue,
    net_received: net,
    balance_due: round2(Math.max(0, due - net)),
    payment_status,
  };
}

module.exports = {
  STATUSES,
  createOrder,
  setOrderStatus,
  addPayment,
  returnItem,
  getOrder,
};

