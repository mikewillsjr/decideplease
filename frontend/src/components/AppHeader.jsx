import { useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { api } from '../api';
import './AppHeader.css';

export default function AppHeader({
  credits,
  userEmail,
  creditPackInfo,
  onCreditsUpdated,
  isAdmin,
  onOpenAdmin,
}) {
  const { signOut } = useClerk();
  const [isBuyingCredits, setIsBuyingCredits] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleBuyCredits = async () => {
    setIsBuyingCredits(true);
    try {
      const { checkout_url } = await api.createCheckoutSession();
      window.location.href = checkout_url;
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to start checkout. Please try again.');
      setIsBuyingCredits(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <a href="/" className="header-logo">
          <span className="header-mark">&#x2B21;</span>
          <span className="header-brand">DecidePlease</span>
        </a>
        <nav className="header-nav">
          <a href="/" className="header-nav-link active">Decisions</a>
          <a href="/blog" className="header-nav-link">Blog</a>
        </nav>
      </div>

      <div className="header-right">
        {/* Credits Display */}
        <div className="credits-display">
          <span className="credits-icon">&#x27e1;</span>
          <span className="credits-value">{credits ?? '...'} Credits</span>
          {creditPackInfo?.stripe_configured && (
            <button
              className="buy-credits-btn"
              onClick={handleBuyCredits}
              disabled={isBuyingCredits}
            >
              {isBuyingCredits ? '...' : `+${creditPackInfo.credits}`}
            </button>
          )}
        </div>

        {/* User Menu */}
        <div className="user-menu-container">
          <button
            className="user-menu-trigger"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <span className="user-avatar">
              {userEmail ? userEmail.charAt(0).toUpperCase() : '?'}
            </span>
          </button>

          {showUserMenu && (
            <>
              <div className="user-menu-backdrop" onClick={() => setShowUserMenu(false)} />
              <div className="user-menu-dropdown">
                <div className="user-menu-email">{userEmail}</div>
                <div className="user-menu-divider" />
                <a href="/settings" className="user-menu-item">Settings</a>
                {isAdmin && (
                  <button
                    className="user-menu-item"
                    onClick={() => {
                      onOpenAdmin();
                      setShowUserMenu(false);
                    }}
                  >
                    Admin Panel
                  </button>
                )}
                <div className="user-menu-divider" />
                <button
                  className="user-menu-item danger"
                  onClick={() => signOut()}
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
