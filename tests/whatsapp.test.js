const { test } = require('node:test');
const assert = require('node:assert/strict');

test('WhatsApp URL and message helper', async () => {
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

test('Universal Product Enquiry builder (src/utils/whatsapp.js)', async () => {
  const {
    buildProductEnquiryMessage,
    buildGeneralEnquiryMessage,
    getWhatsAppActionDetails,
    sanitizePhoneNumber,
    isWhatsAppConfigured
  } = await import('../src/utils/whatsapp.js');

  // Verify number sanitation & status
  assert.equal(sanitizePhoneNumber('+91 80144 45111'), '918014445111');
  assert.equal(isWhatsAppConfigured(), true);

  // Test Case 1: Standard product with brand, code, price, and canonical slug
  const product1 = {
    id: '101',
    code: 'TT-AERO-01',
    name: 'Aeronaut Automatic Chronograph',
    brand: 'Timeless Trends',
    price: 14500,
    slug: 'aeronaut-automatic-chronograph'
  };
  const msg1 = buildProductEnquiryMessage({
    product: product1,
    publicUrl: 'https://timeless-trends.onrender.com'
  });
  assert.match(msg1, /Product: Aeronaut Automatic Chronograph/);
  assert.match(msg1, /Brand: Timeless Trends/);
  assert.match(msg1, /Product ID: TT-AERO-01/);
  assert.match(msg1, /Price: ₹14,500/);
  assert.match(msg1, /Product link: https:\/\/timeless-trends\.onrender\.com\/product\/aeronaut-automatic-chronograph/);
  assert.match(msg1, /Please share the availability and further details\./);

  // Test Case 2: Minimalist/unpriced product with missing optional fields
  const product2 = {
    id: '102',
    name: 'Bespoke Tourbillon Piece Unique',
    brand: '',
    price: null,
    selling_price: null,
    slug: 'bespoke-tourbillon-piece-unique'
  };
  const msg2 = buildProductEnquiryMessage({
    product: product2,
    variant: null,
    publicUrl: 'https://timeless-trends.onrender.com'
  });
  assert.match(msg2, /Product: Bespoke Tourbillon Piece Unique/);
  assert.match(msg2, /Product ID: 102/);
  assert.match(msg2, /Product link: https:\/\/timeless-trends\.onrender\.com\/product\/bespoke-tourbillon-piece-unique/);
  // Optional fields must be omitted gracefully (never show 'Brand:', 'Price:', or '₹0')
  assert.equal(/Brand:/i.test(msg2), false, 'Brand should be omitted when missing');
  assert.equal(/Price:/i.test(msg2), false, 'Price should be omitted when unpriced');
  assert.equal(/₹0/.test(msg2), false, 'Never invent zero pricing');
  assert.equal(/Colour:/i.test(msg2), false, 'Colour should be omitted when no variant exists');

  // Test Case 3: Product with multiple variants where variant overrides price
  const product3 = {
    id: '103',
    code: 'TT-DIVER-300',
    name: 'Ocean Heritage 300M',
    brand: 'Nautica Haute',
    price: 18000, // base model price
    slug: 'ocean-heritage-300m',
    variants: [
      { id: '1', name: 'Stainless Steel', price: 18000 },
      { id: '2', name: 'Rose Gold & Ceramic', price: 22500 }
    ]
  };
  const selectedVariant = product3.variants[1];
  const msg3 = buildProductEnquiryMessage({
    product: product3,
    variant: selectedVariant,
    publicUrl: 'https://timeless-trends.onrender.com'
  });
  assert.match(msg3, /Product: Ocean Heritage 300M/);
  assert.match(msg3, /Brand: Nautica Haute/);
  assert.match(msg3, /Product ID: TT-DIVER-300/);
  assert.match(msg3, /Colour: Rose Gold & Ceramic/);
  assert.match(msg3, /Price: ₹22,500/, 'Must use variant override price instead of base price');
  assert.match(msg3, /Product link: https:\/\/timeless-trends\.onrender\.com\/product\/ocean-heritage-300m/);

  // Test Case 4: Generic 'Default' variant finish should be omitted from message
  const msg4 = buildProductEnquiryMessage({
    product: product1,
    variant: { id: 'def', name: 'Default' }
  });
  assert.equal(/Colour:/i.test(msg4), false, 'Generic "Default" variant label must be omitted');

  // Test Case 5: Full WhatsApp click-to-chat URL formation & encoding
  const actionDetails = getWhatsAppActionDetails({
    product: product3,
    variant: selectedVariant,
    publicUrl: 'https://timeless-trends.onrender.com'
  });
  assert.equal(actionDetails.isConfigured, true);
  assert.equal(actionDetails.configuredNumber, '918014445111');
  assert.ok(actionDetails.url.startsWith('https://wa.me/918014445111?text='));
  assert.ok(actionDetails.url.includes(encodeURIComponent('Product: Ocean Heritage 300M')));
  assert.ok(actionDetails.url.includes(encodeURIComponent('Colour: Rose Gold & Ceramic')));
  assert.ok(actionDetails.url.includes(encodeURIComponent('Price: ₹22,500')));

  // Test Case 6: General enquiry when no product is supplied (e.g. Header / Footer / Contact)
  const generalMsg = buildGeneralEnquiryMessage();
  assert.match(generalMsg, /Hello TIMELESS TRENDS!/);
  assert.match(generalMsg, /I am browsing your watch catalogue and would like to enquire/);
  const generalAction = getWhatsAppActionDetails();
  assert.ok(generalAction.url.startsWith('https://wa.me/918014445111?text='));
  assert.ok(generalAction.url.includes(encodeURIComponent('I am browsing your watch catalogue')));

  // Test Case 7: Product Image resolution in WhatsApp enquiry
  // 7A: Primary product image resolution
  const productWithImg = {
    id: '104',
    code: 'TT-SUB-01',
    name: 'Submariner Diver',
    brand: 'Timeless Trends',
    price: 24000,
    slug: 'submariner-diver',
    mainImage: 'https://images.example.com/watches/submariner.webp'
  };
  const msgWithImg = buildProductEnquiryMessage({
    product: productWithImg,
    publicUrl: 'https://timeless-trends.onrender.com'
  });
  assert.match(msgWithImg, /Product image: https:\/\/images\.example\.com\/watches\/submariner\.webp/);

  // 7B: Variant image overrides primary product image
  const variantWithImg = {
    id: 'var-gold',
    name: 'Yellow Gold',
    image: 'https://images.example.com/watches/submariner-gold.webp'
  };
  const msgWithVariantImg = buildProductEnquiryMessage({
    product: productWithImg,
    variant: variantWithImg,
    publicUrl: 'https://timeless-trends.onrender.com'
  });
  assert.match(msgWithVariantImg, /Product image: https:\/\/images\.example\.com\/watches\/submariner-gold\.webp/);

  // 7C: Relative image path correctly resolves against public domain
  const productWithRelImg = {
    id: '105',
    code: 'TT-CHRONO-02',
    name: 'Monaco Heritage',
    brand: 'Timeless Trends',
    price: 32000,
    slug: 'monaco-heritage',
    mainImage: '/uploads/web/monaco.webp'
  };
  const msgWithRelImg = buildProductEnquiryMessage({
    product: productWithRelImg,
    publicUrl: 'https://timeless-trends.onrender.com'
  });
  assert.match(msgWithRelImg, /Product image: https:\/\/timeless-trends\.onrender\.com\/uploads\/web\/monaco\.webp/);

  // 7D: Localhost/development image URLs are omitted
  const productLocalImg = {
    id: '106',
    code: 'TT-DEV-01',
    name: 'Dev Watch',
    slug: 'dev-watch',
    mainImage: 'http://localhost:5173/test.jpg'
  };
  const msgLocal = buildProductEnquiryMessage({
    product: productLocalImg,
    publicUrl: 'http://localhost:5173'
  });
  assert.equal(/Product image:/.test(msgLocal), false, 'Localhost image URLs must be excluded');

  // 7E: Missing images omitted gracefully
  assert.equal(/Product image:/.test(msg1), false, 'Omit image line when no photo exists');
});
