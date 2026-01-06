import { useState } from 'react';
import './CollapsibleStage.css';

export default function CollapsibleStage({
  title,
  count,
  countLabel = 'items',
  defaultExpanded = false,
  children,
  className = ''
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`collapsible-stage ${className} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="chevron">{isExpanded ? '\u25BC' : '\u25B6'}</span>
        <span className="collapsible-title">{title}</span>
        {count !== undefined && (
          <span className="collapsible-count">({count} {countLabel})</span>
        )}
      </button>

      {isExpanded && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}
