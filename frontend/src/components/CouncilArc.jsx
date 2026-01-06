import ModelSeat from './ModelSeat';
import { DEFAULT_MODELS } from '../utils/confidenceCalculator';
import './CouncilArc.css';

/**
 * Semi-circle arc of 5 AI model seats.
 * Center model (index 2) is highlighted as the chairman.
 */
export default function CouncilArc({
  models = DEFAULT_MODELS,
  modelStatuses = {},
  isLoading = false,
  isMini = false, // Shrunk version shown during dossier state
  className = '',
}) {
  // Limit to 5 models for the arc display
  const displayModels = models.slice(0, 5);

  // Pad to 5 if we have fewer
  while (displayModels.length < 5) {
    displayModels.push(DEFAULT_MODELS[displayModels.length]);
  }

  return (
    <div className={`council-arc ${isMini ? 'mini' : ''} ${isLoading ? 'loading' : ''} ${className}`}>
      <div className="arc-container">
        {displayModels.map((modelId, index) => (
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
