import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Handles the Google OAuth callback.
 * Receives the authorization code from Google and exchanges it for tokens.
 */
export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthData } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setError('Google sign-in was cancelled or failed.');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code) {
        setError('No authorization code received from Google.');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Get the redirect URI that was used (must match exactly)
        const redirectUri = `${window.location.origin}/auth/google/callback`;

        // Exchange code for tokens via our backend
        const response = await fetch(`${API_BASE}/api/auth/oauth/google/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Failed to sign in with Google');
        }

        // Store auth data
        setAuthData({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: data.user,
        });

        // Redirect to council page
        navigate('/council');
      } catch (err) {
        console.error('Google OAuth error:', err);
        setError(err.message || 'Failed to sign in with Google');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setAuthData]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
    }}>
      {error ? (
        <>
          <div style={{
            color: '#ef4444',
            marginBottom: '1rem',
            fontSize: '1.125rem',
          }}>
            {error}
          </div>
          <p style={{ color: '#71717a' }}>Redirecting you back...</p>
        </>
      ) : (
        <>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#5d5dff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ marginTop: '1rem', color: '#71717a' }}>
            Completing sign in with Google...
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
