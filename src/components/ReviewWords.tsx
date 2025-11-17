import { useState, useEffect, useCallback, useRef } from 'react';
import { Word } from '../types';
import { storage } from '../storage';
import { getWordsDueForReview, updateSRSLevel, getMasteryLevel, calculateNextReview } from '../utils/srs';
import { leaderboard } from '../utils/leaderboard';
import { recordStudyActivity } from '../utils/activityTracking';
import KeyboardShortcuts from './KeyboardShortcuts';
import QuestionCountSelector from './QuestionCountSelector';
import LessonSummary from './LessonSummary';

interface ReviewWordsProps {
  courseId: string;
  words: Word[];
  course?: { nativeLanguage: string; targetLanguage: string };
  onUpdate: () => void;
}

export default function ReviewWords({ courseId, words, course, onUpdate }: ReviewWordsProps) {
  const [reviewWords, setReviewWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'multiple' | 'type'>('multiple');
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');
  const [skipSprouting, setSkipSprouting] = useState(false);
  const [showQuestionSelector, setShowQuestionSelector] = useState(true);
  const [questionCount, setQuestionCount] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null); // Capture end time when session finishes
  const [newWordsLearned, setNewWordsLearned] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  // Don't auto-load when showing selector or summary
  useEffect(() => {
    if (!showQuestionSelector && !showSummary) {
      // Only load if we have a question count set
      if (questionCount > 0 && reviewWords.length === 0) {
        loadReviewWords(questionCount);
      }
    }
  }, [words, skipSprouting, showQuestionSelector, showSummary]);

  useEffect(() => {
    if (reviewWords.length > 0 && currentIndex < reviewWords.length) {
      loadCurrentWord();
    }
  }, [currentIndex, mode, direction, reviewWords]);

  const loadReviewWords = (limit?: number) => {
    let wordsToReview = getWordsDueForReview(words);
    
    if (skipSprouting) {
      // Include all words, not just due ones
      wordsToReview = words.filter(w => w.srsLevel > 0);
    }

    // Shuffle
    wordsToReview = wordsToReview.sort(() => Math.random() - 0.5);
    if (limit) {
      wordsToReview = wordsToReview.slice(0, limit);
    }
    setReviewWords(wordsToReview);
    setCurrentIndex(0);
  };

  const loadCurrentWord = () => {
    const word = reviewWords[currentIndex];
    if (!word) return;

    setSelectedAnswer('');
    setUserInput('');
    setFeedback(null);

    if (mode === 'multiple') {
      generateOptions(word);
    }

    // Auto-focus input when loading next word in type mode
    if (mode === 'type') {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
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

  const handleMultipleChoice = (answer: string) => {
    if (feedback) return;

    setSelectedAnswer(answer);
    const word = reviewWords[currentIndex];
    const correctAnswer = direction === 'native-to-target' ? word.target : word.native;
    const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    updateWordProgress(isCorrect);
  };

  const handleTypeAnswer = () => {
    if (feedback || !userInput.trim()) return;

    const word = reviewWords[currentIndex];
    const correctAnswer = direction === 'native-to-target' ? word.target : word.native;
    const isCorrect = userInput.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    updateWordProgress(isCorrect);
  };

  const updateWordProgress = (isCorrect: boolean) => {
    const word = reviewWords[currentIndex];
    if (!word) return;

    const wasNew = word.srsLevel === 0;
    const difficulty = isCorrect ? 'medium' : 'hard';
    const newSrsLevel = updateSRSLevel(word, difficulty);
    const newMasteryLevel = getMasteryLevel(newSrsLevel);
    const nextReview = calculateNextReview(word, difficulty);

    storage.updateWord(word.id, {
      srsLevel: newSrsLevel,
      masteryLevel: newMasteryLevel,
      correctCount: word.correctCount + (isCorrect ? 1 : 0),
      wrongCount: word.wrongCount + (isCorrect ? 0 : 1),
      nextReview,
      lastReviewed: Date.now(),
    });

    if (wasNew && isCorrect) {
      setNewWordsLearned(prev => prev + 1);
      // Award XP for learning a new word
      leaderboard.awardWordXP(courseId, newSrsLevel);
    } else if (!wasNew) {
      // Award XP for reviewing
      leaderboard.awardReviewXP(courseId, newSrsLevel);
    }

    recordStudyActivity(courseId, 1);
    setCorrectCount(prev => prev + (isCorrect ? 1 : 0));
    setQuestionsAnswered(prev => prev + 1);

    onUpdate();
  };

  const handleNext = useCallback(() => {
    if (feedback) {
      if (questionsAnswered >= questionCount) {
        // Show summary
        setEndTime(Date.now()); // Capture end time before showing summary
        setShowSummary(true);
      } else if (currentIndex < reviewWords.length - 1) {
        setCurrentIndex(currentIndex + 1);
        // Auto-focus input after moving to next word
        setTimeout(() => {
          if (inputRef.current && mode === 'type') {
            inputRef.current.focus();
          }
        }, 100);
      } else {
        // Finished review session
        setEndTime(Date.now()); // Capture end time before showing summary
        setShowSummary(true);
      }
    }
  }, [feedback, currentIndex, reviewWords.length, questionsAnswered, questionCount, mode]);

  const handleStart = (count: number) => {
    setQuestionCount(count);
    setShowQuestionSelector(false);
    setStartTime(Date.now());
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewWordsLearned(0);
    loadReviewWords(count);
  };

  const handleSummaryClose = () => {
    setShowSummary(false);
    setShowQuestionSelector(true);
    setQuestionCount(0);
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewWordsLearned(0);
    setCurrentIndex(0);
    setReviewWords([]);
  };

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

  const renderGarden = () => {
    const masteryCounts = {
      seed: words.filter(w => w.masteryLevel === 'seed').length,
      sprout: words.filter(w => w.masteryLevel === 'sprout').length,
      seedling: words.filter(w => w.masteryLevel === 'seedling').length,
      plant: words.filter(w => w.masteryLevel === 'plant').length,
      tree: words.filter(w => w.masteryLevel === 'tree').length,
    };

    return (
      <div className="garden">
        {words.map((word, idx) => (
          <div
            key={word.id}
            className={`garden-item ${word.masteryLevel}`}
            title={`${word.native} - ${word.target} (${word.masteryLevel})`}
          >
            {word.masteryLevel === 'seed' && '🌱'}
            {word.masteryLevel === 'sprout' && '🌿'}
            {word.masteryLevel === 'seedling' && '🌱'}
            {word.masteryLevel === 'plant' && '🌳'}
            {word.masteryLevel === 'tree' && '🌲'}
          </div>
        ))}
      </div>
    );
  };

  if (showQuestionSelector) {
    const availableWords = skipSprouting 
      ? words.filter(w => w.srsLevel > 0)
      : getWordsDueForReview(words);
    return (
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
          <input
            type="checkbox"
            checked={skipSprouting}
            onChange={(e) => setSkipSprouting(e.target.checked)}
          />
          Review all words (skip sprouting process)
        </label>
        {availableWords.length === 0 ? (
          <div className="card">
            <h3>No words to review</h3>
            <p style={{ color: '#656d76', marginTop: '8px' }}>
              All words are up to date! Check back later or learn new words.
            </p>
          </div>
        ) : (
          <QuestionCountSelector
            maxQuestions={availableWords.length}
            defaultCount={Math.min(20, availableWords.length)}
            onStart={handleStart}
            onCancel={() => {}}
          />
        )}
        {renderGarden()}
      </div>
    );
  }

  if (showSummary) {
    const timeElapsed = startTime && endTime ? Math.floor((endTime - startTime) / 1000) : (startTime ? Math.floor((Date.now() - startTime) / 1000) : 0);
    return (
      <div>
        <LessonSummary
          correct={correctCount}
          total={questionsAnswered}
          timeElapsed={timeElapsed}
          newWordsLearned={newWordsLearned}
          onClose={handleSummaryClose}
        />
        {renderGarden()}
      </div>
    );
  }

  if (reviewWords.length === 0) {
    return (
      <div>
        <div className="card">
          <h3>No words to review</h3>
          <p style={{ color: '#656d76', marginTop: '8px' }}>
            All words are up to date! Check back later or learn new words.
          </p>
        </div>
        {renderGarden()}
      </div>
    );
  }

  const currentWord = reviewWords[currentIndex];
  if (!currentWord) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          className={`btn ${mode === 'multiple' ? 'btn-primary' : ''}`}
          onClick={() => setMode('multiple')}
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
          Question {questionsAnswered + 1} of {questionCount} ({reviewWords.length - currentIndex} words remaining)
        </div>

        <div className="quiz-question">
          {direction === 'native-to-target' ? currentWord.native : currentWord.target}
          {currentWord.partOfSpeech && (
            <div style={{ fontSize: '14px', color: '#656d76', fontStyle: 'italic', marginTop: '8px' }}>
              {currentWord.partOfSpeech}
            </div>
          )}
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
              {currentIndex < reviewWords.length - 1 ? 'Next Word' : 'Finish Review'}
            </button>
          </div>
        )}
      </div>

      {renderGarden()}

      <KeyboardShortcuts mode={mode} hasFeedback={!!feedback} />
    </div>
  );
}

