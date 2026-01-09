import { useState, useMemo } from 'react';
import DecisionOrbit from './DecisionOrbit';
import StageStatusBar from './StageStatusBar';
import DecisionConsole from './DecisionConsole';
import './AssemblyState.css';

/**
 * Get current stage from loading state
 */
function getCurrentStage(loading) {
  if (!loading) return null;
  if (loading.stage1) return 'stage1';
  if (loading.stage1_5) return 'stage1_5';
  if (loading.stage2) return 'stage2';
  if (loading.stage3) return 'stage3';
  return null;
}

/**
 * Assembly State - The input view of the Council Chamber.
 * Shows the orbiting LLMs above the decision console.
 *
 * The orbit is dimmed by default, lights up when the user
 * focuses the input, and starts orbiting when LLMs are answering.
 */
export default function AssemblyState({
  models,
  modelStatuses,
  onSubmit,
  isLoading,
  disabled,
  loading = null, // Loading state with stage flags
  mode = 'decide_please', // Current deliberation mode
}) {
  const [isInputActive, setIsInputActive] = useState(false);
  const [selectedMode, setSelectedMode] = useState(mode);

  // Determine current stage for display
  const currentStage = useMemo(() => getCurrentStage(loading), [loading]);

  // Handle submit with mode
  const handleSubmit = (content, submittedMode, files) => {
    setSelectedMode(submittedMode);
    onSubmit(content, submittedMode, files);
  };

  return (
    <div className="assembly-state">
      <DecisionOrbit
        models={models}
        modelStatuses={modelStatuses}
        loading={loading}
        isActive={isInputActive}
        isLoading={isLoading}
        mode={selectedMode}
        currentStage={currentStage}
      />

      <StageStatusBar
        mode={selectedMode}
        loading={loading}
        isVisible={isLoading}
      />

      <DecisionConsole
        onSubmit={handleSubmit}
        onFocusChange={setIsInputActive}
        isLoading={isLoading}
        disabled={disabled}
      />
    </div>
  );
}
