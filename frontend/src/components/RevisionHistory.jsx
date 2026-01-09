import { useState } from 'react';
import './RevisionHistory.css';

export default function RevisionHistory({ revisions, activeRevision, onSelectRevision }) {
  if (!revisions || revisions.length <= 1) {
    return null; // Don't show if there's only one version
  }

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'quick':
      case 'quick_decision': return 'Quick Decision';
      case 'extra_care':
      case 'decide_pretty_please': return 'Decide Pretty Please';
      case 'standard':
      case 'decide_please':
      default: return 'Decide Please';
    }
  };

  return (
    <div className="revision-history">
      <div className="revision-header">
        <span className="revision-label">Revision History</span>
        <span className="revision-count">{revisions.length} versions</span>
      </div>
      <div className="revision-tabs">
        {revisions.map((rev, index) => (
          <button
            key={rev.id}
            className={`revision-tab ${activeRevision === index ? 'active' : ''}`}
            onClick={() => onSelectRevision(index)}
          >
            <div className="revision-tab-main">
              <span className="revision-number">
                {index === 0 ? 'Original' : `Revision ${index}`}
              </span>
              {rev.is_rerun && rev.rerun_input && (
                <span className="revision-type refinement">Refinement</span>
              )}
              {rev.is_rerun && !rev.rerun_input && (
                <span className="revision-type second-opinion">2nd Opinion</span>
              )}
            </div>
            <div className="revision-tab-meta">
              <span className="revision-mode">{getModeLabel(rev.mode)}</span>
              <span className="revision-time">
                {formatDate(rev.created_at)} {formatTime(rev.created_at)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
