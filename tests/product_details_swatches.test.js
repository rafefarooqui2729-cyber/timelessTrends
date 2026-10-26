const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Colour Swatch Parser: single, compound, multi-tone, and fallback finishes', async () => {
  const { parseVariantColors, getSwatchStyle } = await import('../src/utils/swatchColor.js');

  // 1. Single standard finishes
  assert.deepEqual(parseVariantColors('Black'), ['#171717']);
  assert.deepEqual(parseVariantColors('White Dial'), ['#ffffff']);
  assert.deepEqual(parseVariantColors('Silver Steel'), ['#c0c0c0']);
  assert.deepEqual(parseVariantColors('Gold Bezel'), ['#d4af37']);
  assert.deepEqual(parseVariantColors('Blue Dial'), ['#2458a6']);
  assert.deepEqual(parseVariantColors('Green'), ['#28734b']);
  assert.deepEqual(parseVariantColors('Red Leather'), ['#b32632']);
  assert.deepEqual(parseVariantColors('Brown Strap'), ['#795548']);
  assert.deepEqual(parseVariantColors('Grey'), ['#808080']);
  assert.deepEqual(parseVariantColors('Gray Ceramic'), ['#808080']);
  assert.deepEqual(parseVariantColors('Pink'), ['#e6a0b4']);
  assert.deepEqual(parseVariantColors('Purple'), ['#744da9']);
  assert.deepEqual(parseVariantColors('Navy Blue'), ['#172b4d']);
  assert.deepEqual(parseVariantColors('Beige Dial'), ['#d9c7a0']);

  // 2. Compound finishes (should match as single color, NOT split into two)
  assert.deepEqual(parseVariantColors('Rose Gold'), ['#b76e79']);
  assert.deepEqual(parseVariantColors('Rosegold'), ['#b76e79']);
  assert.deepEqual(parseVariantColors('White Gold'), ['#e8e8e8']);
  assert.deepEqual(parseVariantColors('Midnight Blue'), ['#172b4d']);
  assert.deepEqual(parseVariantColors('Forest Green'), ['#1b4d3e']);

  // 3. Multi-tone and two-tone combinations (Silver & Gold, two-tone, etc.)
  const silverGold = parseVariantColors('Silver & Golden');
  assert.equal(silverGold.length, 2);
  assert.ok(silverGold.includes('#c0c0c0'));
  assert.ok(silverGold.includes('#d4af37'));

  const tightTwoTone = parseVariantColors('Silver&golden');
  assert.equal(tightTwoTone.length, 2);
  assert.ok(tightTwoTone.includes('#c0c0c0'));
  assert.ok(tightTwoTone.includes('#d4af37'));

  const reversedTwoTone = parseVariantColors('Golden &silver');
  assert.equal(reversedTwoTone.length, 2);
  assert.ok(reversedTwoTone.includes('#c0c0c0'));
  assert.ok(reversedTwoTone.includes('#d4af37'));

  const slashCombination = parseVariantColors('Gold / Black');
  assert.deepEqual(slashCombination, ['#d4af37', '#171717']);

  const twoTonePhrase = parseVariantColors('Two-Tone Edition');
  assert.equal(twoTonePhrase.length, 2);

  // 4. Word boundary test: "red" should NOT match inside "textured"
  const textured = parseVariantColors('Textured Dial');
  assert.deepEqual(textured, [], 'Should not treat "textured" as red');

  // 5. getSwatchStyle output structure
  // Solid single color
  const solidStyle = getSwatchStyle('Rose Gold');
  assert.equal(solidStyle.backgroundColor, '#b76e79');
  assert.equal(solidStyle.background, undefined);

  // Two-tone split gradient
  const twoToneStyle = getSwatchStyle('Silver & Golden');
  assert.ok(twoToneStyle.background.includes('linear-gradient(135deg,'));
  assert.ok(twoToneStyle.background.includes('50%'));

  // Neutral fallback
  const fallbackStyle = getSwatchStyle('Unspecified Finish');
  assert.equal(fallbackStyle.backgroundColor, '#6b7280');
});

test('Product API mapping: variant-specific image resolution', async () => {
  const { fetchPublicProducts } = await import('../src/utils/publicProductsApi.js');

  // We can test mapApiProduct logic directly or by mocking fetch
  const mockProduct = {
    id: 101,
    code: 'TT-P0101',
    name: 'Precision Chronograph',
    selling_price: 18500,
    images: [
      { id: 1, variantId: null, url: 'https://storage/general-1.webp' },
      { id: 2, variantId: null, url: 'https://storage/general-2.webp' },
      { id: 3, variantId: 501, url: 'https://storage/gold-variant.webp' }
    ],
    variants: [
      { id: 501, colour: 'Yellow Gold', price_override: null, stock_on_hand: 3, reserved: 0, min_stock: 1, available: true },
      { id: 502, colour: 'Stainless Steel', price_override: null, stock_on_hand: 2, reserved: 0, min_stock: 1, available: true }
    ]
  };

  // Temporarily stub global.fetch to return mock product
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => [mockProduct]
  });

  try {
    const [mapped] = await fetchPublicProducts();

    // Check main image and gallery images
    assert.equal(mapped.mainImage, 'https://storage/general-1.webp');
    assert.deepEqual(mapped.additionalImages, [
      'https://storage/general-2.webp',
      'https://storage/gold-variant.webp'
    ]);

    // Check variant 501 (has assigned image)
    const goldVar = mapped.variants.find((v) => v.id === '501');
    assert.equal(goldVar.image, 'https://storage/gold-variant.webp');
    assert.equal(goldVar.hasSpecificImage, true);

    // Check variant 502 (has no assigned image -> falls back to null, NOT falsifying photos)
    const steelVar = mapped.variants.find((v) => v.id === '502');
    assert.equal(steelVar.image, null);
    assert.equal(steelVar.hasSpecificImage, false);

    // Test getImagesForVariant
    const { getImagesForVariant } = await import('../src/utils/publicProductsApi.js');
    
    // Variant 501 has its own image: should return gold image first, then general images, excluding other variants
    const goldImages = getImagesForVariant(mapped, '501');
    assert.deepEqual(goldImages, [
      'https://storage/gold-variant.webp',
      'https://storage/general-1.webp',
      'https://storage/general-2.webp'
    ]);

    // Variant 502 has NO dedicated image: should return general images only, NEVER showing gold variant
    const steelImages = getImagesForVariant(mapped, '502');
    assert.deepEqual(steelImages, [
      'https://storage/general-1.webp',
      'https://storage/general-2.webp'
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
