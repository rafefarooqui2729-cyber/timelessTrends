const { pool, closePool } = require('./server/pg');

async function main() {
  try {
    const result = await pool.query(`
      SELECT
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'public.stock_movements'::regclass
        AND contype = 'c'
      ORDER BY conname
    `);

    console.log('Stock movement constraints:');
    for (const row of result.rows) {
      console.log(`${row.constraint_name}: ${row.definition}`);
    }

    const stock = await pool.query(`
      SELECT stock_on_hand
      FROM variants
      WHERE id = 1
    `);

    console.log(
      '\nCurrent stock for variant 1:',
      stock.rows.length ? stock.rows[0].stock_on_hand : 'not found'
    );
  } finally {
    await closePool();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
