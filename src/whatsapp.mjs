// WhatsApp click-to-chat helpers. Only includes facts that actually exist.
export const formatPrice = (n) => (n == null ? null : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n));
const isLocal = (u) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(u || '');

export function buildEnquiryMessage({ product, variant, publicUrl }) {
  const lines = ['Hello TIMELESS TRENDS!', '', 'I am interested in the following watch:', ''];
  lines.push(`Product: ${product.name}`);
  if (product.brand) lines.push(`Brand: ${product.brand}`);
  lines.push(`Product ID: ${product.code || product.id}`);
  if (variant?.colour || variant?.name) lines.push(`Colour: ${variant.colour || variant.name}`);
  const price = variant?.price ?? product.price_from ?? product.price ?? product.selling_price;
  if (price != null && Number(price) > 0) lines.push(`Price: ${formatPrice(price)}`);
  if (publicUrl && !isLocal(publicUrl)) lines.push(`Product link: ${publicUrl.replace(/\/$/, '')}/shop/${product.slug}`);
  const rawImg = variant?.image || product?.mainImage || product?.image;
  if (rawImg && typeof rawImg === 'string' && rawImg.trim()) {
    let absImg = rawImg.trim();
    if (absImg.startsWith('/') && publicUrl && !isLocal(publicUrl)) {
      absImg = `${publicUrl.replace(/\/$/, '')}${absImg}`;
    }
    if (absImg.startsWith('http') && !isLocal(absImg)) {
      lines.push(`Product image: ${absImg}`);
    }
  }
  lines.push('', 'Please share its availability and further details.', '', 'Thank you.');
  return lines.join('\n');
}

export function whatsappUrl(number, message) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return null; // not configured
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || '')}`;
}
