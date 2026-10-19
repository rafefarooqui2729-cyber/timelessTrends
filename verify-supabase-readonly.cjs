const { pool, closePool } = require('./server/pg');

async function main() {
  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log('\n--- SUPABASE TABLES AND ROW COUNTS ---');

  for (const row of tablesResult.rows) {
    const table = row.table_name;

    // Table names come from information_schema, not user input.
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public."${table.replace(/"/g, '""')}"`
    );

    console.log(`${table}: ${result.rows[0].count}`);
  }

  console.log('\n--- IMPORTANT COLUMN TYPES ---');

  const columns = await pool.query(`
    SELECT table_name, column_name, data_type,
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'products', 'variants', 'stock_movements',
        'orders', 'order_items', 'payments',
        'returns', 'purchases', 'expenses',
        'savings_entries', 'enquiries', 'images',
        'audit_logs', 'users'
      )
    ORDER BY table_name, ordinal_position
  `);

  for (const column of columns.rows) {
    console.log(
      `${column.table_name}.${column.column_name} | ` +
      `${column.data_type} | nullable=${column.is_nullable} | ` +
      `default=${column.column_default ?? 'none'}`
    );
  }
}

main()
  .catch((error) => {
    console.error('Verification failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
