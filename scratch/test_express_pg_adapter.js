const express = require('express');
const { pool } = require('../server/pg');
const { createAdapter } = require('../server/db-adapter');

async function test() {
  const db = createAdapter(pool);

  const app = express();
  app.get('/items', async (req, res) => {
    const items = await db.prepare('SELECT id, name, slug FROM products ORDER BY id LIMIT 2').all();
    res.json(items);
  });

  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/items`);
  const data = await res.json();
  console.log('Received data via HTTP from Supabase PG:', data);
  server.close();
  await pool.end();
}

test().catch(console.error);
