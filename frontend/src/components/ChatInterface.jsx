import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import Stage1 from './Stage1';
import Stage1_5 from './Stage1_5';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import CouncilDebate from './CouncilDebate';
import SpeedSelector, { SPEED_OPTIONS } from './SpeedSelector';
import FileUpload from './FileUpload';
import DecisionCard from './DecisionCard';
import CollapsibleStage from './CollapsibleStage';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  error,
  onDismissError,
  loadError,
  onDeleteConversation,
  onRetryLoad,
  respondingToMessageId,
  onRespondToMessage,
  onClearRespondingTo,
}) {
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState('standard');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Detect when user manually scrolls away from bottom
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setUserHasScrolled(!isNearBottom);
  };

  // Only auto-scroll for new messages, and only if user hasn't scrolled up
  useEffect(() => {
    const newCount = conversation?.messages?.length || 0;
    if (newCount > messageCount) {
      setMessageCount(newCount);
      setUserHasScrolled(false); // Reset on new message
    }
    if (!userHasScrolled) {
      scrollToBottom();
    }
  }, [conversation, userHasScrolled, messageCount]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input, selectedMode, attachedFiles);
      setInput('');
      setAttachedFiles([]); // Clear files after send
    }
  };

  const getSelectedCredits = () => {
    const option = SPEED_OPTIONS.find(o => o.mode === selectedMode);
    const baseCredits = option ? option.credits : 2;
    // Add +1 credit for file uploads
    return attachedFiles.length > 0 ? baseCredits + 1 : baseCredits;
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
          <FileUpload
            files={attachedFiles}
            onFilesChange={setAttachedFiles}
            disabled={isLoading}
          />
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
      <div className="messages-container" onScroll={handleScroll}>
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
          messages.map((msg, index) => {
            // Skip user messages - they'll be included in the DecisionCard
            if (msg.role === 'user') {
              return null;
            }

            // Find the preceding user message for this assistant response
            const precedingUserMsg = messages
              .slice(0, index)
              .reverse()
              .find(m => m.role === 'user');
            const question = precedingUserMsg?.content || '';

            // Check if this is the latest assistant message (for Respond button logic)
            const lastAssistantIndex = messages.map((m, i) => m.role === 'assistant' ? i : -1)
              .filter(i => i !== -1)
              .pop();
            const isLatestDecision = index === lastAssistantIndex;

            const isCardLoading = msg.loading?.stage1 || msg.loading?.stage1_5 ||
                                  msg.loading?.stage2 || msg.loading?.stage3 ||
                                  msg.loading?.preparing;

            return (
              <DecisionCard
                key={index}
                question={question}
                isLoading={isCardLoading}
              >
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

                {/* Council Debate Visualization (shown during loading and transitions) */}
                {isCardLoading && (
                  <CouncilDebate
                    loading={msg.loading}
                    stage1Data={msg.stage1}
                    stage1_5Data={msg.stage1_5}
                    stage2Data={msg.stage2}
                    stage3Data={msg.stage3}
                  />
                )}

                {/* Stage 1 - Individual Responses (Collapsible) */}
                {msg.stage1 && !msg.loading?.stage1 && (
                  <CollapsibleStage
                    title="Individual Responses"
                    count={msg.stage1.length}
                    countLabel="models"
                  >
                    <Stage1 responses={msg.stage1} />
                  </CollapsibleStage>
                )}

                {/* Stage 1.5 - Cross-Review (Collapsible, Extra Care mode only) */}
                {msg.stage1_5 && msg.stage1_5.length > 0 && !msg.loading?.stage1_5 && (
                  <CollapsibleStage
                    title="Cross-Review Refinements"
                    count={msg.stage1_5.length}
                    countLabel="refinements"
                  >
                    <Stage1_5 responses={msg.stage1_5} originalResponses={msg.stage1} />
                  </CollapsibleStage>
                )}

                {/* Stage 2 - Peer Rankings (Collapsible) */}
                {msg.stage2Skipped && (
                  <div className="stage-skipped">
                    <span className="skipped-icon">&#x21BB;</span>
                    <span>Peer review skipped for Quick Answer mode</span>
                  </div>
                )}
                {msg.stage2 && msg.stage2.length > 0 && !msg.loading?.stage2 && (
                  <CollapsibleStage
                    title="Peer Rankings"
                    count={msg.stage2.length}
                    countLabel="reviews"
                  >
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                    />
                  </CollapsibleStage>
                )}

                {/* Stage 3 - Final Synthesis (Always visible, NOT collapsible) */}
                {msg.stage3 && !msg.loading?.stage3 && (
                  <Stage3
                    finalResponse={msg.stage3}
                    originalQuestion={question}
                    messageId={msg.id}
                    onRespond={onRespondToMessage}
                    isLoading={isLoading}
                    isLatestDecision={isLatestDecision}
                  />
                )}

                {/* Mode badge (shown after Stage 3 completes) */}
                {msg.stage3 && msg.metadata?.mode && (
                  <div className="mode-badge-section">
                    <span className="run-mode-badge">
                      {msg.metadata.mode === 'quick' ? 'Quick' :
                       msg.metadata.mode === 'extra_care' ? 'Extra Care' : 'Standard'}
                    </span>
                  </div>
                )}
              </DecisionCard>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={onDismissError} className="dismiss-error">×</button>
        </div>
      )}

      {respondingToMessageId && (
        <div className="responding-to-banner">
          <span>Responding to a previous decision</span>
          <button
            className="clear-responding-btn"
            onClick={onClearRespondingTo}
            title="Clear and respond to latest decision instead"
          >
            ×
          </button>
        </div>
      )}

      <form className="input-form" onSubmit={handleSubmit}>
        <FileUpload
          files={attachedFiles}
          onFilesChange={setAttachedFiles}
          disabled={isLoading}
        />
        <div className="input-wrapper">
          <textarea
            className="message-input"
            placeholder={respondingToMessageId
              ? "Add new information or ask a question about this decision..."
              : "Add new details or constraints, or ask a follow-up question..."}
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
              Ask Follow-up ({getSelectedCredits()} cr)
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
