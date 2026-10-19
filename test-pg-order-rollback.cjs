const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  pool,
  query,
  withTransaction,
} = require('./server/pg-database');

const pgOrders = require('./server/pg-orders');

async function main() {
  const marker = `PG-ORDER-ROLLBACK-TEST-${randomUUID()}`;
  let orderId;

  try {
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
          status: 'pending',
          userId: null,
        });

        const insideTransaction = await client.query(
          'SELECT id, customer_name FROM orders WHERE id = $1',
          [orderId]
        );

        assert.equal(insideTransaction.rowCount, 1);
        assert.equal(insideTransaction.rows[0].customer_name, marker);

        console.log('PASS: Temporary order exists inside the transaction.');

        // Deliberately force the outer transaction to roll back.
        throw new Error('ROLLBACK_TEST_SENTINEL');
      });

      throw new Error(
        'FAIL: The transaction completed instead of rolling back.'
      );
    } catch (error) {
      if (error.message !== 'ROLLBACK_TEST_SENTINEL') {
        throw error;
      }
    }

    const orderCheck = await query(
      `SELECT COUNT(*)::int AS count
         FROM orders
        WHERE customer_name = $1 OR notes = $1`,
      [marker]
    );

    assert.equal(
      orderCheck.rows[0].count,
      0,
      'The temporary order should not exist after rollback.'
    );

    const auditCheck = await query(
      `SELECT COUNT(*)::int AS count
         FROM audit_logs
        WHERE action = 'order.create'
          AND entity = 'order'
          AND entity_id = $1`,
      [String(orderId)]
    );

    assert.equal(
      auditCheck.rows[0].count,
      0,
      'The order audit entry should also have rolled back.'
    );

    console.log('PASS: The temporary order was rolled back.');
    console.log('PASS: The order audit entry was rolled back.');
    console.log('PASS: No test order was left in the database.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('ROLLBACK TEST FAILED:', error.message);
  process.exitCode = 1;
});
