import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

export function ProductGallery({
  images = [],
  mainImage = '',
  additionalImages = [],
  variantImage = null,
  productName = 'Watch'
}) {
  // Build unique, valid, stable image list

const allImages = useMemo(() => {
  let sourceList = [];

  if (Array.isArray(images) && images.length > 0) {
    sourceList = [
      ...(variantImage ? [variantImage] : []),
      ...images
    ];
  } else {
    sourceList = [
      ...(variantImage ? [variantImage] : []),
      mainImage,
      ...(Array.isArray(additionalImages) ? additionalImages : [])
    ];
  }

  return Array.from(new Set(
    sourceList.filter(
      (img) => typeof img === 'string' && img.trim().length > 0
    )
  ));
}, [images, variantImage, mainImage, additionalImages]);


  const [activeImage, setActiveImage] = useState(
    variantImage || allImages[0] || mainImage || ''
  );
  const [imageError, setImageError] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    deltaX: 0,
    isHorizontal: null,
    startTime: 0
  });

  const galleryRef = useRef(null);
  const thumbnailsRef = useRef(null);

  // Preload all gallery images in background for instant zero-lag switching
  useEffect(() => {
    if (typeof window === 'undefined' || allImages.length === 0) return;
    allImages.forEach((src) => {
      if (src) {
        const preloadImg = new Image();
        preloadImg.src = src;
      }
    });
  }, [allImages]);

  // Synchronize when variant changes or product changes
  useEffect(() => {
    if (variantImage && allImages.includes(variantImage)) {
      setActiveImage(variantImage);
      setImageError(false);
    } else if (allImages.length > 0 && !allImages.includes(activeImage)) {
      setActiveImage(allImages[0]);
      setImageError(false);
    } else if (allImages.length > 0 && !activeImage) {
      setActiveImage(allImages[0]);
      setImageError(false);
    }
  }, [variantImage, allImages, activeImage]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (!thumbnailsRef.current) return;
    const activeThumb = thumbnailsRef.current.querySelector('.gallery-thumb-btn.active');
    if (activeThumb && typeof activeThumb.scrollIntoView === 'function') {
      activeThumb.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeImage]);

  
const selectImage = useCallback((img) => {
  if (!img || img === activeImage) return;

  setIsAnimating(true);
  setActiveImage(img);
  setImageError(false);

  const timer = setTimeout(() => {
    setIsAnimating(false);
  }, 250);

  return () => clearTimeout(timer);
}, [activeImage]);


  const currentIndex = Math.max(0, allImages.indexOf(activeImage));

  const showNext = useCallback(() => {
    if (allImages.length < 2) return;
    const nextIdx = (currentIndex + 1) % allImages.length;
selectImage(allImages[nextIdx], 'next');
  }, [allImages, currentIndex, selectImage]);

  const showPrev = useCallback(() => {
    if (allImages.length < 2) return;
    const prevIdx = (currentIndex - 1 + allImages.length) % allImages.length;
selectImage(allImages[prevIdx], 'prev');
  }, [allImages, currentIndex, selectImage]);

  // Touch swipe handling with vertical scroll preservation & drag feedback
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      isHorizontal: null,
      startTime: Date.now()
    };
    setIsSwiping(false);
  };

  const handleTouchMove = (e) => {
    if (!touchStateRef.current || !e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStateRef.current.startX;
    const dy = touch.clientY - touchStateRef.current.startY;

    // Detect gesture direction after small deadband
    if (touchStateRef.current.isHorizontal === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        touchStateRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
    }

    // If predominantly horizontal, provide interactive swipe feedback and prevent vertical page scroll
    if (touchStateRef.current.isHorizontal === true) {
      if (e.cancelable) {
        e.preventDefault();
      }
      touchStateRef.current.deltaX = dx;
      setIsSwiping(true);

      // Dampen drag at boundaries if only single image
      const dampening = allImages.length <= 1 ? 0.15 : 0.35;
      setDragOffset(dx * dampening);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStateRef.current) return;
    const { deltaX, isHorizontal, startTime } = touchStateRef.current;
    const elapsed = Date.now() - startTime;
    touchStateRef.current = null;

    setDragOffset(0);
    setIsSwiping(false);

    if (isHorizontal === true && allImages.length > 1) {
      const isQuickFlick = elapsed < 320 && Math.abs(deltaX) > 24;
      const isSufficientDrag = Math.abs(deltaX) > 42;

      if (isQuickFlick || isSufficientDrag) {
        if (deltaX < 0) {
          showNext();
        } else {
          showPrev();
        }
      }
    }
  };

  // Keyboard accessibility
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      showNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showPrev();
    }
  };

  return (
    <div
      className="product-gallery"
      ref={galleryRef}
      onKeyDown={handleKeyDown}
      tabIndex={allImages.length > 1 ? 0 : undefined}
      role="region"
      aria-label={`${productName} image gallery`}
    >
      {/* Main View Area */}
      <div
        className="gallery-main-view"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {!activeImage || imageError ? (
          <div className="gallery-placeholder">
            <ImageIcon size={44} className="gallery-placeholder-icon" aria-hidden="true" />
            <span className="gallery-placeholder-brand">TIMELESS TRENDS</span>
            <span className="gallery-placeholder-name">{productName}</span>
            <span className="gallery-placeholder-sub">Horological Catalogue</span>
          </div>
        ) : (
          
<div
  key={activeImage}
className={`gallery-main-image ${isAnimating ? 'is-fading' : ''}`}  style={{
    transform: isSwiping ? `translateX(${dragOffset}px)` : 'translateX(0)',
    transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
  }}
>
  <img
    src={activeImage}
    alt={`${productName} - View ${currentIndex + 1} of ${allImages.length}`}
    className="gallery-main-image"
    onError={() => setImageError(true)}
    draggable="false"
  />
</div>

        )}

        {/* Gallery Next / Prev Click Overlays (when multi-image) */}
        {allImages.length > 1 && (
          <>
            <button
              type="button"
              className="gallery-nav-arrow gallery-arrow-prev"
              onClick={showPrev}
              aria-label="View previous photo"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="gallery-nav-arrow gallery-arrow-next"
              onClick={showNext}
              aria-label="View next photo"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>

            {/* Position counter pill */}
            <div className="gallery-counter-pill" aria-hidden="true">
              {currentIndex + 1} / {allImages.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails Strip */}
      {allImages.length > 1 && (
        <div
          className="gallery-thumbnails"
          ref={thumbnailsRef}
          role="tablist"
          aria-label="Product thumbnails"
        >
          {allImages.map((imgUrl, index) => {
            const isActive = activeImage === imgUrl;

            return (
              <button
                key={`${imgUrl}-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show photograph ${index + 1} of ${allImages.length}`}
                className={`gallery-thumb-btn ${isActive ? 'active' : ''}`}
                onClick={() => selectImage(imgUrl)}
              >
                <img
                  src={imgUrl}
                  alt={`Thumbnail ${index + 1}`}
                  loading="lazy"
                  draggable="false"
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
