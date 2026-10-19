import React from 'react';
import { Check } from 'lucide-react';

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
          <span className="variant-current-choice">
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

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={variant.name}
              className={`variant-swatch-btn ${
                isSelected ? 'active' : ''
              }`}
              onClick={() => onSelectVariant(variant)}
              style={{
                transition:
                  'background-color 220ms ease, border-color 220ms ease, box-shadow 220ms ease, transform 220ms ease',
                borderColor: isSelected
                  ? 'var(--color-gold)'
                  : undefined,
                boxShadow: isSelected
                  ? '0 0 0 1px var(--color-gold), 0 4px 14px rgba(184,155,98,0.16)'
                  : undefined,
                transform: isSelected
                  ? 'translateY(-2px)'
                  : 'translateY(0)'
              }}
            >
              <span
                className="variant-color-circle"
                style={{
                  backgroundColor: variant.color || '#333',
                  transition: 'transform 220ms ease',
                  transform: isSelected
                    ? 'scale(1.12)'
                    : 'scale(1)'
                }}
                aria-hidden="true"
              />

              <span className="variant-btn-text">
                {variant.name}
              </span>

              {isSelected && (
                <Check
                  size={14}
                  color="var(--color-gold)"
                  aria-hidden="true"
                  style={{ marginLeft: '4px' }}
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