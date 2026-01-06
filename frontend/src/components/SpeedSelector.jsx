import './SpeedSelector.css';

const SPEED_OPTIONS = [
  {
    mode: 'quick',
    label: 'Quick',
    credits: 1,
    description: 'Fast answer, no peer review',
    note: null,
  },
  {
    mode: 'standard',
    label: 'Standard',
    credits: 2,
    description: 'Full council with peer review',
    note: null,
  },
  {
    mode: 'extra_care',
    label: 'Extra Care',
    credits: 3,
    description: 'Premium models with cross-review refinement',
    note: 'Most thorough • Takes longer',
  },
];

export default function SpeedSelector({ selectedMode, onModeChange, disabled }) {
  return (
    <div className="speed-selector">
      {SPEED_OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          className={`speed-option ${selectedMode === option.mode ? 'selected' : ''} ${option.note ? 'has-note' : ''}`}
          onClick={() => onModeChange(option.mode)}
          disabled={disabled}
          title={option.description}
        >
          <span className="speed-label">{option.label}</span>
          <span className="speed-credits">{option.credits} cr</span>
          {option.note && <span className="speed-note">{option.note}</span>}
        </button>
      ))}
    </div>
  );
}

export { SPEED_OPTIONS };
