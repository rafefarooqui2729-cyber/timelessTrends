const { pool, closePool } = require('./server/pg');
const inventory = require('./server/pg-inventory');

async function main() {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const beforeResult = await client.query(
      `SELECT stock_on_hand, avg_cost
       FROM variants
       WHERE id = $1
       FOR UPDATE`,
      [1]
    );

    if (!beforeResult.rows.length) {
      throw new Error('Variant 1 was not found.');
    }

    const before = beforeResult.rows[0];

    const originalQuantity = Number(before.stock_on_hand);

    const originalAverageCost =
      before.avg_cost == null
        ? null
        : Number(before.avg_cost);

    if (originalQuantity > 0 && originalAverageCost == null) {
      throw new Error(
        'Variant 1 has stock without average cost. Test cannot proceed.'
      );
    }

    const purchaseId = await inventory.receiveStock(client, {
      items: [
        {
          variantId: 1,
          quantity: 2,
          unitCost: 2000,
        },
      ],
      reference: 'TEMP-RECEIVE-ROLLBACK-TEST',
      notes: 'Temporary receiving rollback test',
      paidAmount: 1000,
      userId: null,
    });

    const afterResult = await client.query(
      `SELECT stock_on_hand, avg_cost
       FROM variants
       WHERE id = $1`,
      [1]
    );

    const after = afterResult.rows[0];

    const expectedQuantity = originalQuantity + 2;

    const expectedAverageCost =
      originalQuantity === 0
        ? 2000
        : Math.round(
            (
              originalQuantity * originalAverageCost +
              2 * 2000
            ) / expectedQuantity * 10000
          ) / 10000;

    if (Number(after.stock_on_hand) !== expectedQuantity) {
      throw new Error('Received stock quantity is incorrect.');
    }

    if (
      Math.abs(Number(after.avg_cost) - expectedAverageCost) >
      0.0001
    ) {
      throw new Error('Weighted-average cost is incorrect.');
    }

    const purchase = await client.query(
      `SELECT id, total_cost, paid_amount
       FROM purchases
       WHERE id = $1`,
      [purchaseId]
    );

    if (!purchase.rows.length) {
      throw new Error('Purchase record was not created.');
    }

    if (Number(purchase.rows[0].total_cost) !== 4000) {
      throw new Error('Purchase total is incorrect.');
    }

    if (Number(purchase.rows[0].paid_amount) !== 1000) {
      throw new Error('Paid amount is incorrect.');
    }

    const movements = await client.query(
      `SELECT movement_type, quantity_change, purchase_id
       FROM stock_movements
       WHERE purchase_id = $1`,
      [purchaseId]
    );

    if (
      movements.rows.length !== 1 ||
      movements.rows[0].movement_type !== 'purchase_received' ||
      Number(movements.rows[0].quantity_change) !== 2
    ) {
      throw new Error('Purchase stock movement is incorrect.');
    }

    console.log('PASS: Stock receiving calculations verified.');

  } finally {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
        console.log('Transaction rolled back.');
      } catch (error) {
        console.error('ROLLBACK failed:', error.message);
        throw error;
      }
    }

    client.release();
    await closePool();
  }
}

main().catch((error) => {
  console.error('Receiving test failed:', error.message);
  process.exitCode = 1;
});