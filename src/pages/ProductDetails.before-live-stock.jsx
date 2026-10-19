import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft, ShieldCheck, Truck, RefreshCw, MessageCircle } from 'lucide-react';
import { fetchPublicProductBySlug, fetchPublicProducts } from '../utils/publicProductsApi';
import { formatCurrency, hasValidPrice } from '../utils/formatCurrency';
import { ProductGallery } from '../components/ProductGallery';
import { ColorVariantSelector } from '../components/ColorVariantSelector';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { ProductGrid } from '../components/ProductGrid';
import { siteConfig } from '../config/siteConfig';

export function ProductDetails() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedWatches, setRelatedWatches] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Scroll to top when slug changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  // Fetch product from API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const p = await fetchPublicProductBySlug(slug);
        if (!cancelled) {
          setProduct(p);
          if (p && p.variants && p.variants.length > 0) {
            setSelectedVariant(p.variants[0]);
          } else {
            setSelectedVariant(null);
          }

          if (p) {
            // Load related products from catalogue
            try {
              const all = await fetchPublicProducts();
              if (!cancelled) {
                const others = all.filter(item => item.id !== p.id);
                const sameCat = others.filter(item => item.category === p.category);
                const diffCat = others.filter(item => item.category !== p.category);
                setRelatedWatches([...sameCat, ...diffCat].slice(0, 4));
              }
            } catch {
              // Non-blocking for related products
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load timepiece details.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="section container" style={{ textAlign: 'center', padding: '120px 20px' }}>
        <p style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
          TIMELESS TRENDS
        </p>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          Loading timepiece details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', marginBottom: '16px' }}>
          Catalogue Connection Issue
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '0 auto 32px' }}>
          {error}
        </p>
        <Link to="/shop" className="btn btn-primary">
          <ArrowLeft size={16} />
          <span>Back to All Watches</span>
        </Link>
      </div>
    );
  }

  // Handle Unknown Product Slug gracefully
  if (!product) {
    return (
      <div className="section container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', marginBottom: '16px' }}>
          Watch Not Found
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '0 auto 32px' }}>
          The timepiece you are looking for may have been updated, relocated, or is no longer listed in our active catalogue.
        </p>
        <Link to="/shop" className="btn btn-primary">
          <ArrowLeft size={16} />
          <span>Back to All Watches</span>
        </Link>
      </div>
    );
  }

  const hasVariants = product.variants && product.variants.length > 0;
  const isDiscounted = product.originalPrice && product.price && product.originalPrice > product.price;
  const hasSpecs = product.specifications && Object.keys(product.specifications).length > 0;


  return (
    <div className="product-details-page section">
      <div className="container">
        {/* Editorial Breadcrumbs */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '32px' }}>
          <ol style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            listStyle: 'none',
            fontSize: '0.825rem',
            color: 'var(--color-text-secondary)'
          }}>
            <li><Link to="/" style={{ color: 'var(--color-text-secondary)' }}>Home</Link></li>
            <li><ChevronRight size={13} /></li>
            <li><Link to="/shop" style={{ color: 'var(--color-text-secondary)' }}>Watches</Link></li>
            {product.category && (
              <>
                <li><ChevronRight size={13} /></li>
                <li>
                  <Link to={`/shop?category=${encodeURIComponent(product.category)}`} style={{ color: 'var(--color-text-secondary)' }}>
                    {product.category}
                  </Link>
                </li>
              </>
            )}
            <li><ChevronRight size={13} /></li>
            <li aria-current="page" style={{ color: 'var(--color-charcoal)', fontWeight: 600 }}>
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Product Details 2-Column Grid */}
        <div className="product-details-grid">
          {/* Left Column: Product Visual Gallery */}
          <div>
            <ProductGallery
              mainImage={product.mainImage}
              additionalImages={product.additionalImages}
              variantImage={selectedVariant ? selectedVariant.image : null}
              productName={product.name}
            />
          </div>

          {/* Right Column: Information, Pricing, Swatches, CTA */}
          <div className="product-info-panel">
            {product.brand && (
              <span className="product-header-brand">{product.brand}</span>
            )}

            <h1 className="product-header-title">{product.name}</h1>

            {/* Meta Row: Model reference & availability */}
            <div className="product-meta-row">
              {product.model && (
                <span className="product-id-badge">Model: {product.model}</span>
              )}
              {product.id && (
                <span className="product-id-badge">Ref: {product.id}</span>
              )}
              {product.availability && (
                <span className="product-availability-tag">
                  <ShieldCheck size={14} />
                  {product.availability}
                </span>
              )}
            </div>

            {/* Price Presentation */}
            <div className="product-price-section">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span className="product-main-price">
                  {formatCurrency(product.price)}
                </span>
                {isDiscounted && (
                  <span style={{ fontSize: '1.15rem', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                    {formatCurrency(product.originalPrice, { fallbackOnNull: false })}
                  </span>
                )}
              </div>
              <p className="product-price-notice">
                {hasValidPrice(product.price)
                  ? 'Inclusive of applicable taxes. Order or enquire directly on WhatsApp.'
                  : 'Contact us on WhatsApp for pricing and reserve availability.'}
              </p>
            </div>

            {/* Product Narrative / Description */}
            {product.description && (
              <div style={{ marginBottom: '28px', fontSize: '1rem', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {product.description}
              </div>
            )}

            {/* Colour Variant Selector */}
            {hasVariants && (
              <ColorVariantSelector
                variants={product.variants}
                selectedVariant={selectedVariant}
                onSelectVariant={(v) => setSelectedVariant(v)}
              />
            )}

            {/* Primary Order / Enquiry CTA */}
            <div className="product-cta-container">
              <WhatsAppButton
                product={product}
                variant={selectedVariant}
                label="Order / Enquire on WhatsApp"
                variantStyle="primary"
                className="product-cta-button"
              />

              {/* Informative Explanation of WhatsApp Enquiry Model */}
              <div className="whatsapp-flow-explanation">
                <strong>How WhatsApp enquiry works:</strong> Tapping above opens WhatsApp with your chosen timepiece and colour variant prefilled. You review and send the message yourself. Our team answers your questions directly.
              </div>
            </div>

            {/* Confirmed Technical Specifications */}
            {hasSpecs && (
              <div className="product-specs-box">
                <h4>Confirmed Specifications</h4>
                <table className="specs-table" aria-label="Technical Specifications">
                  <tbody>
                    {Object.entries(product.specifications).map(([key, val]) => (
                      <tr key={key}>
                        <th scope="row">{key}</th>
                        <td>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Return Link */}
            <div style={{ marginTop: '32px' }}>
              <Link
                to="/shop"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.875rem',
                  color: 'var(--color-charcoal)',
                  fontWeight: 600
                }}
              >
                <ArrowLeft size={16} />
                <span>Return to Catalogue</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Related Watches Section */}
        {relatedWatches.length > 0 && (
          <div style={{ marginTop: '80px', paddingTop: '64px', borderTop: '1px solid var(--color-border)' }}>
            <div className="section-header" style={{ marginBottom: '36px' }}>
              <span className="section-subtitle">COMPLEMENTARY PIECES</span>
              <h2 className="section-title">You May Also Admire</h2>
              <div className="gold-divider" />
            </div>

            <ProductGrid products={relatedWatches} />
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductDetails;
