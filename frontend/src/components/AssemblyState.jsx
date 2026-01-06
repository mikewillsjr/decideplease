import CouncilArc from './CouncilArc';
import DecisionConsole from './DecisionConsole';
import './AssemblyState.css';

/**
 * Assembly State - The input view of the Council Chamber.
 * Shows the council arc above the decision console.
 */
export default function AssemblyState({
  models,
  modelStatuses,
  onSubmit,
  isLoading,
  disabled,
}) {
  return (
    <div className="assembly-state">
      <CouncilArc
        models={models}
        modelStatuses={modelStatuses}
        isLoading={isLoading}
      />

      <DecisionConsole
        onSubmit={onSubmit}
        isLoading={isLoading}
        disabled={disabled}
      />
    </div>
  );
}
