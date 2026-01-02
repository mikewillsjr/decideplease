import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import CouncilDebate from './CouncilDebate';
import SpeedSelector, { SPEED_OPTIONS } from './SpeedSelector';
import RerunModal from './RerunModal';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  onRerunDecision,
  isLoading,
  error,
  onDismissError,
  loadError,
  onDeleteConversation,
  onRetryLoad,
}) {
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState('standard');
  const [showRerunModal, setShowRerunModal] = useState(false);
  const [rerunMessageIndex, setRerunMessageIndex] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input, selectedMode);
      setInput('');
    }
  };

  const handleRerunClick = (msgIndex) => {
    setRerunMessageIndex(msgIndex);
    setShowRerunModal(true);
  };

  const handleRerunSubmit = (newInput, mode) => {
    setShowRerunModal(false);
    if (onRerunDecision) {
      onRerunDecision(newInput, mode);
    }
  };

  const getSelectedCredits = () => {
    const option = SPEED_OPTIONS.find(o => o.mode === selectedMode);
    return option ? option.credits : 2;
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="messages-container">
          <div className="empty-state">
            <h2>What decision are you making?</h2>
            <p>Ask the question where being wrong is expensive.</p>
          </div>
        </div>

        <form className="input-form" onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <textarea
              className="message-input"
              placeholder="e.g. Should I incorporate in Delaware or Wyoming for a bootstrapped SaaS?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={2}
            />
            <div className="input-footer">
              <SpeedSelector
                selectedMode={selectedMode}
                onModeChange={setSelectedMode}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="send-button"
                disabled={!input.trim() || isLoading}
              >
                Run Decision ({getSelectedCredits()} cr)
              </button>
            </div>
          </div>
          <div className="micro-strip">
            <span>Verdict</span>
            <span className="ms-item"><span className="ms-dot"></span>Risks</span>
            <span className="ms-item"><span className="ms-dot"></span>Tradeoffs</span>
            <span className="ms-item"><span className="ms-dot"></span>Flip Conditions</span>
            <span className="ms-item"><span className="ms-dot"></span>Action Plan</span>
          </div>
        </form>
      </div>
    );
  }

  // Show error state for failed conversation loads
  if (loadError) {
    return (
      <div className="chat-interface">
        <div className="load-error-state">
          <div className="error-icon">!</div>
          <h2>Failed to load decision</h2>
          <p>There was a problem loading this decision. You can try again or delete it.</p>
          <div className="error-actions">
            <button className="retry-btn" onClick={onRetryLoad}>
              Try Again
            </button>
            <button className="delete-btn" onClick={onDeleteConversation}>
              Delete Decision
            </button>
          </div>
        </div>
      </div>
    );
  }

  const messages = conversation.messages || [];

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h2>What decision are you making?</h2>
            <p>Ask the question where being wrong is expensive.</p>

            <div className="suggestion-grid">
              <button
                className="suggestion-card"
                onClick={() => handleSuggestionClick("Should I use React Native or Flutter for a fintech app?")}
              >
                <span className="sug-icon">🧠</span>
                <div className="sug-text">
                  <strong>Technical Stack</strong>
                  React Native vs Flutter for fintech?
                </div>
              </button>
              <button
                className="suggestion-card"
                onClick={() => handleSuggestionClick("Analyze this contract clause for gaps and risks.")}
              >
                <span className="sug-icon">⚖️</span>
                <div className="sug-text">
                  <strong>Legal / Risk</strong>
                  Analyze this liability clause for gaps.
                </div>
              </button>
              <button
                className="suggestion-card"
                onClick={() => handleSuggestionClick("Should I hire a VP of Sales or 2 Account Executives first?")}
              >
                <span className="sug-icon">💼</span>
                <div className="sug-text">
                  <strong>Hiring Strategy</strong>
                  Hire a VP of Sales or 2 AEs first?
                </div>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">You</div>
                  <div className="message-content">
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">DecidePlease</div>

                  {/* Welcome back / still processing indicator */}
                  {msg.processingResumed && (msg.loading?.stage1 || msg.loading?.stage2 || msg.loading?.stage3) && (
                    <div className="resumed-processing">
                      <div className="resumed-icon">&#8634;</div>
                      <span>Welcome back! We're still working on your answer...</span>
                    </div>
                  )}

                  {/* Incomplete response indicator (only shown when NOT loading) */}
                  {!msg.loading && !msg.processingResumed && msg.stage1 && !msg.stage3 && (
                    <div className="incomplete-response">
                      <div className="incomplete-icon">!</div>
                      <span>This response was interrupted. Showing completed stages.</span>
                    </div>
                  )}

                  {/* Council Debate Visualization (shown during loading) */}
                  {(msg.loading?.stage1 || msg.loading?.stage2 || msg.loading?.stage3) && (
                    <CouncilDebate
                      loading={msg.loading}
                      stage1Data={msg.stage1}
                      stage2Data={msg.stage2}
                      stage3Data={msg.stage3}
                    />
                  )}

                  {/* Stage 1 - Individual Responses */}
                  {msg.stage1 && !msg.loading?.stage1 && <Stage1 responses={msg.stage1} />}

                  {/* Stage 2 - Peer Rankings */}
                  {msg.stage2Skipped && (
                    <div className="stage-skipped">
                      <span className="skipped-icon">&#x21BB;</span>
                      <span>Peer review skipped for Quick Answer mode</span>
                    </div>
                  )}
                  {msg.stage2 && msg.stage2.length > 0 && !msg.loading?.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                    />
                  )}

                  {/* Stage 3 - Final Synthesis */}
                  {msg.stage3 && !msg.loading?.stage3 && <Stage3 finalResponse={msg.stage3} />}

                  {/* Re-run button (shown after Stage 3 completes) */}
                  {msg.stage3 && !isLoading && (
                    <div className="rerun-section">
                      <button
                        className="rerun-button"
                        onClick={() => handleRerunClick(index)}
                      >
                        Re-run this decision
                      </button>
                      {msg.metadata?.mode && (
                        <span className="run-mode-badge">
                          {msg.metadata.mode === 'quick' ? 'Quick' :
                           msg.metadata.mode === 'extra_care' ? 'Extra Care' : 'Standard'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={onDismissError} className="dismiss-error">×</button>
        </div>
      )}

      <form className="input-form" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <textarea
            className="message-input"
            placeholder="Refine this decision or ask a follow-up..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={2}
          />
          <div className="input-footer">
            <SpeedSelector
              selectedMode={selectedMode}
              onModeChange={setSelectedMode}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim() || isLoading}
            >
              Run Decision ({getSelectedCredits()} cr)
            </button>
          </div>
        </div>
      </form>

      {/* Rerun Modal */}
      {showRerunModal && (
        <RerunModal
          isOpen={showRerunModal}
          onClose={() => setShowRerunModal(false)}
          onSubmit={handleRerunSubmit}
        />
      )}
    </div>
  );
}
