const { query, pool } = require('./server/pg-database');

async function main() {
  try {
    const result = await query(`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        is_identity
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'products',
          'variants',
          'stock_movements',
          'purchases',
          'suppliers',
          'audit_logs',
          'orders',
          'order_items',
          'returns'
        )
      ORDER BY table_name, ordinal_position
    `);

    let currentTable = '';

    for (const column of result.rows) {
      if (column.table_name !== currentTable) {
        currentTable = column.table_name;
        console.log(`\n--- ${currentTable} ---`);
      }

      console.log(
        `${column.column_name} | ${column.data_type} | ` +
        `nullable=${column.is_nullable} | ` +
        `identity=${column.is_identity} | ` +
        `default=${column.column_default ?? 'none'}`
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Schema inspection failed:', error.message);
  process.exitCode = 1;
});
