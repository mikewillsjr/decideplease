import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AuthModal({ isOpen, onClose, initialMode = 'login', initialEmail = '' }) {
  const [mode, setMode] = useState(initialMode); // 'login', 'register', or 'forgot'
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState([]);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { login, register } = useAuth();

  // Fetch OAuth providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/oauth/providers`);
        if (response.ok) {
          const data = await response.json();
          setOauthProviders(data.providers || []);
        }
      } catch (err) {
        console.error('Failed to fetch OAuth providers:', err);
      }
    };
    fetchProviders();
  }, []);

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
        // Send forgot password request
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
        // Validate password match
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        // Validate password strength
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setIsLoading(false);
          return;
        }
        await register(email, password);
      } else {
        await login(email, password);
      }
      // Success - close modal
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
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
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          {mode === 'register' && (
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
            <div className="auth-forgot-link">
              <button type="button" onClick={() => switchMode('forgot')}>
                Forgot your password?
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
                {mode === 'login' ? 'Signing in...' :
                 mode === 'register' ? 'Creating account...' :
                 'Sending...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign in' :
              mode === 'register' ? 'Create account' :
              'Send reset link'
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
