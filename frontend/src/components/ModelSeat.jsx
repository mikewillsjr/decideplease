import { getModelConfig } from '../utils/confidenceCalculator';
import './ModelSeat.css';

/**
 * Individual model seat in the Council Arc.
 * Displays model icon with status indicator and name on hover.
 */
export default function ModelSeat({
  modelId,
  status = 'idle', // 'idle' | 'thinking' | 'complete'
  isHighlighted = false,
  position = 0, // 0-4 for arc positioning
}) {
  const config = getModelConfig(modelId);

  return (
    <div
      className={`model-seat seat-${position} ${status} ${isHighlighted ? 'highlighted' : ''}`}
      style={{ '--model-color': config.color }}
    >
      <div className="seat-circle">
        <span className="seat-icon">{config.icon}</span>
        {status === 'thinking' && <div className="thinking-ring" />}
        {status === 'complete' && <div className="complete-indicator">✓</div>}
      </div>
      <span className="seat-label">{config.shortName}</span>
    </div>
  );
}
