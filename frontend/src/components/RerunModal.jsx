import { useState } from 'react';
import SpeedSelector, { SPEED_OPTIONS } from './SpeedSelector';
import './RerunModal.css';

export default function RerunModal({ isOpen, onClose, onSubmit }) {
  const [newInput, setNewInput] = useState('');
  const [selectedMode, setSelectedMode] = useState('decide_please');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(newInput.trim() || null, selectedMode);
    setNewInput('');
    setSelectedMode('decide_please');
  };

  const getCredits = () => {
    const option = SPEED_OPTIONS.find(o => o.mode === selectedMode);
    return option ? option.credits : 2;
  };

  return (
    <div className="rerun-modal-overlay" onClick={onClose}>
      <div className="rerun-modal" onClick={e => e.stopPropagation()}>
        <div className="rerun-modal-header">
          <h3>Re-run this decision</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="rerun-modal-body">
            <label htmlFor="rerun-input">
              What changed, or what do you want to check again?
              <span className="optional-label">(You can leave this blank)</span>
            </label>
            <textarea
              id="rerun-input"
              className="rerun-input"
              placeholder="e.g. 'The budget increased to $50k' or 'What if we need to scale faster?'"
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              rows={3}
            />

            <div className="rerun-mode-section">
              <label>Select speed</label>
              <SpeedSelector
                selectedMode={selectedMode}
                onModeChange={setSelectedMode}
                disabled={false}
              />
            </div>

            <div className="rerun-hint">
              {newInput.trim() ? (
                <span className="hint-refinement">
                  Running as a <strong>refinement</strong> with your new input
                </span>
              ) : (
                <span className="hint-second-opinion">
                  Running as a <strong>second opinion</strong> on the same question
                </span>
              )}
            </div>
          </div>

          <div className="rerun-modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Run ({getCredits()} credits)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
