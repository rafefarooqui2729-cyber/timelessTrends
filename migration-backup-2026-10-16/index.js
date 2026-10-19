const config = require('./config');
const { openDb } = require('./db');
const { createApp } = require('./app');
const db = openDb(config.dbFile);
// purge expired sessions on start
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
createApp(db).listen(config.port, () => console.log(`TIMELESS TRENDS server on http://localhost:${config.port}`));
