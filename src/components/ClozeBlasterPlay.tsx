/**
 * ClozeBlaster Play Screen Component
 * Implements Clozemaster-style gameplay with multiple modes
 */

import { useState, useEffect, useCallback } from 'react';
import KeyboardShortcuts from './KeyboardShortcuts';
import QuestionCountSelector from './QuestionCountSelector';
import LessonSummary from './LessonSummary';

interface ClozeItem {
  id: number;
  sentenceId: number;
  clozeWord: string;
  maskedText: string;
  textNative: string;
  textTarget: string;
  difficulty: string;
  distractors: string[];
  audioUrl?: string;
  progress: {
    masteryPercent: number;
    srsStage: number;
    nextReviewAt: string;
    correctCount: number;
    incorrectCount: number;
  };
}

interface ClozeBlasterPlayProps {
  language: string;
  mode: 'mc' | 'input' | 'listen';
  collectionId?: number;
  apiBaseUrl?: string;
  authToken?: string;
}

export default function ClozeBlasterPlay({
  language,
  mode: initialMode,
  collectionId,
  apiBaseUrl = 'http://localhost:3001/api',
  authToken
}: ClozeBlasterPlayProps) {
  const [currentItem, setCurrentItem] = useState<ClozeItem | null>(null);
  const [items, setItems] = useState<ClozeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(true);
  const [questionCount, setQuestionCount] = useState(20);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [newItemsLearned, setNewItemsLearned] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Load items from API
  const loadItems = useCallback(async (count: number) => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(`${apiBaseUrl}/play/new`);
      url.searchParams.set('language', language);
      url.searchParams.set('mode', initialMode);
      url.searchParams.set('limit', count.toString());
      if (collectionId) {
        url.searchParams.set('collection_id', collectionId.toString());
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load items');
      }

      const data = await response.json();
      setItems(data.items || []);
      if (data.items && data.items.length > 0) {
        setCurrentItem(data.items[0]);
        setCurrentIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [language, initialMode, collectionId, apiBaseUrl, authToken]);

  // Submit answer
  const submitAnswer = useCallback(async (answer: string) => {
    if (!currentItem || feedback) return;

    const startTimeMs = Date.now();
    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/play/answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cloze_item_id: currentItem.id,
          answer,
          time_ms: startTimeMs
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();
      const isCorrect = data.correct;

      setFeedback({
        correct: isCorrect,
        message: isCorrect
          ? 'Correct!'
          : `Incorrect. The answer is "${data.correctAnswer}"`
      });

      if (isCorrect) {
        setCorrectCount(prev => prev + 1);
        if (currentItem.progress.masteryPercent === 0) {
          setNewItemsLearned(prev => prev + 1);
        }
      }

      setQuestionsAnswered(prev => prev + 1);

      // Update current item progress
      setCurrentItem(prev => prev ? {
        ...prev,
        progress: {
          ...prev.progress,
          masteryPercent: data.newMastery,
          nextReviewAt: data.nextReviewAt,
          correctCount: prev.progress.correctCount + (isCorrect ? 1 : 0),
          incorrectCount: prev.progress.incorrectCount + (isCorrect ? 0 : 1)
        }
      } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setLoading(false);
    }
  }, [currentItem, feedback, apiBaseUrl, authToken]);

  // Handle next
  const handleNext = useCallback(() => {
    if (feedback) {
      if (questionsAnswered >= questionCount || currentIndex >= items.length - 1) {
        setShowSummary(true);
      } else {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setCurrentItem(items[nextIndex]);
        setSelectedAnswer('');
        setUserInput('');
        setFeedback(null);
      }
    }
  }, [feedback, questionsAnswered, questionCount, currentIndex, items]);

  // Handle start
  const handleStart = (count: number) => {
    setQuestionCount(count);
    setShowQuestionSelector(false);
    setStartTime(Date.now());
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewItemsLearned(0);
    loadItems(count);
  };

  // Handle summary close
  const handleSummaryClose = () => {
    setShowSummary(false);
    setShowQuestionSelector(true);
    setQuestionCount(20);
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewItemsLearned(0);
    setCurrentItem(null);
    setItems([]);
    setCurrentIndex(0);
  };

  // Play audio (TTS)
  const playAudio = useCallback(() => {
    if (!currentItem || audioPlaying) return;

    const text = direction === 'native-to-target' 
      ? currentItem.textTarget 
      : currentItem.textNative;

    if ('speechSynthesis' in window) {
      setAudioPlaying(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.onend = () => setAudioPlaying(false);
      utterance.onerror = () => setAudioPlaying(false);
      window.speechSynthesis.speak(utterance);
    }
  }, [currentItem, direction, language, audioPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    if (showQuestionSelector || showSummary) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) {
        if (e.key === 'Enter') return;
        return;
      }

      if (feedback) {
        if (e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      } else if (initialMode === 'mc' && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (currentItem && currentItem.distractors[index]) {
          submitAnswer(currentItem.distractors[index]);
        }
      } else if (initialMode === 'input' && e.key === 'Enter' && userInput.trim()) {
        e.preventDefault();
        submitAnswer(userInput);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [feedback, initialMode, currentItem, userInput, showQuestionSelector, showSummary, handleNext, submitAnswer]);

  if (showQuestionSelector) {
    return (
      <div>
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Practice Direction</label>
            <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>
        </div>
        <QuestionCountSelector
          maxQuestions={100}
          defaultCount={questionCount}
          onStart={handleStart}
          onCancel={() => {}}
        />
      </div>
    );
  }

  if (showSummary) {
    const timeElapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    return (
      <LessonSummary
        correct={correctCount}
        total={questionsAnswered}
        timeElapsed={timeElapsed}
        newWordsLearned={newItemsLearned}
        onClose={handleSummaryClose}
      />
    );
  }

  if (loading && !currentItem) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">{error}</div>
        <button className="btn btn-primary" onClick={() => loadItems(questionCount)}>
          Retry
        </button>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="card">
        <p>No items available. Try a different language or collection.</p>
      </div>
    );
  }

  const displayText = direction === 'native-to-target' 
    ? currentItem.textNative 
    : currentItem.textTarget;
  const clozeText = direction === 'native-to-target'
    ? currentItem.maskedText
    : currentItem.maskedText; // TODO: Generate native cloze

  return (
    <div className="quiz-container">
      <div style={{ textAlign: 'center', marginBottom: '16px', color: '#656d76' }}>
        Question {questionsAnswered + 1} of {questionCount} • Mastery: {currentItem.progress.masteryPercent}%
      </div>

      {initialMode === 'listen' && (
        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
          <button
            className="btn"
            onClick={playAudio}
            disabled={audioPlaying}
          >
            {audioPlaying ? 'Playing...' : '🔊 Play Audio'}
          </button>
        </div>
      )}

      <div className="quiz-question">
        <div style={{ fontSize: '20px', marginBottom: '16px' }}>
          {displayText}
        </div>
        <div style={{ fontSize: '24px', color: '#24292f', fontWeight: 'bold' }}>
          {clozeText}
        </div>
      </div>

      {initialMode === 'mc' && (
        <div className="quiz-options">
          {currentItem.distractors.map((option, idx) => (
            <button
              key={idx}
              className={`btn quiz-option ${selectedAnswer === option ? 'selected' : ''}`}
              onClick={() => {
                if (!feedback) {
                  setSelectedAnswer(option);
                  submitAnswer(option);
                }
              }}
              disabled={!!feedback}
            >
              {idx + 1}. {option}
            </button>
          ))}
        </div>
      )}

      {initialMode === 'input' && (
        <>
          <input
            type="text"
            className="quiz-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !feedback && submitAnswer(userInput)}
            placeholder="Type your answer..."
            disabled={!!feedback}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={() => submitAnswer(userInput)}
            disabled={!userInput.trim() || !!feedback}
            style={{ width: '100%', marginTop: '8px' }}
          >
            Check Answer
          </button>
        </>
      )}

      {feedback && (
        <div>
          <div className={`quiz-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
            {feedback.message}
          </div>
          <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%', marginTop: '8px' }}>
            Next Question
          </button>
        </div>
      )}

      <KeyboardShortcuts 
        mode={initialMode === 'mc' ? 'multiple' : 'type'} 
        hasFeedback={!!feedback} 
      />
    </div>
  );
}

