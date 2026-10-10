import React, { useEffect } from 'react';
import { X, AlertCircle, MessageSquare } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';

/**
 * WhatsAppSetupModal
 * Renders an informative, elegant dialog when WhatsApp number is not yet configured in siteConfig.js.
 * This guarantees that client/developer understands the setup immediately and never encounters a dead or fake link.
 */
export function WhatsAppSetupModal({ isOpen, onClose, previewMessage }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-backdrop" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="modal-setup-title"
    >
      <div 
        className="modal-card" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          aria-label="Close setup modal"
        >
          <X size={20} />
        </button>

        <div className="modal-badge-setup">
          <AlertCircle size={14} />
          WhatsApp Configuration Needed
        </div>

        <h3 id="modal-setup-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: '8px' }}>
          Connect Your Business WhatsApp
        </h3>

        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          The direct WhatsApp enquiry feature is ready! To route customer chats to your real store number, update the configuration file:
        </p>

        <div className="code-snippet-box">
          <code>
            // File: src/config/siteConfig.js<br />
            whatsappNumber: '919876543210', // Enter your international phone number
          </code>
        </div>

        <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '16px', color: 'var(--color-charcoal)' }}>
          Prepared Customer Message Preview:
        </h4>

        <div className="message-preview-container">
          {previewMessage || 'Hello ' + siteConfig.brandName + '! I am interested in your watches.'}
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
          * When live, clicking this button automatically launches WhatsApp on the customer's phone or computer with this exact prefilled text. The customer reviews and presses send.
        </p>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          onClick={onClose}
        >
          Understood, Close
        </button>
      </div>
    </div>
  );
}

export default WhatsAppSetupModal;
