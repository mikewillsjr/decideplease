import './SpeedSelector.css';

const SPEED_OPTIONS = [
  {
    mode: 'quick',
    label: 'Quick',
    credits: 1,
    description: 'Fast answer, no peer review',
  },
  {
    mode: 'standard',
    label: 'Standard',
    credits: 2,
    description: 'Full council with peer review',
  },
  {
    mode: 'extra_care',
    label: 'Extra Care',
    credits: 3,
    description: 'Premium models, thorough review',
  },
];

export default function SpeedSelector({ selectedMode, onModeChange, disabled }) {
  return (
    <div className="speed-selector">
      {SPEED_OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          className={`speed-option ${selectedMode === option.mode ? 'selected' : ''}`}
          onClick={() => onModeChange(option.mode)}
          disabled={disabled}
          title={option.description}
        >
          <span className="speed-label">{option.label}</span>
          <span className="speed-credits">{option.credits} cr</span>
        </button>
      ))}
    </div>
  );
}

export { SPEED_OPTIONS };
