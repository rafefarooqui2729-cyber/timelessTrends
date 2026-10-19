
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'timeless.db');
const db = new Database(dbPath, { readonly: true });

try {
  const tables = db.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  for (const table of tables) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TABLE: ${table.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(table.sql);

    const columns = db.prepare(
      `PRAGMA table_info("${table.name.replace(/"/g, '""')}")`
    ).all();

    console.log('\nColumns and constraints:');
    console.table(columns.map(column => ({
      name: column.name,
      type: column.type,
      notNull: column.notnull,
      defaultValue: column.dflt_value,
      primaryKey: column.pk
    })));

    const foreignKeys = db.prepare(
      `PRAGMA foreign_key_list("${table.name.replace(/"/g, '""')}")`
    ).all();

    if (foreignKeys.length) {
      console.log('Foreign keys:');
      console.table(foreignKeys);
    }
  }
} finally {
  db.close();
}

