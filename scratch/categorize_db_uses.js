const fs = require('fs');
const uses = JSON.parse(fs.readFileSync('scratch/db_uses.json', 'utf8'));

const categories = {
  dbPrepare: [],
  dbTransaction: [],
  getSetting: [],
  getActiveOffers: [],
  inv: [],
  ord: [],
  rep: [],
  other: []
};

uses.forEach(u => {
  if (u.text.includes('db.prepare')) categories.dbPrepare.push(u);
  else if (u.text.includes('db.transaction')) categories.dbTransaction.push(u);
  else if (u.text.includes('getSetting(')) categories.getSetting.push(u);
  else if (u.text.includes('getActiveOffers(')) categories.getActiveOffers.push(u);
  else if (/\binv\./.test(u.text)) categories.inv.push(u);
  else if (/\bord\./.test(u.text)) categories.ord.push(u);
  else if (/\brep\./.test(u.text)) categories.rep.push(u);
  else categories.other.push(u);
});

console.log('dbPrepare:', categories.dbPrepare.length);
console.log('dbTransaction:', categories.dbTransaction.length);
console.log('getSetting:', categories.getSetting.length);
console.log('getActiveOffers:', categories.getActiveOffers.length);
console.log('inv:', categories.inv.length);
console.log('ord:', categories.ord.length);
console.log('rep:', categories.rep.length);
console.log('other:', categories.other.length);
if (categories.other.length > 0) {
  console.log('\nOther:');
  categories.other.forEach(o => console.log(`${o.line}: ${o.text}`));
}
