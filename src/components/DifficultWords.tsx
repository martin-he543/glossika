import { useState, useEffect, useCallback, useRef } from 'react';
import { Word } from '../types';
import { storage } from '../storage';
import KeyboardShortcuts from './KeyboardShortcuts';

interface DifficultWordsProps {
  courseId: string;
  words: Word[];
  onUpdate: () => void;
}

export default function DifficultWords({ courseId, words, onUpdate }: DifficultWordsProps) {
  const [mode, setMode] = useState<'multiple' | 'type'>('multiple');
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

  const generateOptions = (word: Word) => {
    const correctAnswer = direction === 'native-to-target' ? word.target : word.native;
    const otherWords = words
      .filter(w => w.id !== word.id)
      .map(w => direction === 'native-to-target' ? w.target : w.native)
      .filter((val, idx, arr) => arr.indexOf(val) === idx);

    const shuffled = otherWords.sort(() => Math.random() - 0.5);
    const wrongAnswers = shuffled.slice(0, 3);
    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
  };

  if (currentWord && mode === 'multiple' && options.length === 0) {
    generateOptions(currentWord);
  }

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
        // Multiple choice: 1-4 select options
        if (e.key >= '1' && e.key <= '4') {
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

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          className={`btn ${direction === 'native-to-target' ? 'btn-primary' : ''}`}
          onClick={() => setDirection('native-to-target')}
        >
          Native → Target
        </button>
        <button
          className={`btn ${direction === 'target-to-native' ? 'btn-primary' : ''}`}
          onClick={() => setDirection('target-to-native')}
        >
          Target → Native
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

