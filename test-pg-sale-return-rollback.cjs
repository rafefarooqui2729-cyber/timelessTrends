const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  pool,
  query,
  withTransaction,
} = require('./server/pg-database');

const pgOrders = require('./server/pg-orders');

async function main() {
  const marker = `PG-SALE-RETURN-ROLLBACK-${randomUUID()}`;
  let orderId;

  try {
    const before = await query(
      'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
      [1]
    );

    assert.equal(before.rowCount, 1);

    const originalStock = Number(before.rows[0].stock_on_hand);
    const originalReserved = Number(before.rows[0].reserved);

    try {
      await withTransaction(async (client) => {
        orderId = await pgOrders.createOrder(client, {
          customerName: marker,
          customerContact: null,
          items: [{
            variantId: 1,
            quantity: 1,
            unitPrice: 1,
            lineDiscount: 0,
          }],
          notes: marker,
          status: 'confirmed',
          userId: null,
        });

        await pgOrders.setOrderStatus(client, orderId, 'completed', {
          userId: null,
        });

        let stock = await client.query(
          'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
          [1]
        );

        assert.equal(
          Number(stock.rows[0].stock_on_hand),
          originalStock - 1,
          'Completing the sale should reduce stock by one.'
        );

        assert.equal(
          Number(stock.rows[0].reserved),
          originalReserved,
          'Completing the sale should release its reservation.'
        );

        let itemResult = await client.query(
          'SELECT id, stock_state, sold_on, unit_cost_at_sale FROM order_items WHERE order_id = $1',
          [orderId]
        );

        assert.equal(itemResult.rowCount, 1);
        assert.equal(itemResult.rows[0].stock_state, 'sold');
        assert.ok(itemResult.rows[0].sold_on);

        console.log('PASS: Sale deducts stock and records the sold item.');

        const saleMovement = await client.query(
          `SELECT id, quantity_change
             FROM stock_movements
            WHERE order_id = $1 AND movement_type = 'sale'`,
          [orderId]
        );

        assert.equal(saleMovement.rowCount, 1);
        assert.equal(Number(saleMovement.rows[0].quantity_change), -1);

        console.log('PASS: Sale movement records a one-unit reduction.');

        await pgOrders.returnItem(client, {
          orderItemId: Number(itemResult.rows[0].id),
          quantity: 1,
          condition: 'sellable',
          reason: 'Automated sellable-return rollback test',
          userId: null,
        });

        stock = await client.query(
          'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
          [1]
        );

        assert.equal(
          Number(stock.rows[0].stock_on_hand),
          originalStock,
          'A sellable return should restore the sold unit.'
        );

        assert.equal(Number(stock.rows[0].reserved), originalReserved);

        itemResult = await client.query(
          'SELECT returned_qty FROM order_items WHERE order_id = $1',
          [orderId]
        );

        assert.equal(Number(itemResult.rows[0].returned_qty), 1);

        const orderResult = await client.query(
          'SELECT status FROM orders WHERE id = $1',
          [orderId]
        );

        assert.equal(orderResult.rows[0].status, 'returned');

        const returnMovement = await client.query(
          `SELECT id, quantity_change
             FROM stock_movements
            WHERE order_id = $1 AND movement_type = 'customer_return'`,
          [orderId]
        );

        assert.equal(returnMovement.rowCount, 1);
        assert.equal(Number(returnMovement.rows[0].quantity_change), 1);

        console.log('PASS: Sellable return restores stock and records the return.');
        console.log('PASS: Fully returned order has status returned.');

        throw new Error('ROLLBACK_SALE_RETURN_TEST');
      });

      throw new Error('Transaction unexpectedly committed.');
    } catch (error) {
      if (error.message !== 'ROLLBACK_SALE_RETURN_TEST') {
        throw error;
      }
    }

    const after = await query(
      'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
      [1]
    );

    assert.equal(Number(after.rows[0].stock_on_hand), originalStock);
    assert.equal(Number(after.rows[0].reserved), originalReserved);

    const leftovers = await query(
      `SELECT COUNT(*)::int AS count
         FROM orders
        WHERE customer_name = $1 OR notes = $1`,
      [marker]
    );

    assert.equal(leftovers.rows[0].count, 0);

    console.log('PASS: Original stock and reservations restored after rollback.');
    console.log('PASS: No test order remains.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('SALE/RETURN ROLLBACK TEST FAILED:', error.message);
  process.exitCode = 1;
});
