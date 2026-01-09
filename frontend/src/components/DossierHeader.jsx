import { calculateConfidence, getModelConfig } from '../utils/confidenceCalculator';
import './DossierHeader.css';

/**
 * Dossier Header - Top section with seal, chairman info, and confidence meter.
 */
export default function DossierHeader({
  question,
  chairmanModel,
  modelCount = 5,
  aggregateRankings,
}) {
  const chairmanConfig = getModelConfig(chairmanModel);
  const { score, label } = calculateConfidence(aggregateRankings);

  // Truncate question for display
  const displayQuestion = question?.length > 100
    ? question.substring(0, 97) + '...'
    : question;

  return (
    <div className="dossier-header">
      <div className="header-left">
        <div className="seal-container">
          <svg className="seal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          </svg>
        </div>
        <div className="header-text">
          <h2 className="verdict-label">Executive Consensus</h2>
          <span className="meta-info">
            Moderator: {chairmanConfig.shortName} • {modelCount} Decision Makers
          </span>
        </div>
      </div>

      <div className={`confidence-badge confidence-${label.toLowerCase().replace(' ', '-')}`}>
        <span className="score-text">{score}% Consensus Strength</span>
        <div className="meter-bar">
          <div className="meter-fill" style={{ width: `${score}%` }} />
        </div>
      </div>

      {displayQuestion && (
        <div className="question-preview" title={question}>
          <span className="question-label">QUERY</span>
          <span className="question-text">{displayQuestion}</span>
        </div>
      )}
    </div>
  );
}
