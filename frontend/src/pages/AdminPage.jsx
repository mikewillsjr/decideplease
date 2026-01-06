import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UnifiedHeader from '../components/UnifiedHeader';
import UnifiedFooter from '../components/UnifiedFooter';
import { api, setAuthTokenGetter } from '../api';
import './AdminPage.css';

function AdminPage() {
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, user, logout, getAccessToken, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [queries, setQueries] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [decisionSearch, setDecisionSearch] = useState('');
  const [auditLog, setAuditLog] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAdjustment, setCreditAdjustment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Admin access state
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [permissions, setPermissions] = useState([]);
  const [credits, setCredits] = useState(null);
  const [creditPackInfo, setCreditPackInfo] = useState(null);

  // Quick action states
  const [quickEmail, setQuickEmail] = useState('');
  const [quickCredits, setQuickCredits] = useState('');
  const [quickActionLoading, setQuickActionLoading] = useState(false);

  // Staff management states
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('employee');

  // Set up auth token getter for API calls
  useEffect(() => {
    if (isAuthenticated) {
      setAuthTokenGetter(() => getAccessToken());
    }
  }, [isAuthenticated, getAccessToken]);

  // Redirect if not authenticated or not staff
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Check admin access and load initial data
  useEffect(() => {
    if (isAuthenticated) {
      checkAdminAccess();
      loadUserInfo();
      loadCreditPackInfo();
    }
  }, [isAuthenticated]);

  const checkAdminAccess = async () => {
    try {
      const result = await api.checkAdminAccess();
      setIsAdmin(result.is_admin || result.is_staff);
      setUserRole(result.role || 'user');
      setPermissions(result.permissions || []);

      if (!result.is_staff && !result.is_admin) {
        // Not authorized, redirect to council
        navigate('/council');
        return;
      }

      // Load dashboard data after confirming access
      loadDashboard();
    } catch (error) {
      console.error('Failed to check admin access:', error);
      navigate('/council');
    }
  };

  const loadUserInfo = async () => {
    try {
      const userInfo = await api.getUserInfo();
      setCredits(userInfo.credits);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const loadCreditPackInfo = async () => {
    try {
      const info = await api.getCreditPackInfo();
      setCreditPackInfo(info);
    } catch (error) {
      console.error('Failed to load credit pack info:', error);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const statsData = await api.getAdminStats();
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersData = await api.getAdminUsers(50, 0, searchTerm);
      setUsers(usersData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const paymentsData = await api.getAdminPayments();
      setPayments(paymentsData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadQueries = async () => {
    setLoading(true);
    try {
      const queriesData = await api.getAdminQueries();
      setQueries(queriesData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadDecisions = async (search = '') => {
    setLoading(true);
    try {
      const decisionsData = await api.getAdminDecisions(50, 0, search);
      setDecisions(decisionsData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadDecisionDetail = async (messageId) => {
    try {
      const detail = await api.getAdminDecisionDetail(messageId);
      setSelectedDecision(detail);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const logsData = await api.getAuditLog();
      setAuditLog(logsData.audit_log || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const loadStaffUsers = async () => {
    setLoading(true);
    try {
      const staffData = await api.getStaffUsers();
      setStaffUsers(staffData.staff || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedUser(null);
    setSelectedDecision(null);
    setSuccessMessage(null);
    setError(null);
    if (tab === 'dashboard') loadDashboard();
    else if (tab === 'users') loadUsers();
    else if (tab === 'payments') loadPayments();
    else if (tab === 'queries') loadQueries();
    else if (tab === 'decisions') loadDecisions(decisionSearch);
    else if (tab === 'audit') loadAuditLog();
    else if (tab === 'staff') loadStaffUsers();
  };

  // Permission check helper
  const hasPermission = (perm) => permissions.includes(perm);

  // Quick Actions
  const handleSetCredits = async () => {
    if (!quickEmail || quickCredits === '') return;
    setQuickActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.setUserCreditsByEmail(quickEmail, parseInt(quickCredits));
      setSuccessMessage(`Set ${result.email} credits: ${result.previous_credits} → ${result.new_credits}`);
      setQuickEmail('');
      setQuickCredits('');
      if (activeTab === 'users') loadUsers();
    } catch (err) {
      setError(err.message);
    }
    setQuickActionLoading(false);
  };

  const handleSendPasswordReset = async () => {
    if (!quickEmail) return;
    setQuickActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.adminSendPasswordReset(quickEmail);
      setSuccessMessage(`Password reset email sent to ${quickEmail}`);
    } catch (err) {
      setError(err.message);
    }
    setQuickActionLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!quickEmail) return;
    if (!window.confirm(`PERMANENTLY DELETE user ${quickEmail} and ALL their data? This cannot be undone!`)) {
      return;
    }
    setQuickActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.deleteUserByEmail(quickEmail);
      setSuccessMessage(`Deleted ${quickEmail}: ${result.deleted.conversations} conversations, ${result.deleted.messages} messages`);
      setQuickEmail('');
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'dashboard') loadDashboard();
    } catch (err) {
      setError(err.message);
    }
    setQuickActionLoading(false);
  };

  const handleUserSearch = (e) => {
    e.preventDefault();
    loadUsers();
  };

  const handleUserClick = async (userId) => {
    try {
      const userData = await api.getAdminUserDetail(userId);
      setSelectedUser(userData);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreditAdjustment = async () => {
    if (!selectedUser || !creditAdjustment) return;
    try {
      const result = await api.adjustUserCredits(selectedUser.user.id, parseInt(creditAdjustment));
      setSelectedUser({
        ...selectedUser,
        user: { ...selectedUser.user, credits: result.new_credits }
      });
      setCreditAdjustment('');
      loadUsers(); // Refresh user list
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImpersonate = async (userId) => {
    if (!window.confirm('Start impersonation session? You will act as this user until you exit.')) {
      return;
    }
    try {
      const result = await api.impersonateUser(userId);
      // Store the impersonation token
      localStorage.setItem('decideplease_impersonation_token', result.access_token);
      localStorage.setItem('decideplease_original_token', localStorage.getItem('decideplease_access_token'));
      localStorage.setItem('decideplease_access_token', result.access_token);
      localStorage.setItem('decideplease_impersonating', JSON.stringify({
        email: result.user.email,
        id: result.user.id,
        impersonated_by: result.impersonated_by
      }));
      // Redirect to council as the impersonated user
      window.location.href = '/council';
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaffEmail || !newStaffPassword || !newStaffRole) return;

    setQuickActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await api.createStaffUser(newStaffEmail, newStaffPassword, newStaffRole);
      setSuccessMessage(`Created ${newStaffRole}: ${result.user.email}`);
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffRole('employee');
      loadStaffUsers();
    } catch (err) {
      setError(err.message);
    }
    setQuickActionLoading(false);
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      setSuccessMessage(`Role updated to ${newRole}`);
      loadStaffUsers();
      if (activeTab === 'users') loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Show nothing while auth is loading
  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="admin-page">
      <UnifiedHeader
        isSignedIn={true}
        credits={credits}
        userEmail={user?.email}
        creditPackInfo={creditPackInfo}
        onCreditsUpdated={loadUserInfo}
        isAdmin={isAdmin}
        userRole={userRole}
        onOpenAdmin={() => {}} // Already on admin page
        onSignOut={logout}
      />

      <div className="admin-page-content">
        <div className="admin-page-header">
          <h1>Admin Dashboard</h1>
          <div className="admin-role-badge">
            Role: <span className={`role-${userRole}`}>{userRole}</span>
          </div>
        </div>

        <div className="admin-tabs">
          <button
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => handleTabChange('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => handleTabChange('users')}
          >
            Users
          </button>
          {hasPermission('view_payments') && (
            <button
              className={activeTab === 'payments' ? 'active' : ''}
              onClick={() => handleTabChange('payments')}
            >
              Payments
            </button>
          )}
          <button
            className={activeTab === 'queries' ? 'active' : ''}
            onClick={() => handleTabChange('queries')}
          >
            Queries
          </button>
          <button
            className={activeTab === 'decisions' ? 'active' : ''}
            onClick={() => handleTabChange('decisions')}
          >
            Decisions
          </button>
          {hasPermission('view_audit_log') && (
            <button
              className={activeTab === 'audit' ? 'active' : ''}
              onClick={() => handleTabChange('audit')}
            >
              Audit Log
            </button>
          )}
          {hasPermission('manage_employees') && (
            <button
              className={activeTab === 'staff' ? 'active' : ''}
              onClick={() => handleTabChange('staff')}
            >
              Staff
            </button>
          )}
        </div>

        {error && (
          <div className="admin-error">
            {error}
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {successMessage && (
          <div className="admin-success">
            {successMessage}
            <button onClick={() => setSuccessMessage(null)}>Dismiss</button>
          </div>
        )}

        {/* Quick Actions - Only for admins with modify permissions */}
        {hasPermission('modify_credits') && (
          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="quick-actions-form">
              <input
                type="email"
                placeholder="User email"
                value={quickEmail}
                onChange={(e) => setQuickEmail(e.target.value)}
                disabled={quickActionLoading}
              />
              <input
                type="number"
                placeholder="Credits (set to)"
                value={quickCredits}
                onChange={(e) => setQuickCredits(e.target.value)}
                disabled={quickActionLoading}
                style={{ width: '120px' }}
              />
              <button
                onClick={handleSetCredits}
                disabled={quickActionLoading || !quickEmail || quickCredits === ''}
                className="btn-credits"
              >
                Set Credits
              </button>
              {hasPermission('send_password_reset') && (
                <button
                  onClick={handleSendPasswordReset}
                  disabled={quickActionLoading || !quickEmail}
                  className="btn-reset"
                >
                  Send Reset
                </button>
              )}
              {hasPermission('delete_users') && (
                <button
                  onClick={handleDeleteUser}
                  disabled={quickActionLoading || !quickEmail}
                  className="btn-delete"
                >
                  Delete User
                </button>
              )}
            </div>
            <div className="quick-actions-hint">
              Enter email to: set credits (999999 = unlimited), send password reset, or delete account
            </div>
          </div>
        )}

        <div className="admin-content">
          {loading && <div className="admin-loading">Loading...</div>}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && stats && !loading && (
            <div className="dashboard-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total_users}</div>
                <div className="stat-label">Total Users</div>
                <div className="stat-today">+{stats.users_today} today</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.total_queries}</div>
                <div className="stat-label">Total Queries</div>
                <div className="stat-today">+{stats.queries_today} today</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.total_conversations}</div>
                <div className="stat-label">Conversations</div>
              </div>
              {hasPermission('view_payments') && (
                <div className="stat-card revenue">
                  <div className="stat-value">{formatCurrency(stats.total_revenue_cents)}</div>
                  <div className="stat-label">Total Revenue</div>
                  <div className="stat-today">+{formatCurrency(stats.revenue_today_cents)} today</div>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && !loading && (
            <div className="users-section">
              <form className="search-form" onSubmit={handleUserSearch}>
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button type="submit">Search</button>
              </form>

              <div className="users-layout">
                <div className="users-list">
                  <table>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Credits</th>
                        <th>Queries</th>
                        <th>Joined</th>
                        {hasPermission('impersonate') && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          onClick={() => handleUserClick(u.id)}
                          className={selectedUser?.user?.id === u.id ? 'selected' : ''}
                        >
                          <td>{u.email}</td>
                          <td>{u.credits}</td>
                          <td>{u.query_count}</td>
                          <td>{formatDate(u.created_at)}</td>
                          {hasPermission('impersonate') && (
                            <td>
                              <button
                                className="btn-impersonate"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImpersonate(u.id);
                                }}
                              >
                                Impersonate
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedUser && (
                  <div className="user-detail">
                    <h3>User Details</h3>
                    <div className="user-info">
                      <p><strong>Email:</strong> {selectedUser.user.email}</p>
                      <p><strong>ID:</strong> <code>{selectedUser.user.id}</code></p>
                      <p><strong>Credits:</strong> {selectedUser.user.credits}</p>
                      <p><strong>Joined:</strong> {formatDate(selectedUser.user.created_at)}</p>
                    </div>

                    {hasPermission('modify_credits') && (
                      <div className="credit-adjustment">
                        <h4>Adjust Credits</h4>
                        <div className="adjustment-form">
                          <input
                            type="number"
                            placeholder="+10 or -5"
                            value={creditAdjustment}
                            onChange={(e) => setCreditAdjustment(e.target.value)}
                          />
                          <button onClick={handleCreditAdjustment}>Apply</button>
                        </div>
                      </div>
                    )}

                    {selectedUser.conversations.length > 0 && (
                      <div className="user-conversations">
                        <h4>Recent Conversations ({selectedUser.conversations.length})</h4>
                        <ul>
                          {selectedUser.conversations.slice(0, 5).map((conv) => (
                            <li key={conv.id}>
                              {conv.title} ({conv.message_count} msgs)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedUser.payments.length > 0 && (
                      <div className="user-payments">
                        <h4>Payment History</h4>
                        <ul>
                          {selectedUser.payments.map((payment) => (
                            <li key={payment.id}>
                              {formatCurrency(payment.amount_cents)} - {payment.credits} credits
                              <span className="payment-date">{formatDate(payment.created_at)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && !loading && (
            <div className="payments-section">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Credits</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-state">No payments yet</td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.created_at)}</td>
                        <td>{payment.user_email}</td>
                        <td>{formatCurrency(payment.amount_cents)}</td>
                        <td>{payment.credits}</td>
                        <td>
                          <span className={`status-badge ${payment.status}`}>
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Queries Tab */}
          {activeTab === 'queries' && !loading && (
            <div className="queries-section">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Query</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((query) => (
                    <tr key={query.id}>
                      <td>{formatDate(query.created_at)}</td>
                      <td>{query.user_email}</td>
                      <td className="query-preview">{query.query_preview}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Decisions Tab */}
          {activeTab === 'decisions' && !loading && (
            <div className="decisions-section">
              <form className="search-form" onSubmit={(e) => { e.preventDefault(); loadDecisions(decisionSearch); }}>
                <input
                  type="text"
                  placeholder="Search questions, responses, or emails..."
                  value={decisionSearch}
                  onChange={(e) => setDecisionSearch(e.target.value)}
                />
                <button type="submit">Search</button>
                {decisionSearch && (
                  <button type="button" onClick={() => { setDecisionSearch(''); loadDecisions(''); }}>
                    Clear
                  </button>
                )}
              </form>

              <div className="decisions-layout">
                <div className="decisions-list">
                  {decisions.length === 0 ? (
                    <div className="empty-state">No decisions found</div>
                  ) : (
                    decisions.map((decision) => (
                      <div
                        key={decision.id}
                        className={`decision-card ${selectedDecision?.question?.id === decision.id ? 'selected' : ''}`}
                        onClick={() => loadDecisionDetail(decision.id)}
                      >
                        <div className="decision-header">
                          <span className="decision-user">{decision.user_email}</span>
                          <span className={`decision-mode mode-${decision.mode}`}>{decision.mode}</span>
                          <span className="decision-date">{formatDate(decision.asked_at)}</span>
                        </div>
                        <div className="decision-question">
                          {decision.question.length > 150
                            ? decision.question.slice(0, 150) + '...'
                            : decision.question}
                        </div>
                        {decision.chairman_response && (
                          <div className="decision-response-preview">
                            {decision.chairman_response.length > 200
                              ? decision.chairman_response.slice(0, 200) + '...'
                              : decision.chairman_response}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {selectedDecision && (
                  <div className="decision-detail">
                    <div className="detail-header">
                      <h3>Decision Detail</h3>
                      <button onClick={() => setSelectedDecision(null)} className="close-detail">×</button>
                    </div>
                    <div className="detail-meta">
                      <span><strong>User:</strong> {selectedDecision.question?.user_email}</span>
                      <span><strong>Mode:</strong> {selectedDecision.response?.mode || 'standard'}</span>
                      <span><strong>Asked:</strong> {formatDate(selectedDecision.question?.created_at)}</span>
                    </div>
                    <div className="detail-section">
                      <h4>Question</h4>
                      <div className="detail-content question-content">
                        {selectedDecision.question?.content}
                      </div>
                    </div>
                    {selectedDecision.response?.chairman_response && (
                      <div className="detail-section">
                        <h4>Chairman Response</h4>
                        <div className="detail-content response-content">
                          {selectedDecision.response.chairman_response}
                        </div>
                      </div>
                    )}
                    {selectedDecision.response?.stage1 && (
                      <details className="stage-details">
                        <summary>Stage 1: Individual Responses ({selectedDecision.response.stage1.length})</summary>
                        <div className="stage-content">
                          {selectedDecision.response.stage1.map((resp, i) => (
                            <div key={i} className="stage-item">
                              <strong>{resp.model}</strong>
                              <pre>{resp.response?.slice(0, 500)}{resp.response?.length > 500 ? '...' : ''}</pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {selectedDecision.response?.stage1_5 && (
                      <details className="stage-details">
                        <summary>Stage 1.5: Refined Responses ({selectedDecision.response.stage1_5.length})</summary>
                        <div className="stage-content">
                          {selectedDecision.response.stage1_5.map((resp, i) => (
                            <div key={i} className="stage-item">
                              <strong>{resp.model}</strong>
                              <pre>{resp.response?.slice(0, 500)}{resp.response?.length > 500 ? '...' : ''}</pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {selectedDecision.response?.stage2 && (
                      <details className="stage-details">
                        <summary>Stage 2: Peer Rankings ({selectedDecision.response.stage2.length})</summary>
                        <div className="stage-content">
                          {selectedDecision.response.stage2.map((rank, i) => (
                            <div key={i} className="stage-item">
                              <strong>{rank.model}</strong>
                              <pre>{rank.ranking?.slice(0, 500)}{rank.ranking?.length > 500 ? '...' : ''}</pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && !loading && (
            <div className="audit-section">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-state">No audit log entries</td>
                    </tr>
                  ) : (
                    auditLog.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.created_at)}</td>
                        <td>{log.admin_email || log.admin_id}</td>
                        <td>
                          <span className={`action-badge action-${log.action}`}>
                            {log.action}
                          </span>
                        </td>
                        <td>{log.details?.target_email || log.target_user_id || '-'}</td>
                        <td className="details-cell">
                          {log.details ? JSON.stringify(log.details) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Staff Management Tab */}
          {activeTab === 'staff' && !loading && (
            <div className="staff-section">
              <div className="staff-create">
                <h3>Create Staff Member</h3>
                <form onSubmit={handleCreateStaff} className="staff-form">
                  <input
                    type="email"
                    placeholder="Email"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    required
                  />
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                  >
                    <option value="employee">Employee</option>
                    {hasPermission('manage_admins') && (
                      <option value="admin">Admin</option>
                    )}
                  </select>
                  <button type="submit" disabled={quickActionLoading}>
                    Create Staff
                  </button>
                </form>
              </div>

              <div className="staff-list">
                <h3>Current Staff</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers.map((staff) => (
                      <tr key={staff.id}>
                        <td>{staff.email}</td>
                        <td>
                          <span className={`role-badge role-${staff.role}`}>
                            {staff.role}
                          </span>
                        </td>
                        <td>{formatDate(staff.created_at)}</td>
                        <td>
                          {staff.role !== 'superadmin' && (
                            <select
                              value={staff.role}
                              onChange={(e) => handleChangeRole(staff.id, e.target.value)}
                              className="role-select"
                            >
                              <option value="user">User</option>
                              <option value="employee">Employee</option>
                              {hasPermission('manage_admins') && (
                                <option value="admin">Admin</option>
                              )}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <UnifiedFooter />
    </div>
  );
}

export default AdminPage;
