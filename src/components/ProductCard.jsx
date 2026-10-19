import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, MessageCircle } from 'lucide-react';
import { formatCurrency, hasValidPrice } from '../utils/formatCurrency';
import { WhatsAppButton } from './WhatsAppButton';

export function ProductCard({ product }) {
  const [imageError, setImageError] = useState(false);
  const [activeImage, setActiveImage] = useState(product.mainImage);
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants && product.variants.length > 0 ? product.variants[0] : null
  );

  useEffect(() => {
    setActiveImage(product.mainImage);
    setImageError(false);
    setSelectedVariant(product.variants && product.variants.length > 0 ? product.variants[0] : null);
  }, [product]);

  const hasVariants = product.variants && product.variants.length > 0;
  const isDiscounted = product.originalPrice && product.price && product.originalPrice > product.price;

  // Variant hover/select preview
  const handleVariantPreview = (variant, e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedVariant(variant);
    if (variant.image) {
      setActiveImage(variant.image);
      setImageError(false);
    }
  };

  return (
    <article className="product-card" aria-label={`Watch: ${product.name}`}>
      {/* Media & Link */}
      <div className="product-card-media">
        {/* Badges */}
        <div className="product-card-badges">
          {product.isNewArrival && (
            <span className="badge badge-new">New Arrival</span>
          )}
          {product.availability === 'Limited Edition' && (
            <span className="badge badge-limited">Limited</span>
          )}
          {isDiscounted && (
            <span className="badge badge-gold">Special Offer</span>
          )}
        </div>

        <Link to={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }}>
          {!activeImage || imageError ? (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#161616',
              color: 'var(--color-silver)',
              padding: '20px',
              textAlign: 'center'
            }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-gold)' }}>
                TIMELESS TRENDS
              </span>
              <span style={{ fontSize: '0.75rem', marginTop: '6px', color: 'var(--color-silver)' }}>
                {product.name}
              </span>
            </div>
          ) : (
            <img
              src={activeImage}
              alt={`${product.name} - ${selectedVariant ? selectedVariant.name : 'Main View'}`}
              className="product-card-img"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          )}
        </Link>
      </div>

      {/* Body Details */}
      <div className="product-card-body">
        {product.brand && (
          <span className="product-card-brand">{product.brand}</span>
        )}

        <h3 className="product-card-title">
          <Link to={`/product/${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        {/* Pricing Row */}
        <div className="product-card-price-row">
          <span className={`product-card-price ${!hasValidPrice(product.price) ? 'on-request' : ''}`}>
            {formatCurrency(product.price)}
          </span>
          {isDiscounted && (
            <span className="product-card-original-price">
              {formatCurrency(product.originalPrice, { fallbackOnNull: false })}
            </span>
          )}
        </div>

        {/* Variant Swatches Preview */}
        {hasVariants && (
          <div className="product-card-variants" aria-label="Available colour variants">
            {product.variants.slice(0, 4).map((v) => (
              <button
                key={v.id}
                type="button"
                className="card-swatch-dot"
                style={{
                  backgroundColor: v.color || '#333',
                  boxShadow: selectedVariant?.id === v.id ? '0 0 0 2px var(--color-gold)' : 'none',
                  transform: selectedVariant?.id === v.id ? 'scale(1.15)' : 'scale(1)'
                }}
                onClick={(e) => handleVariantPreview(v, e)}
                title={v.name}
                aria-label={`Select variant: ${v.name}`}
              />
            ))}
            {product.variants.length > 4 && (
              <span className="card-swatch-more">
                +{product.variants.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Action Row */}
        <div className="product-card-actions">
          <Link
            to={`/product/${product.slug}`}
            className="btn btn-outline product-card-view-btn"
          >
            <Eye size={14} />
            <span>Details</span>
          </Link>

          <WhatsAppButton
            product={product}
            variant={selectedVariant}
            label="Enquire"
            variantStyle="primary"
            className="product-card-wa-btn"
            ariaLabel={`Enquire about ${product.name} on WhatsApp`}
          />
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
