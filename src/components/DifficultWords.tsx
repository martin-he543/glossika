import { useState, useEffect, useCallback, useRef } from 'react';
import { Word } from '../types';
import { storage } from '../storage';
import KeyboardShortcuts from './KeyboardShortcuts';

interface DifficultWordsProps {
  courseId: string;
  words: Word[];
  course?: { nativeLanguage: string; targetLanguage: string };
  onUpdate: () => void;
}

export default function DifficultWords({ courseId, words, course, onUpdate }: DifficultWordsProps) {
  const [mode, setMode] = useState<'multiple' | 'type'>('multiple');
  const [numOptions, setNumOptions] = useState<4 | 6>(4); // Number of multiple choice options
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');
  const inputRef = useRef<HTMLInputElement>(null);

  // Get difficult words (marked as difficult or with high wrong count)
  const difficultWords = words
    .filter(w => w.isDifficult || w.wrongCount > w.correctCount)
    .sort((a, b) => (b.wrongCount - b.correctCount) - (a.wrongCount - a.correctCount));

  const currentWord = difficultWords[currentIndex];

  // Generate harder distractors by finding similar words
  const generateOptions = (word: Word) => {
    const correctAnswer = direction === 'native-to-target' ? word.target : word.native;
    const correctAnswerLower = correctAnswer.toLowerCase().trim();
    
    // Get all other words (excluding current word and duplicates)
    const otherWords = words
      .filter(w => w.id !== word.id)
      .map(w => ({
        id: w.id,
        text: direction === 'native-to-target' ? w.target : w.native,
        native: w.native,
        target: w.target
      }))
      .filter((val, idx, arr) => 
        arr.findIndex(v => v.text.toLowerCase() === val.text.toLowerCase()) === idx
      )
      .filter(w => w.text.toLowerCase() !== correctAnswerLower);

    if (otherWords.length === 0) {
      // Fallback if no other words available
      setOptions([correctAnswer]);
      return;
    }

    // Score words by similarity to make distractors harder
    const scoredWords = otherWords.map(w => {
      const text = w.text.toLowerCase().trim();
      let score = 0;
      
      // Similar length (closer = higher score)
      const lengthDiff = Math.abs(text.length - correctAnswerLower.length);
      score += 10 / (1 + lengthDiff);
      
      // Similar starting characters
      const minStartLen = Math.min(text.length, correctAnswerLower.length, 3);
      let startMatch = 0;
      for (let i = 0; i < minStartLen; i++) {
        if (text[i] === correctAnswerLower[i]) startMatch++;
      }
      score += startMatch * 3;
      
      // Similar ending characters
      const minEndLen = Math.min(text.length, correctAnswerLower.length, 3);
      let endMatch = 0;
      for (let i = 1; i <= minEndLen; i++) {
        if (text[text.length - i] === correctAnswerLower[correctAnswerLower.length - i]) endMatch++;
      }
      score += endMatch * 3;
      
      // Shared characters (case-insensitive)
      const correctChars = new Set(correctAnswerLower);
      const textChars = new Set(text);
      let sharedChars = 0;
      correctChars.forEach(char => {
        if (textChars.has(char)) sharedChars++;
      });
      score += sharedChars * 2;
      
      // Prefer words that have been wrong before (they're confusing)
      const wordObj = words.find(wo => wo.id === w.id);
      if (wordObj && wordObj.wrongCount > wordObj.correctCount) {
        score += 5;
      }
      
      return { ...w, score };
    });

    // Sort by score (higher = more similar/confusing)
    scoredWords.sort((a, b) => b.score - a.score);
    
    // Take top distractors (need numOptions - 1 wrong answers)
    const numWrongAnswers = numOptions - 1;
    let selectedDistractors: typeof scoredWords = [];
    
    if (scoredWords.length <= numWrongAnswers) {
      // Not enough words, use all available
      selectedDistractors = [...scoredWords];
    } else {
      // Take top 60% of similar words, then randomly fill rest
      const topSimilar = scoredWords.slice(0, Math.ceil(scoredWords.length * 0.6));
      const remaining = scoredWords.slice(Math.ceil(scoredWords.length * 0.6));
      
      // Shuffle both arrays
      const shuffledTop = [...topSimilar].sort(() => Math.random() - 0.5);
      const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5);
      
      // Take from top similar first, then fill with remaining
      selectedDistractors = [
        ...shuffledTop.slice(0, Math.min(numWrongAnswers, shuffledTop.length)),
        ...shuffledRemaining.slice(0, numWrongAnswers - Math.min(numWrongAnswers, shuffledTop.length))
      ].slice(0, numWrongAnswers);
    }

    // Get the text values
    const wrongAnswers = selectedDistractors.map(w => w.text);
    
    // Combine with correct answer and shuffle
    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
  };

  // Regenerate options when word or settings change
  useEffect(() => {
    if (currentWord && mode === 'multiple') {
      generateOptions(currentWord);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord, mode, direction, numOptions]);

  const handleMultipleChoice = (answer: string) => {
    if (feedback) return;

    setSelectedAnswer(answer);
    const correctAnswer = direction === 'native-to-target' ? currentWord.target : currentWord.native;
    const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    if (isCorrect) {
      storage.updateWord(currentWord.id, {
        correctCount: currentWord.correctCount + 1,
      });
    } else {
      storage.updateWord(currentWord.id, {
        wrongCount: currentWord.wrongCount + 1,
        isDifficult: true,
      });
    }

    onUpdate();
  };

  const handleTypeAnswer = () => {
    if (feedback || !userInput.trim()) return;

    const correctAnswer = direction === 'native-to-target' ? currentWord.target : currentWord.native;
    const isCorrect = userInput.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    if (isCorrect) {
      storage.updateWord(currentWord.id, {
        correctCount: currentWord.correctCount + 1,
      });
    } else {
      storage.updateWord(currentWord.id, {
        wrongCount: currentWord.wrongCount + 1,
        isDifficult: true,
      });
    }

    onUpdate();
  };

  const handleNext = useCallback(() => {
    if (feedback) {
      setCurrentIndex((prev) => (prev + 1) % difficultWords.length);
      setSelectedAnswer('');
      setUserInput('');
      setFeedback(null);
      setOptions([]);
      // Auto-focus input after moving to next word in type mode
      setTimeout(() => {
        if (inputRef.current && mode === 'type') {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [feedback, difficultWords.length, mode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in input
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') return; // Allow Enter to submit
        return;
      }

      if (feedback) {
        // After feedback, Space goes to next
        if (e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      } else if (mode === 'multiple') {
        // Support up to 6 options (1-6 keys)
        if (e.key >= '1' && e.key <= '6') {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (options[index]) {
            handleMultipleChoice(options[index]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [feedback, mode, options, handleNext, handleMultipleChoice]);

  const toggleDifficult = (wordId: string, isDifficult: boolean) => {
    storage.updateWord(wordId, { isDifficult });
    onUpdate();
  };

  if (difficultWords.length === 0) {
    return (
      <div className="card">
        <h3>No difficult words</h3>
        <p style={{ color: '#656d76', marginTop: '8px' }}>
          Great job! You don't have any words marked as difficult. Words you get wrong frequently will appear here.
        </p>
      </div>
    );
  }

  if (!currentWord) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3>Difficult Words ({difficultWords.length})</h3>
        <p style={{ color: '#656d76', marginTop: '8px' }}>
          Practice words you've marked as difficult or gotten wrong frequently.
        </p>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          className={`btn ${mode === 'multiple' ? 'btn-primary' : ''}`}
          onClick={() => {
            setMode('multiple');
            setOptions([]);
          }}
        >
          Multiple Choice
        </button>
        <button
          className={`btn ${mode === 'type' ? 'btn-primary' : ''}`}
          onClick={() => setMode('type')}
        >
          Type Answer
        </button>
      </div>

      {mode === 'multiple' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">Number of Multiple Choice Options</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className={`btn ${numOptions === 4 ? 'btn-primary' : ''}`}
                onClick={() => {
                  setNumOptions(4);
                  setOptions([]); // Regenerate options with new count
                }}
                style={{ flex: 1 }}
              >
                4 Options
              </button>
              <button
                className={`btn ${numOptions === 6 ? 'btn-primary' : ''}`}
                onClick={() => {
                  setNumOptions(6);
                  setOptions([]); // Regenerate options with new count
                }}
                style={{ flex: 1 }}
              >
                6 Options
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
              Choose how many options you want in multiple choice questions. More options = harder challenge.
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          className={`btn ${direction === 'native-to-target' ? 'btn-primary' : ''}`}
          onClick={() => setDirection('native-to-target')}
        >
          {course ? `${course.nativeLanguage} → ${course.targetLanguage}` : 'Native → Target'}
        </button>
        <button
          className={`btn ${direction === 'target-to-native' ? 'btn-primary' : ''}`}
          onClick={() => setDirection('target-to-native')}
        >
          {course ? `${course.targetLanguage} → ${course.nativeLanguage}` : 'Target → Native'}
        </button>
      </div>

      <div className="quiz-container">
        <div style={{ textAlign: 'center', marginBottom: '16px', color: '#656d76' }}>
          Word {currentIndex + 1} of {difficultWords.length}
          <div style={{ marginTop: '8px' }}>
            Wrong: {currentWord.wrongCount} | Correct: {currentWord.correctCount}
          </div>
        </div>

        <div className="quiz-question">
          {direction === 'native-to-target' ? currentWord.native : currentWord.target}
        </div>

        {mode === 'multiple' ? (
          <div className="quiz-options">
            {options.map((option, idx) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option.toLowerCase().trim() === 
                (direction === 'native-to-target' ? currentWord.target : currentWord.native).toLowerCase().trim();
              
              let className = 'quiz-option';
              if (feedback) {
                if (isCorrect) className += ' correct';
                else if (isSelected && !isCorrect) className += ' incorrect';
              } else if (isSelected) {
                className += ' selected';
              }

              return (
                <button
                  key={idx}
                  className={className}
                  onClick={() => handleMultipleChoice(option)}
                  disabled={!!feedback}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <input
              ref={inputRef}
              type="text"
              className="quiz-input"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTypeAnswer()}
              placeholder="Type your answer..."
              disabled={!!feedback}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={handleTypeAnswer}
              disabled={!!feedback || !userInput.trim()}
              style={{ width: '100%' }}
            >
              Check Answer
            </button>
          </div>
        )}

        {feedback && (
          <div>
            <div className={`quiz-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
              {feedback.message}
            </div>
            <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%' }}>
              Next Word
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h4 style={{ marginBottom: '12px' }}>All Difficult Words</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {difficultWords.map(word => (
            <div
              key={word.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                border: '1px solid #d0d7de',
                borderRadius: '4px',
              }}
            >
              <div>
                <strong>{word.native}</strong> - {word.target}
                <div style={{ fontSize: '12px', color: '#656d76' }}>
                  Wrong: {word.wrongCount} | Correct: {word.correctCount}
                </div>
              </div>
              <button
                className="btn"
                onClick={() => toggleDifficult(word.id, !word.isDifficult)}
              >
                {word.isDifficult ? 'Remove from Difficult' : 'Mark as Difficult'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <KeyboardShortcuts mode={mode} hasFeedback={!!feedback} />
    </div>
  );
}

