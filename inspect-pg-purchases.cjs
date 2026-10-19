const { pool, closePool } = require('./server/pg');

async function main() {
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND (
        table_name LIKE '%purchase%'
        OR table_name LIKE '%supplier%'
        OR table_name = 'variants'
        OR table_name = 'stock_movements'
      )
    ORDER BY table_name
  `);

  console.log('\nRelevant tables:');
  console.table(tables.rows);

  for (const row of tables.rows) {
    const tableName = row.table_name;

    const columns = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    console.log(`\nColumns: ${tableName}`);
    console.table(columns.rows);

    const constraints = await pool.query(`
      SELECT
        c.conname AS constraint_name,
        c.contype AS constraint_type,
        pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = $1
      ORDER BY c.conname
    `, [tableName]);

    console.log(`Constraints: ${tableName}`);
    console.table(constraints.rows);
  }

  const costs = await pool.query(`
    SELECT id, product_id, sku, stock_on_hand, reserved, avg_cost
    FROM variants
    ORDER BY id
    LIMIT 5
  `);

  console.log('\nCurrent sample inventory and costs:');
  console.table(costs.rows);
}

main()
  .catch(error => {
    console.error('Schema inspection failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
