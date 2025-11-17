import { useState, useEffect, useCallback, useRef } from 'react';
import { Word } from '../types';
import { storage } from '../storage';
import { updateSRSLevel, getMasteryLevel, calculateNextReview } from '../utils/srs';
import { leaderboard } from '../utils/leaderboard';
import { recordStudyActivity } from '../utils/activityTracking';
import KeyboardShortcuts from './KeyboardShortcuts';
import QuestionCountSelector from './QuestionCountSelector';
import LessonSummary from './LessonSummary';

interface LearnWordsProps {
  courseId: string;
  words: Word[];
  course?: { nativeLanguage: string; targetLanguage: string };
  onUpdate: () => void;
}

export default function LearnWords({ courseId, words, course, onUpdate }: LearnWordsProps) {
  const [mode, setMode] = useState<'multiple' | 'type'>('multiple');
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');
  const [showQuestionSelector, setShowQuestionSelector] = useState(true);
  const [questionCount, setQuestionCount] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null); // Capture end time when session finishes
  const [newWordsLearned, setNewWordsLearned] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get words that haven't been learned yet (srsLevel === 0)
  const newWords = words.filter(w => w.srsLevel === 0);
  const learnedWords = words.filter(w => w.srsLevel > 0);

  useEffect(() => {
    if (!showQuestionSelector && !showSummary && newWords.length > 0 && questionCount > 0) {
      if (!currentWord) {
        loadNextWord();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, direction, showQuestionSelector, showSummary, questionCount]);

  const loadNextWord = () => {
    if (newWords.length === 0) {
      setCurrentWord(null);
      return;
    }

    const randomWord = newWords[Math.floor(Math.random() * newWords.length)];
    setCurrentWord(randomWord);
    setSelectedAnswer('');
    setUserInput('');
    setFeedback(null);

    if (mode === 'multiple') {
      generateOptions(randomWord);
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
    // Always include the correct answer
    const correctAnswer = direction === 'native-to-target' ? word.target : word.native;
    const otherWords = words
      .filter(w => w.id !== word.id)
      .map(w => direction === 'native-to-target' ? w.target : w.native)
      .filter((val, idx, arr) => arr.indexOf(val) === idx); // Remove duplicates

    // Shuffle and take 3 random wrong answers
    const shuffled = otherWords.sort(() => Math.random() - 0.5);
    const wrongAnswers = shuffled.slice(0, 3);

    // Combine and shuffle
    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    setOptions(allOptions);
  };

  const handleMultipleChoice = (answer: string) => {
    if (feedback) return; // Already answered

    setSelectedAnswer(answer);
    const correctAnswer = direction === 'native-to-target' 
      ? currentWord!.target 
      : currentWord!.native;

    const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    
    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    updateWordProgress(isCorrect);
  };

  const handleTypeAnswer = () => {
    if (feedback || !userInput.trim()) return;

    const correctAnswer = direction === 'native-to-target' 
      ? currentWord!.target 
      : currentWord!.native;

    const isCorrect = userInput.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    
    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${correctAnswer}"`,
    });

    updateWordProgress(isCorrect);
  };

  const updateWordProgress = (isCorrect: boolean) => {
    if (!currentWord) return;

    const wasNew = currentWord.srsLevel === 0;
    const newSrsLevel = isCorrect ? 1 : 0;
    const newMasteryLevel = getMasteryLevel(newSrsLevel);
    const nextReview = calculateNextReview(
      { ...currentWord, srsLevel: newSrsLevel },
      isCorrect ? 'medium' : 'impossible'
    );

    storage.updateWord(currentWord.id, {
      srsLevel: newSrsLevel,
      masteryLevel: newMasteryLevel,
      correctCount: currentWord.correctCount + (isCorrect ? 1 : 0),
      wrongCount: currentWord.wrongCount + (isCorrect ? 0 : 1),
      nextReview,
      lastReviewed: Date.now(),
    });

    if (wasNew && isCorrect) {
      setNewWordsLearned(prev => prev + 1);
      // Award XP for learning a new word
      leaderboard.awardWordXP(courseId);
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
      } else {
        loadNextWord();
        // Auto-focus input after loading next word
        setTimeout(() => {
          if (inputRef.current && mode === 'type') {
            inputRef.current.focus();
          }
        }, 100);
      }
    }
  }, [feedback, questionsAnswered, questionCount, mode]);

  const handleStart = (count: number) => {
    setQuestionCount(count);
    setShowQuestionSelector(false);
    setStartTime(Date.now());
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewWordsLearned(0);
    if (newWords.length > 0) {
      loadNextWord();
    }
  };

  const handleSummaryClose = () => {
    setShowSummary(false);
    setShowQuestionSelector(true);
    setQuestionCount(0);
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewWordsLearned(0);
    setCurrentWord(null);
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
  }, [feedback, mode, options, handleNext]);

  if (showQuestionSelector) {
    return (
      <QuestionCountSelector
        maxQuestions={newWords.length}
        defaultCount={Math.min(20, newWords.length)}
        onStart={handleStart}
        onCancel={() => {}}
      />
    );
  }

  if (showSummary) {
    const timeElapsed = startTime && endTime ? Math.floor((endTime - startTime) / 1000) : (startTime ? Math.floor((Date.now() - startTime) / 1000) : 0);
    return (
      <LessonSummary
        correct={correctCount}
        total={questionsAnswered}
        timeElapsed={timeElapsed}
        newWordsLearned={newWordsLearned}
        onClose={handleSummaryClose}
      />
    );
  }

  if (newWords.length === 0) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <h2>All words learned!</h2>
          <p style={{ color: '#656d76', marginTop: '8px' }}>
            You've learned all {words.length} words. Try the Review section to strengthen your memory.
          </p>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="quiz-container">
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
          {course ? `${course.nativeLanguage} → ${course.targetLanguage}` : (words[0]?.native || 'Native') + ' → ' + (words[0]?.target || 'Target')}
        </button>
        <button
          className={`btn ${direction === 'target-to-native' ? 'btn-primary' : ''}`}
          onClick={() => setDirection('target-to-native')}
        >
          {course ? `${course.targetLanguage} → ${course.nativeLanguage}` : (words[0]?.target || 'Target') + ' → ' + (words[0]?.native || 'Native')}
        </button>
      </div>

      <div className="quiz-question">
        {direction === 'native-to-target' ? currentWord.native : currentWord.target}
        {currentWord.partOfSpeech && (
          <span style={{
            display: 'inline-block',
            marginLeft: '12px',
            padding: '4px 8px',
            backgroundColor: '#0969da',
            color: '#ffffff',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 500
          }}>
            {currentWord.partOfSpeech}
          </span>
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
            <div>{feedback.message}</div>
            {currentWord.pronunciation && direction === 'native-to-target' && (
              <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px', fontStyle: 'italic' }}>
                {currentWord.pronunciation}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%' }}>
            Next Word
          </button>
        </div>
      )}

      <div style={{ marginTop: '24px', textAlign: 'center', color: '#656d76' }}>
        Question {questionsAnswered + 1} of {questionCount} ({newWords.length - questionsAnswered} words remaining)
      </div>

      <KeyboardShortcuts mode={mode} hasFeedback={!!feedback} />
    </div>
  );
}

