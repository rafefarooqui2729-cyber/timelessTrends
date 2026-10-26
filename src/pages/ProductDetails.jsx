import SEO from '../components/SEO';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft, ShieldCheck } from 'lucide-react';

import {
  fetchPublicProductBySlug,
  fetchPublicProducts,
  getImagesForVariant
} from '../utils/publicProductsApi';

import {
  formatCurrency,
  hasValidPrice
} from '../utils/formatCurrency';

import { ProductGallery } from '../components/ProductGallery';
import { ColorVariantSelector } from '../components/ColorVariantSelector';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { ProductGrid } from '../components/ProductGrid';

const STOCK_REFRESH_INTERVAL = 15000;

export function ProductDetails() {
  const { slug } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedWatches, setRelatedWatches] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [stockUpdating, setStockUpdating] = useState(false);

  const refreshInProgress = useRef(false);
    const galleryImages = useMemo(() => {
    if (!product) return [];
    return getImagesForVariant(product, selectedVariantId);
  }, [product, selectedVariantId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  // Initial product loading
  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError('');
      setProduct(null);
      setSelectedVariantId(null);
      setRelatedWatches([]);

      try {
        const watch = await fetchPublicProductBySlug(slug);

        if (cancelled) return;

        setProduct(watch);

        if (watch?.variants?.length) {
          setSelectedVariantId(watch.variants[0].id);
        }

        if (watch) {
          try {
            const all = await fetchPublicProducts();

            if (cancelled) return;

            const others = all.filter(
              (item) => item.id !== watch.id
            );

            const sameCategory = others.filter(
              (item) => item.category === watch.category
            );

            const otherCategories = others.filter(
              (item) => item.category !== watch.category
            );

            setRelatedWatches(
              [...sameCategory, ...otherCategories].slice(0, 4)
            );
          } catch {
            // Related watches are optional.
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || 'Unable to load timepiece details.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Automatically refresh product availability.
  useEffect(() => {
    let cancelled = false;

    async function refreshStock() {
      if (document.visibilityState === 'hidden') return;
      if (refreshInProgress.current) return;

      refreshInProgress.current = true;
      setStockUpdating(true);

      try {
        const updatedProduct =
          await fetchPublicProductBySlug(slug);

        if (cancelled) return;

        if (updatedProduct) {
          setProduct(updatedProduct);

          setSelectedVariantId((previousId) => {
            const stillExists = updatedProduct.variants?.some(
              (variant) => variant.id === previousId
            );

            if (stillExists) return previousId;

            return updatedProduct.variants?.[0]?.id ?? null;
          });

          setError('');
        } else {
          // Product may have been unpublished.
          setProduct(null);
        }
      } catch {
        // Do not overwrite the existing product when
        // a temporary network request fails.
      } finally {
        refreshInProgress.current = false;

        if (!cancelled) {
          setStockUpdating(false);
        }
      }
    }

    const timer = window.setInterval(
      refreshStock,
      STOCK_REFRESH_INTERVAL
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [slug]);

  if (loading) {
    return (
      <div
        className="section container"
        style={{
          textAlign: 'center',
          padding: '120px 20px'
        }}
      >
        <p
          style={{
            color: 'var(--color-gold)',
            fontFamily: 'var(--font-serif)',
            fontSize: '1.4rem'
          }}
        >
          TIMELESS TRENDS
        </p>

        <p
          style={{
            color: 'var(--color-text-secondary)',
            marginTop: '8px'
          }}
        >
          Loading timepiece details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="section container"
        style={{
          textAlign: 'center',
          padding: '100px 20px'
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.4rem',
            marginBottom: '16px'
          }}
        >
          Catalogue Connection Issue
        </h2>

        <p
          style={{
            color: 'var(--color-text-secondary)',
            maxWidth: '480px',
            margin: '0 auto 32px'
          }}
        >
          {error}
        </p>

        <Link to="/shop" className="btn btn-primary">
          <ArrowLeft size={16} />
          <span>Back to All Watches</span>
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className="section container"
        style={{
          textAlign: 'center',
          padding: '100px 20px'
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.4rem',
            marginBottom: '16px'
          }}
        >
          Watch Not Found
        </h2>

        <p
          style={{
            color: 'var(--color-text-secondary)',
            maxWidth: '480px',
            margin: '0 auto 32px'
          }}
        >
          This timepiece may no longer be available in our
          published catalogue.
        </p>

        <Link to="/shop" className="btn btn-primary">
          <ArrowLeft size={16} />
          <span>Back to All Watches</span>
        </Link>
      </div>
    );
  }

  const hasVariants =
    Array.isArray(product.variants) &&
    product.variants.length > 0;

  const selectedVariant = hasVariants
    ? product.variants.find(
        (variant) => String(variant.id) === String(selectedVariantId)
      ) || product.variants[0]
    : null;

  const selectedAvailable = selectedVariant
    ? selectedVariant.available
    : product.available;

  const availabilityLabel = selectedAvailable
    ? 'Available'
    : 'Currently unavailable';

  const hasSpecs =
    product.specifications &&
    Object.keys(product.specifications).length > 0;

  const isDiscounted =
    hasValidPrice(product.originalPrice) &&
    hasValidPrice(product.price) &&
    product.originalPrice > product.price;

  return (
    <>
      <SEO product={product} />

      <div className="product-details-page section">
        <div className="container">

        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          style={{ marginBottom: '32px' }}
        >
          <ol
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              listStyle: 'none',
              fontSize: '0.825rem',
              color: 'var(--color-text-secondary)'
            }}
          >
            <li>
              <Link
                to="/"
                style={{
                  color: 'var(--color-text-secondary)'
                }}
              >
                Home
              </Link>
            </li>

            <li><ChevronRight size={13} /></li>

            <li>
              <Link
                to="/shop"
                style={{
                  color: 'var(--color-text-secondary)'
                }}
              >
                Watches
              </Link>
            </li>

            {product.category && (
              <>
                <li><ChevronRight size={13} /></li>

                <li>
                  <Link
                    to={`/shop?category=${encodeURIComponent(
                      product.category
                    )}`}
                    style={{
                      color: 'var(--color-text-secondary)'
                    }}
                  >
                    {product.category}
                  </Link>
                </li>
              </>
            )}

            <li><ChevronRight size={13} /></li>

            <li
              aria-current="page"
              style={{
                color: 'var(--color-charcoal)',
                fontWeight: 600
              }}
            >
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="product-details-grid">

          {/* Product Gallery */}
          <div className="product-gallery-column">
            <ProductGallery
              images={galleryImages}
              mainImage={selectedVariant?.image || product.mainImage}
              additionalImages={product.additionalImages}
              variantImage={selectedVariant?.image || null}
              productName={product.name}
            />
          </div>

          {/* Product Information */}
          <div className="product-info-panel">

            {product.brand && (
              <span className="product-header-brand">
                {product.brand}
              </span>
            )}

            <h1 className="product-header-title">
              {product.name}
            </h1>

            <div className="product-meta-row">

              {product.model && (
                <span className="product-id-badge">
                  Model: {product.model}
                </span>
              )}

              {product.id && (
                <span className="product-id-badge">
                  Ref: {product.id}
                </span>
              )}

              <span
                className={`product-availability-tag ${!selectedAvailable ? 'unavailable' : ''}`}
                role="status"
                aria-live="polite"
              >
                <ShieldCheck size={14} />
                {availabilityLabel}
              </span>
            </div>

            {/* Pricing */}
            <div className="product-price-section">
              {(() => {
                const currentPrice = selectedVariant?.price ?? product.price;
                return (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '12px'
                      }}
                    >
                      <span className="product-main-price">
                        {formatCurrency(currentPrice)}
                      </span>

                      {isDiscounted && (
                        <span
                          style={{
                            fontSize: '1.15rem',
                            color: 'var(--color-text-muted)',
                            textDecoration: 'line-through'
                          }}
                        >
                          {formatCurrency(
                            product.originalPrice,
                            { fallbackOnNull: false }
                          )}
                        </span>
                      )}
                    </div>

                    <p className="product-price-notice">
                      {hasValidPrice(currentPrice)
                        ? 'Inclusive of applicable taxes. Enquire directly on WhatsApp.'
                        : 'Contact us on WhatsApp for pricing and availability.'}
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Description */}
            {product.description && (
              <div
                style={{
                  marginBottom: '28px',
                  fontSize: '1rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.7
                }}
              >
                {product.description}
              </div>
            )}

            {/* Colour Selection */}
            {hasVariants && (
              <ColorVariantSelector
                variants={product.variants}
                selectedVariant={selectedVariant}
                onSelectVariant={(variant) =>
                  setSelectedVariantId(variant.id)
                }
              />
            )}

            {/* WhatsApp Enquiry */}
            <div className="product-cta-container">
              <WhatsAppButton
                product={product}
                variant={selectedVariant}
                label={selectedAvailable ? "Order / Enquire on WhatsApp" : "Enquire About Restock on WhatsApp"}
                variantStyle="primary"
                className="product-cta-button"
              />

              <div className="whatsapp-flow-explanation">
                <strong>
                  How WhatsApp enquiry works:
                </strong>{' '}
                Tapping above opens WhatsApp with your
                chosen timepiece and colour variant
                prefilled. You review and send the message
                yourself. Our team answers your questions
                directly.
              </div>
            </div>

            {/* Specifications */}
            {hasSpecs && (
              <div className="product-specs-box">
                <h4>Confirmed Specifications</h4>

                <table
                  className="specs-table"
                  aria-label="Technical Specifications"
                >
                  <tbody>
                    {Object.entries(
                      product.specifications
                    ).map(([key, value]) => (
                      <tr key={key}>
                        <th scope="row">{key}</th>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Back Link */}
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

        {/* Related Watches */}
        {relatedWatches.length > 0 && (
          <div
            style={{
              marginTop: '80px',
              paddingTop: '64px',
              borderTop:
                '1px solid var(--color-border)'
            }}
          >
            <div
              className="section-header"
              style={{ marginBottom: '36px' }}
            >
              <span className="section-subtitle">
                COMPLEMENTARY PIECES
              </span>

              <h2 className="section-title">
                You May Also Admire
              </h2>

              <div className="gold-divider" />
            </div>

            <ProductGrid products={relatedWatches} />
          </div>
        )}
        </div>
      </div>
    </>
  );
}

export default ProductDetails;