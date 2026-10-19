require('dotenv').config();

const { pool, closePool } = require('./server/pg');

async function cleanupCatalog() {
  const client = await pool.connect();

  try {
    console.log('Starting controlled AI catalog cleanup...');

    await client.query('BEGIN');

    // Prevent simultaneous catalog changes during cleanup.
    await client.query('LOCK TABLE products, variants, stock_movements, images, purchases IN EXCLUSIVE MODE');

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM variants) AS variants,
        (SELECT COUNT(*) FROM images) AS images,
        (SELECT COUNT(*) FROM stock_movements) AS movements,
        (SELECT COUNT(*) FROM purchases) AS purchases,
        (SELECT COUNT(*) FROM enquiries) AS enquiries,
        (SELECT COUNT(*) FROM order_items) AS order_items
    `);

    const current = counts.rows[0];

    console.log('Current database counts:', current);

    const expected = {
      products: 11,
      variants: 22,
      images: 5,
      movements: 24,
      purchases: 1,
      enquiries: 0,
      order_items: 0
    };

    for (const [key, expectedCount] of Object.entries(expected)) {
      if (Number(current[key]) !== expectedCount) {
        throw new Error(
          `Safety check failed: ${key} expected ${expectedCount}, found ${current[key]}`
        );
      }
    }

    // Stock movements reference variants, so remove them first.
    await client.query('DELETE FROM stock_movements');

    // Delete the AI-generated purchase.
    await client.query('DELETE FROM purchases');

    // Delete image database records.
    await client.query('DELETE FROM images');

    // Delete colour variants.
    await client.query('DELETE FROM variants');

    // Delete AI-generated watches.
    await client.query('DELETE FROM products');

    const verification = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM variants) AS variants,
        (SELECT COUNT(*) FROM images) AS images,
        (SELECT COUNT(*) FROM stock_movements) AS movements,
        (SELECT COUNT(*) FROM purchases) AS purchases
    `);

    const remaining = verification.rows[0];

    for (const [table, count] of Object.entries(remaining)) {
      if (Number(count) !== 0) {
        throw new Error(
          `Cleanup verification failed: ${table} still contains ${count} records`
        );
      }
    }

    await client.query('COMMIT');

    console.log('AI-generated catalog successfully cleared.');
    console.log('Admin accounts, audit logs, and database structure preserved.');
    console.log('The shop owner can now add real watches and stock.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup cancelled and rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

cleanupCatalog();