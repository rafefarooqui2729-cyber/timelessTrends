const express = require('express');
const { openDb } = require('../server/db');
const { createAdapter } = require('../server/db-adapter');

async function test() {
  const sqliteRaw = openDb(':memory:');
  const db = createAdapter(sqliteRaw);

  await db.prepare('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)').run();
  await db.prepare('INSERT INTO test (name) VALUES (?)').run('Watch 1');

  const app = express();
  app.get('/items', async (req, res) => {
    const items = await db.prepare('SELECT * FROM test').all();
    res.json(items);
  });

  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/items`);
  const data = await res.json();
  console.log('Received data via HTTP:', data);
  server.close();
}

test().catch(console.error);
