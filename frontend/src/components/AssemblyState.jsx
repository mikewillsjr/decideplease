import { useState } from 'react';
import CouncilArc from './CouncilArc';
import DecisionConsole from './DecisionConsole';
import './AssemblyState.css';

/**
 * Assembly State - The input view of the Council Chamber.
 * Shows the council arc above the decision console.
 *
 * The arc is dimmed by default and lights up when the user
 * focuses the input - signaling "the team is listening".
 */
export default function AssemblyState({
  models,
  modelStatuses,
  onSubmit,
  isLoading,
  disabled,
}) {
  const [isInputActive, setIsInputActive] = useState(false);

  return (
    <div className="assembly-state">
      <CouncilArc
        models={models}
        modelStatuses={modelStatuses}
        isLoading={isLoading}
        isActive={isInputActive}
      />

      <DecisionConsole
        onSubmit={onSubmit}
        onFocusChange={setIsInputActive}
        isLoading={isLoading}
        disabled={disabled}
      />
    </div>
  );
}
