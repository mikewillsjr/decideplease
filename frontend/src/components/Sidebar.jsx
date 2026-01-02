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
    if (window.confirm('Are you sure you want to delete this conversation?')) {
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
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + New Conversation
        </button>
      </div>

      <div className="conversation-list">
        {!conversations || conversations.length === 0 ? (
          <div className="no-conversations">No conversations yet</div>
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
                  {conv.title || 'New Conversation'}
                </div>
                <div className="conversation-meta">
                  {conv.message_count} messages
                </div>
              </div>
              <button
                className="delete-btn"
                onClick={(e) => handleDelete(e, conv.id)}
                disabled={deletingId === conv.id}
                title="Delete conversation"
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
