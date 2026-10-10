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
  ariaLabel
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
