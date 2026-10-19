const { pool, closePool } = require('./server/pg');
const inventory = require('./server/pg-inventory');

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const before = await client.query(`
      SELECT stock_on_hand
      FROM variants
      WHERE id = 1
      FOR UPDATE
    `);

    if (before.rows.length === 0) {
      throw new Error('Test variant 1 was not found.');
    }

    const originalStock = Number(before.rows[0].stock_on_hand);

    const result = await inventory.recordMovement(client, {
      variantId: 1,
      type: 'manual_correction',
      delta: 1,
      reason: 'Temporary rollback test',
    });

    const after = await client.query(
      'SELECT stock_on_hand FROM variants WHERE id = $1',
      [1]
    );

    const movement = await client.query(`
      SELECT quantity_change, previous_qty, new_qty
      FROM stock_movements
      WHERE id = $1
    `, [result.movementId]);

    const audit = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM audit_logs
      WHERE action = 'stock.movement'
        AND entity = 'variant'
        AND entity_id = '1'
        AND detail LIKE '%Temporary rollback test%'
    `);

    console.log('Original stock:', originalStock);
    console.log('Temporary stock:', Number(after.rows[0].stock_on_hand));
    console.log('Movement record:', JSON.stringify(movement.rows[0]));
    console.log('Matching audit records:', audit.rows[0].count);

    if (Number(after.rows[0].stock_on_hand) !== originalStock + 1) {
      throw new Error('Stock update verification failed.');
    }

    if (
      Number(movement.rows[0].previous_qty) !== originalStock ||
      Number(movement.rows[0].new_qty) !== originalStock + 1
    ) {
      throw new Error('Movement history verification failed.');
    }

    if (audit.rows[0].count < 1) {
      throw new Error('Audit entry was not created.');
    }

    await client.query('ROLLBACK');
    console.log('\nPASS: test transaction rolled back; no test changes were retained.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(error => {
  console.error('Rollback test failed:', error.message);
  process.exitCode = 1;
});

