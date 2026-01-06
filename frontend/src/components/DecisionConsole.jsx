import { useState, useRef } from 'react';
import SpeedSelector from './SpeedSelector';
import FileUpload from './FileUpload';
import './DecisionConsole.css';

/**
 * Decision Console - The centered input card in Assembly State.
 * Features textarea, speed selector, file upload, and "Run Simulation" button.
 */
export default function DecisionConsole({
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = "Describe your dilemma. The Council will deliberate...",
}) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('standard');
  const [files, setFiles] = useState([]);
  const textareaRef = useRef(null);

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

  // Calculate credit cost
  const baseCost = mode === 'quick' ? 1 : mode === 'standard' ? 2 : 3;
  const fileCost = files.length > 0 ? 1 : 0;
  const totalCost = baseCost + fileCost;

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
          <div className="credit-info">
            <span className="credit-dot"></span>
            <span className="credit-text">
              {totalCost} Credit{totalCost !== 1 ? 's' : ''}
              {fileCost > 0 && <span className="file-cost"> (+1 for files)</span>}
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
