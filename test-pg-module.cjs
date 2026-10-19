
require('dotenv').config();

const { testConnection, closePool } = require('./server/pg');

async function main() {
  try {
    const result = await testConnection();

    console.log('PostgreSQL module connection successful!');
    console.log('Database:', result.database);
    console.log('Server time:', result.server_time);
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
