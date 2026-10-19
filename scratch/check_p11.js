const { openDb } = require('../server/db');
const db = openDb('data/timeless.db');
console.log('SQLite Product 11:', db.prepare('SELECT id, name, status, is_active FROM products WHERE id = 11').get());
console.log('SQLite Published count:', db.prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND is_active = 1").get().c);
console.log('SQLite Total products:', db.prepare("SELECT COUNT(*) AS c FROM products").get().c);
