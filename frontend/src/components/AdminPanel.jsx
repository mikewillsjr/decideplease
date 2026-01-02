import { useState, useEffect } from 'react';
import { api } from '../api';
import './AdminPanel.css';

function AdminPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [queries, setQueries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAdjustment, setCreditAdjustment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedUser(null);
    if (tab === 'dashboard') loadDashboard();
    else if (tab === 'users') loadUsers();
    else if (tab === 'payments') loadPayments();
    else if (tab === 'queries') loadQueries();
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

  return (
    <div className="admin-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <button className="close-btn" onClick={onClose}>X</button>
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
          <button
            className={activeTab === 'payments' ? 'active' : ''}
            onClick={() => handleTabChange('payments')}
          >
            Payments
          </button>
          <button
            className={activeTab === 'queries' ? 'active' : ''}
            onClick={() => handleTabChange('queries')}
          >
            Queries
          </button>
        </div>

        {error && (
          <div className="admin-error">
            {error}
            <button onClick={() => setError(null)}>Dismiss</button>
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
              <div className="stat-card revenue">
                <div className="stat-value">{formatCurrency(stats.total_revenue_cents)}</div>
                <div className="stat-label">Total Revenue</div>
                <div className="stat-today">+{formatCurrency(stats.revenue_today_cents)} today</div>
              </div>
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
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          onClick={() => handleUserClick(user.id)}
                          className={selectedUser?.user?.id === user.id ? 'selected' : ''}
                        >
                          <td>{user.email}</td>
                          <td>{user.credits}</td>
                          <td>{user.query_count}</td>
                          <td>{formatDate(user.created_at)}</td>
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
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
