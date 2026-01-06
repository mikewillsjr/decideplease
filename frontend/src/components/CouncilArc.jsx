import { useMemo } from 'react';
import ModelSeat from './ModelSeat';
import { DEFAULT_MODELS } from '../utils/confidenceCalculator';
import './CouncilArc.css';

/**
 * Shuffle array using Fisher-Yates algorithm with a seed
 * We use a stable shuffle per session to avoid jarring re-shuffles
 */
function shuffleArray(array, seed) {
  const shuffled = [...array];
  let currentSeed = seed;

  for (let i = shuffled.length - 1; i > 0; i--) {
    // Simple seeded random
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Semi-circle arc of 5 AI model seats.
 * Center model (index 2) is highlighted as the chairman.
 * Models are shuffled each session to avoid favoritism.
 */
export default function CouncilArc({
  models = DEFAULT_MODELS,
  modelStatuses = {},
  isLoading = false,
  isActive = false, // True when input is focused
  isMini = false, // Shrunk version shown during dossier state
  className = '',
}) {
  // Shuffle models once per component mount (session)
  // Use current minute as seed for variety but stability within a session
  const shuffledModels = useMemo(() => {
    const seed = Math.floor(Date.now() / 60000); // Changes every minute
    const modelList = models.slice(0, 5);

    // Pad to 5 if we have fewer
    while (modelList.length < 5) {
      modelList.push(DEFAULT_MODELS[modelList.length]);
    }

    return shuffleArray(modelList, seed);
  }, [models]);

  // Determine arc state class
  const stateClass = isMini ? '' : (isActive ? 'active' : 'dimmed');

  return (
    <div className={`council-arc ${isMini ? 'mini' : ''} ${isLoading ? 'loading' : ''} ${stateClass} ${className}`}>
      <div className="arc-container">
        {shuffledModels.map((modelId, index) => (
          <ModelSeat
            key={modelId || index}
            modelId={modelId}
            position={index}
            status={modelStatuses[modelId] || 'idle'}
            isHighlighted={index === 2} // Center seat is chairman
          />
        ))}
      </div>
    </div>
  );
}
