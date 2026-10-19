const { pool, closePool } = require('./server/pg');

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN READ ONLY');

    const result = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.products) AS products,
        (SELECT COUNT(*)::int FROM public.variants) AS variants,
        (SELECT COUNT(*)::int FROM public.users) AS users,
        (SELECT COUNT(*)::int FROM public.stock_movements) AS movements,
        current_database() AS database
    `);

    console.log('PostgreSQL application smoke test:');
    console.log(JSON.stringify(result.rows[0], null, 2));

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'products', 'variants', 'orders', 'order_items',
          'payments', 'returns', 'stock_movements',
          'audit_logs', 'sessions'
        )
      ORDER BY table_name
    `);

    console.log('\nRequired application tables:');
    console.log(tables.rows.map(row => row.table_name).join(', '));

    if (tables.rows.length !== 9) {
      throw new Error('One or more required application tables are missing.');
    }

    await client.query('ROLLBACK');
    console.log('\nRead-only transaction completed successfully.');
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(error => {
  console.error('PostgreSQL smoke test failed:', error.message);
  process.exitCode = 1;
});
