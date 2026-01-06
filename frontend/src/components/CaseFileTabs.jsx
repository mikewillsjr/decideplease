import './CaseFileTabs.css';

/**
 * Case File Tabs - Side tabs for navigating conversation rounds.
 * Styled like binder dividers (Original, Addendum 1, 2, etc.)
 */
export default function CaseFileTabs({
  rounds = [],
  currentIndex = 0,
  onSelectRound,
}) {
  if (rounds.length <= 1) {
    return null; // Don't show tabs for single round
  }

  const getTabLabel = (index) => {
    if (index === 0) return 'Original';
    return `Addendum ${index}`;
  };

  const getTabPreview = (round) => {
    // Truncate question for tab preview
    const question = round?.question || '';
    if (question.length > 30) {
      return question.substring(0, 27) + '...';
    }
    return question;
  };

  return (
    <div className="case-file-tabs">
      <div className="tabs-header">
        <span className="tabs-label">CASE FILE</span>
      </div>

      <div className="tabs-list">
        {rounds.map((round, index) => {
          const isActive = index === currentIndex;
          const hasResult = !!round?.stage3;

          return (
            <button
              key={index}
              className={`case-tab ${isActive ? 'active' : ''} ${hasResult ? 'complete' : 'pending'}`}
              onClick={() => onSelectRound(index)}
              title={round?.question}
            >
              <span className="tab-label">{getTabLabel(index)}</span>
              <span className="tab-preview">{getTabPreview(round)}</span>
              {!hasResult && <span className="tab-status">pending</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
