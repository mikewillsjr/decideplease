import { getModelConfig, getVotingTier } from '../utils/confidenceCalculator';
import './DossierFooter.css';

/**
 * Dossier Footer - Voting record grid from Stage 2 rankings.
 */
export default function DossierFooter({
  aggregateRankings = [],
  stage2Skipped = false,
}) {
  if (stage2Skipped) {
    return (
      <div className="dossier-footer skipped">
        <div className="footer-title">COUNCIL VOTING RECORD</div>
        <div className="skipped-notice">
          Peer review was skipped in Quick mode
        </div>
      </div>
    );
  }

  if (!aggregateRankings || aggregateRankings.length === 0) {
    return null;
  }

  // Sort by average rank (best first)
  const sortedRankings = [...aggregateRankings].sort(
    (a, b) => a.average_rank - b.average_rank
  );

  return (
    <div className="dossier-footer">
      <div className="footer-title">COUNCIL VOTING RECORD (STAGE 2)</div>

      <div className="voting-grid">
        {sortedRankings.map((ranking, index) => {
          const config = getModelConfig(ranking.model);
          const tier = getVotingTier(index + 1, sortedRankings.length);
          const rank = index + 1;

          return (
            <div
              key={ranking.model}
              className={`vote-card ${tier}`}
              style={{ '--model-color': config.color }}
            >
              <span className="vote-icon">{config.icon}</span>
              <span className="vote-model">{config.shortName}</span>
              <span className="vote-rank">
                Rank #{rank}
                {tier === 'low-tier' && <span className="divergent-label"> (Divergent)</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="footer-legend">
        <span className="legend-item top-tier">Top consensus</span>
        <span className="legend-item mid-tier">Middle</span>
        <span className="legend-item low-tier">Divergent view</span>
      </div>
    </div>
  );
}
