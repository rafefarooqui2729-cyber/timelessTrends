// All figures are computed from stored records for business-local calendar dates [from, to] inclusive.
// Conventions (also shown in the dashboard):
//  * Sales revenue is recognised when an order is COMPLETED (handed over): sum of (qty x price - line discount)
//    by sold_on date, minus refund value of returns by returned_on date.
//  * COGS = units sold x average cost captured at the moment of sale, minus cost of units returned as SELLABLE.
//    Damaged returns are not restocked, so their cost stays in COGS (it is a real loss).
//  * Gross profit = net sales revenue - COGS.  Operating profit (estimate) = gross profit - recorded expenses.
//  * Stock purchases are NOT expenses (they become inventory value, and COGS when sold).
//  * Cash movement = payments received - refunds paid - expenses paid - supplier purchases paid.
//  * Units whose cost is unknown are excluded from COGS and reported, never treated as zero cost.
const { localDate, monthRange, checkDate, round2 } = require('./util');

const num = (v) => (v == null ? 0 : v);

function financials(db, from, to) {
  const sales = db.prepare(`SELECT COALESCE(SUM(quantity*unit_price - line_discount),0) AS rev,
      COALESCE(SUM(quantity),0) AS units,
      COALESCE(SUM(CASE WHEN unit_cost_at_sale IS NOT NULL THEN quantity*unit_cost_at_sale END),0) AS cogs,
      COALESCE(SUM(CASE WHEN unit_cost_at_sale IS NULL THEN quantity END),0) AS missing_cost_units,
      COUNT(DISTINCT order_id) AS orders
    FROM order_items WHERE stock_state='sold' AND sold_on BETWEEN ? AND ?`).get(from, to);
  const ret = db.prepare(`SELECT COALESCE(SUM(r.refund_value),0) AS val, COALESCE(SUM(r.quantity),0) AS units,
      COALESCE(SUM(CASE WHEN r.condition='sellable' AND oi.unit_cost_at_sale IS NOT NULL THEN r.quantity*oi.unit_cost_at_sale END),0) AS cost_back
    FROM returns r JOIN order_items oi ON oi.id = r.order_item_id WHERE r.returned_on BETWEEN ? AND ?`).get(from, to);
  const exp = db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE expense_on BETWEEN ? AND ?').get(from, to).v;
  const byCat = db.prepare(`SELECT category, SUM(amount) AS amount FROM expenses WHERE expense_on BETWEEN ? AND ?
    GROUP BY category ORDER BY amount DESC`).all(from, to);
  const receipts = db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE kind='payment' AND paid_on BETWEEN ? AND ?").get(from, to).v;
  const refunds = db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE kind='refund' AND paid_on BETWEEN ? AND ?").get(from, to).v;
  const purchasesPaid = db.prepare('SELECT COALESCE(SUM(paid_amount),0) AS v FROM purchases WHERE received_on BETWEEN ? AND ?').get(from, to).v;
  const sav = db.prepare(`SELECT COALESCE(SUM(CASE WHEN direction='deposit' THEN amount ELSE -amount END),0) AS net
    FROM savings_entries WHERE entry_on BETWEEN ? AND ?`).get(from, to).net;

  const gross_sales = round2(sales.rev);
  const net_revenue = round2(sales.rev - ret.val);
  const cogs = round2(sales.cogs - ret.cost_back);
  const gross_profit = round2(net_revenue - cogs);
  return {
    from, to,
    gross_sales, returns_value: round2(ret.val), net_sales_revenue: net_revenue,
    units_sold: sales.units, units_returned: ret.units, completed_orders_with_sales: sales.orders,
    cost_of_goods_sold: cogs, units_with_unknown_cost: sales.missing_cost_units,
    gross_profit, operating_expenses: round2(exp), expenses_by_category: byCat,
    estimated_operating_profit: round2(gross_profit - exp),
    cash: { received: round2(receipts), refunds_paid: round2(refunds), expenses_paid: round2(exp),
      supplier_payments: round2(purchasesPaid),
      net_movement: round2(receipts - refunds - exp - purchasesPaid) },
    savings_net_transferred: round2(sav),
  };
}

function inventoryValue(db) {
  const r = db.prepare(`SELECT COALESCE(SUM(CASE WHEN avg_cost IS NOT NULL THEN stock_on_hand*avg_cost END),0) AS val,
      COALESCE(SUM(stock_on_hand),0) AS units,
      COALESCE(SUM(CASE WHEN avg_cost IS NULL THEN stock_on_hand END),0) AS unknown_cost_units
    FROM variants`).get();
  return { value_at_cost: round2(r.val), units_on_hand: r.units, units_with_unknown_cost: r.unknown_cost_units };
}

// Business cash balance = opening cash setting + all recorded receipts/payments up to `asOf`.
function cashBalance(db, asOf) {
  const open = Number(db.prepare("SELECT value FROM settings WHERE key='opening_cash'").get()?.value || 0);
  const f = financials(db, '0000-01-01', asOf);
  return round2(open + f.cash.net_movement);
}

function savingsBalance(db, asOf) {
  return round2(db.prepare(`SELECT COALESCE(SUM(CASE WHEN direction='deposit' THEN amount ELSE -amount END),0) AS v
    FROM savings_entries WHERE entry_on <= ?`).get(asOf).v);
}

function stockSummary(db, from, to) {
  const before = db.prepare('SELECT COALESCE(SUM(quantity_change),0) AS v FROM stock_movements WHERE occurred_on < ?').get(from).v;
  const t = db.prepare(`SELECT movement_type AS t, COALESCE(SUM(quantity_change),0) AS q, COALESCE(SUM(non_sellable_qty),0) AS ns
    FROM stock_movements WHERE occurred_on BETWEEN ? AND ? GROUP BY movement_type`).all(from, to);
  const g = (k) => num(t.find((x) => x.t === k)?.q);
  const received = g('purchase_received');
  const sold = -g('sale');
  const returns = g('customer_return');
  const other = -(g('supplier_return') + g('damage_loss'));
  const adjustments = g('manual_correction');
  const damagedReturns = num(t.find((x) => x.t === 'customer_return_damaged')?.ns);
  const closing = before + received - sold + returns - other + adjustments;
  return { from, to, opening_stock: before, stock_received: received, units_sold: sold,
    returns_to_sellable_stock: returns, other_reductions: other, adjustments,
    closing_stock: closing, damaged_returns_not_restocked: damagedReturns,
    damaged_or_lost_units: -g('damage_loss'), supplier_returns: -g('supplier_return') };
}

function stockByVariant(db) {
  return db.prepare(`SELECT v.id AS variant_id, v.sku, p.name AS product, p.brand, v.colour, v.stock_on_hand, v.reserved,
      (v.stock_on_hand - v.reserved) AS available, v.min_stock, v.avg_cost,
      CASE WHEN v.avg_cost IS NULL THEN NULL ELSE ROUND(v.stock_on_hand*v.avg_cost,2) END AS value_at_cost
    FROM variants v JOIN products p ON p.id = v.product_id ORDER BY p.name, v.colour`).all();
}

const ORDER_CONFIRMED = ['confirmed', 'processing', 'ready', 'completed', 'partially_returned', 'returned'];

function bestSellers(db, from, to) {
  const byProduct = db.prepare(`SELECT p.name, p.code, SUM(oi.quantity - oi.returned_qty) AS units,
      ROUND(SUM((oi.quantity*oi.unit_price - oi.line_discount) * (oi.quantity - oi.returned_qty) * 1.0 / oi.quantity),2) AS revenue
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.stock_state='sold' AND oi.sold_on BETWEEN ? AND ? GROUP BY p.id ORDER BY units DESC LIMIT 10`).all(from, to);
  const byVariant = db.prepare(`SELECT p.name, v.colour, v.sku, SUM(oi.quantity - oi.returned_qty) AS units
    FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN variants v ON v.id = oi.variant_id
    WHERE oi.stock_state='sold' AND oi.sold_on BETWEEN ? AND ? GROUP BY v.id ORDER BY units DESC LIMIT 10`).all(from, to);
  return { byProduct, byVariant };
}

function orderCounts(db, from, to) {
  const rows = db.prepare('SELECT status, COUNT(*) AS n FROM orders WHERE order_date BETWEEN ? AND ? GROUP BY status').all(from, to);
  const n = (...s) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.n, 0);
  return {
    created: rows.reduce((a, r) => a + r.n, 0),
    pending: n('enquiry', 'pending'),
    confirmed_or_later: n(...ORDER_CONFIRMED),
    completed: n('completed', 'partially_returned', 'returned'), // had a completed sale at some point
    cancelled: n('cancelled'),
    returned_or_partly: n('partially_returned', 'returned'),
  };
}

function outstandingPayments(db) {
  const { getOrder } = require('./orders');
  const ids = db.prepare(`SELECT id FROM orders WHERE status IN ('confirmed','processing','ready','completed','partially_returned')`).all();
  let total = 0; let count = 0;
  for (const { id } of ids) { const o = getOrder(db, id); if (o.balance_due > 0) { total += o.balance_due; count++; } }
  return { amount: round2(total), orders: count };
}

function lowStock(db) {
  return stockByVariant(db).filter((r) => {
    const v = db.prepare('SELECT v.is_active, p.is_active AS pa FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?').get(r.variant_id);
    return v.is_active && v.pa && r.available <= r.min_stock;
  });
}

function daily(db, date) {
  checkDate(date);
  const fin = financials(db, date, date);
  return {
    date,
    products_added: db.prepare('SELECT COUNT(*) AS n FROM products WHERE date_added = ?').get(date).n,
    stock: stockSummary(db, date, date),
    orders: orderCounts(db, date, date),
    sales_revenue: fin.net_sales_revenue, units_sold: fin.units_sold,
    expenses: fin.operating_expenses, estimated_gross_profit: fin.gross_profit,
    units_with_unknown_cost: fin.units_with_unknown_cost,
    low_stock: lowStock(db),
    website_activity: { whatsapp_button_clicks: db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE created_on = ?").get(date).n },
    business_records: { confirmed_enquiries: db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status IN ('received','converted') AND substr(COALESCE(confirmed_at, created_at),1,10) = ?").get(date).n },
  };
}

function monthly(db, month) {
  const { from, to } = monthRange(month);
  const fin = financials(db, from, to);
  const oc = orderCounts(db, from, to);
  return {
    month, from, to, timezone: require('./config').timezone,
    website_activity: { whatsapp_button_clicks: db.prepare('SELECT COUNT(*) AS n FROM enquiries WHERE created_on BETWEEN ? AND ?').get(from, to).n },
    enquiries_recorded: db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status IN ('received','converted','closed') AND created_on BETWEEN ? AND ?").get(from, to).n,
    orders: oc,
    units_sold: fin.units_sold, units_returned: fin.units_returned,
    recorded_sales: fin.net_sales_revenue,
    average_order_value: fin.completed_orders_with_sales ? round2(fin.gross_sales / fin.completed_orders_with_sales) : null,
    outstanding_payments: outstandingPayments(db),
    best_sellers: bestSellers(db, from, to),
    low_stock: lowStock(db),
    new_products_added: db.prepare('SELECT COUNT(*) AS n FROM products WHERE date_added BETWEEN ? AND ?').get(from, to).n,
    financials: fin,
    stock: stockSummary(db, from, to),
    inventory_now: inventoryValue(db),
    stock_by_variant: stockByVariant(db),
    cash_balance_end_of_month: cashBalance(db, to),
    savings_fund_balance_end_of_month: savingsBalance(db, to),
  };
}

module.exports = { financials, inventoryValue, cashBalance, savingsBalance, stockSummary, stockByVariant, lowStock, daily, monthly, outstandingPayments };

