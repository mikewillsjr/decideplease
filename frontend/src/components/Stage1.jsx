import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import './Stage1.css';

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState(0);

  // Safety check for invalid data
  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return null;
  }

  const safeActiveTab = Math.min(activeTab, responses.length - 1);
  const currentResponse = responses[safeActiveTab];

  if (!currentResponse) {
    return null;
  }

  return (
    <div className="stage stage1">
      <h3 className="stage-title">Stage 1: Individual Responses</h3>

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
        <div className="response-text markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{currentResponse.response || 'No response available'}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
