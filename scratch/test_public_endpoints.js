const express = require('express');
const { pool } = require('../server/pg');
const { openDb } = require('../server/db');
const { createApp } = require('../server/app.adapted');

// Let's test the public endpoints
async function testPublic() {
  console.log('Testing public endpoints against SQLite...');
  const sqliteDb = openDb(':memory:');
  const appSqlite = createApp(sqliteDb, { noRateLimit: true });
  const serverSqlite = appSqlite.listen(0);
  const portSqlite = serverSqlite.address().port;
  
  const res1 = await fetch(`http://localhost:${portSqlite}/api/public/config`);
  console.log('SQLite /config status:', res1.status, await res1.json());
  serverSqlite.close();

  console.log('\nTesting public endpoints against Supabase PostgreSQL...');
  const appPg = createApp(pool, { noRateLimit: true });
  const serverPg = appPg.listen(0);
  const portPg = serverPg.address().port;

  const res2 = await fetch(`http://localhost:${portPg}/api/public/config`);
  console.log('PG /config status:', res2.status, await res2.json());
  
  serverPg.close();
  await pool.end();
}

testPublic().catch(console.error);
