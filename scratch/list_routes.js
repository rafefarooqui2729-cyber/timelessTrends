const fs = require('fs');
const content = fs.readFileSync('server/app.js', 'utf8');
const lines = content.split('\n');
const routes = [];
lines.forEach((l, i) => {
  const m = l.match(/(pub|auth|admin|app)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/);
  if (m) routes.push({ line: i + 1, method: m[2].toUpperCase(), path: m[3], router: m[1] });
});
console.log('Total routes:', routes.length);
routes.forEach(r => console.log(r.line + ': ' + r.router + '.' + r.method + ' ' + r.path));
