const { createAdapter } = require('../server/db-adapter');
const { openDb } = require('../server/db');
const { pool } = require('../server/pg');

async function test() {
  console.log('Testing SQLite transaction...');
  const sqliteRaw = openDb(':memory:');
  const sqlite = createAdapter(sqliteRaw);
  await sqlite.prepare('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)').run();
  
  const txSqlite = sqlite.transaction(async (tx) => {
    await tx.prepare('INSERT INTO items (val) VALUES (?)').run('A');
    await tx.prepare('INSERT INTO items (val) VALUES (?)').run('B');
  });
  await txSqlite();
  console.log('SQLite items:', await sqlite.prepare('SELECT * FROM items').all());

  console.log('\nTesting PostgreSQL transaction...');
  const pg = createAdapter(pool);
  const txPg = pg.transaction(async (tx) => {
    const res = await tx.prepare('SELECT COUNT(*)::int AS count FROM products').get();
    return res.count;
  });
  const count = await txPg();
  console.log('PostgreSQL product count in tx:', count);

  await pool.end();
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
