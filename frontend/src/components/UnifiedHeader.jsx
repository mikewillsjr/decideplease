import { useState } from 'react';
import { api } from '../api';
import './UnifiedHeader.css';

export default function UnifiedHeader({
  isSignedIn = false,
  credits,
  userEmail,
  creditPackInfo,
  isAdmin,
  onOpenAdmin,
  onOpenAuth,
  onSignOut, // Pass signOut as prop instead of using hook
}) {
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

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="unified-header">
      <div className="header-container">
        <div className="header-left">
          <a href="/" className="header-logo">
            <img src="/logo/Logo-icon.png" alt="DecidePlease Icon" className="header-logo-icon" />
            <img src="/logo/logo-text.png" alt="DecidePlease" className="header-logo-text" />
          </a>

          <nav className="header-nav">
            {isSignedIn ? (
              <>
                <a href="/" className="header-nav-link active">Decisions</a>
                <a href="/blog" className="header-nav-link">Blog</a>
              </>
            ) : (
              <>
                <button
                  className="header-nav-link"
                  onClick={() => scrollToSection('demo')}
                >
                  Examples
                </button>
                <button
                  className="header-nav-link"
                  onClick={() => scrollToSection('pricing')}
                >
                  Pricing
                </button>
                <a href="/blog" className="header-nav-link">Blog</a>
              </>
            )}
          </nav>
        </div>

        <div className="header-right">
          {isSignedIn ? (
            <>
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
                            onOpenAdmin?.();
                            setShowUserMenu(false);
                          }}
                        >
                          Admin Panel
                        </button>
                      )}
                      <div className="user-menu-divider" />
                      <button
                        className="user-menu-item danger"
                        onClick={() => onSignOut?.()}
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <button className="header-nav-link" onClick={() => onOpenAuth?.('signin')}>
                Log in
              </button>
              <button className="btn-primary btn-small" onClick={() => onOpenAuth?.('signup')}>
                Try Free
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
