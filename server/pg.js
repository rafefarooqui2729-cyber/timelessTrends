
const { Pool } = require('pg');
const config = require('./config');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is missing. Check the root .env file.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

async function testConnection() {
  const result = await pool.query(
    'SELECT current_database() AS database, NOW() AS server_time'
  );

  return result.rows[0];
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  testConnection,
  closePool,
};
