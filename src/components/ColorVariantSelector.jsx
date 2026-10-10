import React from 'react';
import { Check } from 'lucide-react';

export function ColorVariantSelector({
  variants = [],
  selectedVariant = null,
  onSelectVariant
}) {
  if (!variants || variants.length === 0) return null;

  return (
    <div className="variant-selector-wrapper" role="group" aria-labelledby="variant-selector-heading">
      <div className="variant-selector-header">
        <span id="variant-selector-heading" className="variant-label-title">
          Colour / Finish
        </span>
        {selectedVariant && (
          <span className="variant-current-choice">
            {selectedVariant.name}
          </span>
        )}
      </div>

      <div className="variant-swatch-list" role="radiogroup" aria-label="Watch colour variants">
        {variants.map((variant) => {
          const isSelected = selectedVariant?.id === variant.id;

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`variant-swatch-btn ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectVariant(variant)}
            >
              {/* Swatch circle with border */}
              <span
                className="variant-color-circle"
                style={{ backgroundColor: variant.color || '#333' }}
                aria-hidden="true"
              />

              {/* Text label to satisfy accessibility (never colour alone) */}
              <span className="variant-btn-text">
                {variant.name}
              </span>

              {isSelected && (
                <Check size={14} color="var(--color-gold)" aria-hidden="true" style={{ marginLeft: '4px' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ColorVariantSelector;
