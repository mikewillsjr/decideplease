import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, setAuthTokenGetter } from '../api';
import UnifiedHeader from './UnifiedHeader';
import UnifiedFooter from './UnifiedFooter';
import './SettingsPage.css';

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

  // Credits info
  const [credits, setCredits] = useState(null);
  const [creditPackInfo, setCreditPackInfo] = useState(null);

  useEffect(() => {
    setAuthTokenGetter(() => getAccessToken());
    loadUserInfo();
    loadCreditPackInfo();
  }, [getAccessToken]);

  const loadUserInfo = async () => {
    try {
      const info = await api.getUserInfo();
      setCredits(info.credits);
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
                      <div className="info-row">
                        <span className="info-label">Credits</span>
                        <span className="info-value">{credits ?? '...'}</span>
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
            </div>
          </div>
        </div>
      </main>

      <UnifiedFooter />
    </div>
  );
}
