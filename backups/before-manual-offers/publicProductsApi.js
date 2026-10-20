
const API_BASE = '/api/public';

/**
 * Fetch published products from the backend and convert them
 * into the data format used by the existing storefront components.
 */
export async function fetchPublicProducts() {
  const response = await fetch(`${API_BASE}/products`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load watches (HTTP ${response.status})`);
  }

  const data = await response.json();

  // The current API returns an array. Supporting an object wrapper
  // as well makes the service more tolerant of response formats.
  const products = Array.isArray(data) ? data : data.products;

  if (!Array.isArray(products)) {
    throw new Error('The products API returned an unexpected response.');
  }

  return products.map(mapApiProduct);
}

/**
 * Fetch one published product by its URL slug.
 */
export async function fetchPublicProductBySlug(slug) {
  if (!slug) return null;

  const response = await fetch(
    `${API_BASE}/products/${encodeURIComponent(slug)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Unable to load this watch (HTTP ${response.status})`);
  }

  const data = await response.json();

  // Accommodate either a direct product or a wrapped product response.
  const product = data.product ?? data;

  return product && product.slug ? mapApiProduct(product) : null;
}

/**
 * Convert the backend product format into the format
 * expected by ProductCard, ProductGallery and ProductDetails.
 */
function mapApiProduct(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const variants = Array.isArray(product.variants) ? product.variants : [];

  const mainImage = images[0]?.url || '';

  const mappedVariants = variants.map((variant) => {
    const variantImage = images.find(
      (image) => image.variantId === variant.id
    );

    const vPrice = variant.price ?? product.effective_price ?? product.selling_price;

    return {
      id: String(variant.id),
      sku: variant.sku || '',
      name: variant.colour || 'Default',
      color: variant.colour || 'Default',
      image: variantImage?.url || mainImage,
      available: Boolean(variant.available),
      price: vPrice != null ? Number(vPrice) : null,
    };
  });

  const rawPrice = product.effective_price ?? product.selling_price ?? product.price;
  const price = rawPrice != null && !isNaN(Number(rawPrice)) ? Number(rawPrice) : null;

  const originalPrice = product.original_price == null
    ? null
    : Number(product.original_price);

  const specifications = Array.isArray(product.specs)
    ? product.specs.reduce((result, item, index) => {
        if (item && typeof item === 'object') {
          const key = item.name ?? item.key ?? item.label ?? `Specification ${index + 1}`;
          const value = item.value ?? item.description ?? '';
          result[key] = value;
        }
        return result;
      }, {})
    : product.specs && typeof product.specs === 'object'
      ? product.specs
      : {};

  return {
    id: String(product.id),
    code: product.code || '',
    slug: product.slug || '',
    name: product.name || 'Unnamed Watch',
    brand: product.brand || '',
    model: product.model || product.code || '',
    category: product.category || '',
    description: product.description || '',
    price,
    originalPrice,
    mainImage,
    additionalImages: images.slice(1).map((image) => image.url),
    variants: mappedVariants,
    specifications,
    featured: Boolean(product.is_featured),
    isNewArrival: Boolean(product.is_new_arrival),
    availability: product.available ? 'Available' : 'Currently unavailable',
    available: Boolean(product.available),
    activeOffer: product.active_offer || null,
    priceFrom: product.price_from != null ? Number(product.price_from) : price,
  };
}
