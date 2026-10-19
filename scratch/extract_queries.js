const fs = require('fs');

const content = fs.readFileSync('server/app.js', 'utf8');
const regex = /db\.prepare\(\s*(`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\s*\)/g;
let m;
const queries = [];
while ((m = regex.exec(content)) !== null) {
  queries.push(m[1].trim());
}
console.log('Total queries found:', queries.length);
fs.writeFileSync('scratch/extracted_queries.json', JSON.stringify(queries, null, 2));
