import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AuthModal({ isOpen, onClose, initialMode = 'login', initialEmail = '' }) {
  const [mode, setMode] = useState(initialMode); // 'login', 'register', 'forgot', or 'email_sent'
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // TODO: Re-enable when Google OAuth is configured in production
  const [oauthProviders] = useState([]);
  const [oauthLoading, setOauthLoading] = useState(false); // eslint-disable-line no-unused-vars
  const [emailSentType, setEmailSentType] = useState(null); // 'magic_link' or 'verification'
  const [requiresVerification, setRequiresVerification] = useState(false);

  const { login, requestMagicLink } = useAuth();

  // Sync mode with initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setEmail(initialEmail);
      setPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
      setEmailSentType(null);
      setRequiresVerification(false);
    }
  }, [isOpen, initialMode, initialEmail]);

  // Fetch OAuth providers on mount
  // TODO: Re-enable when Google OAuth is configured in production
  // useEffect(() => {
  //   const fetchProviders = async () => {
  //     try {
  //       const response = await fetch(`${API_BASE}/api/auth/oauth/providers`);
  //       if (response.ok) {
  //         const data = await response.json();
  //         setOauthProviders(data.providers || []);
  //       }
  //     } catch (err) {
  //       console.error('Failed to fetch OAuth providers:', err);
  //     }
  //   };
  //   fetchProviders();
  // }, []);

  // Handle Google OAuth login
  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/oauth/google/authorize`);
      if (!response.ok) {
        throw new Error('Failed to initiate Google sign-in');
      }
      const data = await response.json();
      // Redirect to Google's authorization page
      window.location.href = data.authorize_url;
    } catch (err) {
      setError(err.message || 'Failed to start Google sign-in');
      setOauthLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (mode === 'forgot') {
        // Send forgot password request (also uses magic link)
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || 'Failed to send reset email');
        }
        setSuccess('If an account exists with this email, a password reset link has been sent.');
        setIsLoading(false);
        return;
      } else if (mode === 'register') {
        // Registration flow - use magic link API

        // If password provided, validate it
        if (password) {
          if (password !== confirmPassword) {
            setError('Passwords do not match');
            setIsLoading(false);
            return;
          }
          if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setIsLoading(false);
            return;
          }
        }

        // Request magic link (with optional password)
        const result = await requestMagicLink(email, password || null);

        if (result.loggedIn) {
          // Password flow - logged in immediately but needs verification
          if (result.requiresVerification) {
            setEmailSentType('verification');
            setRequiresVerification(true);
            setMode('email_sent');
          } else {
            // Fully verified (shouldn't happen with password signup, but handle it)
            onClose();
          }
        } else {
          // Magic link flow - email sent
          setEmailSentType('magic_link');
          setMode('email_sent');
        }
      } else {
        // Login flow
        await login(email, password);
        // Success - close modal
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle magic link login request
  const handleMagicLinkLogin = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await requestMagicLink(email, null);
      setEmailSentType('magic_link');
      setMode('email_sent');
    } catch (err) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setEmailSentType(null);
    setRequiresVerification(false);
  };

  // Email sent confirmation screen
  if (mode === 'email_sent') {
    return (
      <div className="auth-modal-overlay" onClick={onClose}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <button className="auth-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div className="auth-email-sent">
            <div className="auth-email-sent-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2>Check your email</h2>
            <p className="auth-email-sent-email">{email}</p>

            {emailSentType === 'magic_link' ? (
              <p className="auth-email-sent-message">
                We&apos;ve sent you a magic link. Click the link in the email to{' '}
                {requiresVerification ? 'verify your email and get your 5 free credits' : 'sign in'}.
              </p>
            ) : (
              <p className="auth-email-sent-message">
                Your account is ready! We&apos;ve sent a verification link to unlock your 5 free credits.
                You can start exploring while you wait.
              </p>
            )}

            <div className="auth-email-sent-note">
              <span>Didn&apos;t receive it?</span> Check your spam folder or{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setEmailSentType(null);
                }}
              >
                try again
              </button>
            </div>

            {requiresVerification && (
              <button
                type="button"
                className="auth-submit auth-continue-btn"
                onClick={onClose}
              >
                Continue to app
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Determine button text based on mode and password
  const getSubmitButtonText = () => {
    if (isLoading) {
      if (mode === 'login') return 'Signing in...';
      if (mode === 'register') return password ? 'Creating account...' : 'Sending link...';
      return 'Sending...';
    }

    if (mode === 'login') return 'Sign in';
    if (mode === 'register') return password ? 'Create account' : 'Get started';
    return 'Send reset link';
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="auth-modal-header">
          <h2>
            {mode === 'login' ? 'Welcome back' :
             mode === 'register' ? 'Create your account' :
             'Reset your password'}
          </h2>
          <p>
            {mode === 'login' ? 'Sign in to continue' :
             mode === 'register' ? 'Get 5 free credits to start' :
             'Enter your email to receive a reset link'}
          </p>
        </div>

        {/* OAuth buttons - show for login and register modes */}
        {mode !== 'forgot' && oauthProviders.length > 0 && (
          <>
            <div className="auth-oauth-buttons">
              {oauthProviders.some(p => p.name === 'google') && (
                <button
                  type="button"
                  className="auth-oauth-button auth-oauth-google"
                  onClick={handleGoogleLogin}
                  disabled={oauthLoading}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              )}
            </div>
            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="auth-field">
              <label htmlFor="password">
                Password
                {mode === 'register' && <span className="auth-field-optional">(Optional)</span>}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register'
                  ? 'Set a password or skip for magic link'
                  : 'Your password'}
                required={mode === 'login'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              {mode === 'register' && !password && (
                <p className="auth-field-hint">
                  Leave blank to sign in via email link
                </p>
              )}
            </div>
          )}

          {mode === 'register' && password && (
            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {mode === 'login' && (
            <div className="auth-login-options">
              <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
              <button
                type="button"
                className="auth-magic-link-btn"
                onClick={handleMagicLinkLogin}
                disabled={isLoading}
              >
                Email me a login link
              </button>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={isLoading || (mode === 'forgot' && success)}
          >
            {isLoading ? (
              <span className="auth-loading">
                <svg className="auth-spinner" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="32" strokeLinecap="round" />
                </svg>
                {getSubmitButtonText()}
              </span>
            ) : (
              getSubmitButtonText()
            )}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchMode('register')}>Sign up</button>
            </>
          ) : mode === 'register' ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')}>Sign in</button>
            </>
          ) : (
            <>
              Remember your password?{' '}
              <button type="button" onClick={() => switchMode('login')}>Sign in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
