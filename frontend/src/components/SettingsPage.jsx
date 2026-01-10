import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { api, setAuthTokenGetter } from '../api';
import UnifiedHeader from './UnifiedHeader';
import UnifiedFooter from './UnifiedFooter';
import './SettingsPage.css';

// Card brand icons (simple text for now, could be replaced with SVGs)
const CARD_BRANDS = {
  visa: '💳 Visa',
  mastercard: '💳 Mastercard',
  amex: '💳 Amex',
  discover: '💳 Discover',
  default: '💳',
};

// Stripe promise - initialized lazily
let stripePromise = null;
const getStripePromise = (publishableKey) => {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// Add Card Form component (inside Elements provider)
function AddCardForm({ onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage('');

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings?card_added=true`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message);
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-card-form">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && <div className="card-error">{errorMessage}</div>}
      <div className="card-form-actions">
        <button type="button" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!stripe || isProcessing}>
          {isProcessing ? 'Saving...' : 'Save Card'}
        </button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, getAccessToken, refreshUser, isLoading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Redirect unauthenticated users to home page
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Profile form state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Preferences state
  const [interfaceMode, setInterfaceMode] = useState(() => {
    return localStorage.getItem('decideplease_interface') || 'chamber';
  });

  // Credits and quotas info
  const [credits, setCredits] = useState(null);
  const [quotas, setQuotas] = useState(null);
  const [creditPackInfo, setCreditPackInfo] = useState(null);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [maxCards, setMaxCards] = useState(3);
  const [loadingCards, setLoadingCards] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState(null);
  const [deletingCardId, setDeletingCardId] = useState(null);

  useEffect(() => {
    setAuthTokenGetter(() => getAccessToken());
    loadUserInfo();
    loadCreditPackInfo();
    loadPaymentMethods();
  }, [getAccessToken]);

  const loadUserInfo = async () => {
    try {
      const info = await api.getUserInfo();
      setCredits(info.credits);
      if (info.quotas) {
        setQuotas(info.quotas);
      }
    } catch (err) {
      console.error('Failed to load user info:', err);
    }
  };

  const loadCreditPackInfo = async () => {
    try {
      const info = await api.getCreditPackInfo();
      setCreditPackInfo(info);
    } catch (err) {
      console.error('Failed to load credit pack info:', err);
    }
  };

  const loadPaymentMethods = async () => {
    setLoadingCards(true);
    try {
      const data = await api.getPaymentMethods();
      setPaymentMethods(data.methods || []);
      setMaxCards(data.max_cards || 3);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    }
    setLoadingCards(false);
  };

  const handleAddCard = async () => {
    setLoading(true);
    clearMessages();
    try {
      const data = await api.createSetupIntent();
      setSetupClientSecret(data.client_secret);
      setShowAddCard(true);
    } catch (err) {
      setError(err.message || 'Failed to start card setup');
    }
    setLoading(false);
  };

  const handleCardAdded = () => {
    setShowAddCard(false);
    setSetupClientSecret(null);
    setSuccess('Card added successfully');
    loadPaymentMethods();
  };

  const handleDeleteCard = async (paymentMethodId) => {
    if (!window.confirm('Are you sure you want to remove this card?')) return;

    setDeletingCardId(paymentMethodId);
    clearMessages();
    try {
      await api.deletePaymentMethod(paymentMethodId);
      setSuccess('Card removed successfully');
      loadPaymentMethods();
    } catch (err) {
      setError(err.message || 'Failed to remove card');
    }
    setDeletingCardId(null);
  };

  const handleSetDefault = async (paymentMethodId) => {
    clearMessages();
    try {
      await api.setDefaultPaymentMethod(paymentMethodId);
      setSuccess('Default card updated');
      loadPaymentMethods();
    } catch (err) {
      setError(err.message || 'Failed to set default card');
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!newEmail || !emailPassword) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await api.updateEmail(newEmail, emailPassword);
      setSuccess('Email updated successfully. Please check your new email for verification.');
      setNewEmail('');
      setEmailPassword('');
      refreshUser();
    } catch (err) {
      setError(err.message || 'Failed to update email');
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to change password');
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    clearMessages();

    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    if (!window.confirm('This action is PERMANENT and cannot be undone. All your data will be deleted. Are you absolutely sure?')) {
      return;
    }

    setLoading(true);
    try {
      await api.deleteAccount();
      logout();
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  // Don't render settings page for unauthenticated users
  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="settings-page">
      <UnifiedHeader
        isSignedIn={true}
        credits={credits}
        userEmail={user?.email}
        creditPackInfo={creditPackInfo}
        onCreditsUpdated={refreshUser}
        onSignOut={logout}
      />

      <main className="settings-main">
        <div className="settings-container">
          <div className="settings-header">
            <h1>Settings</h1>
            <p>Manage your account settings and preferences</p>
          </div>

          <div className="settings-layout">
            <nav className="settings-nav">
              <button
                className={activeSection === 'profile' ? 'active' : ''}
                onClick={() => { setActiveSection('profile'); clearMessages(); }}
              >
                Profile
              </button>
              <button
                className={activeSection === 'security' ? 'active' : ''}
                onClick={() => { setActiveSection('security'); clearMessages(); }}
              >
                Security
              </button>
              <button
                className={activeSection === 'account' ? 'active' : ''}
                onClick={() => { setActiveSection('account'); clearMessages(); }}
              >
                Account
              </button>
              <button
                className={activeSection === 'payment' ? 'active' : ''}
                onClick={() => { setActiveSection('payment'); clearMessages(); }}
              >
                Payment
              </button>
              <button
                className={activeSection === 'preferences' ? 'active' : ''}
                onClick={() => { setActiveSection('preferences'); clearMessages(); }}
              >
                Preferences
              </button>
            </nav>

            <div className="settings-content">
              {error && (
                <div className="settings-error">
                  {error}
                  <button onClick={() => setError(null)}>Dismiss</button>
                </div>
              )}

              {success && (
                <div className="settings-success">
                  {success}
                  <button onClick={() => setSuccess(null)}>Dismiss</button>
                </div>
              )}

              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div className="settings-section">
                  <h2>Profile</h2>

                  <div className="settings-card">
                    <h3>Current Email</h3>
                    <p className="current-value">{user?.email}</p>
                  </div>

                  <div className="settings-card">
                    <h3>Change Email</h3>
                    <p className="settings-description">
                      Update your email address. You'll need to verify your new email.
                    </p>
                    <form onSubmit={handleUpdateEmail}>
                      <div className="form-group">
                        <label>New Email Address</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="new@email.com"
                          disabled={loading}
                        />
                      </div>
                      <div className="form-group">
                        <label>Current Password</label>
                        <input
                          type="password"
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          placeholder="Enter your password to confirm"
                          disabled={loading}
                        />
                      </div>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Updating...' : 'Update Email'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Security Section */}
              {activeSection === 'security' && (
                <div className="settings-section">
                  <h2>Security</h2>

                  <div className="settings-card">
                    <h3>Change Password</h3>
                    <p className="settings-description">
                      Choose a strong password that you don't use elsewhere.
                    </p>
                    <form onSubmit={handleChangePassword}>
                      <div className="form-group">
                        <label>Current Password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          disabled={loading}
                        />
                      </div>
                      <div className="form-group">
                        <label>New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="At least 8 characters"
                          disabled={loading}
                        />
                      </div>
                      <div className="form-group">
                        <label>Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          disabled={loading}
                        />
                      </div>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Changing...' : 'Change Password'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Account Section */}
              {activeSection === 'account' && (
                <div className="settings-section">
                  <h2>Account</h2>

                  <div className="settings-card">
                    <h3>Account Information</h3>
                    <div className="account-info">
                      <div className="info-row">
                        <span className="info-label">Email</span>
                        <span className="info-value">{user?.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <h3>Decision Quotas</h3>
                    <p className="settings-description" style={{ marginBottom: '16px', opacity: 0.7 }}>
                      Your available decisions by type.
                    </p>
                    <div className="quota-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div className="quota-card" style={{ padding: '16px', background: 'var(--card-bg, #f8fafc)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--primary, #6366f1)' }}>
                          {quotas?.quick_decision?.remaining ?? '...'}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>Quick</div>
                        {quotas?.quick_decision?.admin_granted > 0 && (
                          <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                            +{quotas.quick_decision.admin_granted} granted
                          </div>
                        )}
                      </div>
                      <div className="quota-card" style={{ padding: '16px', background: 'var(--card-bg, #f8fafc)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--primary, #6366f1)' }}>
                          {quotas?.standard_decision?.remaining ?? '...'}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>Standard</div>
                        {quotas?.standard_decision?.admin_granted > 0 && (
                          <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                            +{quotas.standard_decision.admin_granted} granted
                          </div>
                        )}
                      </div>
                      <div className="quota-card" style={{ padding: '16px', background: 'var(--card-bg, #f8fafc)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--primary, #6366f1)' }}>
                          {quotas?.premium_decision?.remaining ?? '...'}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>Premium</div>
                        {quotas?.premium_decision?.admin_granted > 0 && (
                          <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px' }}>
                            +{quotas.premium_decision.admin_granted} granted
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="settings-card danger-zone">
                    <h3>Danger Zone</h3>
                    <p className="settings-description">
                      Once you delete your account, there is no going back. This will permanently delete your account and all associated data including conversations and payments history.
                    </p>
                    <div className="form-group">
                      <label>Type DELETE to confirm</label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        disabled={loading}
                      />
                    </div>
                    <button
                      onClick={handleDeleteAccount}
                      className="btn-danger"
                      disabled={loading || deleteConfirmText !== 'DELETE'}
                    >
                      {loading ? 'Deleting...' : 'Delete Account'}
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Section */}
              {activeSection === 'payment' && (
                <div className="settings-section">
                  <h2>Payment Methods</h2>

                  <div className="settings-card">
                    <h3>Saved Cards</h3>
                    <p className="settings-description">
                      Manage your saved payment methods. You can save up to {maxCards} cards.
                    </p>

                    {loadingCards ? (
                      <div className="loading-cards">Loading payment methods...</div>
                    ) : paymentMethods.length === 0 ? (
                      <div className="no-cards">
                        <p>No saved payment methods.</p>
                      </div>
                    ) : (
                      <div className="saved-cards-list">
                        {paymentMethods.map((card) => (
                          <div key={card.id} className={`saved-card ${card.is_default ? 'default' : ''}`}>
                            <div className="card-info">
                              <span className="card-brand">{CARD_BRANDS[card.brand] || CARD_BRANDS.default}</span>
                              <span className="card-number">•••• {card.last4}</span>
                              <span className="card-expiry">Exp: {card.exp_month}/{card.exp_year}</span>
                              {card.is_default && <span className="default-badge">Default</span>}
                            </div>
                            <div className="card-actions">
                              {!card.is_default && (
                                <button
                                  onClick={() => handleSetDefault(card.id)}
                                  className="btn-secondary btn-small"
                                  disabled={loading}
                                >
                                  Set Default
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCard(card.id)}
                                className="btn-danger btn-small"
                                disabled={deletingCardId === card.id}
                              >
                                {deletingCardId === card.id ? 'Removing...' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Card Button/Form */}
                    {!showAddCard ? (
                      <button
                        onClick={handleAddCard}
                        className="btn-primary add-card-btn"
                        disabled={loading || paymentMethods.length >= maxCards}
                      >
                        {loading ? 'Loading...' : paymentMethods.length >= maxCards ? `Maximum ${maxCards} cards reached` : 'Add New Card'}
                      </button>
                    ) : (
                      setupClientSecret && creditPackInfo?.publishable_key && (
                        <Elements
                          stripe={getStripePromise(creditPackInfo.publishable_key)}
                          options={{
                            clientSecret: setupClientSecret,
                            appearance: {
                              theme: 'stripe',
                              variables: {
                                colorPrimary: '#4a90e2',
                              },
                            },
                          }}
                        >
                          <AddCardForm
                            onSuccess={handleCardAdded}
                            onCancel={() => {
                              setShowAddCard(false);
                              setSetupClientSecret(null);
                            }}
                          />
                        </Elements>
                      )
                    )}
                  </div>

                  <div className="settings-card">
                    <h3>How it works</h3>
                    <p className="settings-description">
                      When you purchase credits, we'll try your default card first. If it fails, we'll automatically try your other saved cards before asking you to add a new payment method.
                    </p>
                  </div>
                </div>
              )}

              {/* Preferences Section */}
              {activeSection === 'preferences' && (
                <div className="settings-section">
                  <h2>Preferences</h2>

                  <div className="settings-card">
                    <h3>Interface Style</h3>
                    <p className="settings-description">
                      Choose how your deliberation sessions are displayed.
                    </p>

                    <div className="interface-toggle">
                      <button
                        className={`interface-option ${interfaceMode === 'chamber' ? 'active' : ''}`}
                        onClick={() => {
                          setInterfaceMode('chamber');
                          localStorage.setItem('decideplease_interface', 'chamber');
                          setSuccess('Interface changed to Council Chamber');
                        }}
                      >
                        <div className="option-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="8" r="3" />
                            <circle cx="5" cy="14" r="2" />
                            <circle cx="19" cy="14" r="2" />
                            <circle cx="7" cy="20" r="2" />
                            <circle cx="17" cy="20" r="2" />
                          </svg>
                        </div>
                        <div className="option-content">
                          <span className="option-title">Council Chamber</span>
                          <span className="option-desc">Theatrical experience with AI models in an arc formation and legal briefing-style verdicts</span>
                        </div>
                        {interfaceMode === 'chamber' && <span className="active-badge">Active</span>}
                      </button>

                      <button
                        className={`interface-option ${interfaceMode === 'classic' ? 'active' : ''}`}
                        onClick={() => {
                          setInterfaceMode('classic');
                          localStorage.setItem('decideplease_interface', 'classic');
                          setSuccess('Interface changed to Classic Chat');
                        }}
                      >
                        <div className="option-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                          </svg>
                        </div>
                        <div className="option-content">
                          <span className="option-title">Classic Chat</span>
                          <span className="option-desc">Traditional chat interface with expandable stages and tabbed model responses</span>
                        </div>
                        {interfaceMode === 'classic' && <span className="active-badge">Active</span>}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <UnifiedFooter />
    </div>
  );
}
