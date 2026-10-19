const { pool, closePool } = require('./server/pg');
const inventory = require('./server/pg-inventory');

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const before = await client.query(
      'SELECT stock_on_hand FROM variants WHERE id = $1 FOR UPDATE',
      [1]
    );

    if (!before.rows.length) {
      throw new Error('Variant 1 was not found.');
    }

    const original = Number(before.rows[0].stock_on_hand);

    const result = await inventory.adjustStock(client, {
      variantId: 1,
      newQuantity: original - 1,
      reason: 'Temporary adjustment rollback test',
      userId: null,
    });

    console.log('Original quantity:', original);
    console.log('Temporary adjustment:', JSON.stringify(result));

    const current = await client.query(
      'SELECT stock_on_hand FROM variants WHERE id = $1',
      [1]
    );

    if (Number(current.rows[0].stock_on_hand) !== original - 1) {
      throw new Error('Temporary stock adjustment failed.');
    }

    if (result.quantityChange !== -1) {
      throw new Error('Unexpected movement quantity.');
    }

    await client.query('ROLLBACK');
    console.log('PASS: adjustment rolled back successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(error => {
  console.error('Adjustment test failed:', error.message);
  process.exitCode = 1;
});
