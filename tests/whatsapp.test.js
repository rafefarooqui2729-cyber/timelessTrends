const { test } = require('node:test');
const assert = require('node:assert/strict');

test('WhatsApp URL and message', async () => {
  const { buildEnquiryMessage, whatsappUrl } = await import('../src/whatsapp.mjs');
  const product = { name: 'Classic Chrono', brand: 'Acme', code: 'TT-P0001', slug: 'classic-chrono', price_from: 2500 };
  const msg = buildEnquiryMessage({ product, variant: { colour: 'Black', price: 2500 }, publicUrl: 'https://shop.example/' });
  assert.match(msg, /Product: Classic Chrono/); assert.match(msg, /Brand: Acme/); assert.match(msg, /Colour: Black/);
  assert.match(msg, /Product ID: TT-P0001/); assert.match(msg, /Price: ₹2,500/); assert.match(msg, /Product link: https:\/\/shop\.example\/shop\/classic-chrono/);
  // only real info; no localhost links; missing brand/price omitted (never "₹0")
  const bare = buildEnquiryMessage({ product: { name: 'X', code: 'TT-P0002', slug: 'x', price_from: null }, variant: null, publicUrl: 'http://localhost:5173' });
  assert.ok(!/Brand:|Price:|Colour:|localhost|Product link/.test(bare));
  const url = whatsappUrl('+91 98765-43210', 'Hi there & welcome\nline2');
  assert.equal(url, 'https://wa.me/919876543210?text=Hi%20there%20%26%20welcome%0Aline2');
  assert.equal(whatsappUrl('', 'x'), null); assert.equal(whatsappUrl(null, 'x'), null);
});
