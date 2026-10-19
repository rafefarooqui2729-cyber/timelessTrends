
const { query } = require('./pg-database');
const { localDate, monthRange, checkDate, round2 } = require('./util');
const config = require('./config');

const num = (value) => (value == null ? 0 : Number(value));
const nullableNum = (value) => (value == null ? null : Number(value));

const ORDER_CONFIRMED = [
  'confirmed',
  'processing',
  'ready',
  'completed',
  'partially_returned',
  'returned',
];

async function financials(db, from, to) {
  const salesResult = await query(
    `SELECT
       COALESCE(SUM(quantity * unit_price - line_discount), 0) AS rev,
       COALESCE(SUM(quantity), 0) AS units,
       COALESCE(
         SUM(
           CASE
             WHEN unit_cost_at_sale IS NOT NULL
             THEN quantity * unit_cost_at_sale
           END
         ), 0
       ) AS cogs,
       COALESCE(
         SUM(
           CASE
             WHEN unit_cost_at_sale IS NULL THEN quantity
             ELSE 0
           END
         ), 0
       ) AS missing_cost_units,
       COUNT(DISTINCT order_id) AS orders
     FROM order_items
     WHERE stock_state = 'sold'
       AND sold_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const returnsResult = await query(
    `SELECT
       COALESCE(SUM(r.refund_value), 0) AS val,
       COALESCE(SUM(r.quantity), 0) AS units,
       COALESCE(
         SUM(
           CASE
             WHEN r.condition = 'sellable'
               AND oi.unit_cost_at_sale IS NOT NULL
             THEN r.quantity * oi.unit_cost_at_sale
             ELSE 0
           END
         ), 0
       ) AS cost_back
     FROM returns r
     JOIN order_items oi ON oi.id = r.order_item_id
     WHERE r.returned_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const expenseResult = await query(
    `SELECT COALESCE(SUM(amount), 0) AS value
     FROM expenses
     WHERE expense_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const categoryResult = await query(
    `SELECT category, SUM(amount) AS amount
     FROM expenses
     WHERE expense_on BETWEEN $1 AND $2
     GROUP BY category
     ORDER BY amount DESC`,
    [from, to]
  );

  const receiptsResult = await query(
    `SELECT COALESCE(SUM(amount), 0) AS value
     FROM payments
     WHERE kind = 'payment'
       AND paid_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const refundsResult = await query(
    `SELECT COALESCE(SUM(amount), 0) AS value
     FROM payments
     WHERE kind = 'refund'
       AND paid_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const purchasesResult = await query(
    `SELECT COALESCE(SUM(paid_amount), 0) AS value
     FROM purchases
     WHERE received_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const savingsResult = await query(
    `SELECT COALESCE(
       SUM(
         CASE
           WHEN direction = 'deposit' THEN amount
           ELSE -amount
         END
       ), 0
     ) AS net
     FROM savings_entries
     WHERE entry_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const sales = salesResult.rows[0];
  const returns = returnsResult.rows[0];

  const grossSales = num(sales.rev);
  const returnsValue = num(returns.val);
  const netRevenue = grossSales - returnsValue;
  const cogs = num(sales.cogs) - num(returns.cost_back);
  const expenses = num(expenseResult.rows[0].value);
  const receipts = num(receiptsResult.rows[0].value);
  const refunds = num(refundsResult.rows[0].value);
  const purchasesPaid = num(purchasesResult.rows[0].value);

  return {
    from,
    to,
    gross_sales: round2(grossSales),
    returns_value: round2(returnsValue),
    net_sales_revenue: round2(netRevenue),
    units_sold: num(sales.units),
    units_returned: num(returns.units),
    completed_orders_with_sales: num(sales.orders),
    cost_of_goods_sold: round2(cogs),
    units_with_unknown_cost: num(sales.missing_cost_units),
    gross_profit: round2(netRevenue - cogs),
    operating_expenses: round2(expenses),
    expenses_by_category: categoryResult.rows.map((row) => ({
      ...row,
      amount: num(row.amount),
    })),
    estimated_operating_profit: round2(netRevenue - cogs - expenses),
    cash: {
      received: round2(receipts),
      refunds_paid: round2(refunds),
      expenses_paid: round2(expenses),
      supplier_payments: round2(purchasesPaid),
      net_movement: round2(
        receipts - refunds - expenses - purchasesPaid
      ),
    },
    savings_net_transferred: round2(num(savingsResult.rows[0].net)),
  };
}

async function inventoryValue(db) {
  const result = await query(
    `SELECT
       COALESCE(
         SUM(
           CASE
             WHEN avg_cost IS NOT NULL
             THEN stock_on_hand * avg_cost
           END
         ), 0
       ) AS value,
       COALESCE(SUM(stock_on_hand), 0) AS units,
       COALESCE(
         SUM(
           CASE
             WHEN avg_cost IS NULL THEN stock_on_hand
             ELSE 0
           END
         ), 0
       ) AS unknown_cost_units
     FROM variants`
  );

  const row = result.rows[0];

  return {
    value_at_cost: round2(num(row.value)),
    units_on_hand: num(row.units),
    units_with_unknown_cost: num(row.unknown_cost_units),
  };
}

async function cashBalance(db, asOf) {
  const settingResult = await query(
    `SELECT value
     FROM settings
     WHERE key = $1`,
    ['opening_cash']
  );

  const openingCash = Number(settingResult.rows[0]?.value || 0);
  const result = await financials(db, '0000-01-01', asOf);

  return round2(openingCash + result.cash.net_movement);
}

async function savingsBalance(db, asOf) {
  const result = await query(
    `SELECT COALESCE(
       SUM(
         CASE
           WHEN direction = 'deposit' THEN amount
           ELSE -amount
         END
       ), 0
     ) AS balance
     FROM savings_entries
     WHERE entry_on <= $1`,
    [asOf]
  );

  return round2(num(result.rows[0].balance));
}

async function stockSummary(db, from, to) {
  const beforeResult = await query(
    `SELECT COALESCE(SUM(quantity_change), 0) AS quantity
     FROM stock_movements
     WHERE occurred_on < $1`,
    [from]
  );

  const movementsResult = await query(
    `SELECT
       movement_type,
       COALESCE(SUM(quantity_change), 0) AS quantity,
       COALESCE(SUM(non_sellable_qty), 0) AS non_sellable
     FROM stock_movements
     WHERE occurred_on BETWEEN $1 AND $2
     GROUP BY movement_type`,
    [from, to]
  );

  const movements = movementsResult.rows;
  const quantityFor = (type) =>
    num(movements.find((row) => row.movement_type === type)?.quantity);

  const opening = num(beforeResult.rows[0].quantity);
  const received = quantityFor('purchase_received');
  const sold = -quantityFor('sale');
  const returns = quantityFor('customer_return');
  const other = -(
    quantityFor('supplier_return') + quantityFor('damage_loss')
  );
  const adjustments = quantityFor('manual_correction');
  const damagedReturns = num(
    movements.find(
      (row) => row.movement_type === 'customer_return_damaged'
    )?.non_sellable
  );

  return {
    from,
    to,
    opening_stock: opening,
    stock_received: received,
    units_sold: sold,
    returns_to_sellable_stock: returns,
    other_reductions: other,
    adjustments,
    closing_stock: opening + received - sold + returns - other + adjustments,
    damaged_returns_not_restocked: damagedReturns,
    damaged_or_lost_units: -quantityFor('damage_loss'),
    supplier_returns: -quantityFor('supplier_return'),
  };
}

async function stockByVariant(db) {
  const result = await query(
    `SELECT
       v.id AS variant_id,
       v.sku,
       p.name AS product,
       p.brand,
       v.colour,
       v.stock_on_hand,
       v.reserved,
       (v.stock_on_hand - v.reserved) AS available,
       v.min_stock,
       v.avg_cost,
       CASE
         WHEN v.avg_cost IS NULL THEN NULL
         ELSE ROUND(v.stock_on_hand * v.avg_cost, 2)
       END AS value_at_cost
     FROM variants v
     JOIN products p ON p.id = v.product_id
     ORDER BY p.name, v.colour`
  );

  return result.rows.map((row) => ({
    ...row,
    variant_id: num(row.variant_id),
    stock_on_hand: num(row.stock_on_hand),
    reserved: num(row.reserved),
    available: num(row.available),
    min_stock: num(row.min_stock),
    avg_cost: nullableNum(row.avg_cost),
    value_at_cost: nullableNum(row.value_at_cost),
  }));
}

async function bestSellers(db, from, to) {
  const productResult = await query(
    `SELECT
       p.name,
       p.code,
       SUM(oi.quantity - oi.returned_qty) AS units,
       ROUND(
         SUM(
           (oi.quantity * oi.unit_price - oi.line_discount)
           * (oi.quantity - oi.returned_qty)::numeric
           / NULLIF(oi.quantity, 0)
         ), 2
       ) AS revenue
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.stock_state = 'sold'
       AND oi.sold_on BETWEEN $1 AND $2
     GROUP BY p.id, p.name, p.code
     ORDER BY units DESC
     LIMIT 10`,
    [from, to]
  );

  const variantResult = await query(
    `SELECT
       p.name,
       v.colour,
       v.sku,
       SUM(oi.quantity - oi.returned_qty) AS units
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN variants v ON v.id = oi.variant_id
     WHERE oi.stock_state = 'sold'
       AND oi.sold_on BETWEEN $1 AND $2
     GROUP BY v.id, p.name, v.colour, v.sku
     ORDER BY units DESC
     LIMIT 10`,
    [from, to]
  );

  return {
    byProduct: productResult.rows.map((row) => ({
      ...row,
      units: num(row.units),
      revenue: num(row.revenue),
    })),
    byVariant: variantResult.rows.map((row) => ({
      ...row,
      units: num(row.units),
    })),
  };
}

async function orderCounts(db, from, to) {
  const result = await query(
    `SELECT status, COUNT(*) AS count
     FROM orders
     WHERE order_date BETWEEN $1 AND $2
     GROUP BY status`,
    [from, to]
  );

  const rows = result.rows;
  const countFor = (...statuses) =>
    rows
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + num(row.count), 0);

  return {
    created: rows.reduce((sum, row) => sum + num(row.count), 0),
    pending: countFor('enquiry', 'pending'),
    confirmed_or_later: countFor(...ORDER_CONFIRMED),
    completed: countFor('completed', 'partially_returned', 'returned'),
    cancelled: countFor('cancelled'),
    returned_or_partly: countFor('partially_returned', 'returned'),
  };
}

async function outstandingPayments(db) {
  const { getOrder } = require('./pg-orders');

  const result = await query(
    `SELECT id
     FROM orders
     WHERE status IN (
       'confirmed',
       'processing',
       'ready',
       'completed',
       'partially_returned'
     )`
  );

  let total = 0;
  let count = 0;

  for (const row of result.rows) {
    const order = await getOrder(db, row.id);

    if (order && order.balance_due > 0) {
      total += num(order.balance_due);
      count++;
    }
  }

  return { amount: round2(total), orders: count };
}

async function lowStock(db) {
  const variants = await stockByVariant(db);

  const result = await query(
    `SELECT v.id
     FROM variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.is_active = 1
       AND p.is_active = 1
       AND (v.stock_on_hand - v.reserved) <= v.min_stock`
  );

  const lowIds = new Set(result.rows.map((row) => num(row.id)));

  return variants.filter((row) => lowIds.has(row.variant_id));
}

async function daily(db, date) {
  checkDate(date);

  const fin = await financials(db, date, date);
  const stock = await stockSummary(db, date, date);
  const orders = await orderCounts(db, date, date);
  const low = await lowStock(db);

  const productsResult = await query(
    'SELECT COUNT(*) AS count FROM products WHERE date_added = $1',
    [date]
  );

  const enquiriesResult = await query(
    `SELECT COUNT(*) AS count
     FROM enquiries
     WHERE created_on = $1`,
    [date]
  );

  const confirmedResult = await query(
    `SELECT COUNT(*) AS count
     FROM enquiries
     WHERE status IN ('received', 'converted')
       AND SUBSTRING(COALESCE(confirmed_at, created_at), 1, 10) = $1`,
    [date]
  );

  return {
    date,
    products_added: num(productsResult.rows[0].count),
    stock,
    orders,
    sales_revenue: fin.net_sales_revenue,
    units_sold: fin.units_sold,
    expenses: fin.operating_expenses,
    estimated_gross_profit: fin.gross_profit,
    units_with_unknown_cost: fin.units_with_unknown_cost,
    low_stock: low,
    website_activity: {
      whatsapp_button_clicks: num(enquiriesResult.rows[0].count),
    },
    business_records: {
      confirmed_enquiries: num(confirmedResult.rows[0].count),
    },
  };
}

async function monthly(db, month) {
  const { from, to } = monthRange(month);

  const fin = await financials(db, from, to);
  const orders = await orderCounts(db, from, to);
  const outstanding = await outstandingPayments(db);
  const sellers = await bestSellers(db, from, to);
  const low = await lowStock(db);
  const stock = await stockSummary(db, from, to);
  const inventory = await inventoryValue(db);
  const variants = await stockByVariant(db);
  const cash = await cashBalance(db, to);
  const savings = await savingsBalance(db, to);

  const activityResult = await query(
    `SELECT COUNT(*) AS count
     FROM enquiries
     WHERE created_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const enquiriesResult = await query(
    `SELECT COUNT(*) AS count
     FROM enquiries
     WHERE status IN ('received', 'converted', 'closed')
       AND created_on BETWEEN $1 AND $2`,
    [from, to]
  );

  const productsResult = await query(
    `SELECT COUNT(*) AS count
     FROM products
     WHERE date_added BETWEEN $1 AND $2`,
    [from, to]
  );

  return {
    month,
    from,
    to,
    timezone: config.timezone,
    website_activity: {
      whatsapp_button_clicks: num(activityResult.rows[0].count),
    },
    enquiries_recorded: num(enquiriesResult.rows[0].count),
    orders,
    units_sold: fin.units_sold,
    units_returned: fin.units_returned,
    recorded_sales: fin.net_sales_revenue,
    average_order_value: fin.completed_orders_with_sales
      ? round2(fin.gross_sales / fin.completed_orders_with_sales)
      : null,
    outstanding_payments: outstanding,
    best_sellers: sellers,
    low_stock: low,
    new_products_added: num(productsResult.rows[0].count),
    financials: fin,
    stock,
    inventory_now: inventory,
    stock_by_variant: variants,
    cash_balance_end_of_month: cash,
    savings_fund_balance_end_of_month: savings,
  };
}

module.exports = {
  financials,
  inventoryValue,
  cashBalance,
  savingsBalance,
  stockSummary,
  stockByVariant,
  lowStock,
  daily,
  monthly,
  outstandingPayments,
};
