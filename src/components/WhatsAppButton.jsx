import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { getWhatsAppActionDetails } from '../utils/whatsapp';
import { WhatsAppSetupModal } from './WhatsAppSetupModal';

/**
 * WhatsAppButton
 * Standardized, accessible button that opens WhatsApp click-to-chat
 * or presents setup assistance if business number is unconfigured.
 */
export function WhatsAppButton({
  product = null,
  variant = null,
  customMessage = null,
  label = 'Enquire on WhatsApp',
  variantStyle = 'primary', // 'primary' | 'outline' | 'compact'
  className = '',
    showIcon = true,
  ariaLabel,
  style
}) {
  const [showSetupModal, setShowSetupModal] = useState(false);

  const actionDetails = getWhatsAppActionDetails({
    product,
    variant,
    customMessage
  });

  const baseClass = variantStyle === 'outline'
    ? 'btn btn-whatsapp-outline'
    : 'btn btn-whatsapp';

  const combinedClass = `${baseClass} ${className}`.trim();
  const accessibleLabel = ariaLabel || label;

  // Record click activity non-blockingly without delaying navigation
  const handleLinkClick = () => {
    if (product && (product.id || product.code)) {
      try {
        const payload = JSON.stringify({
          productId: Number(product.id) || null,
          variantId: variant?.id ? Number(variant.id) || null : null,
          source: 'whatsapp_button'
        });
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          navigator.sendBeacon('/api/public/enquiries/click', new Blob([payload], { type: 'application/json' }));
        } else if (typeof fetch === 'function') {
          fetch('/api/public/enquiries/click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          }).catch(() => {});
        }
      } catch {
        // Non-blocking telemetry
      }
    }
  };

  // Handle click when WhatsApp number is not configured
  const handleClick = (e) => {
    if (!actionDetails.isConfigured) {
      e.preventDefault();
      setShowSetupModal(true);
    }
  };

  return (
    <>
      {actionDetails.isConfigured ? (
        <a
          href={actionDetails.url}
          target="_blank"
          rel="noopener noreferrer"
          className={combinedClass}
          aria-label={accessibleLabel}
          onClick={handleLinkClick}
        >
          {showIcon && <MessageCircle size={18} aria-hidden="true" />}
          <span>{label}</span>
        </a>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={combinedClass}
          aria-label={`${accessibleLabel} (Setup required)`}
          title="WhatsApp configuration needed"
        >
          {showIcon && <MessageCircle size={18} aria-hidden="true" />}
          <span>{label}</span>
        </button>
      )}

      {showSetupModal && (
        <WhatsAppSetupModal
          isOpen={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          previewMessage={actionDetails.messageText}
        />
      )}
    </>
  );
}

export default WhatsAppButton;
