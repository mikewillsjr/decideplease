import { useState, useEffect, useCallback } from 'react';
import './WaitingGame.css';

// Decision-related words to unscramble
const WORDS = [
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
];

// Shuffle letters in a word
function scrambleWord(word) {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
  mode = 'standard',
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
    quick: { min: 10, max: 25 },
    standard: { min: 30, max: 60 },
    extra_care: { min: 60, max: 120 },
  };

  const estimate = estimates[mode] || estimates.standard;

  // Pick a new word
  const newWord = useCallback(() => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
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
