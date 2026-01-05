import { useState, useEffect } from 'react';
import './CouncilDebate.css';

// Model configurations with brand colors and icons
const MODEL_CONFIG = {
  'openai/gpt-5.2-chat': {
    name: 'GPT',
    color: '#10a37f',
    icon: '◯',
    shortName: 'GPT'
  },
  'anthropic/claude-sonnet-4.5': {
    name: 'Claude',
    color: '#d97706',
    icon: '◐',
    shortName: 'Claude'
  },
  'google/gemini-3-flash-preview': {
    name: 'Gemini',
    color: '#4285f4',
    icon: '◇',
    shortName: 'Gemini'
  },
  'x-ai/grok-4-fast': {
    name: 'Grok',
    color: '#ffffff',
    icon: '✕',
    shortName: 'Grok'
  },
  'deepseek/deepseek-v3.2': {
    name: 'DeepSeek',
    color: '#6366f1',
    icon: '◈',
    shortName: 'DeepSeek'
  },
  // Fallback configs for different model names
  'openai': { name: 'GPT', color: '#10a37f', icon: '◯', shortName: 'GPT' },
  'anthropic': { name: 'Claude', color: '#d97706', icon: '◐', shortName: 'Claude' },
  'google': { name: 'Gemini', color: '#4285f4', icon: '◇', shortName: 'Gemini' },
  'x-ai': { name: 'Grok', color: '#ffffff', icon: '✕', shortName: 'Grok' },
  'deepseek': { name: 'DeepSeek', color: '#6366f1', icon: '◈', shortName: 'DeepSeek' },
};

function getModelConfig(modelId) {
  if (MODEL_CONFIG[modelId]) return MODEL_CONFIG[modelId];
  // Try to match by prefix
  const prefix = modelId?.split('/')[0];
  if (MODEL_CONFIG[prefix]) return MODEL_CONFIG[prefix];
  // Default fallback
  return { name: 'Model', color: '#6b7280', icon: '●', shortName: 'AI' };
}

function ModelIcon({ modelId, status, message, isChairman }) {
  const config = getModelConfig(modelId);

  return (
    <div
      className={`model-icon-wrapper ${status} ${isChairman ? 'chairman' : ''}`}
      style={{ '--model-color': config.color }}
    >
      <div className="model-icon">
        <span className="icon-symbol">{config.icon}</span>
        {status === 'thinking' && <div className="thinking-ring" />}
        {status === 'complete' && <div className="complete-check">✓</div>}
      </div>
      <span className="model-name">{config.shortName}</span>
      {message && (
        <div className="speech-bubble">
          <span className="bubble-text">{message}</span>
        </div>
      )}
    </div>
  );
}

export default function CouncilDebate({
  stage,
  stage1Data,
  stage2Data,
  stage3Data,
  loading,
  isMinimized,
  onToggleMinimize,
}) {
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('decideplease_debate_view') || 'full';
  });

  useEffect(() => {
    localStorage.setItem('decideplease_debate_view', viewMode);
  }, [viewMode]);

  // If turned off, show simple text
  if (viewMode === 'off') {
    return (
      <div className="council-debate minimal">
        <div className="debate-simple">
          <div className="spinner-small"></div>
          <span>
            {loading?.stage1 && 'Collecting responses...'}
            {loading?.stage2 && 'Peer review in progress...'}
            {loading?.stage3 && 'Synthesizing verdict...'}
          </span>
        </div>
        <button
          className="view-toggle"
          onClick={() => setViewMode('full')}
          title="Show council visualization"
        >
          Show Council
        </button>
      </div>
    );
  }

  // Get model list from stage1 data if available
  const models = stage1Data?.map(r => r.model) || [
    'openai/gpt-5.2-chat',
    'anthropic/claude-sonnet-4.5',
    'google/gemini-3-flash-preview',
    'x-ai/grok-4-fast',
    'deepseek/deepseek-v3.2'
  ];

  // Calculate overall progress percentage
  const getProgress = () => {
    if (stage3Data && !loading?.stage3) return 100;
    if (loading?.stage3) return 80;
    if (stage2Data?.length > 0 && !loading?.stage2) return 66;
    if (loading?.stage2) return 50;
    if (stage1Data?.length > 0 && !loading?.stage1) return 33;
    if (loading?.stage1) return 15;
    return 5;
  };

  // Determine status for each model
  const getModelStatus = (modelId, index) => {
    if (loading?.stage3) return 'waiting';
    if (loading?.stage2) {
      // Check if this model has submitted ranking
      const hasRanked = stage2Data?.some(r => r.model === modelId);
      return hasRanked ? 'complete' : 'thinking';
    }
    if (loading?.stage1) {
      // Check if this model has responded
      const hasResponded = stage1Data?.some(r => r.model === modelId);
      return hasResponded ? 'complete' : 'thinking';
    }
    if (stage1Data?.some(r => r.model === modelId)) return 'complete';
    return 'idle';
  };

  // Get a snippet from model's response
  const getModelMessage = (modelId) => {
    if (loading?.stage2) {
      const ranking = stage2Data?.find(r => r.model === modelId);
      if (ranking?.parsed_ranking?.[0]) {
        return `#1: ${ranking.parsed_ranking[0].replace('Response ', '')}`;
      }
    }
    if (loading?.stage1 || stage1Data) {
      const response = stage1Data?.find(r => r.model === modelId);
      if (response?.response) {
        // Get first sentence or 60 chars
        const text = response.response;
        const firstSentence = text.split(/[.!?]/)[0];
        return firstSentence.length > 60
          ? firstSentence.substring(0, 57) + '...'
          : firstSentence;
      }
    }
    return null;
  };

  // Minimized view
  if (viewMode === 'minimal' || isMinimized) {
    return (
      <div className="council-debate minimized">
        <div className="debate-bar">
          <div className="bar-models">
            {models.slice(0, 5).map((modelId, i) => {
              const config = getModelConfig(modelId);
              const status = getModelStatus(modelId, i);
              return (
                <div
                  key={modelId}
                  className={`bar-icon ${status}`}
                  style={{ '--model-color': config.color }}
                  title={config.name}
                >
                  <span>{config.icon}</span>
                </div>
              );
            })}
          </div>
          <div className="bar-status">
            {loading?.stage1 && 'Stage 1: Gathering opinions...'}
            {loading?.stage2 && 'Stage 2: Peer review...'}
            {loading?.stage3 && 'Stage 3: Final synthesis...'}
          </div>
          <button
            className="expand-btn"
            onClick={() => {
              setViewMode('full');
              onToggleMinimize?.();
            }}
            title="Expand view"
          >
            ↗
          </button>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="council-debate full">
      <div className="debate-header">
        <span className="debate-title">
          {loading?.stage1 && 'Stage 1: Models are forming opinions...'}
          {loading?.stage2 && 'Stage 2: Anonymous peer review...'}
          {loading?.stage3 && 'Stage 3: Chairman synthesizing verdict...'}
        </span>
        <div className="debate-controls">
          <button
            className="minimize-btn"
            onClick={() => setViewMode('minimal')}
            title="Minimize"
          >
            −
          </button>
          <button
            className="disable-btn"
            onClick={() => setViewMode('off')}
            title="Hide visualization"
          >
            ×
          </button>
        </div>
      </div>

      <div className="debate-arena">
        <div className="models-row">
          {models.slice(0, 5).map((modelId, i) => (
            <ModelIcon
              key={modelId}
              modelId={modelId}
              status={getModelStatus(modelId, i)}
              message={getModelMessage(modelId)}
              isChairman={loading?.stage3 && i === 2} // Gemini is usually chairman
            />
          ))}
        </div>

        {/* Connection lines for stage 2 */}
        {loading?.stage2 && stage2Data && stage2Data.length > 0 && (
          <svg className="connections-overlay" viewBox="0 0 400 100">
            {/* Draw lines between models based on rankings */}
            {/* This is simplified - could be enhanced with actual ranking data */}
          </svg>
        )}

        {/* Stage indicator */}
        <div className="stage-progress">
          <div className={`stage-dot ${loading?.stage1 || stage1Data ? 'active' : ''} ${stage1Data && !loading?.stage1 ? 'complete' : ''}`}>
            <span>1</span>
          </div>
          <div className="stage-line"></div>
          <div className={`stage-dot ${loading?.stage2 || stage2Data?.length > 0 ? 'active' : ''} ${stage2Data?.length > 0 && !loading?.stage2 ? 'complete' : ''}`}>
            <span>2</span>
          </div>
          <div className="stage-line"></div>
          <div className={`stage-dot ${loading?.stage3 || stage3Data ? 'active' : ''} ${stage3Data && !loading?.stage3 ? 'complete' : ''}`}>
            <span>3</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
        <div className="progress-labels">
          <span>Responses</span>
          <span>Peer Review</span>
          <span>Verdict</span>
        </div>
      </div>
    </div>
  );
}
