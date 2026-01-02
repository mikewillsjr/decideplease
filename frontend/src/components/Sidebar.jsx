import { useState } from 'react';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, convId) => {
    e.stopPropagation(); // Prevent selecting the conversation
    if (window.confirm('Are you sure you want to delete this decision?')) {
      setDeletingId(convId);
      try {
        await onDeleteConversation(convId);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <a href="/" className="sidebar-logo">
          <span className="logo-mark">&#x2B21;</span>
          <span>DecidePlease</span>
        </a>
      </div>

      <button className="new-conversation-btn" onClick={onNewConversation}>
        <span>+</span> New Decision
      </button>

      <div className="history-label">Decision Log</div>

      <div className="conversation-list">
        {!conversations || conversations.length === 0 ? (
          <div className="no-conversations">No decisions yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                conv.id === currentConversationId ? 'active' : ''
              } ${deletingId === conv.id ? 'deleting' : ''}`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-content">
                <div className="conversation-title">
                  {conv.title || 'New Decision'}
                </div>
                <div className="conversation-meta">
                  {conv.message_count} {conv.message_count === 1 ? 'query' : 'queries'}
                </div>
              </div>
              <button
                className="delete-btn"
                onClick={(e) => handleDelete(e, conv.id)}
                disabled={deletingId === conv.id}
                title="Delete decision"
              >
                {deletingId === conv.id ? '...' : '×'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
