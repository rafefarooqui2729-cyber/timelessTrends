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

    if (original < 1) {
      throw new Error('Variant 1 has no stock available for this test.');
    }

    const result = await inventory.removeStock(client, {
      variantId: 1,
      quantity: 1,
      type: 'damage_loss',
      reason: 'Temporary removal rollback test',
      userId: null,
    });

    console.log('Original quantity:', original);
    console.log('Temporary removal:', JSON.stringify(result));

    if (result.previous !== original || result.next !== original - 1) {
      throw new Error('Unexpected stock removal result.');
    }

    await client.query('ROLLBACK');
    console.log('PASS: stock removal rolled back successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(error => {
  console.error('Removal test failed:', error.message);
  process.exitCode = 1;
});
