import { useState } from 'react';
import SpeedSelector from './SpeedSelector';
import './ChairpersonRemarks.css';

/**
 * Chairperson Remarks - Sticky footer bar for follow-up questions.
 * Appears after dossier is displayed, allows "Re-convening" the council.
 */
export default function ChairpersonRemarks({
  onSubmit,
  isLoading = false,
  disabled = false,
}) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('standard');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;

    onSubmit(input.trim(), mode, []);
    setInput('');
    setIsExpanded(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
    }
  };

  const canSubmit = input.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className={`chairperson-remarks ${isExpanded ? 'expanded' : ''} ${isLoading ? 'loading' : ''}`}>
      <form onSubmit={handleSubmit}>
        <div className="remarks-header">
          <span className="remarks-label">CHAIRPERSON'S REMARKS</span>
          {!isExpanded && (
            <button
              type="button"
              className="expand-btn"
              onClick={() => setIsExpanded(true)}
            >
              Add follow-up
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="remarks-body">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What additional context or questions do you have?"
              disabled={isLoading || disabled}
              rows={2}
              autoFocus
            />

            <div className="remarks-footer">
              <SpeedSelector
                selectedMode={mode}
                onModeChange={setMode}
                disabled={isLoading || disabled}
              />

              <div className="footer-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setIsExpanded(false);
                    setInput('');
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`reconvene-btn ${canSubmit ? 'ready' : ''}`}
                  disabled={!canSubmit}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      Deliberating...
                    </>
                  ) : (
                    'Re-convene Council'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
