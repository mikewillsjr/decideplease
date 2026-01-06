import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import './DecisionCard.css';

export default function DecisionCard({ children, isLoading, question }) {
  return (
    <div className={`decision-card ${isLoading ? 'loading' : ''}`}>
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
  );
}
