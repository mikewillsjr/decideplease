/**
 * PurchaseModal - Custom checkout UI with Stripe Payment Element
 * Supports saved cards with auto-fallback, plus new card entry with Apple/Google Pay.
 */

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { api } from '../api';
import './PurchaseModal.css';

// Card brand display names
const CARD_BRANDS = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  default: 'Card',
};

// Stripe promise - initialized once with publishable key
let stripePromise = null;

const getStripePromise = (publishableKey) => {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

/**
 * Saved cards selection component
 */
function SavedCardsSection({
  savedCards,
  selectedCardId,
  onSelectCard,
  onUseNewCard,
  isProcessing,
}) {
  return (
    <div className="saved-cards-section">
      <h3>Pay with saved card</h3>
      <div className="saved-cards-options">
        {savedCards.map((card) => (
          <label
            key={card.id}
            className={`card-option ${selectedCardId === card.id ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="payment-method"
              value={card.id}
              checked={selectedCardId === card.id}
              onChange={() => onSelectCard(card.id)}
              disabled={isProcessing}
            />
            <span className="card-details">
              <span className="card-brand-icon">💳</span>
              <span className="card-info">
                {CARD_BRANDS[card.brand] || CARD_BRANDS.default} •••• {card.last4}
              </span>
              {card.is_default && <span className="default-tag">Default</span>}
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="use-new-card-link"
        onClick={onUseNewCard}
        disabled={isProcessing}
      >
        + Use a different card
      </button>
    </div>
  );
}

/**
 * Inner payment form component (must be inside Elements provider)
 */
function CheckoutForm({ credits, priceDisplay, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/?payment=success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      // Payment failed
      setErrorMessage(error.message);
      setIsProcessing(false);
    } else {
      // Payment succeeded without redirect
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="purchase-form">
      <div className="purchase-summary">
        <div className="purchase-item">
          <span className="item-name">{credits} Credits</span>
          <span className="item-price">{priceDisplay}</span>
        </div>
      </div>

      <div className="payment-element-container">
        <PaymentElement
          options={{
            layout: 'tabs',
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
            },
          }}
        />
      </div>

      {errorMessage && (
        <div className="payment-error">
          {errorMessage}
        </div>
      )}

      <div className="purchase-actions">
        <button
          type="button"
          className="cancel-button"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="pay-button"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? 'Processing...' : `Pay ${priceDisplay}`}
        </button>
      </div>
    </form>
  );
}

/**
 * Main PurchaseModal component
 */
export default function PurchaseModal({ isOpen, onClose, onSuccess }) {
  const [creditPackInfo, setCreditPackInfo] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [paymentMode, setPaymentMode] = useState('saved'); // 'saved' | 'new'
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [chargeResult, setChargeResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset state when modal opens
    setPaymentMode('saved');
    setSelectedCardId(null);
    setClientSecret('');
    setError('');
    setChargeResult(null);

    const initialize = async () => {
      setLoading(true);
      setError('');

      try {
        // Get credit pack info (includes publishable key)
        const info = await api.getCreditPackInfo();
        setCreditPackInfo(info);

        if (!info.stripe_configured || !info.publishable_key) {
          setError('Payment system is not configured. Please try again later.');
          setLoading(false);
          return;
        }

        // Try to load saved payment methods
        try {
          const { methods } = await api.getPaymentMethods();
          setSavedCards(methods || []);

          // Pre-select default card if available
          const defaultCard = methods?.find(m => m.is_default);
          if (defaultCard) {
            setSelectedCardId(defaultCard.id);
          } else if (methods?.length > 0) {
            setSelectedCardId(methods[0].id);
          }

          // If no saved cards, go straight to new card mode
          if (!methods || methods.length === 0) {
            await prepareNewCardPayment();
          }
        } catch (err) {
          // If loading saved cards fails, fall back to new card
          console.warn('Could not load saved cards:', err);
          await prepareNewCardPayment();
        }
      } catch (err) {
        setError(err.message || 'Failed to initialize payment');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [isOpen]);

  const prepareNewCardPayment = async () => {
    setPaymentMode('new');
    try {
      const { client_secret } = await api.createPaymentIntent();
      setClientSecret(client_secret);
    } catch (err) {
      setError(err.message || 'Failed to initialize payment');
    }
  };

  const handleUseNewCard = async () => {
    if (!clientSecret) {
      setLoading(true);
      await prepareNewCardPayment();
      setLoading(false);
    } else {
      setPaymentMode('new');
    }
  };

  const handleUseSavedCards = () => {
    setPaymentMode('saved');
    setError('');
    setChargeResult(null);
  };

  const handlePayWithSavedCard = async () => {
    setProcessing(true);
    setError('');
    setChargeResult(null);

    try {
      // This will try the selected card first, then others if it fails
      const result = await api.chargeSavedCard(selectedCardId);

      if (result.success) {
        handleSuccess();
      } else {
        // All cards failed
        setChargeResult(result);
        setError(result.message || 'Payment failed. Please try a different payment method.');
      }
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  const stripePromise = creditPackInfo?.publishable_key
    ? getStripePromise(creditPackInfo.publishable_key)
    : null;

  const hasSavedCards = savedCards.length > 0;

  return (
    <div className="purchase-modal-overlay" onClick={onClose}>
      <div className="purchase-modal" onClick={(e) => e.stopPropagation()}>
        <div className="purchase-header">
          <h2>Purchase Credits</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="purchase-content">
          {loading ? (
            <div className="purchase-loading">
              <div className="spinner"></div>
              <p>Preparing checkout...</p>
            </div>
          ) : error && !chargeResult ? (
            <div className="purchase-error-state">
              <p>{error}</p>
              <button onClick={onClose}>Close</button>
            </div>
          ) : paymentMode === 'saved' && hasSavedCards ? (
            /* Saved cards mode */
            <div className="saved-cards-checkout">
              <div className="purchase-summary">
                <div className="purchase-item">
                  <span className="item-name">{creditPackInfo?.credits} Credits</span>
                  <span className="item-price">{creditPackInfo?.price_display}</span>
                </div>
              </div>

              <SavedCardsSection
                savedCards={savedCards}
                selectedCardId={selectedCardId}
                onSelectCard={setSelectedCardId}
                onUseNewCard={handleUseNewCard}
                isProcessing={processing}
              />

              {chargeResult?.failed_attempts && (
                <div className="failed-cards-notice">
                  <p>The following cards were declined:</p>
                  <ul>
                    {chargeResult.failed_attempts.map((attempt, i) => (
                      <li key={i}>•••• {attempt.card_last4}: {attempt.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <div className="payment-error">
                  {error}
                </div>
              )}

              <div className="purchase-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={onClose}
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="pay-button"
                  onClick={handlePayWithSavedCard}
                  disabled={!selectedCardId || processing}
                >
                  {processing ? 'Processing...' : `Pay ${creditPackInfo?.price_display}`}
                </button>
              </div>
            </div>
          ) : clientSecret && stripePromise ? (
            /* New card mode */
            <>
              {hasSavedCards && (
                <button
                  type="button"
                  className="back-to-saved-link"
                  onClick={handleUseSavedCards}
                >
                  ← Back to saved cards
                </button>
              )}
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#4a90e2',
                      colorBackground: '#ffffff',
                      colorText: '#1a1a2e',
                      colorDanger: '#dc3545',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      borderRadius: '8px',
                    },
                  },
                }}
              >
                <CheckoutForm
                  credits={creditPackInfo?.credits}
                  priceDisplay={creditPackInfo?.price_display}
                  onSuccess={handleSuccess}
                  onCancel={onClose}
                />
              </Elements>
            </>
          ) : (
            <div className="purchase-error-state">
              <p>Unable to load payment form</p>
              <button onClick={onClose}>Close</button>
            </div>
          )}
        </div>

        <div className="purchase-footer">
          <p className="secure-notice">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
            Secure payment powered by Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
