import { useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { api } from '../api';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  credits,
  userEmail,
  creditPackInfo,
  onCreditsUpdated,
  isAdmin,
  onOpenAdmin,
}) {
  const { signOut } = useClerk();
  const [isBuyingCredits, setIsBuyingCredits] = useState(false);

  const handleBuyCredits = async () => {
    setIsBuyingCredits(true);
    try {
      const { checkout_url } = await api.createCheckoutSession();
      // Redirect to Stripe checkout
      window.location.href = checkout_url;
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to start checkout. Please try again.');
      setIsBuyingCredits(false);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>DecidePlease</h1>
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + New Conversation
        </button>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="no-conversations">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                conv.id === currentConversationId ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-title">
                {conv.title || 'New Conversation'}
              </div>
              <div className="conversation-meta">
                {conv.message_count} messages
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="credits-section">
          <div className="credits-display">
            <span className="credits-label">Credits:</span>
            <span className="credits-value">{credits ?? '...'}</span>
          </div>
          {creditPackInfo?.stripe_configured && (
            <button
              className="buy-credits-btn"
              onClick={handleBuyCredits}
              disabled={isBuyingCredits}
            >
              {isBuyingCredits ? 'Loading...' : `Buy ${creditPackInfo.credits} for ${creditPackInfo.price_display}`}
            </button>
          )}
        </div>
        {userEmail && (
          <div className="user-info">
            <span className="user-email">{userEmail}</span>
            <button className="sign-out-btn" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        )}
        {isAdmin && (
          <button className="admin-btn" onClick={onOpenAdmin}>
            Admin Panel
          </button>
        )}
      </div>
    </div>
  );
}
