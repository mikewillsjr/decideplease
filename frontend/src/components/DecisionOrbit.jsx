import { useMemo } from 'react';
import ProgressRing from './ProgressRing';
import { getModelConfig, DEFAULT_MODELS } from '../utils/confidenceCalculator';
import './DecisionOrbit.css';

// Brain icon for center hub
const BrainIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 4.5C9.5 4.5 7.5 6.5 7.5 9c0 1.2.5 2.3 1.3 3.1-.5.8-.8 1.7-.8 2.7 0 2.5 2 4.7 4 4.7s4-2.2 4-4.7c0-1-.3-1.9-.8-2.7.8-.8 1.3-1.9 1.3-3.1 0-2.5-2-4.5-4.5-4.5z"/>
    <path d="M9 9.5h6M9 12h6M10.5 14.5h3"/>
  </svg>
);

/**
 * Shuffle array using Fisher-Yates algorithm with a seed
 */
function shuffleArray(array, seed) {
  const shuffled = [...array];
  let currentSeed = seed;

  for (let i = shuffled.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Get stage completion progress for a model based on current stage.
 * @param {string} modelStatus - 'idle' | 'thinking' | 'complete'
 * @param {object} loading - Current loading state with stage flags
 * @param {string} mode - 'quick_decision' | 'decide_please' | 'decide_pretty_please'
 * @returns {number} Progress percentage (0-100)
 */
function getModelProgress(modelStatus, loading, mode) {
  if (!loading) return 0;

  // Determine total stages based on mode
  const stages = mode === 'quick_decision' ? 2 :
                 mode === 'decide_pretty_please' ? 4 : 3;
  const progressPerStage = 100 / stages;

  let completedStages = 0;

  // Stage 1 complete
  if (!loading.stage1 && loading.stage1 !== undefined) {
    completedStages++;
  }

  // Stage 1.5 (only for decide_pretty_please)
  if (mode === 'decide_pretty_please' && !loading.stage1_5 && loading.stage1_5 !== undefined) {
    completedStages++;
  }

  // Stage 2 complete (only for decide_please and decide_pretty_please)
  if (mode !== 'quick_decision' && !loading.stage2 && loading.stage2 !== undefined) {
    completedStages++;
  }

  // Stage 3 complete
  if (!loading.stage3 && loading.stage3 !== undefined) {
    completedStages++;
  }

  return Math.min(completedStages * progressPerStage, 100);
}

/**
 * DecisionOrbit - Orbiting animation of 5 LLM models.
 *
 * Three visual states:
 * - dim: Default (opacity 0.3, no animation)
 * - lit: Input focused (full opacity, no animation)
 * - orbiting: LLMs answering (full opacity, rotation active)
 *
 * Features:
 * - Progress rings around each model showing stage completion
 * - Dynamic center hub text showing current stage
 * - Individual model status indicators (thinking/complete)
 */
export default function DecisionOrbit({
  models = DEFAULT_MODELS,
  modelStatuses = {},
  loading = null, // Loading state object with stage flags
  isActive = false, // True when input is focused
  isLoading = false, // True when any stage is processing
  mode = 'decide_please', // Current deliberation mode
  currentStage = null, // Current stage name for center hub
}) {
  // Shuffle models once per component mount
  const shuffledModels = useMemo(() => {
    const seed = Math.floor(Date.now() / 60000);
    const modelList = models.slice(0, 5);
    while (modelList.length < 5) {
      modelList.push(DEFAULT_MODELS[modelList.length]);
    }
    return shuffleArray(modelList, seed);
  }, [models]);

  // Determine animation state
  const animationState = useMemo(() => {
    if (isLoading) return 'orbiting';
    if (isActive) return 'lit';
    return 'dim';
  }, [isLoading, isActive]);

  // Get center hub text based on current stage
  const getCenterText = () => {
    if (!isLoading) return 'Ready';
    if (!currentStage) return 'Deliberating';

    const stageNames = {
      stage1: 'Gathering Opinions',
      stage1_5: 'Cross-Examining',
      stage2: 'Peer Review',
      stage3: 'Synthesizing',
    };

    return stageNames[currentStage] || 'Deliberating';
  };

  return (
    <div className={`decision-orbit ${animationState}`}>
      {/* Orbit container */}
      <div className="orbit-container">
        {/* The rotating ring */}
        <div className="agent-orbit">
          {shuffledModels.map((modelId, index) => {
            const config = getModelConfig(modelId);
            const status = modelStatuses[modelId] || 'idle';
            const progress = getModelProgress(status, loading, mode);
            const position = index + 1; // 1-5 for CSS positioning

            return (
              <div key={modelId} className={`agent-node pos-${position}`}>
                <div className="agent-inner-wrapper">
                  {/* Progress ring */}
                  <ProgressRing
                    progress={progress}
                    size={64}
                    strokeWidth={3}
                    color={config.color}
                    isSpinning={status === 'thinking'}
                  />

                  {/* Model node */}
                  <div
                    className={`agent-inner ${status}`}
                    style={{ '--model-color': config.color }}
                  >
                    <span className="agent-icon">{config.icon}</span>

                    {/* Status indicators */}
                    {status === 'complete' && (
                      <div className="complete-badge">✓</div>
                    )}
                  </div>

                  {/* Label (counter-rotates to stay readable) */}
                  <span className="agent-label">{config.shortName}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center hub */}
        <div className={`consensus-center ${isLoading ? 'active' : ''}`}>
          <BrainIcon />
          <span className="center-text">{getCenterText()}</span>
        </div>

        {/* Decorative rings */}
        <div className="orbit-ring ring-1"></div>
        <div className="orbit-ring ring-2"></div>
      </div>
    </div>
  );
}
