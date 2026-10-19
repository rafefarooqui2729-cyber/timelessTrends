const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'timeless.db');
const db = new Database(dbPath, { readonly: true });

try {
  const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log('\n=== SQLite Database Inspection ===');
  console.log('Database:', dbPath);
  console.log('Total tables:', tables.length);

  for (const { name } of tables) {
    const safeName = name.replace(/"/g, '""');
    const result = db.prepare(
      `SELECT COUNT(*) AS total FROM "${safeName}"`
    ).get();

    console.log(`${name}: ${result.total} records`);
  }
} finally {
  db.close();
}