/**
 * ProgressRing - SVG circular progress indicator for model nodes.
 * Shows stage completion progress as a filling ring around the model icon.
 */
export default function ProgressRing({
  progress = 0, // 0-100 percentage
  size = 64,
  strokeWidth = 3,
  color = '#6366f1',
  isSpinning = false, // True when model is actively thinking
  className = '',
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg
      className={`progress-ring ${isSpinning ? 'spinning' : ''} ${className}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Background track */}
      <circle
        className="progress-ring-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
      />

      {/* Progress arc */}
      <circle
        className="progress-ring-progress"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: 'stroke-dashoffset 0.5s ease-out',
        }}
      />

      {/* Spinning indicator when actively thinking */}
      {isSpinning && (
        <circle
          className="progress-ring-spinner"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}
