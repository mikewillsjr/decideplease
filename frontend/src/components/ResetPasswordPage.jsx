import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import UnifiedHeader from './UnifiedHeader';
import UnifiedFooter from './UnifiedFooter';
import './LegalPages.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <div className="legal-page">
      <UnifiedHeader />
      <main className="legal-content">
        <div className="legal-container" style={{ maxWidth: '400px' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Reset Password</h1>

          {status === 'success' ? (
            <div className="reset-success">
              <div className="success-icon">✓</div>
              <h2>Password Reset Successfully</h2>
              <p>Your password has been updated. You can now log in with your new password.</p>
              <button
                className="reset-button"
                onClick={() => navigate('/')}
              >
                Go to Login
              </button>
            </div>
          ) : status === 'error' && !token ? (
            <div className="reset-error">
              <div className="error-icon">!</div>
              <p>{error}</p>
              <button
                className="reset-button"
                onClick={() => navigate('/')}
              >
                Back to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="reset-form">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
                Enter your new password below.
              </p>

              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
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

              {error && status === 'error' && (
                <div className="form-error">{error}</div>
              )}

              <button
                type="submit"
                className="reset-button"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </main>
      <UnifiedFooter />

      <style>{`
        .reset-form {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 2rem;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          color: var(--text-primary, #f4f4f5);
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: var(--text-primary, #f4f4f5);
          font-size: 1rem;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--primary, #5d5dff);
        }

        .form-group input::placeholder {
          color: var(--text-muted, #71717a);
        }

        .form-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .reset-button {
          width: 100%;
          padding: 0.875rem 1.5rem;
          background: var(--primary, #5d5dff);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .reset-button:hover:not(:disabled) {
          background: #4a4ae0;
        }

        .reset-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .reset-success,
        .reset-error {
          text-align: center;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
        }

        .success-icon {
          width: 60px;
          height: 60px;
          background: rgba(16, 185, 129, 0.2);
          border: 2px solid #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: #10b981;
          margin: 0 auto 1.5rem;
        }

        .error-icon {
          width: 60px;
          height: 60px;
          background: rgba(239, 68, 68, 0.2);
          border: 2px solid #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: #ef4444;
          margin: 0 auto 1.5rem;
        }

        .reset-success h2,
        .reset-error h2 {
          color: var(--text-primary, #f4f4f5);
          font-size: 1.25rem;
          margin-bottom: 0.75rem;
        }

        .reset-success p,
        .reset-error p {
          color: var(--text-secondary, #a1a1aa);
          margin-bottom: 1.5rem;
        }
      `}</style>
    </div>
  );
}
