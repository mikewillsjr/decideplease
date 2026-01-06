/**
 * Calculate confidence score from aggregate rankings variance.
 * Lower variance in rankings = higher agreement = higher confidence.
 */
export function calculateConfidence(aggregateRankings) {
  if (!aggregateRankings || aggregateRankings.length === 0) {
    return { score: 50, label: 'Moderate' };
  }

  // Calculate variance in average ranks
  const avgRanks = aggregateRankings.map(r => r.average_rank);
  const mean = avgRanks.reduce((a, b) => a + b, 0) / avgRanks.length;
  const variance = avgRanks.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / avgRanks.length;

  // Lower variance = higher confidence
  // Variance of 0 (perfect agreement) = 100%
  // Variance of 4 (max spread for 5 models) = 50%
  const maxVariance = 4;
  const normalizedVariance = Math.min(variance / maxVariance, 1);
  const score = Math.round(100 - (normalizedVariance * 50));

  // Label based on score
  let label = 'Low';
  if (score >= 85) label = 'Very High';
  else if (score >= 70) label = 'High';
  else if (score >= 55) label = 'Moderate';

  return { score, label };
}

/**
 * Get tier class for voting record visualization.
 * @param {number} rank - 1-indexed position
 * @param {number} totalModels - Total number of models
 * @returns {string} CSS class: 'top-tier', 'mid-tier', or 'low-tier'
 */
export function getVotingTier(rank, totalModels = 5) {
  if (rank <= 2) return 'top-tier';
  if (rank <= 3) return 'mid-tier';
  return 'low-tier';
}

/**
 * Model configurations with brand colors and icons.
 * Extracted from CouncilDebate.jsx for reuse.
 */
export const MODEL_CONFIG = {
  // Premium tier
  'openai/gpt-5.2-chat': { name: 'GPT', color: '#10a37f', icon: '◯', shortName: 'GPT' },
  'openai/gpt-5.2': { name: 'GPT', color: '#10a37f', icon: '◯', shortName: 'GPT' },
  'anthropic/claude-sonnet-4.5': { name: 'Claude', color: '#d97706', icon: '◐', shortName: 'Claude' },
  'anthropic/claude-opus-4.5': { name: 'Claude', color: '#d97706', icon: '◐', shortName: 'Claude' },
  'google/gemini-3-flash-preview': { name: 'Gemini', color: '#4285f4', icon: '◇', shortName: 'Gemini' },
  'google/gemini-3-pro-preview': { name: 'Gemini', color: '#4285f4', icon: '◇', shortName: 'Gemini' },
  'x-ai/grok-4-fast': { name: 'Grok', color: '#ffffff', icon: '✕', shortName: 'Grok' },
  'x-ai/grok-4.1-fast': { name: 'Grok', color: '#ffffff', icon: '✕', shortName: 'Grok' },
  'deepseek/deepseek-v3.2': { name: 'DeepSeek', color: '#6366f1', icon: '◈', shortName: 'DeepSeek' },
  // Haiku tier
  'openai/gpt-4o-mini': { name: 'GPT', color: '#10a37f', icon: '◯', shortName: 'GPT' },
  'anthropic/claude-3-haiku': { name: 'Claude', color: '#d97706', icon: '◐', shortName: 'Claude' },
  'google/gemini-2.0-flash-exp': { name: 'Gemini', color: '#4285f4', icon: '◇', shortName: 'Gemini' },
  'x-ai/grok-2-mini': { name: 'Grok', color: '#ffffff', icon: '✕', shortName: 'Grok' },
  'deepseek/deepseek-chat': { name: 'DeepSeek', color: '#6366f1', icon: '◈', shortName: 'DeepSeek' },
  // Fallback configs for different model names
  'openai': { name: 'GPT', color: '#10a37f', icon: '◯', shortName: 'GPT' },
  'anthropic': { name: 'Claude', color: '#d97706', icon: '◐', shortName: 'Claude' },
  'google': { name: 'Gemini', color: '#4285f4', icon: '◇', shortName: 'Gemini' },
  'x-ai': { name: 'Grok', color: '#ffffff', icon: '✕', shortName: 'Grok' },
  'deepseek': { name: 'DeepSeek', color: '#6366f1', icon: '◈', shortName: 'DeepSeek' },
};

/**
 * Get model display configuration from model ID.
 */
export function getModelConfig(modelId) {
  if (MODEL_CONFIG[modelId]) return MODEL_CONFIG[modelId];
  // Try to match by prefix
  const prefix = modelId?.split('/')[0];
  if (MODEL_CONFIG[prefix]) return MODEL_CONFIG[prefix];
  // Default fallback
  return { name: 'Model', color: '#6b7280', icon: '●', shortName: 'AI' };
}

/**
 * Default model list for display when no data available.
 */
export const DEFAULT_MODELS = [
  'deepseek/deepseek-v3.2',
  'anthropic/claude-sonnet-4.5',
  'google/gemini-3-flash-preview',
  'x-ai/grok-4-fast',
  'openai/gpt-5.2-chat',
];
