const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  pool,
  query,
  withTransaction,
} = require('./server/pg-database');

const pgOrders = require('./server/pg-orders');

async function main() {
  const marker = `PG-RESERVATION-ROLLBACK-${randomUUID()}`;
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
          items: [
            {
              variantId: 1,
              quantity: 1,
              unitPrice: 1,
              lineDiscount: 0,
            },
          ],
          notes: marker,
          status: 'confirmed',
          userId: null,
        });

        let stock = await client.query(
          'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
          [1]
        );

        assert.equal(Number(stock.rows[0].stock_on_hand), originalStock);
        assert.equal(
          Number(stock.rows[0].reserved),
          originalReserved + 1,
          'Confirming the order should reserve one unit without reducing stock on hand.'
        );

        console.log('PASS: Confirmed order reserves one unit.');

        // Repeating the same status must not reserve twice.
        await pgOrders.setOrderStatus(client, orderId, 'confirmed');

        stock = await client.query(
          'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
          [1]
        );

        assert.equal(Number(stock.rows[0].reserved), originalReserved + 1);
        console.log('PASS: Repeating the status does not reserve twice.');

        // Cancellation must release the reservation.
        await pgOrders.setOrderStatus(client, orderId, 'cancelled', {
          userId: null,
          cancelReason: 'Automated rollback test',
        });

        stock = await client.query(
          'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
          [1]
        );

        assert.equal(Number(stock.rows[0].stock_on_hand), originalStock);
        assert.equal(Number(stock.rows[0].reserved), originalReserved);
        console.log('PASS: Cancellation releases the reservation.');

        throw new Error('ROLLBACK_RESERVATION_TEST');
      });

      throw new Error('Transaction unexpectedly committed.');
    } catch (error) {
      if (error.message !== 'ROLLBACK_RESERVATION_TEST') {
        throw error;
      }
    }

    const after = await query(
      'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
      [1]
    );

    assert.equal(Number(after.rows[0].stock_on_hand), originalStock);
    assert.equal(Number(after.rows[0].reserved), originalReserved);

    const leftover = await query(
      'SELECT COUNT(*)::int AS count FROM orders WHERE customer_name = $1 OR notes = $1',
      [marker]
    );

    assert.equal(leftover.rows[0].count, 0);

    console.log('PASS: Stock matches its original values after rollback.');
    console.log('PASS: No test order remains.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('RESERVATION ROLLBACK TEST FAILED:', error.message);
  process.exitCode = 1;
});
