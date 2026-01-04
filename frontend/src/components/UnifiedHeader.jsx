import { useState } from 'react';
import { api } from '../api';
import { useTheme } from '../contexts/ThemeContext';
import './UnifiedHeader.css';

// Sun icon for light mode
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  </svg>
);

// Moon icon for dark mode
const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
  </svg>
);

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
  const { theme, toggleTheme } = useTheme();

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
          <a href="/" className="header-logo" aria-label="DecidePlease home">
            <img src="/logo/Logo-icon.png" alt="" className="header-logo-icon" />
            <span className="header-brand" aria-hidden="true">DecidePlease</span>
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
          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

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
