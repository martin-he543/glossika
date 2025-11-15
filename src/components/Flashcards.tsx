import { useState, useEffect, useCallback } from 'react';
import { Word } from '../types';
import { storage } from '../storage';
import { updateSRSLevel, getMasteryLevel, calculateNextReview, getWordsDueForReview } from '../utils/srs';
import { leaderboard } from '../utils/leaderboard';

interface FlashcardsProps {
  courseId: string;
  words: Word[];
  course?: { nativeLanguage: string; targetLanguage: string };
  onUpdate: () => void;
}

export default function Flashcards({ courseId, words, course, onUpdate }: FlashcardsProps) {
  const [flashcardWords, setFlashcardWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');
  const [reviewMode, setReviewMode] = useState<'due' | 'all'>('due');

  useEffect(() => {
    loadFlashcards();
  }, [words, reviewMode]);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  const loadFlashcards = () => {
    let wordsToReview = reviewMode === 'due' 
      ? getWordsDueForReview(words)
      : words.filter(w => w.srsLevel > 0);

    if (wordsToReview.length === 0) {
      wordsToReview = words; // Fallback to all words
    }

    wordsToReview = wordsToReview.sort(() => Math.random() - 0.5);
    setFlashcardWords(wordsToReview);
    setCurrentIndex(0);
  };

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleDifficulty = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'impossible') => {
    if (!isFlipped) return;

    const word = flashcardWords[currentIndex];
    if (!word) return;

    const newSrsLevel = updateSRSLevel(word, difficulty);
    const newMasteryLevel = getMasteryLevel(newSrsLevel);
    const nextReview = calculateNextReview(word, difficulty);

    storage.updateWord(word.id, {
      srsLevel: newSrsLevel,
      masteryLevel: newMasteryLevel,
      correctCount: word.correctCount + (difficulty === 'easy' || difficulty === 'medium' ? 1 : 0),
      wrongCount: word.wrongCount + (difficulty === 'hard' || difficulty === 'impossible' ? 1 : 0),
      nextReview,
      lastReviewed: Date.now(),
    });

    // Award XP for flashcard review
    leaderboard.awardFlashcardXP(courseId, newSrsLevel);

    onUpdate();

    // Move to next card
    if (currentIndex < flashcardWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      loadFlashcards();
    }
  }, [isFlipped, flashcardWords, currentIndex, onUpdate]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < flashcardWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      loadFlashcards();
    }
  }, [currentIndex, flashcardWords.length]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === '1') {
        e.preventDefault();
        handleDifficulty('easy');
      } else if (e.key === '2') {
        e.preventDefault();
        handleDifficulty('medium');
      } else if (e.key === '3') {
        e.preventDefault();
        handleDifficulty('hard');
      } else if (e.key === '4') {
        e.preventDefault();
        handleDifficulty('impossible');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleFlip, handlePrevious, handleNext, handleDifficulty]);

  if (flashcardWords.length === 0) {
    return (
      <div className="card">
        <h3>No flashcards available</h3>
        <p style={{ color: '#656d76', marginTop: '8px' }}>
          Learn some words first to create flashcards!
        </p>
      </div>
    );
  }

  const currentWord = flashcardWords[currentIndex];
  if (!currentWord) return <div className="loading">Loading...</div>;

  const frontText = direction === 'native-to-target' ? currentWord.native : currentWord.target;
  const backText = direction === 'native-to-target' ? currentWord.target : currentWord.native;

  return (
    <div>
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

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          className={`btn ${reviewMode === 'due' ? 'btn-primary' : ''}`}
          onClick={() => {
            setReviewMode('due');
            loadFlashcards();
          }}
        >
          Review Due
        </button>
        <button
          className={`btn ${reviewMode === 'all' ? 'btn-primary' : ''}`}
          onClick={() => {
            setReviewMode('all');
            loadFlashcards();
          }}
        >
          Review All
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '16px', color: '#656d76' }}>
        Card {currentIndex + 1} of {flashcardWords.length}
      </div>

      <div className="flashcard" onClick={handleFlip}>
        <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
          <div className="flashcard-front">
            <div className="flashcard-content">{frontText}</div>
          </div>
          <div className="flashcard-back">
            <div className="flashcard-content">{backText}</div>
          </div>
        </div>
      </div>

      <div className="keyboard-hint">
        Press <strong>Space</strong> to flip, <strong>←</strong> <strong>→</strong> to navigate
      </div>

      {isFlipped && (
        <div className="flashcard-actions">
          <button
            className="btn"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            ← Previous
          </button>
          <button
            className="btn"
            style={{ backgroundColor: '#2da44e', color: '#ffffff', borderColor: '#2da44e' }}
            onClick={() => handleDifficulty('easy')}
          >
            1 - Easy
          </button>
          <button
            className="btn"
            style={{ backgroundColor: '#0969da', color: '#ffffff', borderColor: '#0969da' }}
            onClick={() => handleDifficulty('medium')}
          >
            2 - Medium
          </button>
          <button
            className="btn"
            style={{ backgroundColor: '#fb8500', color: '#ffffff', borderColor: '#fb8500' }}
            onClick={() => handleDifficulty('hard')}
          >
            3 - Hard
          </button>
          <button
            className="btn"
            style={{ backgroundColor: '#da3633', color: '#ffffff', borderColor: '#da3633' }}
            onClick={() => handleDifficulty('impossible')}
          >
            4 - Impossible
          </button>
          <button
            className="btn"
            onClick={handleNext}
            disabled={currentIndex === flashcardWords.length - 1}
          >
            Next →
          </button>
        </div>
      )}

      {!isFlipped && (
        <div className="keyboard-hint" style={{ marginTop: '16px' }}>
          Click the card or press <strong>Space</strong> to reveal the answer
        </div>
      )}

      {isFlipped && (
        <div className="keyboard-hint" style={{ marginTop: '8px' }}>
          Press <strong>1</strong> Easy, <strong>2</strong> Medium, <strong>3</strong> Hard, <strong>4</strong> Impossible
        </div>
      )}
    </div>
  );
}

