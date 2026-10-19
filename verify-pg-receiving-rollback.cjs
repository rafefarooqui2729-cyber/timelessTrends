const { pool, closePool } = require('./server/pg');

async function main() {
  const stock = await pool.query(`
    SELECT id, stock_on_hand, avg_cost
    FROM variants
    WHERE id = 1
  `);

  const purchase = await pool.query(`
    SELECT id
    FROM purchases
    WHERE reference = $1
  `, ['TEMP-RECEIVE-ROLLBACK-TEST']);

  const movement = await pool.query(`
    SELECT id
    FROM stock_movements
    WHERE reason = $1
  `, ['Temporary receiving rollback test']);

  console.table(stock.rows);

  console.log(
    'Temporary purchase remaining:',
    purchase.rows.length
  );

  console.log(
    'Temporary movement remaining:',
    movement.rows.length
  );

  if (
    !stock.rows.length ||
    Number(stock.rows[0].stock_on_hand) !== 8 ||
    Number(stock.rows[0].avg_cost) !== 1600 ||
    purchase.rows.length !== 0 ||
    movement.rows.length !== 0
  ) {
    throw new Error('Verification failed. Stop and report the output.');
  }

  console.log('PASS: original inventory and cost are intact.');
}

main()
  .catch(error => {
    console.error('Verification failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
