const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  pool,
  query,
  withTransaction,
} = require('./server/pg-database');

const pgOrders = require('./server/pg-orders');

async function main() {
  const marker = `PG-DAMAGED-RETURN-${randomUUID()}`;
  let orderId;
  let orderItemId;
  let originalStock;
  let rollbackConfirmed = false;

  try {
    const before = await query(
      'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
      [1]
    );

    assert.equal(before.rowCount, 1, 'Variant 1 must exist');
    originalStock = Number(before.rows[0].stock_on_hand);

    assert.ok(
      originalStock >= 1,
      'Variant 1 needs at least one unit to run this test'
    );

    try {
      await withTransaction(async (client) => {
        orderId = await pgOrders.createOrder(client, {
          customerName: marker,
          notes: marker,
          status: 'pending',
          userId: null,
          items: [{
            variantId: 1,
            quantity: 1,
            unitPrice: 100,
            lineDiscount: 0,
          }],
        });

        await pgOrders.setOrderStatus(
          client,
          orderId,
          'confirmed',
          { userId: null }
        );

        await pgOrders.setOrderStatus(
          client,
          orderId,
          'completed',
          { userId: null }
        );

        const itemResult = await client.query(
          `SELECT id, quantity, returned_qty, stock_state
             FROM order_items
            WHERE order_id = $1`,
          [orderId]
        );

        assert.equal(itemResult.rowCount, 1);
        orderItemId = Number(itemResult.rows[0].id);
        assert.equal(Number(itemResult.rows[0].quantity), 1);
        assert.equal(Number(itemResult.rows[0].returned_qty), 0);
        assert.equal(itemResult.rows[0].stock_state, 'sold');

        const afterSale = await client.query(
          'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
          [1]
        );

        assert.equal(
          Number(afterSale.rows[0].stock_on_hand),
          originalStock - 1,
          'Completing the order should deduct one unit'
        );

        await pgOrders.returnItem(client, {
          orderItemId,
          quantity: 1,
          condition: 'damaged',
          reason: marker,
          userId: null,
          returnedOn: '2026-10-16',
        });

        const afterReturn = await client.query(
          'SELECT stock_on_hand, reserved FROM variants WHERE id = $1',
          [1]
        );

        assert.equal(
          Number(afterReturn.rows[0].stock_on_hand),
          originalStock - 1,
          'Damaged return must not increase saleable stock'
        );

        const updatedItem = await client.query(
          `SELECT returned_qty, stock_state
             FROM order_items
            WHERE id = $1`,
          [orderItemId]
        );

        assert.equal(Number(updatedItem.rows[0].returned_qty), 1);
        assert.equal(updatedItem.rows[0].stock_state, 'sold');

        const returned = await client.query(
          `SELECT quantity, condition, reason
             FROM returns
            WHERE order_item_id = $1 AND reason = $2`,
          [orderItemId, marker]
        );

        assert.equal(returned.rowCount, 1);
        assert.equal(Number(returned.rows[0].quantity), 1);
        assert.equal(returned.rows[0].condition, 'damaged');

        const movement = await client.query(
          `SELECT movement_type, quantity_change,
                  previous_qty, new_qty, non_sellable_qty
             FROM stock_movements
            WHERE order_id = $1 AND reason = $2`,
          [orderId, marker]
        );

        assert.equal(movement.rowCount, 1);
        assert.equal(
          movement.rows[0].movement_type,
          'customer_return_damaged'
        );
        assert.equal(Number(movement.rows[0].quantity_change), 0);
        assert.equal(
          Number(movement.rows[0].previous_qty),
          originalStock - 1
        );
        assert.equal(
          Number(movement.rows[0].new_qty),
          originalStock - 1
        );
        assert.equal(Number(movement.rows[0].non_sellable_qty), 1);

        const order = await client.query(
          'SELECT status FROM orders WHERE id = $1',
          [orderId]
        );

        assert.equal(order.rows[0].status, 'returned');

        const audit = await client.query(
          `SELECT COUNT(*)::int AS count
             FROM audit_logs
            WHERE action = 'order.return'
              AND entity = 'order_item'
              AND entity_id = $1`,
          [String(orderItemId)]
        );

        assert.equal(audit.rows[0].count, 1);

        console.log('PASS: Test order was created and completed.');
        console.log('PASS: Damaged return was recorded.');
        console.log('PASS: Returned quantity was updated.');
        console.log('PASS: Saleable stock was not increased.');
        console.log('PASS: Damaged movement and audit were recorded.');

        throw new Error('INTENTIONAL_DAMAGED_RETURN_ROLLBACK');
      });

      throw new Error('Transaction unexpectedly committed.');
    } catch (error) {
      if (error.message !== 'INTENTIONAL_DAMAGED_RETURN_ROLLBACK') {
        throw error;
      }

      rollbackConfirmed = true;
    }

    const checks = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM orders WHERE id = $1', [orderId]),
      query('SELECT COUNT(*)::int AS count FROM returns WHERE order_item_id = $1', [orderItemId]),
      query('SELECT COUNT(*)::int AS count FROM stock_movements WHERE order_id = $1', [orderId]),
      query(
        `SELECT COUNT(*)::int AS count
           FROM audit_logs
          WHERE entity = 'order_item' AND entity_id = $1`,
        [String(orderItemId)]
      ),
      query('SELECT stock_on_hand, reserved FROM variants WHERE id = $1', [1]),
    ]);

    assert.equal(checks[0].rows[0].count, 0, 'Temporary order must be rolled back');
    assert.equal(checks[1].rows[0].count, 0, 'Temporary return must be rolled back');
    assert.equal(checks[2].rows[0].count, 0, 'Temporary stock movements must be rolled back');
    assert.equal(checks[3].rows[0].count, 0, 'Temporary item audit entries must be rolled back');
    assert.equal(
      Number(checks[4].rows[0].stock_on_hand),
      originalStock,
      'Original stock must be restored'
    );

    console.log('PASS: Temporary order, return, movements, and audit were rolled back.');
    console.log('PASS: Original stock quantity was restored.');
    console.log('Rollback confirmed:', rollbackConfirmed);

    assert.equal(rollbackConfirmed, true);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('DAMAGED RETURN TEST FAILED:', error.message);
  process.exitCode = 1;
});
