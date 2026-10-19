require('dotenv').config();

const { Pool } = require('pg');

async function testConnection() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing from your .env file.');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(
      'SELECT current_database() AS database, NOW() AS server_time'
    );

    console.log('Supabase connection successful!');
    console.log('Database:', result.rows[0].database);
    console.log('Server time:', result.rows[0].server_time);
  } catch (error) {
    console.error('Supabase connection failed.');
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();