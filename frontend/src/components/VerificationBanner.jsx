import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './VerificationBanner.css';

/**
 * Banner shown to users who haven't verified their email.
 * Includes a resend verification email button.
 */
export default function VerificationBanner({ userEmail }) {
  const { resendVerification, refreshUser } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  const handleResend = async () => {
    setIsResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      await resendVerification();
      setResendSuccess(true);
      // Auto-clear success message after 5 seconds
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      setResendError(err.message || 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="verification-banner">
      <div className="verification-banner-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="verification-banner-content">
        <span className="verification-banner-title">Verify your email to unlock 5 free credits</span>
        <span className="verification-banner-email">{userEmail}</span>
      </div>
      <div className="verification-banner-actions">
        {resendSuccess ? (
          <span className="verification-banner-sent">Email sent!</span>
        ) : resendError ? (
          <span className="verification-banner-error">{resendError}</span>
        ) : (
          <button
            className="verification-banner-resend"
            onClick={handleResend}
            disabled={isResending}
          >
            {isResending ? 'Sending...' : 'Resend verification email'}
          </button>
        )}
      </div>
    </div>
  );
}
