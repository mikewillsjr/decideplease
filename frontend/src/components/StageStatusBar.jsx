import './StageStatusBar.css';

/**
 * Stage configuration by mode
 */
const STAGE_CONFIG = {
  quick_decision: [
    { id: 'stage1', name: 'Gathering Opinions' },
    { id: 'stage3', name: 'Synthesizing' },
  ],
  decide_please: [
    { id: 'stage1', name: 'Gathering Opinions' },
    { id: 'stage2', name: 'Peer Review' },
    { id: 'stage3', name: 'Synthesizing' },
  ],
  decide_pretty_please: [
    { id: 'stage1', name: 'Gathering Opinions' },
    { id: 'stage1_5', name: 'Cross-Examination' },
    { id: 'stage2', name: 'Peer Review' },
    { id: 'stage3', name: 'Synthesizing' },
  ],
};

/**
 * Get stage status based on loading state
 * @returns 'completed' | 'active' | 'upcoming'
 */
function getStageStatus(stageId, loading) {
  if (!loading) return 'upcoming';

  // Check if this stage is actively loading
  const isActive = loading[stageId] === true;
  if (isActive) return 'active';

  // Check if this stage is complete (was true, now false)
  // We determine completion by checking if later stages are active
  const stageOrder = ['stage1', 'stage1_5', 'stage2', 'stage3'];
  const currentIndex = stageOrder.indexOf(stageId);

  // Find the currently active stage
  let activeIndex = -1;
  for (let i = 0; i < stageOrder.length; i++) {
    if (loading[stageOrder[i]] === true) {
      activeIndex = i;
      break;
    }
  }

  // If we're before the active stage, we're complete
  if (activeIndex > currentIndex) return 'completed';

  // If no active stage but we have loading data, check if all done
  if (activeIndex === -1 && loading.stage3 === false) {
    return 'completed';
  }

  return 'upcoming';
}

/**
 * StageStatusBar - Horizontal stepper showing deliberation progress.
 *
 * Displays stages based on selected mode:
 * - Quick Decision: 2 stages
 * - Decide Please: 3 stages
 * - Decide Pretty Please: 4 stages
 *
 * Each stage shows: ✓ (completed) | • (active) | ○ (upcoming)
 */
export default function StageStatusBar({
  mode = 'decide_please',
  loading = null,
  isVisible = false, // Only show when deliberation is active
}) {
  if (!isVisible) return null;

  const stages = STAGE_CONFIG[mode] || STAGE_CONFIG.decide_please;

  return (
    <div className="stage-status-bar">
      {stages.map((stage, index) => {
        const status = getStageStatus(stage.id, loading);
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.id} className="stage-item-wrapper">
            <div className={`stage-item ${status}`}>
              <div className="stage-indicator">
                {status === 'completed' && <span className="checkmark">✓</span>}
                {status === 'active' && <span className="dot active-dot"></span>}
                {status === 'upcoming' && <span className="dot"></span>}
              </div>
              <span className="stage-name">{stage.name}</span>
            </div>

            {!isLast && (
              <div className={`stage-connector ${status === 'completed' ? 'completed' : ''}`}>
                <span className="connector-line"></span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
