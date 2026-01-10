import { useState, useRef, useEffect } from 'react';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
}) {
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

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

  const handleDoubleClick = (e, conv) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.title || 'New Decision');
  };

  const handleRenameSubmit = async (convId) => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && onRenameConversation) {
      await onRenameConversation(convId, trimmedValue);
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e, convId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit(convId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleRenameCancel();
    }
  };

  const handleBlur = (convId) => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (editingId === convId) {
        handleRenameSubmit(convId);
      }
    }, 100);
  };

  return (
    <div className="sidebar">
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
              onClick={() => !editingId && onSelectConversation(conv.id)}
            >
              <div className="conversation-content">
                {editingId === conv.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    className="conversation-rename-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, conv.id)}
                    onBlur={() => handleBlur(conv.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="conversation-title"
                    onDoubleClick={(e) => handleDoubleClick(e, conv)}
                    title="Double-click to rename"
                  >
                    {conv.title || 'New Decision'}
                  </div>
                )}
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
