import React from 'react';
import { Check } from 'lucide-react';
import { getSwatchStyle } from '../utils/swatchColor';

export function ColorVariantSelector({
  variants = [],
  selectedVariant = null,
  onSelectVariant
}) {
  if (!variants || variants.length === 0) return null;

  return (
    <div
      className="variant-selector-wrapper"
      role="group"
      aria-labelledby="variant-selector-heading"
    >
      <div className="variant-selector-header">
        <span
          id="variant-selector-heading"
          className="variant-label-title"
        >
          Colour / Finish
        </span>

        {selectedVariant && (
          <span className="variant-current-choice" aria-live="polite">
            {selectedVariant.name}
          </span>
        )}
      </div>

      <div
        className="variant-swatch-list"
        role="radiogroup"
        aria-label="Watch colour variants"
      >
        {variants.map((variant) => {
          const isSelected = selectedVariant?.id === variant.id;
          const swatchStyle = getSwatchStyle(variant.name || variant.color || '');

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select ${variant.name} finish`}
              className={`variant-swatch-btn ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectVariant(variant)}
            >
              <span
                className="variant-color-circle"
                style={swatchStyle}
                aria-hidden="true"
              />

              <span className="variant-btn-text">
                {variant.name}
              </span>

              {isSelected && (
                <Check
                  size={14}
                  className="variant-check-icon"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ColorVariantSelector;
