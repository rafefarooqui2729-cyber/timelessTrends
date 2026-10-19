const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, testConnection, closePool } = require('../server/pg');
const { createApp } = require('../server/app');

let server;
let base;
let cookie = '';

const call = async (method, url, body, { auth = true, raw = false } = {}) => {
  const r = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'tt',
      ...(auth && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return r;
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, body: json, headers: r.headers };
};

before(async () => {
  // Verify Supabase PostgreSQL connection
  const conn = await testConnection();
  assert.ok(conn.database, 'Connected to Supabase PostgreSQL database');

  // Start app backed by Supabase PostgreSQL pool
  const app = createApp(pool, { noRateLimit: true });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  if (server) server.close();
  await closePool();
});

test('Supabase PG: Public /config returns business settings and WhatsApp number', async () => {
  const r = await call('GET', '/api/public/config', null, { auth: false });
  assert.equal(r.status, 200);
  assert.ok(r.body.businessName);
  assert.equal(r.body.currency, 'INR');
  assert.equal(r.body.currencySymbol, '₹');
});

test('Supabase PG: Public /products loads published watches with variants and pricing', async () => {
  const r = await call('GET', '/api/public/products', null, { auth: false });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body), 'Products must be an array');
  assert.equal(r.body.length, 10, `Expected 10 published products, found ${r.body.length}`);

  // All returned products must have variants and parsed specs
  for (const p of r.body) {
    assert.ok(Array.isArray(p.variants), `Product ${p.id} must have variants array`);
    assert.ok(Array.isArray(p.specs), `Product ${p.id} specs must be an array`);
  }

  // Verify product 6 (null price watch)
  const skeleton = r.body.find((p) => p.id === 6);
  if (skeleton) {
    assert.equal(skeleton.selling_price, null, 'Product 6 selling_price must be null');
    assert.equal(skeleton.price_from, null, 'Product 6 price_from must be null');
  }
});

test('Supabase PG: Public /products/:slug fetches watch by slug with full detail', async () => {
  const r = await call('GET', '/api/public/products/aethelgard-master-chronograph', null, { auth: false });
  assert.equal(r.status, 200);
  assert.equal(r.body.slug, 'aethelgard-master-chronograph');
  assert.ok(r.body.variants.length >= 2, 'Should have variants');
  assert.ok(Array.isArray(r.body.specs), 'Specs must be parsed array');

  // 404 for non-existent slug
  const notFound = await call('GET', '/api/public/products/non-existent-watch-xyz', null, { auth: false });
  assert.equal(notFound.status, 404);
});

test('Supabase PG: Public /categories and /collections return dynamic aggregate counts', async () => {
  const catRes = await call('GET', '/api/public/categories', null, { auth: false });
  assert.equal(catRes.status, 200);
  assert.ok(Array.isArray(catRes.body));
  assert.ok(catRes.body.length > 0);
  assert.ok(catRes.body[0].count !== undefined, 'Categories must have count');

  const colRes = await call('GET', '/api/public/collections', null, { auth: false });
  assert.equal(colRes.status, 200);
  assert.ok(Array.isArray(colRes.body.categories));
  assert.ok(Array.isArray(colRes.body.brands));
});

test('Supabase PG: Public /enquiries/click records website interest in PostgreSQL', async () => {
  const r = await call(
    'POST',
    '/api/public/enquiries/click',
    {
      productId: 1,
      variantId: 1,
      source: 'whatsapp_button',
      customerName: 'Test Buyer',
      customerContact: '+91 9999999999',
      notes: 'Interested in Aethelgard watch',
    },
    { auth: false }
  );
  assert.equal(r.status, 201);
  assert.ok(r.body.ref, 'Enquiry ref should be returned');
  assert.match(r.body.ref, /^ENQ-/);

  // Clean up test inquiry from PostgreSQL
  await pool.query('DELETE FROM enquiries WHERE ref = $1', [r.body.ref]);
});

test('Supabase PG: Admin login and session management via Supabase PostgreSQL', async () => {
  // Query an active super_admin from database to test login
  const userRes = await pool.query("SELECT email FROM users WHERE role IN ('super_admin', 'owner') AND is_active = 1 LIMIT 1");
  assert.ok(userRes.rows.length > 0, 'An active admin user must exist');
  const adminEmail = userRes.rows[0].email;

  // Login with invalid credentials -> 401
  const badLogin = await call('POST', '/api/auth/login', { email: adminEmail, password: 'wrong-password-xyz' }, { auth: false });
  assert.equal(badLogin.status, 401);

  // Temporarily set a known password hash for testing login, then restore
  const testPw = 'TestAdminPass123!';
  const bcrypt = require('bcryptjs');
  const origRow = (await pool.query('SELECT password_hash FROM users WHERE email = $1', [adminEmail])).rows[0];
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [bcrypt.hashSync(testPw, 4), adminEmail]);

  try {
    const loginRes = await call('POST', '/api/auth/login', { email: adminEmail, password: testPw }, { auth: false, raw: true });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('set-cookie');
    assert.ok(setCookie, 'set-cookie header must be present');
    assert.match(setCookie, /tt_session/);
    cookie = setCookie.split(';')[0];

    // Verify /api/auth/me
    const meRes = await call('GET', '/api/auth/me');
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.email, adminEmail);
    assert.equal(meRes.body.role, 'super_admin');

    // Verify /api/admin/dashboard/summary
    const summaryRes = await call('GET', '/api/admin/dashboard/summary');
    assert.equal(summaryRes.status, 200);
    assert.ok(summaryRes.body.products.total >= 11);
    assert.ok(summaryRes.body.inventory.total_units >= 0);
    assert.ok(Array.isArray(summaryRes.body.recent_movements));

    // Verify /api/admin/inventory
    const invRes = await call('GET', '/api/admin/inventory');
    assert.equal(invRes.status, 200);
    assert.ok(Array.isArray(invRes.body.rows));
    assert.ok(invRes.body.rows.length >= 22);

    // Verify /api/admin/reports/overview
    const repRes = await call('GET', '/api/admin/reports/overview');
    assert.equal(repRes.status, 200);
    assert.ok(repRes.body.today);
    assert.ok(repRes.body.month);
  } finally {
    // Invalidate sessions and restore original password hash
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [require('crypto').createHash('sha256').update(cookie.replace('tt_session=', '')).digest('hex')]);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [origRow.password_hash, adminEmail]);
  }
});
