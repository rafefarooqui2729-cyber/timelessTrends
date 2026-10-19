import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { formatPrice } from '../whatsapp.mjs';
import { Photo, pickImage } from './ProductCard.jsx';
import { WhatsAppButton } from './PublicLayout.jsx';
import { NotFound } from './Static.jsx';

export default function Product() {
  const { slug } = useParams();
  const { data: p, error, loading } = useLoad(() => api.get(`/api/public/products/${encodeURIComponent(slug)}`), [slug]);
  const [vid, setVid] = useState(null);
  const [imgId, setImgId] = useState(null);
  useEffect(() => { if (p) { setVid(p.variants.find((v) => v.available)?.id ?? p.variants[0]?.id ?? null); setImgId(null); } }, [p]);
  if (loading) return <p className="center-note">Loading…</p>;
  if (error?.status === 404 || !p) return <NotFound />;
  const variant = p.variants.find((v) => v.id === vid) || null;
  const shown = (imgId && p.images.find((i) => i.id === imgId)) || pickImage(p, vid);
  const price = variant?.price ?? p.price_from;
  return (
    <div className="wrap section product">
      <p className="crumbs"><Link to="/shop">← Back to shop</Link></p>
      <div className="product-grid">
        <div>
          {shown ? <div className="photo big"><img src={shown.url} alt={shown.alt || p.name} /></div> : <Photo product={p} />}
          {p.images.length > 1 && <div className="thumbs">{p.images.map((i) => <button key={i.id} className={i.id === shown?.id ? 'on' : ''} onClick={() => setImgId(i.id)} aria-label="Show photo"><img src={i.url} alt="" /></button>)}</div>}
        </div>
        <div className="info">
          {p.brand && <p className="brand">{p.brand}</p>}
          <h1>{p.name}</h1>
          {p.model && <p className="muted">Model: {p.model}</p>}
          <p className="price lg">{price != null ? formatPrice(price) : 'Price on enquiry'}{p.original_price != null && price != null && p.original_price > price && <s>{formatPrice(p.original_price)}</s>}</p>
          {p.variants.length > 0 && (
            <fieldset className="variants"><legend>Colour: <strong>{variant?.colour}</strong></legend>
              {p.variants.map((v) => <button key={v.id} type="button" className={`vbtn ${v.id === vid ? 'on' : ''} ${v.available ? '' : 'out'}`} aria-pressed={v.id === vid}
                onClick={() => { setVid(v.id); setImgId(null); }}>{v.colour}{!v.available && <small> · unavailable</small>}</button>)}
            </fieldset>)}
          <p className={variant?.available ? 'avail yes' : 'avail no'}>{variant ? (variant.available ? 'Available — confirm on WhatsApp' : 'Currently unavailable — ask us about restocking') : ''}</p>
          <WhatsAppButton product={p} variant={variant} className="block" />
          {p.description && <p className="desc">{p.description}</p>}
          {p.specs.length > 0 && <dl className="specs">{p.specs.map((s) => <React.Fragment key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></React.Fragment>)}</dl>}
        </div>
      </div>
    </div>
  );
}
