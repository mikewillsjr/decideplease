/**
 * PurchaseModal - Custom checkout UI with Stripe Payment Element
 * Supports cards, Apple Pay, and Google Pay with full DecidePlease branding.
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

// Stripe promise - initialized once with publishable key
let stripePromise = null;

const getStripePromise = (publishableKey) => {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

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
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const initializePayment = async () => {
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

        // Create payment intent
        const { client_secret } = await api.createPaymentIntent();
        setClientSecret(client_secret);
      } catch (err) {
        setError(err.message || 'Failed to initialize payment');
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [isOpen]);

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  const stripePromise = creditPackInfo?.publishable_key
    ? getStripePromise(creditPackInfo.publishable_key)
    : null;

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
          ) : error ? (
            <div className="purchase-error-state">
              <p>{error}</p>
              <button onClick={onClose}>Close</button>
            </div>
          ) : clientSecret && stripePromise ? (
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
                credits={creditPackInfo.credits}
                priceDisplay={creditPackInfo.price_display}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            </Elements>
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
