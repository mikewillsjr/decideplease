import { useState, useEffect, useCallback } from 'react';
import AssemblyState from './AssemblyState';
import CouncilArc from './CouncilArc';
import DecisionOrbit from './DecisionOrbit';
import StageStatusBar from './StageStatusBar';
import VerdictDossier from './VerdictDossier';
import ChairpersonRemarks from './ChairpersonRemarks';
import CaseFileTabs from './CaseFileTabs';
import WaitingGame from './WaitingGame';
import VerificationBanner from './VerificationBanner';
import { DEFAULT_MODELS } from '../utils/confidenceCalculator';
import './CouncilChamber.css';

/**
 * Council Chamber - Main container with state machine.
 * Manages transitions between Assembly (input), Loading, and Dossier (output) states.
 */
export default function CouncilChamber({
  conversation,
  onSendMessage,
  isLoading,
  error,
  onDismissError,
  user,
  onCancelRequest,
  onRetryOrphaned,
  orphanedMessage,
}) {
  // Check if user needs to verify email (has password but not verified)
  const needsVerification = user && !user.email_verified && user.credits === 0;
  // UI state machine: 'assembly' | 'loading' | 'dossier'
  const [uiState, setUiState] = useState('assembly');

  // Rounds for conversation stacking (each round = one Q&A)
  const [rounds, setRounds] = useState([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);

  // Track if user manually selected a different round (to view history while loading)
  const [userSelectedRound, setUserSelectedRound] = useState(false);

  // Model statuses for the arc visualization
  const [modelStatuses, setModelStatuses] = useState({});

  // Extract models from conversation or use defaults
  const getModels = useCallback(() => {
    if (conversation?.messages?.length > 0) {
      // Find first assistant message with stage1 data
      const assistantMsg = conversation.messages.find(m => m.role === 'assistant' && m.stage1);
      if (assistantMsg?.stage1) {
        return assistantMsg.stage1.map(r => r.model);
      }
    }
    return DEFAULT_MODELS;
  }, [conversation]);

  // Determine UI state based on conversation data
  useEffect(() => {
    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
      // Check isLoading first - stay in loading state even with no conversation yet
      if (isLoading) {
        setUiState('loading');
      } else {
        setUiState('assembly');
      }
      setRounds([]);
      setCurrentRoundIndex(0);
      setUserSelectedRound(false);
      return;
    }

    // Parse conversation into rounds (pairs of user + assistant messages)
    const newRounds = [];
    const messages = conversation.messages;

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'user') {
        const userMsg = messages[i];
        const assistantMsg = messages[i + 1]?.role === 'assistant' ? messages[i + 1] : null;

        newRounds.push({
          question: userMsg.content,
          userMessage: userMsg,
          assistantMessage: assistantMsg,
          stage1: assistantMsg?.stage1 || null,
          stage1_5: assistantMsg?.stage1_5 || null,
          stage2: assistantMsg?.stage2 || null,
          stage3: assistantMsg?.stage3 || null,
          metadata: assistantMsg?.metadata || {},
          loading: assistantMsg?.loading || {},
        });
      }
    }

    setRounds(newRounds);

    // Determine UI state
    // Check isLoading first - if we're loading, stay in loading state even with no rounds
    if (isLoading && newRounds.length === 0) {
      setUiState('loading');
      setUserSelectedRound(false);
    } else if (newRounds.length === 0) {
      setUiState('assembly');
      setUserSelectedRound(false);
    } else {
      const lastRound = newRounds[newRounds.length - 1];
      const hasLoading = lastRound.loading?.stage1 || lastRound.loading?.stage2 ||
                         lastRound.loading?.stage3 || lastRound.loading?.stage1_5 ||
                         lastRound.loading?.preparing;

      // If user manually selected a historical round, don't auto-switch to loading view
      if (!userSelectedRound) {
        if (hasLoading || isLoading) {
          setUiState('loading');
        } else if (lastRound.stage3) {
          setUiState('dossier');
        } else {
          setUiState('loading');
        }
        setCurrentRoundIndex(newRounds.length - 1);
      }
      // If user HAS selected a round, keep their selection but update state if viewing completed round
      else {
        const selectedRound = newRounds[currentRoundIndex];
        if (selectedRound?.stage3) {
          setUiState('dossier');
        }
      }
    }
  }, [conversation, isLoading, userSelectedRound, currentRoundIndex]);

  // Update model statuses based on current round's loading state
  useEffect(() => {
    if (rounds.length === 0) {
      setModelStatuses({});
      return;
    }

    const currentRound = rounds[currentRoundIndex];
    if (!currentRound) return;

    const models = getModels();
    const newStatuses = {};

    models.forEach(modelId => {
      if (currentRound.loading?.stage1) {
        // Stage 1: Check if model has responded
        const hasResponded = currentRound.stage1?.some(r => r.model === modelId);
        newStatuses[modelId] = hasResponded ? 'complete' : 'thinking';
      } else if (currentRound.loading?.stage1_5) {
        // Stage 1.5: Cross-review
        const hasRefined = currentRound.stage1_5?.some(r => r.model === modelId);
        newStatuses[modelId] = hasRefined ? 'complete' : 'thinking';
      } else if (currentRound.loading?.stage2) {
        // Stage 2: Peer review
        const hasRanked = currentRound.stage2?.some(r => r.model === modelId);
        newStatuses[modelId] = hasRanked ? 'complete' : 'thinking';
      } else if (currentRound.loading?.stage3) {
        // Stage 3: Chairman synthesizing
        newStatuses[modelId] = 'waiting';
      } else if (currentRound.stage3) {
        // Complete
        newStatuses[modelId] = 'complete';
      } else {
        newStatuses[modelId] = 'idle';
      }
    });

    setModelStatuses(newStatuses);
  }, [rounds, currentRoundIndex, getModels]);

  // Handle submit from DecisionConsole
  const handleSubmit = useCallback((content, mode, files) => {
    setUiState('loading');
    onSendMessage(content, mode, files);
  }, [onSendMessage]);

  // Handle follow-up from ChairpersonRemarks (will be implemented in Phase 4)
  const handleFollowUp = useCallback((content, mode, files) => {
    setUiState('loading');
    onSendMessage(content, mode, files);
  }, [onSendMessage]);

  // Handle tab click for round navigation
  const handleRoundSelect = useCallback((index) => {
    setCurrentRoundIndex(index);
    // Mark that user manually selected a round (allows viewing history while loading)
    // If they select the last (loading) round, reset this flag
    const lastRoundIndex = rounds.length - 1;
    if (index < lastRoundIndex) {
      setUserSelectedRound(true);
    } else {
      setUserSelectedRound(false);
    }
  }, [rounds.length]);

  const models = getModels();
  const currentRound = rounds[currentRoundIndex] || null;
  const lastRoundIndex = rounds.length - 1;
  const lastRound = rounds[lastRoundIndex] || null;

  // Check if the last round is currently loading
  const lastRoundIsLoading = isLoading || lastRound?.loading?.stage1 ||
    lastRound?.loading?.stage1_5 || lastRound?.loading?.stage2 ||
    lastRound?.loading?.stage3 || lastRound?.loading?.preparing;

  // User is viewing a historical (completed) round while a new one is loading
  const viewingHistoryWhileLoading = userSelectedRound && lastRoundIsLoading &&
    currentRoundIndex < lastRoundIndex && currentRound?.stage3;

  // Only show dossier when Stage 3 is complete - don't show it prematurely
  // BUT also show it when viewing historical round while loading
  const showDossier = (uiState === 'dossier' && currentRound?.stage3) || viewingHistoryWhileLoading;

  // Show loading state until Stage 3 is complete (but not when viewing history)
  const showInitialLoading = !viewingHistoryWhileLoading &&
    (uiState === 'loading' || (currentRound && !currentRound?.stage3));

  // Helper to go back to watching the current loading round
  const handleViewCurrent = useCallback(() => {
    setCurrentRoundIndex(lastRoundIndex);
    setUserSelectedRound(false);
  }, [lastRoundIndex]);

  return (
    <div className={`council-chamber state-${uiState}`}>
      {/* Verification banner for unverified users */}
      {needsVerification && <VerificationBanner userEmail={user?.email} />}

      {/* Banner when viewing historical round while new one is loading */}
      {viewingHistoryWhileLoading && (
        <div className="history-while-loading-banner">
          <div className="banner-content">
            <span className="banner-icon">⏳</span>
            <span className="banner-text">
              Addendum {lastRoundIndex} is processing in the background
            </span>
          </div>
          <div className="banner-actions">
            <button className="view-current-btn" onClick={handleViewCurrent}>
              View Progress
            </button>
            {onCancelRequest && (
              <button className="cancel-btn" onClick={onCancelRequest}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Orphaned message banner (request that never completed) */}
      {orphanedMessage && !isLoading && (
        <div className="orphaned-message-banner">
          <div className="banner-content">
            <span className="banner-icon">⚠️</span>
            <div className="banner-text">
              <strong>Previous request didn't complete</strong>
              <span className="orphaned-preview">
                "{orphanedMessage.content?.substring(0, 50)}
                {orphanedMessage.content?.length > 50 ? '...' : ''}"
              </span>
            </div>
          </div>
          <div className="banner-actions">
            {onRetryOrphaned && (
              <button className="retry-btn" onClick={() => onRetryOrphaned(orphanedMessage)}>
                Retry Request
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="chamber-error">
          <span>{error}</span>
          <button onClick={onDismissError}>×</button>
        </div>
      )}

      {/* Main content area */}
      <div className="chamber-content">
        {/* Assembly State (Input) - shown when no results yet */}
        {uiState === 'assembly' && (
          <AssemblyState
            models={models}
            modelStatuses={modelStatuses}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            disabled={needsVerification}
            needsVerification={needsVerification}
            loading={currentRound?.loading}
            mode={currentRound?.metadata?.mode || 'decide_please'}
          />
        )}

        {/* Initial Loading State - shown while waiting for first stage1 results */}
        {showInitialLoading && (
          <div className="initial-loading-container">
            <DecisionOrbit
              models={models}
              modelStatuses={modelStatuses}
              loading={currentRound?.loading}
              isActive={true}
              isLoading={true}
              mode={currentRound?.metadata?.mode || 'decide_please'}
              currentStage={
                currentRound?.loading?.stage1 ? 'stage1' :
                currentRound?.loading?.stage1_5 ? 'stage1_5' :
                currentRound?.loading?.stage2 ? 'stage2' :
                currentRound?.loading?.stage3 ? 'stage3' : null
              }
            />

            <StageStatusBar
              mode={currentRound?.metadata?.mode || 'decide_please'}
              loading={currentRound?.loading}
              isVisible={true}
            />

            <div className="initial-loading-message">
              <span className="loading-subtitle">
                {currentRound?.question ? `"${currentRound.question.substring(0, 60)}${currentRound.question.length > 60 ? '...' : ''}"` : 'Gathering the council...'}
              </span>
              {/* Cancel button */}
              {onCancelRequest && (
                <button className="cancel-request-btn" onClick={onCancelRequest}>
                  Cancel Request
                </button>
              )}
            </div>

            {/* Mini-game while waiting */}
            <WaitingGame
              mode={currentRound?.metadata?.mode || 'decide_please'}
              elapsed={currentRound?.loading?.heartbeat?.elapsed || 0}
            />
          </div>
        )}

        {/* Loading/Dossier State - shown when processing or complete */}
        {showDossier && (
          <div className="dossier-container">
            {/* Mini arc at top during dossier view */}
            <CouncilArc
              models={models}
              modelStatuses={modelStatuses}
              isLoading={uiState === 'loading'}
              isMini={true}
            />

            {/* Verdict Dossier with Supplement inside */}
            <VerdictDossier
              question={currentRound?.question}
              stage1={currentRound?.stage1}
              stage1_5={currentRound?.stage1_5}
              stage2={currentRound?.stage2}
              stage3={currentRound?.stage3}
              metadata={{
                ...currentRound?.metadata,
                stage2Skipped: currentRound?.stage2Skipped,
                stage1_5Skipped: currentRound?.stage1_5Skipped,
              }}
              isLoading={uiState === 'loading' && !currentRound?.stage3}
            >
              {/* Supplement (ChairpersonRemarks) as children - sticky inside dossier */}
              {uiState === 'dossier' && currentRound?.stage3 && (
                <ChairpersonRemarks
                  onSubmit={handleFollowUp}
                  isLoading={isLoading}
                  disabled={needsVerification}
                  needsVerification={needsVerification}
                />
              )}
            </VerdictDossier>

            {/* Loading indicator for current stage */}
            {uiState === 'loading' && currentRound?.loading && (
              <div className="loading-indicator">
                {currentRound.loading.preparing && (
                  <span>{currentRound.loading.preparingStatus || 'Preparing...'}</span>
                )}
                {currentRound.loading.stage1 && <span>Stage 1: Gathering opinions...</span>}
                {currentRound.loading.stage1_5 && <span>Stage 1.5: Cross-reviewing...</span>}
                {currentRound.loading.stage2 && <span>Stage 2: Peer review...</span>}
                {currentRound.loading.stage3 && <span>Stage 3: Synthesizing verdict...</span>}
                {currentRound.loading.heartbeat?.elapsed && (
                  <span className="elapsed">({currentRound.loading.heartbeat.elapsed}s)</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Case File Tabs for round navigation */}
      <CaseFileTabs
        rounds={rounds}
        currentIndex={currentRoundIndex}
        onSelectRound={handleRoundSelect}
      />
    </div>
  );
}
