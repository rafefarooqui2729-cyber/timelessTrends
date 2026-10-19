const { pool } = require('../server/pg');
const { createApp } = require('../server/app');

async function testReceive() {
  const app = createApp(pool, { noRateLimit: true });
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  // 1. Get an active admin
  const user = (await pool.query("SELECT id, email, role FROM users WHERE role IN ('super_admin', 'owner') AND is_active = 1 LIMIT 1")).rows[0];
  console.log('Using admin:', user);

  // 2. Create session
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)', [
    tokenHash, user.id, new Date(Date.now() + 864e5).toISOString(), new Date().toISOString()
  ]);

  // 3. Get first variant
  const variant = (await pool.query('SELECT v.id, v.stock_on_hand, v.avg_cost FROM variants v WHERE v.is_active = 1 ORDER BY v.id LIMIT 1')).rows[0];
  console.log('Testing variant:', variant);

  // 4. Test frontend payload with unitCost = null
  const payload1 = {
    supplierId: null,
    reference: null,
    notes: null,
    items: [
      {
        variantId: variant.id,
        quantity: 2,
        unitCost: null
      }
    ]
  };

  console.log('\nTesting POST /api/admin/stock/receive with payload1:', payload1);
  const res1 = await fetch(`${base}/api/admin/stock/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'tt',
      'Cookie': `tt_session=${token}`
    },
    body: JSON.stringify(payload1)
  });

  console.log('Status 1:', res1.status);
  const data1 = await res1.text();
  console.log('Response 1:', data1);

  // Clean up session
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  server.close();
  await pool.end();
}

testReceive().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
