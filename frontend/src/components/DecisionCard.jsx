import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import './DecisionCard.css';

export default function DecisionCard({ children, isLoading, question, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Truncate question for collapsed view
  const truncatedQuestion = question && question.length > 100
    ? question.substring(0, 100) + '...'
    : question;

  return (
    <div className={`decision-card ${isLoading ? 'loading' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="card-header"
        onClick={() => !isLoading && setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        disabled={isLoading}
      >
        <span className="card-chevron">{isExpanded ? '\u25BC' : '\u25B6'}</span>
        <div className="card-header-content">
          <span className="card-header-label">Decision</span>
          {!isExpanded && question && (
            <span className="card-header-preview">{truncatedQuestion}</span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="card-body">
          {question && (
            <div className="decision-question">
              <div className="question-label">Question</div>
              <div className="question-content markdown-content">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{question}</ReactMarkdown>
              </div>
            </div>
          )}
          <div className="decision-stages">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
