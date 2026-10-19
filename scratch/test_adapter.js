const { createAdapter } = require('../server/db-adapter');
const { openDb } = require('../server/db');
const { pool } = require('../server/pg');

async function test() {
  console.log('Testing SQLite adapter...');
  const sqliteRaw = openDb(':memory:');
  const sqlite = createAdapter(sqliteRaw);
  
  await sqlite.prepare('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)').run();
  const res1 = await sqlite.prepare('INSERT INTO test (name) VALUES (?)').run('Item 1');
  console.log('SQLite insert result:', res1);
  const rows1 = await sqlite.prepare('SELECT * FROM test WHERE name = ?').all('Item 1');
  console.log('SQLite select all:', rows1);
  const row1 = await sqlite.prepare('SELECT * FROM test WHERE id = ?').get(1);
  console.log('SQLite select get:', row1);

  console.log('\nTesting PostgreSQL adapter...');
  const pg = createAdapter(pool);
  const rows2 = await pg.prepare('SELECT id, name, slug FROM products ORDER BY id LIMIT 2').all();
  console.log('PostgreSQL select all:', rows2);
  const row2 = await pg.prepare('SELECT id, name, slug FROM products WHERE id = ?').get(rows2[0].id);
  console.log('PostgreSQL select get:', row2);

  await pool.end();
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
