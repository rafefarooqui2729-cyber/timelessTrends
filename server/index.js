const config = require('./config');
const { createApp } = require('./app');
const { openDb } = require('./db');

async function startServer() {
  let db;

  if (process.env.DATABASE_URL) {
    try {
      const { pool, testConnection } = require('./pg');
      const conn = await testConnection();
      console.log(`Connected to Supabase PostgreSQL [database: ${conn.database}, time: ${conn.server_time}]`);

      // Purge expired sessions on startup
      await pool.query('DELETE FROM sessions WHERE expires_at < $1', [new Date().toISOString()]);
      db = pool;
    } catch (err) {
      console.warn(`PostgreSQL connection failed (${err.message}). Falling back to local SQLite.`);
      db = openDb(config.dbFile);
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
    }
  } else {
    console.log('DATABASE_URL not set; using local SQLite database.');
    db = openDb(config.dbFile);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  }

  const app = createApp(db);
  const server = app.listen(config.port, () => {
    console.log(`TIMELESS TRENDS server running on http://localhost:${config.port}`);
  });

  return server;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

