import { useState, useEffect, useCallback } from 'react';
import { Word } from '../types';
import { storage } from '../storage';
import { updateSRSLevel, getMasteryLevel, calculateNextReview } from '../utils/srs';
import { leaderboard } from '../utils/leaderboard';
import KeyboardShortcuts from './KeyboardShortcuts';

interface SpeedReviewProps {
  courseId: string;
  words: Word[];
  course?: { nativeLanguage: string; targetLanguage: string };
  onUpdate: () => void;
}

export default function SpeedReview({ courseId, words, course, onUpdate }: SpeedReviewProps) {
  const [isActive, setIsActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0); // Will be set from timeMinutes
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [reviewWords, setReviewWords] = useState<Word[]>([]);
  const [timeMinutes, setTimeMinutes] = useState(5);
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');

  useEffect(() => {
    if (isActive && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isActive && countdown === 0 && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        if (timeLeft === 1) {
          endSession();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isActive, countdown, timeLeft]);

  const startSession = () => {
    const wordsToReview = words
      .filter(w => w.srsLevel > 0)
      .sort(() => Math.random() - 0.5);

    if (wordsToReview.length === 0) {
      alert('No words available for speed review. Learn some words first!');
      return;
    }

    setReviewWords(wordsToReview);
    setCountdown(3);
    setTimeLeft(timeMinutes * 60); // Convert minutes to seconds
    setScore(0);
    setTotal(0);
    setIsActive(true);
  };

  useEffect(() => {
    if (isActive && countdown === 0 && reviewWords.length > 0) {
      loadNextWord();
    }
  }, [isActive, countdown, reviewWords.length]);

  const loadNextWord = () => {
    if (reviewWords.length === 0) {
      endSession();
      return;
    }

    const randomWord = reviewWords[Math.floor(Math.random() * reviewWords.length)];
    setCurrentWord(randomWord);
    setSelectedAnswer('');
    generateOptions(randomWord);
  };

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

  const handleAnswer = (answer: string) => {
    if (!currentWord || selectedAnswer) return;

    const correctAnswer = direction === 'native-to-target' ? currentWord.target : currentWord.native;
    const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setSelectedAnswer(answer);
    setTotal(total + 1);

    if (isCorrect) {
      setScore(score + 1);
      updateWordProgress(true);
      
      // Move to next word immediately
      setTimeout(() => {
        loadNextWord();
      }, 300);
    } else {
      updateWordProgress(false);
      // Show feedback briefly, then move on
      setTimeout(() => {
        loadNextWord();
      }, 1000);
    }
  };

  const updateWordProgress = (isCorrect: boolean) => {
    if (!currentWord) return;

    const difficulty = isCorrect ? 'easy' : 'hard';
    const newSrsLevel = updateSRSLevel(currentWord, difficulty);
    const newMasteryLevel = getMasteryLevel(newSrsLevel);
    const nextReview = calculateNextReview(currentWord, difficulty);

    storage.updateWord(currentWord.id, {
      srsLevel: newSrsLevel,
      masteryLevel: newMasteryLevel,
      correctCount: currentWord.correctCount + (isCorrect ? 1 : 0),
      wrongCount: currentWord.wrongCount + (isCorrect ? 0 : 1),
      nextReview,
      lastReviewed: Date.now(),
    });

    // Award XP for speed review question
    leaderboard.awardSpeedReviewXP(courseId);

    onUpdate();
  };

  const endSession = () => {
    setIsActive(false);
    setCurrentWord(null);
  };

  // Keyboard shortcuts for speed review
  useEffect(() => {
    if (!isActive || countdown > 0 || !currentWord) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Multiple choice: 1-4 select options
      if (e.key >= '1' && e.key <= '4' && !selectedAnswer) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (options[index]) {
          handleAnswer(options[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive, countdown, currentWord, options, selectedAnswer, handleAnswer]);

  if (!isActive) {
    return (
      <div className="quiz-container">
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Speed Review</h2>
          <p style={{ color: '#656d76', marginBottom: '24px' }}>
            Test your vocabulary with a timed challenge!
          </p>

          <div className="form-group">
            <label className="form-label">Time (minutes)</label>
            <input
              type="number"
              className="input"
              value={timeMinutes}
              onChange={(e) => setTimeMinutes(Math.max(1, parseInt(e.target.value) || 5))}
              min={1}
              max={60}
            />
            <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
              How long do you want to review? (1-60 minutes)
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Direction</label>
            <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>

          {total > 0 && (
            <div className="card" style={{ marginBottom: '16px', backgroundColor: '#f6f8fa' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 600, color: '#0969da' }}>
                  {score} / {total}
                </div>
                <div style={{ color: '#656d76', marginTop: '4px' }}>
                  {total > 0 ? Math.round((score / total) * 100) : 0}% correct
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={startSession} style={{ width: '100%' }}>
            Start Speed Review
          </button>
        </div>
      </div>
    );
  }

  if (countdown > 0) {
    return (
      <div className="quiz-container">
        <div className="speed-review-timer">{countdown}</div>
        <div style={{ textAlign: 'center', fontSize: '18px', color: '#656d76' }}>
          Get ready!
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return <div className="loading">Loading...</div>;
  }

  const correctAnswer = direction === 'native-to-target' ? currentWord.target : currentWord.native;
  const isCorrect = selectedAnswer && selectedAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

  return (
    <div className="quiz-container">
      <div className="speed-review-timer">{timeLeft}s</div>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '18px', fontWeight: 600 }}>Score: {score} / {total}</span>
      </div>

      <div className="quiz-question">
        {direction === 'native-to-target' ? currentWord.native : currentWord.target}
      </div>

      <div className="quiz-options">
        {options.map((option, idx) => {
          let className = 'quiz-option';
          if (selectedAnswer) {
            if (option.toLowerCase().trim() === correctAnswer.toLowerCase().trim()) {
              className += ' correct';
            } else if (option === selectedAnswer && !isCorrect) {
              className += ' incorrect';
            }
          }

          return (
            <button
              key={idx}
              className={className}
              onClick={() => handleAnswer(option)}
              disabled={!!selectedAnswer}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selectedAnswer && !isCorrect && (
        <div className="quiz-feedback incorrect" style={{ marginTop: '16px' }}>
          Correct answer: {correctAnswer}
        </div>
      )}

      <KeyboardShortcuts mode="speed" hasFeedback={false} />
    </div>
  );
}

