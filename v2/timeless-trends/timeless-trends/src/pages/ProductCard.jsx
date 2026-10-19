import React from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../whatsapp.mjs';

export function pickImage(product, variantId) {
  return product.images.find((i) => variantId && i.variantId === variantId) || product.images.find((i) => !i.variantId) || product.images[0] || null;
}
export function Photo({ product, variantId, eager }) {
  const img = pickImage(product, variantId);
  if (!img) return <div className="photo placeholder" role="img" aria-label="Photo coming soon"><span>Photo coming soon</span></div>;
  return <div className="photo"><img src={img.url} alt={img.alt || `${product.name}${product.brand ? ` by ${product.brand}` : ''}`} loading={eager ? 'eager' : 'lazy'} /></div>;
}
export default function ProductCard({ product: p }) {
  return (
    <Link to={`/shop/${p.slug}`} className="card">
      <Photo product={p} />
      <div className="card-body">
        {p.is_new_arrival ? <span className="tag">New</span> : null}
        {p.brand && <p className="brand">{p.brand}</p>}
        <h3>{p.name}</h3>
        <p className="price">{p.price_from != null ? <>{p.variants.length > 1 && new Set(p.variants.map((v) => v.price)).size > 1 ? 'From ' : ''}{formatPrice(p.price_from)}</> : 'Price on enquiry'}
          {p.original_price != null && p.original_price > (p.price_from ?? 0) && <s>{formatPrice(p.original_price)}</s>}</p>
        <p className="swatches">{p.variants.map((v) => v.colour).join(' · ')}</p>
        {!p.available && <p className="oos">Currently unavailable</p>}
      </div>
    </Link>
  );
}
