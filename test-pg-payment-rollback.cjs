const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  pool,
  query,
  withTransaction,
} = require('./server/pg-database');

const pgOrders = require('./server/pg-orders');

async function main() {
  const marker = `PG-PAYMENT-ROLLBACK-${randomUUID()}`;
  let orderId;
  let paymentId;

  try {
    try {
      await withTransaction(async (client) => {
        orderId = await pgOrders.createOrder(client, {
          customerName: marker,
          items: [{
            variantId: 1,
            quantity: 1,
            unitPrice: 100,
            lineDiscount: 0,
          }],
          notes: marker,
          status: 'pending',
          userId: null,
        });

        paymentId = await pgOrders.addPayment(client, orderId, {
          kind: 'payment',
          amount: 25,
          paidOn: '2026-10-16',
          method: 'test',
          note: marker,
          userId: null,
        });

        const payment = await client.query(
          'SELECT id, order_id, kind, amount, note FROM payments WHERE id = $1',
          [paymentId]
        );

        assert.equal(payment.rowCount, 1);
        assert.equal(Number(payment.rows[0].order_id), orderId);
        assert.equal(payment.rows[0].kind, 'payment');
        assert.equal(Number(payment.rows[0].amount), 25);
        assert.equal(payment.rows[0].note, marker);

        const audit = await client.query(
          `SELECT COUNT(*)::int AS count
             FROM audit_logs
            WHERE action = 'payment.payment'
              AND entity = 'order'
              AND entity_id = $1`,
          [String(orderId)]
        );

        assert.equal(audit.rows[0].count, 1);

        console.log('PASS: Payment is recorded inside the transaction.');
        console.log('PASS: Payment audit entry is recorded.');

        throw new Error('ROLLBACK_PAYMENT_TEST');
      });

      throw new Error('Transaction unexpectedly committed.');
    } catch (error) {
      if (error.message !== 'ROLLBACK_PAYMENT_TEST') {
        throw error;
      }
    }

    const paymentCheck = await query(
      'SELECT COUNT(*)::int AS count FROM payments WHERE id = $1',
      [paymentId]
    );

    assert.equal(paymentCheck.rows[0].count, 0);

    const auditCheck = await query(
      `SELECT COUNT(*)::int AS count
         FROM audit_logs
        WHERE action = 'payment.payment'
          AND entity = 'order'
          AND entity_id = $1`,
      [String(orderId)]
    );

    assert.equal(auditCheck.rows[0].count, 0);

    const orderCheck = await query(
      'SELECT COUNT(*)::int AS count FROM orders WHERE id = $1',
      [orderId]
    );

    assert.equal(orderCheck.rows[0].count, 0);

    console.log('PASS: Payment was rolled back.');
    console.log('PASS: Payment audit entry was rolled back.');
    console.log('PASS: Temporary order was rolled back.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('PAYMENT ROLLBACK TEST FAILED:', error.message);
  process.exitCode = 1;
});
