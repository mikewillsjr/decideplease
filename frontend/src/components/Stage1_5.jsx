import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import './Stage1_5.css';

export default function Stage1_5({ responses, originalResponses }) {
  const [activeTab, setActiveTab] = useState(0);
  const [showComparison, setShowComparison] = useState(false);

  // Safety check for invalid data
  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return null;
  }

  const safeActiveTab = Math.min(activeTab, responses.length - 1);
  const currentResponse = responses[safeActiveTab];

  if (!currentResponse) {
    return null;
  }

  // Find original response for comparison
  const originalResponse = originalResponses?.find(
    (r) => r.model === currentResponse.model
  );

  return (
    <div className="stage stage1-5">
      <h3 className="stage-title">Stage 1.5: Cross-Review Refinements</h3>
      <p className="stage-description">
        Each model reviewed all initial responses and refined their answer based on other perspectives.
      </p>

      <div className="tabs">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`tab ${safeActiveTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {resp?.model?.split('/')[1] || resp?.model || `Model ${index + 1}`}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="model-name">{currentResponse.model || 'Unknown Model'}</div>

        {originalResponse && (
          <button
            className="comparison-toggle"
            onClick={() => setShowComparison(!showComparison)}
          >
            {showComparison ? 'Hide original response' : 'Show original response for comparison'}
          </button>
        )}

        {showComparison && originalResponse && (
          <div className="original-response">
            <div className="original-label">Original Response (Stage 1):</div>
            <div className="response-text markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {originalResponse.response || 'No original response available'}
              </ReactMarkdown>
            </div>
          </div>
        )}

        <div className={showComparison ? 'refined-section' : ''}>
          {showComparison && <div className="refined-label">Refined Response (Stage 1.5):</div>}
          <div className="response-text markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {currentResponse.response || 'No response available'}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
