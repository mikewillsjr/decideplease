import { useState, useRef, useEffect } from 'react';
import SpeedSelector from './SpeedSelector';
import FileUpload from './FileUpload';
import './DecisionConsole.css';

// Map run modes to quota field names
const MODE_TO_QUOTA_FIELD = {
  'quick_decision': 'quick_decision',
  'decide_please': 'standard_decision',
  'decide_pretty_please': 'premium_decision',
  // Legacy mappings
  'quick': 'quick_decision',
  'standard': 'standard_decision',
  'extra_care': 'premium_decision',
};

// Friendly names for display
const MODE_LABELS = {
  'quick_decision': 'Quick',
  'standard_decision': 'Standard',
  'premium_decision': 'Premium',
};

/**
 * Decision Console - The centered input card in Assembly State.
 * Features textarea, speed selector, file upload, and "Run Simulation" button.
 */
export default function DecisionConsole({
  onSubmit,
  onFocusChange, // Callback when focus state changes
  isLoading = false,
  disabled = false,
  placeholder = "Describe your dilemma. The Council will deliberate...",
  quotas = null, // New: per-type quotas from API
}) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('decide_please');
  const [files, setFiles] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);

  // Notify parent of focus changes
  useEffect(() => {
    onFocusChange?.(isFocused || input.length > 0);
  }, [isFocused, input, onFocusChange]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;

    onSubmit(input.trim(), mode, files);
    setInput('');
    setFiles([]);
  };

  const handleKeyDown = (e) => {
    // Enter to submit (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Get quota info for the current mode
  const quotaField = MODE_TO_QUOTA_FIELD[mode] || 'standard_decision';
  const quotaInfo = quotas?.[quotaField];
  const remaining = quotaInfo?.remaining ?? null;
  const modeLabel = MODE_LABELS[quotaField] || 'Standard';

  const canSubmit = input.trim().length > 0 && !isLoading && !disabled;

  return (
    <form className="decision-console" onSubmit={handleSubmit}>
      <div className="console-header">
        <span className="console-label">STRATEGIC DECISION CONSOLE</span>
        <span className="console-status">5 MODELS READY</span>
      </div>

      <div className="console-body">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isLoading || disabled}
          rows={4}
          className="console-textarea"
        />

        <FileUpload
          files={files}
          onFilesChange={setFiles}
          disabled={isLoading || disabled}
        />
      </div>

      <div className="console-footer">
        <div className="footer-left">
          <SpeedSelector
            selectedMode={mode}
            onModeChange={setMode}
            disabled={isLoading || disabled}
          />
        </div>

        <div className="footer-right">
          <div className="quota-info">
            <span className={`quota-dot ${remaining === 0 ? 'empty' : ''}`}></span>
            <span className="quota-text">
              {remaining === null ? (
                '...'
              ) : remaining > 0 ? (
                `${remaining} ${modeLabel} remaining`
              ) : (
                <span className="no-quota">No {modeLabel} remaining</span>
              )}
            </span>
          </div>

          <button
            type="submit"
            className={`run-button ${canSubmit ? 'ready' : ''} ${isLoading ? 'loading' : ''}`}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Deliberating...
              </>
            ) : (
              'Run Simulation'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
