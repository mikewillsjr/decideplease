import { useState, useEffect } from 'react';
import { api, setAuthTokenGetter } from '../api';
import './ImpersonationBanner.css';

/**
 * Banner that displays when a superadmin is impersonating another user.
 * Shows the impersonated user's email and an exit button.
 */
function ImpersonationBanner() {
  const [impersonationData, setImpersonationData] = useState(null);

  useEffect(() => {
    // Check if we're in an impersonation session
    const data = localStorage.getItem('decideplease_impersonating');
    if (data) {
      try {
        setImpersonationData(JSON.parse(data));
      } catch (e) {
        console.error('Failed to parse impersonation data:', e);
      }
    }
  }, []);

  const handleExitImpersonation = async () => {
    try {
      // Restore the original token
      const originalToken = localStorage.getItem('decideplease_original_token');
      if (originalToken) {
        localStorage.setItem('decideplease_access_token', originalToken);
        localStorage.removeItem('decideplease_original_token');
        localStorage.removeItem('decideplease_impersonation_token');
        localStorage.removeItem('decideplease_impersonating');

        // Try to log the end of impersonation
        try {
          // Temporarily use the impersonation token to call end endpoint
          await api.endImpersonation();
        } catch (e) {
          console.log('Could not log impersonation end:', e);
        }

        // Redirect back to admin
        window.location.href = '/admin';
      }
    } catch (error) {
      console.error('Failed to exit impersonation:', error);
      // Force redirect anyway
      window.location.href = '/admin';
    }
  };

  if (!impersonationData) {
    return null;
  }

  return (
    <div className="impersonation-banner">
      <div className="impersonation-content">
        <span className="impersonation-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <span className="impersonation-text">
          Viewing as <strong>{impersonationData.email}</strong>
        </span>
        <button onClick={handleExitImpersonation} className="exit-button">
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}

export default ImpersonationBanner;
