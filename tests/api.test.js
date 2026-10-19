const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('os'); const fs = require('fs'); const path = require('path');
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-'));
const { openDb } = require('../server/db');
const { createApp } = require('../server/app');
const { localDate } = require('../server/util');

let server; let base; let db; let cookie = '';
const call = async (method, url, body, { auth = true, raw = false } = {}) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'tt', ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  if (raw) return r;
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
};
const A = (u) => `/api/admin${u}`;

before(async () => {
  db = openDb(':memory:');
  db.prepare('INSERT INTO users (email,name,password_hash,created_at) VALUES (?,?,?,?)').run('owner@test.com', 'Owner', bcrypt.hashSync('correct-horse-1', 4), new Date().toISOString());
  server = createApp(db, { noRateLimit: true }).listen(0); base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('private API rejects unauthenticated access', async () => {
  for (const u of ['/products', '/inventory', '/orders', '/expenses', '/reports/overview', '/export/orders', '/audit', '/settings']) {
    const r = await call('GET', A(u), null, { auth: false }); assert.equal(r.status, 401, u);
  }
  assert.equal((await call('POST', A('/stock/adjust'), {}, { auth: false })).status, 401);
});

test('login: wrong password rejected, correct sets httpOnly cookie, writes need CSRF header', async () => {
  assert.equal((await call('POST', '/api/auth/login', { email: 'owner@test.com', password: 'nope' }, { auth: false })).status, 401);
  const r = await call('POST', '/api/auth/login', { email: 'owner@test.com', password: 'correct-horse-1' }, { auth: false, raw: true });
  assert.equal(r.status, 200);
  const sc = r.headers.get('set-cookie'); assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Lax/);
  cookie = sc.split(';')[0];
  const noHeader = await fetch(base + A('/expenses'), { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}' });
  assert.equal(noHeader.status, 403);
});

let P; let black; let silver;
test('create product with two variants; public site hides private data and drafts', async () => {
  const r = await call('POST', A('/products'), { name: 'Classic Chrono', brand: 'Acme', category: 'Chronograph', selling_price: 2500,
    variants: [{ colour: 'Black', min_stock: 2 }, { colour: 'Silver' }] });
  assert.equal(r.status, 201); P = r.body; [black, silver] = P.variants;
  assert.equal(P.slug, 'classic-chrono');
  assert.equal((await call('GET', '/api/public/products', null, { auth: false })).body.length, 0); // draft hidden
  await call('PUT', A(`/products/${P.id}`), { status: 'published' });
  const pub = await call('GET', '/api/public/products/classic-chrono', null, { auth: false });
  assert.equal(pub.status, 200);
  const txt = JSON.stringify(pub.body);
  for (const k of ['avg_cost', 'stock_on_hand', 'reserved', 'purchase', 'cost']) assert.ok(!txt.includes(k), `public leaks ${k}`);
  assert.equal(pub.body.variants.every((v) => v.available === false), true); // no stock yet => not available
  assert.equal((await call('GET', '/api/public/products/nope', null, { auth: false })).status, 404);
});

test('receiving stock updates quantities, weighted cost, and writes audit movements', async () => {
  await call('POST', A('/stock/receive'), { items: [{ variantId: black.id, quantity: 10, unitCost: 1000 }, { variantId: silver.id, quantity: 3, unitCost: 1100 }] });
  await call('POST', A('/stock/receive'), { items: [{ variantId: black.id, quantity: 10, unitCost: 1200 }] });
  const inv = (await call('GET', A('/inventory'))).body;
  const b = inv.rows.find((r) => r.variant_id === black.id);
  assert.equal(b.stock_on_hand, 20); assert.equal(b.avg_cost, 1100);
  assert.equal(inv.valuation.value_at_cost, 20 * 1100 + 3 * 1100);
  const mv = (await call('GET', A(`/stock/movements?variantId=${black.id}`))).body;
  assert.equal(mv.length, 2); assert.equal(mv[0].previous_qty, 10); assert.equal(mv[0].new_qty, 20);
  assert.equal((await call('GET', '/api/public/products/classic-chrono', null, { auth: false })).body.variants[0].available, true);
});

test('WhatsApp click records website activity only, never stock or orders', async () => {
  const before = (await call('GET', A('/inventory'))).body.rows.find((r) => r.variant_id === black.id);
  const r = await call('POST', '/api/public/enquiries/click', { productId: P.id, variantId: black.id, source: 'insta' }, { auth: false });
  assert.equal(r.status, 201); assert.match(r.body.ref, /^ENQ-/);
  const after = (await call('GET', A('/inventory'))).body.rows.find((r2) => r2.variant_id === black.id);
  assert.equal(after.stock_on_hand, before.stock_on_hand); assert.equal(after.reserved, before.reserved);
  assert.equal((await call('GET', A('/orders'))).body.length, 0);
  assert.equal((await call('GET', A('/enquiries'))).body[0].status, 'clicked');
  assert.equal((await call('POST', '/api/public/enquiries/click', { productId: 9999 }, { auth: false })).status, 404);
});

let order;
test('order workflow: confirm reserves once, complete sells once, repeated updates never double-deduct', async () => {
  const r = await call('POST', A('/orders'), { customerName: 'Asha', items: [{ variantId: black.id, quantity: 4, unitPrice: 2500, lineDiscount: 100 }] });
  assert.equal(r.status, 201); order = r.body; assert.equal(order.total, 9900);
  const v = async () => (await call('GET', A('/inventory'))).body.rows.find((x) => x.variant_id === black.id);
  assert.equal((await v()).reserved, 0);
  for (let i = 0; i < 3; i++) await call('POST', A(`/orders/${order.id}/status`), { status: 'confirmed' });
  let s = await v(); assert.equal(s.reserved, 4); assert.equal(s.stock_on_hand, 20); assert.equal(s.available, 16);
  for (let i = 0; i < 3; i++) await call('POST', A(`/orders/${order.id}/status`), { status: 'completed' });
  s = await v(); assert.equal(s.reserved, 0); assert.equal(s.stock_on_hand, 16);
  const sales = (await call('GET', A(`/stock/movements?variantId=${black.id}&type=sale`))).body; assert.equal(sales.length, 1);
  assert.equal((await call('POST', A(`/orders/${order.id}/status`), { status: 'cancelled', cancelReason: 'x' })).status, 409); // completed can't be cancelled
});

test('cannot over-reserve or sell more than available; no negative stock', async () => {
  const r = await call('POST', A('/orders'), { items: [{ variantId: silver.id, quantity: 4 }], status: 'confirmed' });
  assert.equal(r.status, 409); assert.match(r.body.error, /Not enough/);
  assert.equal((await call('GET', A('/orders'))).body.length, 1); // failed create rolled back entirely
});

test('missing price is never treated as zero', async () => {
  const p2 = (await call('POST', A('/products'), { name: 'No Price', variants: [{ colour: 'Gold' }] })).body;
  const r = await call('POST', A('/orders'), { items: [{ variantId: p2.variants[0].id, quantity: 1 }] });
  assert.equal(r.status, 400); assert.match(r.body.error, /price/i);
});

test('cancelling a reserved order releases reservation and needs a reason', async () => {
  const o = (await call('POST', A('/orders'), { items: [{ variantId: silver.id, quantity: 2 }], status: 'confirmed' })).body;
  let s = (await call('GET', A('/inventory'))).body.rows.find((x) => x.variant_id === silver.id); assert.equal(s.reserved, 2);
  assert.equal((await call('POST', A(`/orders/${o.id}/status`), { status: 'cancelled' })).status, 400);
  assert.equal((await call('POST', A(`/orders/${o.id}/status`), { status: 'cancelled', cancelReason: 'Customer changed mind' })).status, 200);
  s = (await call('GET', A('/inventory'))).body.rows.find((x) => x.variant_id === silver.id); assert.equal(s.reserved, 0); assert.equal(s.stock_on_hand, 3);
  assert.equal((await call('POST', A(`/orders/${o.id}/status`), { status: 'confirmed' })).status, 409); // cannot reopen
});

test('returns: sellable restocks, damaged does not; refund value computed', async () => {
  const item = order.items[0];
  const r1 = await call('POST', A(`/orders/${order.id}/items/${item.id}/return`), { quantity: 1, condition: 'sellable' });
  assert.equal(r1.status, 200); assert.equal(r1.body.status, 'partially_returned');
  let s = (await call('GET', A('/inventory'))).body.rows.find((x) => x.variant_id === black.id); assert.equal(s.stock_on_hand, 17);
  const r2 = await call('POST', A(`/orders/${order.id}/items/${item.id}/return`), { quantity: 1, condition: 'damaged' });
  assert.equal(r2.status, 200);
  s = (await call('GET', A('/inventory'))).body.rows.find((x) => x.variant_id === black.id); assert.equal(s.stock_on_hand, 17);
  assert.equal(r2.body.returned_value, 2 * 2475);
  assert.equal((await call('POST', A(`/orders/${order.id}/items/${item.id}/return`), { quantity: 5, condition: 'sellable' })).status, 409);
});

test('adjustments need a reason, keep history, and cannot go negative', async () => {
  assert.equal((await call('POST', A('/stock/adjust'), { variantId: black.id, newQuantity: 15, reason: '  ' })).status, 400);
  assert.equal((await call('POST', A('/stock/adjust'), { variantId: black.id, newQuantity: 15, reason: 'Stock count' })).status, 200);
  assert.equal((await call('POST', A('/stock/adjust'), { variantId: black.id, newQuantity: -1, reason: 'x' })).status, 400);
  const mv = (await call('GET', A(`/stock/movements?variantId=${black.id}&type=manual_correction`))).body;
  assert.equal(mv[0].previous_qty, 17); assert.equal(mv[0].new_qty, 15); assert.equal(mv[0].quantity_change, -2);
  assert.equal((await call('POST', A('/stock/remove'), { variantId: silver.id, quantity: 99, type: 'damage_loss', reason: 'x' })).status, 409);
});

test('payments are derived into payment status, kept separate from order status', async () => {
  let o = (await call('POST', A(`/orders/${order.id}/payments`), { kind: 'payment', amount: 3000 })).body;
  assert.equal(o.payment_status, 'partially_paid'); // due after returns = 9900 - 4950 = 4950
  o = (await call('POST', A(`/orders/${order.id}/payments`), { kind: 'payment', amount: 6900 })).body;
  assert.equal(o.payment_status, 'paid'); assert.equal(o.status, 'partially_returned');
});

test('daily stock summary satisfies the closing-stock equation and matches balances', async () => {
  const d = (await call('GET', A(`/stock/daily?date=${localDate()}`))).body;
  assert.equal(d.closing_stock, d.opening_stock + d.stock_received - d.units_sold + d.returns_to_sellable_stock - d.other_reductions + d.adjustments);
  const total = (await call('GET', A('/inventory'))).body.rows.reduce((s, r) => s + r.stock_on_hand, 0);
  assert.equal(d.closing_stock, total);
  assert.equal(d.damaged_returns_not_restocked, 1);
});

test('financials: revenue, COGS, expenses, profit and cash are separate and correct', async () => {
  await call('POST', A('/expenses'), { category: 'Advertising', amount: 500, description: 'Ad' });
  const m = (await call('GET', A(`/reports/monthly?month=${localDate().slice(0, 7)}`))).body; const f = m.financials;
  // sold 4 @2500 less 100 discount = 9900; returned 2 units (2475 each) = 4950
  assert.equal(f.gross_sales, 9900); assert.equal(f.returns_value, 4950); assert.equal(f.net_sales_revenue, 4950);
  // cost 1100 x 4 sold, minus 1 sellable return cost back (1100) = 3300  (damaged unit cost stays as loss)
  assert.equal(f.cost_of_goods_sold, 3300); assert.equal(f.gross_profit, 1650);
  assert.equal(f.operating_expenses, 500); assert.equal(f.estimated_operating_profit, 1150);
  assert.equal(m.units_sold, 4); assert.equal(m.units_returned, 2);
  // cash = received 9900 - refunds 0 - expenses 500 - supplier paid (10k+3.3k+12k)
  assert.equal(f.cash.received, 9900); assert.equal(f.cash.supplier_payments, 10 * 1000 + 3 * 1100 + 10 * 1200);
  assert.notEqual(f.estimated_operating_profit, f.cash.net_movement);
  assert.equal(m.orders.cancelled, 1); assert.equal(m.website_activity.whatsapp_button_clicks, 1); assert.equal(m.enquiries_recorded, 0);
  assert.equal(m.best_sellers.byProduct[0].units, 2);
});

test('savings entries do not alter profit or cash figures', async () => {
  const before = (await call('GET', A(`/reports/monthly?month=${localDate().slice(0, 7)}`))).body;
  await call('POST', A('/savings'), { direction: 'deposit', amount: 1000, note: 'Moved to savings' });
  const after = (await call('GET', A(`/reports/monthly?month=${localDate().slice(0, 7)}`))).body;
  assert.equal(after.financials.estimated_operating_profit, before.financials.estimated_operating_profit);
  assert.equal(after.financials.cash.net_movement, before.financials.cash.net_movement);
  assert.equal(after.savings_fund_balance_end_of_month, 1000);
});

test('month boundaries respect business dates', async () => {
  const past = (await call('GET', A('/reports/monthly?month=2020-01'))).body;
  assert.equal(past.financials.gross_sales, 0); assert.equal(past.units_sold, 0);
  assert.equal((await call('GET', A('/reports/monthly?month=bad'))).status, 400);
});

test('CSV export matches data and neutralises formula injection', async () => {
  await call('POST', A('/expenses'), { category: 'Misc', amount: 10, description: '=HYPERLINK("http://evil")' });
  const r = await call('GET', A('/export/expenses'), null, { raw: true }); const t = await r.text();
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.equal(t.trim().split('\r\n').length, 3); assert.ok(t.includes(`'=HYPERLINK`));
});

test('settings validate WhatsApp number; public config exposes it; unconfigured is null', async () => {
  assert.equal((await call('GET', '/api/public/config', null, { auth: false })).body.whatsappNumber, null);
  assert.equal((await call('PUT', A('/settings'), { whatsapp_number: '+91 98765' })).status, 400);
  assert.equal((await call('PUT', A('/settings'), { whatsapp_number: '919876543210' })).status, 200);
  assert.equal((await call('GET', '/api/public/config', null, { auth: false })).body.whatsappNumber, '919876543210');
});

test('variant with history cannot be deleted; logout invalidates session', async () => {
  assert.equal((await call('DELETE', A(`/variants/${black.id}`))).status, 409);
  await call('POST', '/api/auth/logout', {});
  assert.equal((await call('GET', A('/products'))).status, 401);
});

test('image upload keeps original separate, serves only optimised copy, rejects non-images', async () => {
  const sharp = require('sharp');
  await call('POST', '/api/auth/login', { email: 'owner@test.com', password: 'correct-horse-1' }, { auth: false, raw: true }).then((r) => { cookie = r.headers.get('set-cookie').split(';')[0]; });
  const png = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#888' } }).png().toBuffer();
  const fd = new FormData(); fd.append('image', new Blob([png], { type: 'image/png' }), 'w.png'); fd.append('variantId', String(black.id));
  const r = await fetch(base + A(`/products/${P.id}/images`), { method: 'POST', headers: { Cookie: cookie, 'X-Requested-With': 'tt' }, body: fd });
  assert.equal(r.status, 201); const p = await r.json(); const img = p.images[0];
  assert.match(img.url, /^\/uploads\/[0-9a-f]+\.webp$/);
const storedImage = db.prepare(
  'SELECT original_path FROM images WHERE id = ?'
).get(img.id);

assert.ok(storedImage, 'uploaded image should be saved in the database');

assert.ok(
  fs.existsSync(
    path.join(process.env.UPLOAD_DIR, 'originals', storedImage.original_path)
  ),
  'original image should exist in the private originals directory'
);  const served = await fetch(base + img.url); assert.equal(served.status, 200);
  const meta = await sharp(Buffer.from(await served.arrayBuffer())).metadata(); assert.equal(meta.format, 'webp'); assert.ok(meta.width <= 1600);
  const traversal = await fetch(base + `/uploads/../originals/${img.original_path}`); assert.ok(!/image/.test(traversal.headers.get('content-type') || ''), 'original must not be served');
  assert.equal((await fetch(base + `/uploads/${img.original_path}`)).status, 404);
  const pub = (await call('GET', '/api/public/products/classic-chrono', null, { auth: false })).body;
  assert.equal(pub.images[0].variantId, black.id);
  assert.ok(!JSON.stringify(pub).includes('original_path'));
  const bad = new FormData(); bad.append('image', new Blob(['not an image'], { type: 'image/png' }), 'x.png');
  assert.equal((await fetch(base + A(`/products/${P.id}/images`), { method: 'POST', headers: { Cookie: cookie, 'X-Requested-With': 'tt' }, body: bad })).status >= 400, true);
});
