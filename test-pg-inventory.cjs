const { pool, closePool } = require('./server/pg');

const inventory = require('./server/pg-inventory');

async function main() {
  try {
    const result = await pool.query(`
      SELECT id
      FROM variants
      ORDER BY id
      LIMIT 5
    `);

    for (const row of result.rows) {
      const variant = await inventory.getVariant(pool, row.id);

      console.log(JSON.stringify({
        variant_id: variant.id,
        product: variant.product_name,
        stock_on_hand: variant.stock_on_hand,
        reserved: variant.reserved,
        available:
          Number(variant.stock_on_hand) - Number(variant.reserved),
        status: inventory.variantStatus(variant),
      }));
    }

    console.log('\nRead-only inventory test passed.');
  } finally {
    await closePool();
  }
}

main().catch(error => {
  console.error('Inventory test failed:', error.message);
  process.exitCode = 1;
});
