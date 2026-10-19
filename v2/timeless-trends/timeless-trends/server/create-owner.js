// Usage: npm run create-owner -- owner@example.com "Owner Name"   (password is prompted, never stored in plain text)
const readline = require('readline');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { openDb } = require('./db');
const [email, name] = process.argv.slice(2);
if (!email) { console.error('Usage: npm run create-owner -- email "Name"'); process.exit(1); }
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Choose a password (min 10 characters; typing is visible): ', (pw) => {
  rl.close();
  if (pw.length < 10) { console.error('Password too short.'); process.exit(1); }
  const db = openDb(config.dbFile);
  db.prepare(`INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`)
    .run(email.toLowerCase(), name || null, bcrypt.hashSync(pw, 12), 'owner', new Date().toISOString());
  console.log('Owner account saved.');
});
