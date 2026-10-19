const fs = require('fs');

const content = fs.readFileSync('server/app.js', 'utf8');
const lines = content.split('\n');

const uses = [];
lines.forEach((line, index) => {
  if (/\bdb\b/.test(line)) {
    uses.push({ line: index + 1, text: line.trim() });
  }
});

console.log('Total lines using `db`:', uses.length);
fs.writeFileSync('scratch/db_uses.json', JSON.stringify(uses, null, 2));
