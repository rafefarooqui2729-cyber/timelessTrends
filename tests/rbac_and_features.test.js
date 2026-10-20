const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-rbac-'));
const { openDb } = require('../server/db');
const { createApp } = require('../server/app');

let server;
let base;
let db;

let superAdminCookie = '';
let invManagerCookie = '';
let mktManagerCookie = '';

const call = async (method, url, body, { cookie = '', raw = false } = {}) => {
  const r = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'tt',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (raw) return r;
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
};

before(async () => {
  db = openDb(':memory:');

  // Seed Super Admin
  db.prepare(`
    INSERT INTO users (email, name, password_hash, role, is_active, created_at)
    VALUES (?, ?, ?, 'super_admin', 1, ?)
  `).run('super@test.com', 'Super Admin', bcrypt.hashSync('super-secret-10', 4), new Date().toISOString());

  // Seed Inventory Manager
  db.prepare(`
    INSERT INTO users (email, name, password_hash, role, is_active, created_at)
    VALUES (?, ?, ?, 'inventory_manager', 1, ?)
  `).run('inv@test.com', 'Inventory Staff', bcrypt.hashSync('inv-secret-10', 4), new Date().toISOString());

  // Seed Marketing Manager
  db.prepare(`
    INSERT INTO users (email, name, password_hash, role, is_active, created_at)
    VALUES (?, ?, ?, 'marketing_manager', 1, ?)
  `).run('mkt@test.com', 'Marketing Staff', bcrypt.hashSync('mkt-secret-10', 4), new Date().toISOString());

  server = createApp(db, { noRateLimit: true }).listen(0);
  base = `http://localhost:${server.address().port}`;

  // Login as Super Admin
  const rSuper = await call('POST', '/api/auth/login', { email: 'super@test.com', password: 'super-secret-10' }, { raw: true });
  superAdminCookie = rSuper.headers.get('set-cookie').split(';')[0];

  // Login as Inventory Manager
  const rInv = await call('POST', '/api/auth/login', { email: 'inv@test.com', password: 'inv-secret-10' }, { raw: true });
  invManagerCookie = rInv.headers.get('set-cookie').split(';')[0];

  // Login as Marketing Manager
  const rMkt = await call('POST', '/api/auth/login', { email: 'mkt@test.com', password: 'mkt-secret-10' }, { raw: true });
  mktManagerCookie = rMkt.headers.get('set-cookie').split(';')[0];
});

after(() => server.close());

test('RBAC: Super Admin can manage staff, but staff roles cannot', async () => {
  // Super admin can view admins list
  const rAdmins = await call('GET', '/api/admin/admins', null, { cookie: superAdminCookie });
  assert.equal(rAdmins.status, 200);
  assert.equal(rAdmins.body.length, 3);

  // Inventory manager cannot view or create admins
  const rInvGetAdmins = await call('GET', '/api/admin/admins', null, { cookie: invManagerCookie });
  assert.equal(rInvGetAdmins.status, 403);
  const rInvPostAdmins = await call('POST', '/api/admin/admins', { email: 'hacker@test.com', name: 'H', role: 'super_admin', password: 'password1234' }, { cookie: invManagerCookie });
  assert.equal(rInvPostAdmins.status, 403);

  // Marketing manager cannot view or create admins
  const rMktGetAdmins = await call('GET', '/api/admin/admins', null, { cookie: mktManagerCookie });
  assert.equal(rMktGetAdmins.status, 403);
});

test('RBAC: Super Admin can invite/create new admin and deactivate them', async () => {
  const rCreate = await call('POST', '/api/admin/admins', {
    email: 'newbie@test.com',
    name: 'Newbie Staff',
    role: 'inventory_manager',
    password: 'password12345'
  }, { cookie: superAdminCookie });
  assert.equal(rCreate.status, 201);
  const newbieId = rCreate.body.id;

  // Newbie can log in
  const rLogin = await call('POST', '/api/auth/login', { email: 'newbie@test.com', password: 'password12345' });
  assert.equal(rLogin.status, 200);

  // Super admin deactivates newbie
  const rDeact = await call('PATCH', `/api/admin/admins/${newbieId}`, { is_active: false }, { cookie: superAdminCookie });
  assert.equal(rDeact.status, 200);

  // Deactivated admin cannot log in
  const rLoginBlocked = await call('POST', '/api/auth/login', { email: 'newbie@test.com', password: 'password12345' });
  assert.equal(rLoginBlocked.status, 403);
});

test('RBAC: Marketing Manager cannot adjust stock or view costs', async () => {
  // Create product via inventory manager
  const rProd = await call('POST', '/api/admin/products', {
    name: 'RBAC Test Chrono',
    selling_price: 5000,
    variants: [{ colour: 'Steel', min_stock: 2 }]
  }, { cookie: invManagerCookie });
  assert.equal(rProd.status, 201);
  const variantId = rProd.body.variants[0].id;

  // Marketing manager tries to adjust stock => Forbidden 403
  const rAdjust = await call('POST', '/api/admin/stock/adjust', {
    variantId,
    newQuantity: 50,
    reason: 'Unauthorized stock change'
  }, { cookie: mktManagerCookie });
  assert.equal(rAdjust.status, 403);

  // Inventory manager can adjust stock => 200
  const rAdjustAllowed = await call('POST', '/api/admin/stock/adjust', {
    variantId,
    newQuantity: 20,
    reason: 'Legitimate stock count'
  }, { cookie: invManagerCookie });
  assert.equal(rAdjustAllowed.status, 200);
});

test('Offers & Discounts: Promotional rules apply correctly on public endpoints', async () => {
  // Create product
  const rProd = await call('POST', '/api/admin/products', {
    name: 'Luxury Moonphase',
    selling_price: 10000,
    status: 'published',
    variants: [{ colour: 'Blue', stock_on_hand: 5 }]
  }, { cookie: invManagerCookie });
  assert.equal(rProd.status, 201);
  const prodId = rProd.body.id;
  const slug = rProd.body.slug;

  // Marketing manager creates a 20% discount offer for all products
  const rOffer = await call('POST', '/api/admin/offers', {
    title: 'Season Sale 20%',
    discount_type: 'percentage',
    discount_value: 20,
    scope: 'all',
    badge_text: '20% OFF'
  }, { cookie: mktManagerCookie });
  assert.equal(rOffer.status, 201);

  // Public endpoint applies effective discounted price (10000 - 20% = 8000)
  // Explicitly assign the promotional offer to the product.
const rAssign = await call(
  'PUT',
  `/api/admin/products/${prodId}`,
  {
    offer_id: rOffer.body.id
  },
  {
    cookie: superAdminCookie
  }
);

assert.equal(rAssign.status, 200);

// Verify the public storefront displays the discounted price.
const rPub = await call('GET', `/api/public/products/${slug}`);

  assert.equal(rPub.status, 200);
  assert.equal(rPub.body.effective_price, 8000);
  assert.equal(rPub.body.active_offer.badge_text, '20% OFF');
});

test('Categories: Deletion is blocked if products are assigned', async () => {
  // Create category
  const rCat = await call('POST', '/api/admin/categories', {
    name: 'Aviation Watches',
    slug: 'aviation'
  }, { cookie: invManagerCookie });
  assert.equal(rCat.status, 201);
  const catId = rCat.body.id;

  // Create product assigned to 'aviation'
  await call('POST', '/api/admin/products', {
    name: 'Aviator Flieger',
    category: 'aviation',
    variants: [{ colour: 'Black' }]
  }, { cookie: invManagerCookie });

  // Attempting to delete category should return 409 Conflict
  const rDel = await call('DELETE', `/api/admin/categories/${catId}`, null, { cookie: invManagerCookie });
  assert.equal(rDel.status, 409);
});

test('Product Duplication and Archival', async () => {
  const rProd = await call('POST', '/api/admin/products', {
    name: 'Original Master',
    selling_price: 4500,
    variants: [{ colour: 'Gold' }]
  }, { cookie: invManagerCookie });
  assert.equal(rProd.status, 201);
  const originalId = rProd.body.id;

  // Duplicate
  const rDup = await call('POST', `/api/admin/products/${originalId}/duplicate`, null, { cookie: invManagerCookie });
  assert.equal(rDup.status, 201);
  assert.equal(rDup.body.name, 'Original Master (Copy)');
  assert.equal(rDup.body.status, 'draft');

  // Archive original
  const rArch = await call('POST', `/api/admin/products/${originalId}/archive`, null, { cookie: invManagerCookie });
  assert.equal(rArch.status, 200);
  assert.equal(rArch.body.status, 'archived');

  // Archived products are hidden from public
  const rPub = await call('GET', `/api/public/products/${rProd.body.slug}`);
  assert.equal(rPub.status, 404);
});
