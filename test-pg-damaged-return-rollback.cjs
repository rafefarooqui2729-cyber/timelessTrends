const { pool, closePool } = require('./server/pg');
const { withTransaction } = require('./server/pg-database');
const { recordMovement } = require('./server/pg-inventory');

const testReason = 'Temporary damaged-return rollback test';
const rollbackSignal = 'INTENTIONAL_TEST_ROLLBACK';

async function main() {
  const before = await pool.query(`
    SELECT stock_on_hand
    FROM variants
    WHERE id = 1
  `);

  if (!before.rows.length) {
    throw new Error('Variant 1 was not found.');
  }

  const originalStock = Number(before.rows[0].stock_on_hand);
  let rollbackConfirmed = false;

  try {
    await withTransaction(async (client) => {
      await recordMovement(client, {
        variantId: 1,
        type: 'customer_return_damaged',
        delta: 0,
        reason: testReason,
        unitCost: 1600,
        nonSellable: 1,
      });

      const movement = await client.query(`
        SELECT movement_type, quantity_change,
               previous_qty, new_qty, non_sellable_qty
        FROM stock_movements
        WHERE reason = $1
      `, [testReason]);

      console.table(movement.rows);

      if (
        movement.rows.length !== 1 ||
        movement.rows[0].movement_type !== 'customer_return_damaged' ||
        Number(movement.rows[0].quantity_change) !== 0 ||
        Number(movement.rows[0].previous_qty) !== originalStock ||
        Number(movement.rows[0].new_qty) !== originalStock ||
        Number(movement.rows[0].non_sellable_qty) !== 1
      ) {
        throw new Error('Damaged-return movement validation failed.');
      }

      throw new Error(rollbackSignal);
    });
  } catch (error) {
    if (error.message !== rollbackSignal) {
      throw error;
    }

    rollbackConfirmed = true;
  }

  const after = await pool.query(`
    SELECT stock_on_hand
    FROM variants
    WHERE id = 1
  `);

  const remaining = await pool.query(`
    SELECT id
    FROM stock_movements
    WHERE reason = $1
  `, [testReason]);

  console.log('Original stock:', originalStock);
  console.log('Stock after rollback:', Number(after.rows[0].stock_on_hand));
  console.log('Temporary movements remaining:', remaining.rows.length);
  console.log('Rollback confirmed:', rollbackConfirmed);

  if (
    !rollbackConfirmed ||
    Number(after.rows[0].stock_on_hand) !== originalStock ||
    remaining.rows.length !== 0
  ) {
    throw new Error('Verification failed. Stop and report the output.');
  }

  console.log('PASS: damaged-return logic and rollback verified.');
}

main()
  .catch(error => {
    console.error('TEST FAILED:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
