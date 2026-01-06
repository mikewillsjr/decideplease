import { useState, useEffect, useCallback } from 'react';
import AssemblyState from './AssemblyState';
import CouncilArc from './CouncilArc';
import VerdictDossier from './VerdictDossier';
import ChairpersonRemarks from './ChairpersonRemarks';
import CaseFileTabs from './CaseFileTabs';
import WaitingGame from './WaitingGame';
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
}) {
  // UI state machine: 'assembly' | 'loading' | 'dossier'
  const [uiState, setUiState] = useState('assembly');

  // Rounds for conversation stacking (each round = one Q&A)
  const [rounds, setRounds] = useState([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);

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
      setUiState('assembly');
      setRounds([]);
      setCurrentRoundIndex(0);
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
    if (newRounds.length === 0) {
      setUiState('assembly');
    } else {
      const lastRound = newRounds[newRounds.length - 1];
      const hasLoading = lastRound.loading?.stage1 || lastRound.loading?.stage2 ||
                         lastRound.loading?.stage3 || lastRound.loading?.stage1_5 ||
                         lastRound.loading?.preparing;

      if (hasLoading || isLoading) {
        setUiState('loading');
      } else if (lastRound.stage3) {
        setUiState('dossier');
      } else {
        setUiState('loading');
      }

      setCurrentRoundIndex(newRounds.length - 1);
    }
  }, [conversation, isLoading]);

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

  // Handle tab click for round navigation (will be implemented in Phase 4)
  const handleRoundSelect = useCallback((index) => {
    setCurrentRoundIndex(index);
  }, []);

  const models = getModels();
  const currentRound = rounds[currentRoundIndex] || null;
  const showDossier = uiState === 'dossier' || (uiState === 'loading' && currentRound?.stage1);
  const showInitialLoading = uiState === 'loading' && !currentRound?.stage1;

  return (
    <div className={`council-chamber state-${uiState}`}>
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
            disabled={false}
          />
        )}

        {/* Initial Loading State - shown while waiting for first stage1 results */}
        {showInitialLoading && (
          <div className="initial-loading-container">
            <CouncilArc
              models={models}
              modelStatuses={Object.fromEntries(models.map(m => [m, 'thinking']))}
              isLoading={true}
              isActive={true}
            />
            <div className="initial-loading-message">
              <div className="loading-spinner"></div>
              <span className="loading-title">Council Convening</span>
              <span className="loading-subtitle">
                {currentRound?.question ? `"${currentRound.question.substring(0, 60)}${currentRound.question.length > 60 ? '...' : ''}"` : 'Gathering the council...'}
              </span>
            </div>

            {/* Mini-game while waiting */}
            <WaitingGame
              mode={currentRound?.metadata?.mode || 'standard'}
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

            {/* Verdict Dossier */}
            <VerdictDossier
              question={currentRound?.question}
              stage1={currentRound?.stage1}
              stage3={currentRound?.stage3}
              metadata={{
                ...currentRound?.metadata,
                stage2Skipped: currentRound?.stage2Skipped,
              }}
              isLoading={uiState === 'loading' && !currentRound?.stage3}
            />

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

            {/* Chairperson Remarks - Follow-up input bar */}
            {uiState === 'dossier' && currentRound?.stage3 && (
              <ChairpersonRemarks
                onSubmit={handleFollowUp}
                isLoading={isLoading}
                disabled={false}
              />
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
