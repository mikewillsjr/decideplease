import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Handles magic link verification.
 * When users click the magic link in their email, they're brought here
 * to complete the sign-in or signup process.
 */
export default function MagicLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyMagicLink } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleVerification = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setError('Invalid magic link. No token provided.');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Verify the magic link token
        const user = await verifyMagicLink(token);

        setSuccess(true);

        // Show success briefly then redirect to decision
        setTimeout(() => {
          navigate('/decision');
        }, 1500);
      } catch (err) {
        console.error('Magic link verification error:', err);
        setError(err.message || 'This magic link is invalid or has expired.');
        setTimeout(() => navigate('/'), 4000);
      }
    };

    handleVerification();
  }, [searchParams, navigate, verifyMagicLink]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      background: '#000',
    }}>
      {error ? (
        <>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div style={{
            color: '#f87171',
            marginBottom: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: '600',
          }}>
            Link expired or invalid
          </div>
          <p style={{
            color: '#9ca3af',
            marginBottom: '1.5rem',
            maxWidth: '300px',
            lineHeight: '1.6',
          }}>
            {error}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Redirecting you back...
          </p>
        </>
      ) : success ? (
        <>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div style={{
            color: '#34d399',
            marginBottom: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: '600',
          }}>
            Email verified!
          </div>
          <p style={{
            color: '#9ca3af',
            marginBottom: '1.5rem',
          }}>
            Welcome to DecidePlease. Redirecting...
          </p>
        </>
      ) : (
        <>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid rgba(93, 93, 255, 0.2)',
            borderTopColor: '#5d5dff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1.5rem',
          }} />
          <p style={{
            color: '#9ca3af',
            fontSize: '1.125rem',
          }}>
            Verifying your magic link...
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
