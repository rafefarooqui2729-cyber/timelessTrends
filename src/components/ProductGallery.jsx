import React, { useState, useEffect } from 'react';

export function ProductGallery({
  mainImage,
  additionalImages = [],
  variantImage = null,
  productName = 'Watch'
}) {
  const [activeImage, setActiveImage] = useState(variantImage || mainImage);
  const [imageError, setImageError] = useState(false);

  // When variant changes from parent, sync the active preview image
  useEffect(() => {
    if (variantImage) {
      setActiveImage(variantImage);
      setImageError(false);
    }
  }, [variantImage]);

  // Combine unique images for thumbnail navigation
  const allImages = Array.from(
    new Set([mainImage, ...(additionalImages || []), ...(variantImage ? [variantImage] : [])])
  ).filter(Boolean);

  return (
    <div className="product-gallery">
      {/* Primary High-Resolution View */}
      <div className="gallery-main-view">
        {!activeImage || imageError ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: '#161616',
            color: 'var(--color-silver)'
          }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--color-gold)' }}>
              TIMELESS TRENDS
            </span>
            <span style={{ fontSize: '0.85rem', marginTop: '8px' }}>
              {productName}
            </span>
          </div>
        ) : (
          <img
            src={activeImage}
            alt={`${productName} Catalogue View`}
            className="gallery-main-image"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* Thumbnails Navigation */}
      {allImages.length > 1 && (
        <div className="gallery-thumbnails" role="tablist" aria-label="Product image gallery thumbnails">
          {allImages.map((imgUrl, index) => {
            const isActive = activeImage === imgUrl;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`View photo ${index + 1} of ${productName}`}
                className={`gallery-thumb-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveImage(imgUrl);
                  setImageError(false);
                }}
              >
                <img
                  src={imgUrl}
                  alt={`Thumbnail ${index + 1}`}
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProductGallery;
