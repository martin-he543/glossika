import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppState, ClozeCourse, ClozeSentence } from '../types';
import { storage } from '../storage';
import { leaderboard } from '../utils/leaderboard';
import { updateClozeSRS } from '../utils/clozeSRS';
import { recordStudyActivity } from '../utils/activityTracking';
import KeyboardShortcuts from './KeyboardShortcuts';
import QuestionCountSelector from './QuestionCountSelector';
import LessonSummary from './LessonSummary';
import ClozeCourseSettings from './ClozeCourseSettings';
import StreakDisplay from './StreakDisplay';

interface ClozeCourseDetailProps {
  course: ClozeCourse;
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onBack: () => void;
}

export default function ClozeCourseDetail({ course, appState, updateState, onBack }: ClozeCourseDetailProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'practice' | 'library' | 'statistics'>('practice');
  const [activeMode, setActiveMode] = useState<'continue' | 'learn' | 'review' | 'speed' | 'flashcards' | 'difficult' | null>(null);
  const [currentSentence, setCurrentSentence] = useState<ClozeSentence | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [newSentencesLearned, setNewSentencesLearned] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [practiceSentences, setPracticeSentences] = useState<ClozeSentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streakKey, setStreakKey] = useState(0); // Force StreakDisplay to refresh

  const sentences = appState.clozeSentences.filter(s => s.courseId === course.id);
  const availableSentences = sentences.filter(s => s.masteryLevel !== 'tree');
  const newSentences = sentences.filter(s => s.masteryLevel === 'seed' || s.srsLevel === 0);
  const reviewSentences = sentences.filter(s => s.masteryLevel !== 'seed' && s.masteryLevel !== 'tree');
  
  // Refresh course data when navigating back from edit page
  useEffect(() => {
    // Only refresh if we're on the cloze course detail page (not the edit page)
    if (location.pathname === `/cloze-course/${course.id}`) {
      const newState = storage.load();
      updateState({ 
        clozeCourses: newState.clozeCourses,
        clozeSentences: newState.clozeSentences 
      });
    }
  }, [location.pathname, course.id, updateState]);
  
  // Determine what "Continue" should do
  const getContinueMode = (): 'learn' | 'review' => {
    if (reviewSentences.length > 0) return 'review';
    if (newSentences.length > 0) return 'learn';
    return 'learn'; // Default to learn if nothing available
  };

  useEffect(() => {
    if (!showQuestionSelector && !showSummary && availableSentences.length > 0 && questionCount > 0) {
      if (practiceSentences.length === 0) {
        loadPracticeSentences();
      }
      if (!currentSentence && practiceSentences.length > 0) {
        loadNextSentence();
      }
    }
  }, [showQuestionSelector, showSummary, questionCount, availableSentences.length, activeMode]);

  const loadPracticeSentences = () => {
    let sentencesToUse: ClozeSentence[] = [];
    
    if (activeMode === 'learn') {
      sentencesToUse = newSentences.sort(() => Math.random() - 0.5).slice(0, questionCount);
    } else if (activeMode === 'review') {
      sentencesToUse = reviewSentences.sort(() => Math.random() - 0.5).slice(0, questionCount);
    } else {
      sentencesToUse = availableSentences.sort(() => Math.random() - 0.5).slice(0, questionCount);
    }
    
    const shuffled = sentencesToUse;
    setPracticeSentences(shuffled);
    setCurrentIndex(0);
  };

  const handleModeSelect = (mode: 'continue' | 'learn' | 'review' | 'speed' | 'flashcards' | 'difficult') => {
    if (mode === 'continue') {
      const continueMode = getContinueMode();
      setActiveMode(continueMode as 'learn' | 'review' | 'speed' | 'flashcards' | 'difficult' | null);
      setShowQuestionSelector(true);
    } else if (mode === 'speed' || mode === 'flashcards' || mode === 'difficult') {
      setActiveMode(mode as 'continue' | 'learn' | 'review' | 'speed' | 'flashcards' | 'difficult' | null);
      // These modes will be handled separately
    } else {
      setActiveMode(mode as 'continue' | 'learn' | 'review' | 'speed' | 'flashcards' | 'difficult' | null);
      setShowQuestionSelector(true);
    }
  };

  const loadNextSentence = useCallback(() => {
    if (practiceSentences.length === 0) return;
    if (currentIndex < practiceSentences.length) {
      setCurrentSentence(practiceSentences[currentIndex]);
      setUserAnswer('');
      setFeedback(null);
    }
  }, [currentIndex, practiceSentences]);

  const handleAnswer = useCallback(() => {
    if (!currentSentence || !userAnswer.trim() || feedback) return;

    // Fix: Translate from native to target (not native to native)
    const isCorrect = userAnswer.toLowerCase().trim() === currentSentence.answer.toLowerCase().trim();
    setFeedback({ correct: isCorrect });

    const wasNew = currentSentence.masteryLevel === 'seed' || currentSentence.srsLevel === 0;
    const updates = updateClozeSRS(currentSentence, isCorrect);
    
    storage.updateClozeSentence(currentSentence.id, {
      ...updates,
      correctCount: currentSentence.correctCount + (isCorrect ? 1 : 0),
      wrongCount: currentSentence.wrongCount + (isCorrect ? 0 : 1),
    });

    if (wasNew && isCorrect) {
      setNewSentencesLearned(prev => prev + 1);
      // Award XP for learning a new sentence
      leaderboard.awardSentenceXP(course.id);
    }

    // Record study activity - this is critical for streak tracking
    recordStudyActivity(course.id, 1);
    setCorrectCount(prev => prev + (isCorrect ? 1 : 0));
    setQuestionsAnswered(prev => prev + 1);
    
    // Force StreakDisplay to refresh by updating key
    setStreakKey(prev => prev + 1);

    updateState({ clozeSentences: storage.load().clozeSentences });
  }, [currentSentence, userAnswer, feedback, course.id, updateState]);

  const handleNext = useCallback(() => {
    if (!feedback) return;
    
    setFeedback(null);
    setUserAnswer('');
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    // Don't increment questionsAnswered here - it's already incremented in handleAnswer
    
    if (nextIndex >= questionCount || nextIndex >= practiceSentences.length) {
      setShowSummary(true);
    } else {
      // Load next sentence after state updates
      setTimeout(() => {
        if (nextIndex < practiceSentences.length) {
          setCurrentSentence(practiceSentences[nextIndex]);
          setUserAnswer('');
          setFeedback(null);
        }
      }, 100);
    }
  }, [feedback, questionCount, currentIndex, practiceSentences]);

  const handleStart = (count: number) => {
    setQuestionCount(count);
    setShowQuestionSelector(false);
    setStartTime(Date.now());
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewSentencesLearned(0);
    setCurrentIndex(0);
    setPracticeSentences([]);
    setCurrentSentence(null);
    // loadPracticeSentences will be called by useEffect
  };

  const handleSummaryClose = () => {
    setShowSummary(false);
    setShowQuestionSelector(false);
    setActiveMode(null);
    setQuestionCount(0);
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewSentencesLearned(0);
    setCurrentSentence(null);
    setPracticeSentences([]);
    setCurrentIndex(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter') return;
        return;
      }

      if (feedback) {
        if (e.key === ' ') {
          e.preventDefault();
          handleNext();
        }
      } else if (e.key === 'Enter' && userAnswer.trim()) {
        e.preventDefault();
        handleAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [feedback, userAnswer, handleAnswer, handleNext]);

  useEffect(() => {
    if (currentIndex < practiceSentences.length && !currentSentence) {
      loadNextSentence();
    }
  }, [currentIndex, practiceSentences]);

  const stats = {
    total: sentences.length,
    mastered: sentences.filter(s => s.masteryLevel === 'tree').length,
    inProgress: sentences.filter(s => s.masteryLevel !== 'seed' && s.masteryLevel !== 'tree').length,
    new: sentences.filter(s => s.masteryLevel === 'seed' || s.srsLevel === 0).length,
    totalCorrect: sentences.reduce((sum, s) => sum + s.correctCount, 0),
    totalWrong: sentences.reduce((sum, s) => sum + s.wrongCount, 0),
  };

  const refreshData = () => {
    const newState = storage.load();
    updateState(newState);
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <button className="btn" onClick={onBack} style={{ marginBottom: '8px' }}>
            ← Back to Courses
          </button>
          <h1 className="card-title">{course.name}</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {course.nativeLanguage} → {course.targetLanguage}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to={`/leaderboard/course/${course.id}`} className="btn">
            Leaderboard
          </Link>
          <Link to="/glossary" className="btn">
            Glossary
          </Link>
          <Link to={`/cloze-course/${course.id}/edit`} className="btn">
            Edit
          </Link>
          <button className="btn" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>
      </div>

      {/* Streak Display */}
      <div style={{ marginBottom: '24px' }}>
        <StreakDisplay key={streakKey} courseId={course.id} />
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'practice' ? 'active' : ''}`}
          onClick={() => setActiveTab('practice')}
        >
          Practice
        </button>
        <button
          className={`tab ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          Library
        </button>
        <button
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Statistics
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'practice' && (
          <div>
            {!showQuestionSelector && !showSummary && activeMode !== 'speed' && activeMode !== 'flashcards' && activeMode !== 'difficult' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'nowrap', overflowX: 'auto' }}>
                <button
                  className={`btn ${activeMode === null || activeMode === 'continue' ? 'btn-primary' : ''}`}
                  onClick={() => handleModeSelect('continue')}
                  style={{ padding: '16px', fontSize: '16px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Continue
                </button>
                <button
                  className={`btn ${activeMode === 'learn' ? 'btn-primary' : ''}`}
                  onClick={() => handleModeSelect('learn')}
                  style={{ padding: '16px', fontSize: '16px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Learn Sentences
                </button>
                <button
                  className={`btn ${activeMode === 'review' ? 'btn-review' : ''}`}
                  onClick={() => handleModeSelect('review')}
                  style={{ padding: '16px', fontSize: '16px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Review Sentences
                </button>
                <button
                  className={`btn ${(activeMode as string) === 'speed' ? 'btn-quick-review' : ''}`}
                  onClick={() => handleModeSelect('speed')}
                  style={{ padding: '16px', fontSize: '16px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Speed Review
                </button>
                <button
                  className={`btn ${(activeMode as string) === 'flashcards' ? 'btn-flashcards' : ''}`}
                  onClick={() => handleModeSelect('flashcards')}
                  style={{ 
                    padding: '16px', 
                    fontSize: '16px', 
                    fontWeight: 600,
                    backgroundColor: (activeMode as string) === 'flashcards' ? '#9370db' : undefined,
                    color: (activeMode as string) === 'flashcards' ? '#ffffff' : undefined,
                    borderColor: (activeMode as string) === 'flashcards' ? '#9370db' : undefined,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  Flashcards
                </button>
                <button
                  className={`btn ${(activeMode as string) === 'difficult' ? 'btn-difficult' : ''}`}
                  onClick={() => handleModeSelect('difficult')}
                  style={{ 
                    padding: '16px', 
                    fontSize: '16px', 
                    fontWeight: 600,
                    backgroundColor: (activeMode as string) === 'difficult' ? '#ffd700' : undefined,
                    color: (activeMode as string) === 'difficult' ? '#24292f' : undefined,
                    borderColor: (activeMode as string) === 'difficult' ? '#ffd700' : undefined,
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  Difficult Sentences
                </button>
              </div>
            )}

            {activeMode === 'speed' && (
              <div className="card">
                <h2 style={{ marginBottom: '16px' }}>Speed Review Sentences</h2>
                <p style={{ color: '#656d76', marginBottom: '24px' }}>
                  Test your sentence knowledge with a timed challenge!
                </p>
                <p style={{ color: '#656d76', marginBottom: '24px' }}>
                  Speed Review for sentences is coming soon. For now, use Review Sentences mode.
                </p>
                <button className="btn btn-primary" onClick={() => setActiveMode(null)}>
                  Back
                </button>
              </div>
            )}

            {showQuestionSelector ? (
              <QuestionCountSelector
                maxQuestions={
                  activeMode === 'learn' ? newSentences.length :
                  activeMode === 'review' ? reviewSentences.length :
                  availableSentences.length
                }
                defaultCount={Math.min(20, 
                  activeMode === 'learn' ? newSentences.length :
                  activeMode === 'review' ? reviewSentences.length :
                  availableSentences.length
                )}
                onStart={handleStart}
                onCancel={() => {
                  setShowQuestionSelector(false);
                  setActiveMode(null);
                }}
              />
            ) : showSummary ? (
              <LessonSummary
                correct={correctCount}
                total={questionsAnswered}
                timeElapsed={startTime ? Math.floor((Date.now() - startTime) / 1000) : 0}
                newWordsLearned={newSentencesLearned}
                onClose={handleSummaryClose}
              />
            ) : currentSentence ? (
              <div className="quiz-container">
                <div style={{ textAlign: 'center', marginBottom: '16px', color: '#656d76' }}>
                  Question {questionsAnswered + 1} of {questionCount}
                </div>

                <div className="quiz-question">
                  <div style={{ marginBottom: '16px', fontSize: '18px' }}>
                    <div style={{ color: '#656d76', fontSize: '14px', marginBottom: '4px' }}>
                      {course.nativeLanguage}:
                    </div>
                    <strong>{currentSentence.native}</strong>
                  </div>
                  <div style={{ marginTop: '24px' }}>
                    <div style={{ color: '#656d76', fontSize: '14px', marginBottom: '4px' }}>
                      {course.targetLanguage} (fill in the blank):
                    </div>
                    <div style={{ fontSize: '20px', color: '#24292f' }}>
                      {currentSentence.clozeText}
                    </div>
                  </div>
                </div>

                <input
                  type="text"
                  className="quiz-input"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAnswer()}
                  placeholder={`Fill in the blank in ${course.targetLanguage}...`}
                  disabled={!!feedback}
                  autoFocus
                />

                {feedback && (
                  <div>
                    <div className={`quiz-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
                      {feedback.correct ? 'Correct!' : `Incorrect. The answer is "${currentSentence.answer}"`}
                    </div>
                    <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%' }}>
                      Next Sentence
                    </button>
                  </div>
                )}

                {!feedback && (
                  <button
                    className="btn btn-primary"
                    onClick={handleAnswer}
                    disabled={!userAnswer.trim()}
                    style={{ width: '100%' }}
                  >
                    Check Answer
                  </button>
                )}

                <KeyboardShortcuts mode="type" hasFeedback={!!feedback} />
              </div>
            ) : (
              <div className="card">
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  No sentences available. All sentences are mastered!
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'library' && (
          <div>
            <div className="card">
              <h3>Sentence Library ({sentences.length})</h3>
              {sentences.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  No sentences yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                  {sentences.map(sentence => (
                    <div
                      key={sentence.id}
                      style={{
                        padding: '12px',
                        border: '1px solid #d0d7de',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div><strong>{sentence.native}</strong></div>
                        <div style={{ color: '#656d76', marginTop: '4px' }}>{sentence.target}</div>
                        <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                          Mastery: {sentence.masteryLevel === 'seed' ? '🌱' : sentence.masteryLevel === 'sprout' ? '🌿' : sentence.masteryLevel === 'seedling' ? '🌱' : sentence.masteryLevel === 'plant' ? '🌳' : '🌲'} {sentence.masteryLevel} | Correct: {sentence.correctCount} | Wrong: {sentence.wrongCount}
                        </div>
                      </div>
                      <button
                        className="btn btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this sentence?')) {
                            storage.deleteClozeSentence(sentence.id);
                            refreshData();
                          }
                        }}
                        style={{ marginLeft: '12px' }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'statistics' && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total Sentences</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.mastered}</div>
                <div className="stat-label">Mastered (🌲 Tree)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.inProgress}</div>
                <div className="stat-label">In Progress</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.new}</div>
                <div className="stat-label">New (🌱 Seed)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalCorrect}</div>
                <div className="stat-label">Total Correct</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalWrong}</div>
                <div className="stat-label">Total Wrong</div>
              </div>
            </div>
            
            <div className="card" style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>SRS Stages</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌱 Seed</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{sentences.filter(s => s.masteryLevel === 'seed').length}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌿 Sprout</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{sentences.filter(s => s.masteryLevel === 'sprout').length}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌱 Seedling</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{sentences.filter(s => s.masteryLevel === 'seedling').length}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌳 Plant</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{sentences.filter(s => s.masteryLevel === 'plant').length}</div>
                </div>
                <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌲 Tree</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{sentences.filter(s => s.masteryLevel === 'tree').length}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <ClozeCourseSettings
          course={course}
          sentences={sentences}
          onClose={() => setShowSettings(false)}
          onUpdate={refreshData}
        />
      )}
    </div>
  );
}

