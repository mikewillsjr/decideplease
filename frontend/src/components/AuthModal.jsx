import { useState } from 'react';
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

  const { login, register } = useAuth();

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
