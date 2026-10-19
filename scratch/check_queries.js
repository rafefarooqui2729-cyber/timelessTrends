const fs = require('fs');

const queries = JSON.parse(fs.readFileSync('scratch/extracted_queries.json', 'utf8'));

const sqliteSpecific = [];
for (const q of queries) {
  if (/strftime|datetime\(|date\(|julianday|group_concat|INSERT\s+OR\s+IGNORE|INSERT\s+OR\s+REPLACE|sqlite_|last_insert_rowid/i.test(q)) {
    sqliteSpecific.push(q);
  }
}

console.log('SQLite specific queries found:', sqliteSpecific.length);
sqliteSpecific.forEach((q, i) => console.log(`\n--- [${i+1}] ---\n`, q));
