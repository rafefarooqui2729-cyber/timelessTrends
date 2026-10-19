const { query, withTransaction } = require('./server/pg-database');
const { closePool } = require('./server/pg');

async function main() {
  try {
    const result = await withTransaction(async (client) => {
      await client.query('SET TRANSACTION READ ONLY');

      const db = await client.query(
        'SELECT current_database() AS database'
      );

      const counts = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM products) AS products,
          (SELECT COUNT(*)::int FROM variants) AS variants
      `);

      return { ...db.rows[0], ...counts.rows[0] };
    });

    console.log('PostgreSQL helper test passed:');
    console.log(JSON.stringify(result, null, 2));

    const check = await query(
      'SELECT COUNT(*)::int AS count FROM audit_logs'
    );

    console.log('Audit rows remain readable:', check.rows[0].count);
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('Helper test failed:', error.message);
  process.exitCode = 1;
});
