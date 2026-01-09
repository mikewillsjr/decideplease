import { useState, useEffect, useCallback } from 'react';
import './WaitingGame.css';

// Decision-related words to unscramble (100+ words)
const WORDS = [
  // Core decision words
  { word: 'DECIDE', hint: 'Make a choice' },
  { word: 'WISDOM', hint: 'Knowledge applied well' },
  { word: 'CHOICE', hint: 'One of many options' },
  { word: 'COUNCIL', hint: 'Group of advisors' },
  { word: 'VERDICT', hint: 'Final judgment' },
  { word: 'INSIGHT', hint: 'Deep understanding' },
  { word: 'OPTION', hint: 'Alternative path' },
  { word: 'REASON', hint: 'Logic behind thinking' },
  { word: 'CLARITY', hint: 'Clear understanding' },
  { word: 'BALANCE', hint: 'Equal consideration' },
  { word: 'ANSWER', hint: 'Response to a question' },
  { word: 'DEBATE', hint: 'Discuss opposing views' },
  // Thinking & analysis
  { word: 'ANALYZE', hint: 'Examine in detail' },
  { word: 'PONDER', hint: 'Think deeply' },
  { word: 'REFLECT', hint: 'Think back on' },
  { word: 'CONSIDER', hint: 'Think carefully about' },
  { word: 'EVALUATE', hint: 'Assess the value' },
  { word: 'ASSESS', hint: 'Judge or estimate' },
  { word: 'COMPARE', hint: 'Note similarities' },
  { word: 'CONTRAST', hint: 'Note differences' },
  { word: 'EXAMINE', hint: 'Inspect closely' },
  { word: 'REVIEW', hint: 'Look over again' },
  { word: 'STUDY', hint: 'Learn in depth' },
  { word: 'RESEARCH', hint: 'Systematic inquiry' },
  { word: 'INQUIRE', hint: 'Ask questions' },
  { word: 'EXPLORE', hint: 'Investigate thoroughly' },
  { word: 'PROBE', hint: 'Investigate deeply' },
  { word: 'SCRUTINIZE', hint: 'Examine very closely' },
  // Logic & reasoning
  { word: 'LOGIC', hint: 'Systematic reasoning' },
  { word: 'DEDUCE', hint: 'Reach by reasoning' },
  { word: 'INFER', hint: 'Conclude from evidence' },
  { word: 'CONCLUDE', hint: 'Reach a decision' },
  { word: 'ASSUME', hint: 'Take for granted' },
  { word: 'HYPOTHESIZE', hint: 'Form a theory' },
  { word: 'THEOREM', hint: 'Proven statement' },
  { word: 'PREMISE', hint: 'Starting assumption' },
  { word: 'AXIOM', hint: 'Self-evident truth' },
  { word: 'PROOF', hint: 'Evidence of truth' },
  { word: 'EVIDENCE', hint: 'Supporting facts' },
  { word: 'FACT', hint: 'Verified truth' },
  { word: 'TRUTH', hint: 'What is real' },
  { word: 'VALID', hint: 'Logically sound' },
  // Judgment & outcomes
  { word: 'JUDGE', hint: 'Form an opinion' },
  { word: 'RULING', hint: 'Official decision' },
  { word: 'DECREE', hint: 'Authoritative order' },
  { word: 'RESOLVE', hint: 'Settle conclusively' },
  { word: 'SETTLE', hint: 'Reach agreement' },
  { word: 'OUTCOME', hint: 'Final result' },
  { word: 'RESULT', hint: 'Consequence' },
  { word: 'EFFECT', hint: 'Produced outcome' },
  { word: 'IMPACT', hint: 'Strong influence' },
  { word: 'CONSEQUENCE', hint: 'Result of action' },
  { word: 'CONCLUSION', hint: 'Final decision' },
  { word: 'SOLUTION', hint: 'Answer to problem' },
  { word: 'REMEDY', hint: 'Cure or fix' },
  // Strategy & planning
  { word: 'STRATEGY', hint: 'Plan of action' },
  { word: 'TACTICS', hint: 'Specific methods' },
  { word: 'PLAN', hint: 'Intended course' },
  { word: 'SCHEME', hint: 'Systematic plan' },
  { word: 'APPROACH', hint: 'Way of dealing' },
  { word: 'METHOD', hint: 'Systematic procedure' },
  { word: 'PROCESS', hint: 'Series of steps' },
  { word: 'PROCEDURE', hint: 'Established way' },
  { word: 'SYSTEM', hint: 'Organized method' },
  { word: 'FRAMEWORK', hint: 'Basic structure' },
  { word: 'MODEL', hint: 'Representation' },
  { word: 'BLUEPRINT', hint: 'Detailed plan' },
  // Risk & uncertainty
  { word: 'RISK', hint: 'Potential danger' },
  { word: 'GAMBLE', hint: 'Take a chance' },
  { word: 'HAZARD', hint: 'Source of danger' },
  { word: 'PERIL', hint: 'Serious danger' },
  { word: 'DANGER', hint: 'Possible harm' },
  { word: 'THREAT', hint: 'Potential menace' },
  { word: 'CHANCE', hint: 'Possibility' },
  { word: 'ODDS', hint: 'Probability ratio' },
  { word: 'PROBABILITY', hint: 'Likelihood' },
  { word: 'UNCERTAIN', hint: 'Not sure' },
  { word: 'DOUBT', hint: 'Feeling unsure' },
  { word: 'DILEMMA', hint: 'Difficult choice' },
  { word: 'QUANDARY', hint: 'State of perplexity' },
  { word: 'PREDICAMENT', hint: 'Difficult situation' },
  // Agreement & consensus
  { word: 'CONSENSUS', hint: 'General agreement' },
  { word: 'AGREEMENT', hint: 'Mutual understanding' },
  { word: 'ACCORD', hint: 'Harmony of opinion' },
  { word: 'HARMONY', hint: 'Agreement in feeling' },
  { word: 'UNITY', hint: 'State of oneness' },
  { word: 'ALLIANCE', hint: 'Union of parties' },
  { word: 'COALITION', hint: 'Temporary alliance' },
  { word: 'COMPROMISE', hint: 'Mutual concession' },
  { word: 'NEGOTIATE', hint: 'Discuss terms' },
  { word: 'MEDIATE', hint: 'Intervene to resolve' },
  { word: 'ARBITRATE', hint: 'Judge a dispute' },
  // Knowledge & understanding
  { word: 'KNOWLEDGE', hint: 'Acquired information' },
  { word: 'UNDERSTAND', hint: 'Grasp the meaning' },
  { word: 'COMPREHEND', hint: 'Fully understand' },
  { word: 'GRASP', hint: 'Seize mentally' },
  { word: 'PERCEIVE', hint: 'Become aware of' },
  { word: 'REALIZE', hint: 'Become fully aware' },
  { word: 'RECOGNIZE', hint: 'Identify as known' },
  { word: 'DISCERN', hint: 'Perceive distinctly' },
  { word: 'DISTINGUISH', hint: 'Tell apart' },
  { word: 'IDENTIFY', hint: 'Establish identity' },
  // AI & technology
  { word: 'ALGORITHM', hint: 'Step-by-step procedure' },
  { word: 'NEURAL', hint: 'Brain-like network' },
  { word: 'MACHINE', hint: 'Automated device' },
  { word: 'COMPUTE', hint: 'Calculate' },
  { word: 'PROCESS', hint: 'Handle data' },
  { word: 'OPTIMIZE', hint: 'Make best use' },
  { word: 'ITERATE', hint: 'Repeat process' },
  { word: 'CALIBRATE', hint: 'Adjust precisely' },
  { word: 'SIMULATE', hint: 'Imitate conditions' },
  { word: 'PREDICT', hint: 'Forecast outcome' },
  { word: 'FORECAST', hint: 'Estimate future' },
];

// Cryptographically secure random number generator
function secureRandom(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

// Shuffle letters in a word using secure randomness
function scrambleWord(word) {
  const letters = word.split('');
  // Fisher-Yates shuffle with crypto random
  for (let i = letters.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1);
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  // Make sure it's actually scrambled
  if (letters.join('') === word) {
    return scrambleWord(word);
  }
  return letters.join('');
}

/**
 * WaitingGame - Mini word scramble game during loading
 * Shows estimated time and gives users something fun to do
 */
export default function WaitingGame({
  mode = 'decide_please',
  elapsed = 0,
  onComplete,
}) {
  const [currentWord, setCurrentWord] = useState(null);
  const [scrambled, setScrambled] = useState('');
  const [guess, setGuess] = useState('');
  const [solved, setSolved] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Estimated times by mode (in seconds)
  const estimates = {
    // New mode names
    quick_decision: { min: 10, max: 25 },
    decide_please: { min: 30, max: 60 },
    decide_pretty_please: { min: 60, max: 120 },
    // Legacy mode names
    quick: { min: 10, max: 25 },
    standard: { min: 30, max: 60 },
    extra_care: { min: 60, max: 120 },
  };

  const estimate = estimates[mode] || estimates.decide_please;

  // Pick a new word using secure randomness
  const newWord = useCallback(() => {
    const word = WORDS[secureRandom(WORDS.length)];
    setCurrentWord(word);
    setScrambled(scrambleWord(word.word));
    setGuess('');
    setShowHint(false);
    setFeedback(null);
  }, []);

  // Initialize with a word
  useEffect(() => {
    newWord();
  }, [newWord]);

  // Handle guess submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentWord) return;

    if (guess.toUpperCase() === currentWord.word) {
      setSolved(s => s + 1);
      setFeedback('correct');
      setTimeout(() => {
        newWord();
      }, 800);
      onComplete?.();
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 500);
    }
  };

  // Calculate progress percentage
  const progress = Math.min(100, (elapsed / estimate.max) * 100);

  if (isMinimized) {
    return (
      <div className="waiting-game minimized" onClick={() => setIsMinimized(false)}>
        <span className="game-badge">
          {solved > 0 ? `${solved} solved` : 'Word Game'}
        </span>
        <span className="expand-hint">Click to play</span>
      </div>
    );
  }

  return (
    <div className="waiting-game">
      <div className="game-header">
        <div className="time-estimate">
          <div className="estimate-bar">
            <div className="estimate-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="estimate-text">
            Est. {estimate.min}-{estimate.max}s
            {elapsed > 0 && ` (${elapsed}s elapsed)`}
          </span>
        </div>
        <button
          className="minimize-btn"
          onClick={() => setIsMinimized(true)}
          title="Minimize"
        >
          −
        </button>
      </div>

      <div className="game-content">
        <div className="game-title">
          <span>Unscramble while you wait</span>
          {solved > 0 && <span className="solved-count">{solved} solved</span>}
        </div>

        <div className={`scrambled-word ${feedback || ''}`}>
          {scrambled.split('').map((letter, i) => (
            <span key={i} className="letter">{letter}</span>
          ))}
        </div>

        {showHint && currentWord && (
          <div className="hint">Hint: {currentWord.hint}</div>
        )}

        <form onSubmit={handleSubmit} className="guess-form">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value.toUpperCase())}
            placeholder="Your guess..."
            maxLength={currentWord?.word.length || 10}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" disabled={!guess.trim()}>
            Check
          </button>
        </form>

        <div className="game-actions">
          {!showHint && (
            <button className="hint-btn" onClick={() => setShowHint(true)}>
              Show Hint
            </button>
          )}
          <button className="skip-btn" onClick={newWord}>
            Skip Word
          </button>
        </div>
      </div>
    </div>
  );
}
