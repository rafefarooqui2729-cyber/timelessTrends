const fs = require('fs');

let code = fs.readFileSync('server/app.js', 'utf8');

// 1. Add adapter and pg service imports
const oldImports = `const inv = require('./inventory');
const ord = require('./orders');
const rep = require('./reports');`;

const newImports = `const { createAdapter } = require('./db-adapter');
const inv = require('./inventory');
const ord = require('./orders');
const rep = require('./reports');
const pgInv = require('./pg-inventory');
const pgOrd = require('./pg-orders');
const pgRep = require('./pg-reports');`;

code = code.replace(oldImports, newImports);

// 2. Make getSetting async
code = code.replace(
`function getSetting(db, key, fallback = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : fallback;
}`,
`async function getSetting(db, key, fallback = null) {
  const r = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : fallback;
}`
);

// 3. Make getActiveOffers async
code = code.replace(
`function getActiveOffers(db) {
  const today = localDate();
  return db.prepare(\`
    SELECT * FROM offers
    WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY discount_value DESC
  \`).all(today, today);
}`,
`async function getActiveOffers(db) {
  const today = localDate();
  return await db.prepare(\`
    SELECT * FROM offers
    WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY discount_value DESC
  \`).all(today, today);
}`
);

// 4. In createApp(rawDb, opts = {})
code = code.replace(
`function createApp(db, opts = {}) {`,
`function createApp(rawDb, opts = {}) {
  const db = createAdapter(rawDb);
  const currentInv = db.isPg ? pgInv : inv;
  const currentOrd = db.isPg ? pgOrd : ord;
  const currentRep = db.isPg ? pgRep : rep;`
);

fs.writeFileSync('server/app.adapted.js', code);
console.log('Saved preliminary server/app.adapted.js');
