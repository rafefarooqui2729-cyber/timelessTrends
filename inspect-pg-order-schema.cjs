const { pool, closePool } = require('./server/pg');

async function main() {
  const tables = [
    'orders',
    'order_items',
    'payments',
    'returns',
    'enquiries',
    'variants',
    'products',
    'stock_movements',
    'audit_logs'
  ];

  const columns = await pool.query(`
    SELECT
      table_name,
      ordinal_position,
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [tables]);

  for (const table of tables) {
    console.log('\n--- ' + table + ' ---');

    const rows = columns.rows.filter(
      row => row.table_name === table
    );

    if (!rows.length) {
      console.log('TABLE NOT FOUND');
      continue;
    }

    console.table(rows.map(row => ({
      column: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable,
      default: row.column_default
    })));
  }

  const constraints = await pool.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS referenced_table,
      ccu.column_name AS referenced_column
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.constraint_schema = kcu.constraint_schema
      AND tc.table_name = kcu.table_name
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.constraint_schema = ccu.constraint_schema
      AND tc.table_name = ccu.table_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = ANY($1::text[])
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `, [tables]);

  console.log('\n--- CONSTRAINTS ---');
  console.table(constraints.rows);
}

main()
  .catch(error => {
    console.error('Schema inspection failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
