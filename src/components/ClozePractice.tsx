import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, ClozeSentence, ClozeCourse } from '../types';
import { storage } from '../storage';
import { parseCSV, createClozeFromTatoeba } from '../utils/csv';
import { leaderboard } from '../utils/leaderboard';
import CreateClozeCourseModal from './CreateClozeCourseModal';
import ClozeCourseSettings from './ClozeCourseSettings';
import KeyboardShortcuts from './KeyboardShortcuts';
import QuestionCountSelector from './QuestionCountSelector';
import LessonSummary from './LessonSummary';

interface ClozePracticeProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function ClozePractice({ appState, updateState }: ClozePracticeProps) {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Practice state (only when a course is selected)
  const [direction, setDirection] = useState<'native-to-target' | 'target-to-native'>('native-to-target');
  const [currentSentence, setCurrentSentence] = useState<ClozeSentence | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [newItemsLearned, setNewItemsLearned] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [practiceSentences, setPracticeSentences] = useState<ClozeSentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintLetter, setHintLetter] = useState<string>('');
  const [currentClozeData, setCurrentClozeData] = useState<{ text: string; answer: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clozeCourses = appState.clozeCourses || [];
  const selectedCourse = selectedCourseId ? clozeCourses.find(c => c.id === selectedCourseId) : null;
  const courseSentences = selectedCourseId 
    ? (appState.clozeSentences || []).filter(s => s.courseId === selectedCourseId)
    : [];
  const availableSentences = courseSentences.filter(s => s.masteryLevel < 5);

  // Generate cloze text for a sentence
  const generateClozeText = useCallback((sentence: ClozeSentence, dir: 'native-to-target' | 'target-to-native'): { text: string; answer: string } => {
    if (dir === 'native-to-target') {
      const words = sentence.target.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) {
        return { text: '_____', answer: sentence.target };
      }
      const randomIndex = Math.floor(Math.random() * words.length);
      const answer = words[randomIndex];
      words[randomIndex] = '_____';
      return { text: words.join(' '), answer };
    } else {
      const words = sentence.native.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) {
        return { text: '_____', answer: sentence.native };
      }
      const randomIndex = Math.floor(Math.random() * words.length);
      const answer = words[randomIndex];
      words[randomIndex] = '_____';
      return { text: words.join(' '), answer };
    }
  }, []);

  // Initialize practice session
  const handleStart = (count: number) => {
    const shuffled = availableSentences.sort(() => Math.random() - 0.5).slice(0, count);
    
    setQuestionCount(count);
    setShowQuestionSelector(false);
    setStartTime(Date.now());
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewItemsLearned(0);
    setCurrentIndex(0);
    setPracticeSentences(shuffled);
    setCurrentSentence(null);
    setCurrentClozeData(null);
    setFeedback(null);
    setUserAnswer('');
    setHintUsed(false);
    setHintLetter('');
  };

  // Load sentence when index changes
  useEffect(() => {
    if (showQuestionSelector || showSummary) return;
    if (practiceSentences.length === 0) return;
    if (currentIndex >= practiceSentences.length) return;

    const sentence = practiceSentences[currentIndex];
    if (!sentence) return;

    setCurrentSentence(sentence);
    const clozeData = generateClozeText(sentence, direction);
    setCurrentClozeData(clozeData);
    setUserAnswer('');
    setFeedback(null);
    setHintUsed(false);
    setHintLetter('');

    // Auto-focus input when sentence loads
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  }, [currentIndex, practiceSentences, showQuestionSelector, showSummary, direction, generateClozeText]);

  // Handle answer submission
  const handleAnswer = useCallback(() => {
    if (!currentSentence || !userAnswer.trim() || feedback || !currentClozeData) return;

    const isCorrect = userAnswer.toLowerCase().trim() === currentClozeData.answer.toLowerCase().trim();
    setFeedback({ 
      correct: isCorrect,
      message: isCorrect ? 'Correct!' : `Incorrect. The answer is "${currentClozeData.answer}"`
    });

    const wasNew = currentSentence.masteryLevel === 0;
    const newMasteryLevel = isCorrect
      ? Math.min(currentSentence.masteryLevel + 1, 5)
      : Math.max(currentSentence.masteryLevel - 1, 0);

    storage.updateClozeSentence(currentSentence.id, {
      masteryLevel: newMasteryLevel,
      correctCount: currentSentence.correctCount + (isCorrect ? 1 : 0),
      wrongCount: currentSentence.wrongCount + (isCorrect ? 0 : 1),
    });

    if (wasNew && isCorrect) {
      setNewItemsLearned(prev => prev + 1);
      // Award XP for learning a new sentence
      if (selectedCourseId) {
        leaderboard.awardSentenceXP(selectedCourseId);
      }
    }

    setCorrectCount(prev => prev + (isCorrect ? 1 : 0));
    setQuestionsAnswered(prev => prev + 1);

    updateState({ clozeSentences: storage.load().clozeSentences });
  }, [currentSentence, userAnswer, feedback, currentClozeData, updateState, selectedCourseId]);

  // Handle moving to next sentence
  const handleNext = useCallback(() => {
    if (!feedback) return;

    if (questionsAnswered >= questionCount) {
      setShowSummary(true);
      return;
    }

    if (currentIndex < practiceSentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Auto-focus input after moving to next sentence
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } else {
      setShowSummary(true);
    }
  }, [feedback, questionsAnswered, questionCount, currentIndex, practiceSentences.length]);

  // Handle hint
  const handleHint = useCallback(() => {
    if (!currentClozeData || hintUsed || feedback) return;
    
    const answer = currentClozeData.answer;
    if (answer && answer.length > 0) {
      setHintLetter(answer[0].toUpperCase());
      setHintUsed(true);
      setUserAnswer(answer[0]);
    }
  }, [currentClozeData, hintUsed, feedback]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!selectedCourseId || showQuestionSelector || showSummary) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter' && !feedback && userAnswer.trim()) {
          e.preventDefault();
          handleAnswer();
          return;
        }
        if ((e.key === 'h' || e.key === 'H') && !feedback) {
          e.preventDefault();
          handleHint();
          return;
        }
        return;
      }

      if (e.target instanceof HTMLButtonElement) {
        return;
      }

      if (feedback) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        }
      } else {
        if (e.key === 'Enter' && userAnswer.trim()) {
          e.preventDefault();
          handleAnswer();
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          handleHint();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [feedback, userAnswer, handleAnswer, handleNext, handleHint, selectedCourseId, showQuestionSelector, showSummary]);

  const handleSummaryClose = () => {
    setShowSummary(false);
    setShowQuestionSelector(true);
    setQuestionCount(0);
    setQuestionsAnswered(0);
    setCorrectCount(0);
    setNewItemsLearned(0);
    setCurrentSentence(null);
    setPracticeSentences([]);
    setCurrentIndex(0);
    setHintUsed(false);
    setHintLetter('');
    setCurrentClozeData(null);
    setFeedback(null);
    setUserAnswer('');
  };

  const handleDeleteCourse = (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this course?')) {
      storage.deleteClozeCourse(courseId);
      updateState({
        clozeCourses: storage.load().clozeCourses,
        clozeSentences: storage.load().clozeSentences,
      });
      if (selectedCourseId === courseId) {
        setSelectedCourseId(null);
      }
    }
  };

  const handleCourseClick = (courseId: string) => {
    setSelectedCourseId(courseId);
    setShowQuestionSelector(true);
  };

  const handleBackToCourses = () => {
    setSelectedCourseId(null);
    setShowQuestionSelector(false);
    setShowSummary(false);
  };

  // If no course selected, show course list
  if (!selectedCourseId) {
    return (
      <div>
        <div className="card-header">
          <h1 className="card-title">ClozePractice Courses</h1>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Course
          </button>
        </div>

        {clozeCourses.length === 0 ? (
          <div className="card">
            <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
              No courses yet. Create your first course to get started!
            </p>
          </div>
        ) : (
          <div className="grid">
            {clozeCourses.map(course => {
              const sentences = appState.clozeSentences.filter(s => s.courseId === course.id);
              const learned = sentences.filter(s => s.masteryLevel > 0).length;
              const total = sentences.length;
              const progressPercent = total > 0 ? (learned / total) * 100 : 0;

              return (
                <div
                  key={course.id}
                  className="course-card"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="course-card-title">{course.name}</div>
                  <div className="course-card-meta">
                    {course.nativeLanguage} → {course.targetLanguage}
                  </div>
                  {course.tags.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {course.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="progress-bar" style={{ marginTop: '12px' }}>
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="course-card-meta">
                    {learned} / {total} sentences learned
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ marginTop: '12px', width: '100%' }}
                    onClick={(e) => handleDeleteCourse(e, course.id)}
                  >
                    Delete Course
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showCreateModal && (
          <CreateClozeCourseModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={(course) => {
              updateState({
                clozeCourses: storage.load().clozeCourses,
                clozeSentences: storage.load().clozeSentences,
              });
              setShowCreateModal(false);
              handleCourseClick(course.id);
            }}
          />
        )}
      </div>
    );
  }

  // Show settings if requested
  if (showSettings && selectedCourse) {
    return (
      <ClozeCourseSettings
        course={selectedCourse}
        sentences={courseSentences}
        onClose={() => {
          setShowSettings(false);
          const newState = storage.load();
          updateState({
            clozeCourses: newState.clozeCourses,
            clozeSentences: newState.clozeSentences,
          });
        }}
        onUpdate={() => {
          const newState = storage.load();
          updateState({
            clozeCourses: newState.clozeCourses,
            clozeSentences: newState.clozeSentences,
          });
        }}
      />
    );
  }

  // Course selected - show practice interface
  return (
    <div>
      <div className="card-header">
        <div>
          <button className="btn" onClick={handleBackToCourses} style={{ marginRight: '12px' }}>
            ← Back to Courses
          </button>
          <h1 className="card-title" style={{ display: 'inline' }}>{selectedCourse?.name}</h1>
        </div>
        <button className="btn" onClick={() => setShowSettings(true)}>
          Settings
        </button>
      </div>

      {showQuestionSelector && (
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
      )}

      {showQuestionSelector ? (
        <QuestionCountSelector
          maxQuestions={availableSentences.length}
          defaultCount={Math.min(20, availableSentences.length)}
          onStart={handleStart}
          onCancel={() => {}}
        />
      ) : showSummary ? (
        <LessonSummary
          correct={correctCount}
          total={questionsAnswered}
          timeElapsed={startTime ? Math.floor((Date.now() - startTime) / 1000) : 0}
          newWordsLearned={newItemsLearned}
          onClose={handleSummaryClose}
        />
      ) : currentSentence && currentClozeData ? (
        <div className="quiz-container">
          <div style={{ textAlign: 'center', marginBottom: '16px', color: '#656d76' }}>
            Question {questionsAnswered + 1} of {questionCount}
          </div>

          <div className="quiz-question">
            {direction === 'native-to-target' ? (
              <>
                <div style={{ marginBottom: '16px', fontSize: '18px' }}>
                  <div style={{ color: '#656d76', fontSize: '14px', marginBottom: '4px' }}>
                    {selectedCourse?.nativeLanguage || 'Native'}:
                  </div>
                  <strong>{currentSentence.native}</strong>
                </div>
                <div style={{ marginTop: '24px' }}>
                  <div style={{ color: '#656d76', fontSize: '14px', marginBottom: '4px' }}>
                    {selectedCourse?.targetLanguage || 'Target'} (fill in the blank):
                  </div>
                  <div style={{ fontSize: '20px', color: '#24292f' }}>
                    {currentClozeData.text}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '16px', fontSize: '18px' }}>
                  <div style={{ color: '#656d76', fontSize: '14px', marginBottom: '4px' }}>
                    {selectedCourse?.targetLanguage || 'Target'}:
                  </div>
                  <strong>{currentSentence.target}</strong>
                </div>
                <div style={{ marginTop: '24px' }}>
                  <div style={{ color: '#656d76', fontSize: '14px', marginBottom: '4px' }}>
                    {selectedCourse?.nativeLanguage || 'Native'} (fill in the blank):
                  </div>
                  <div style={{ fontSize: '20px', color: '#24292f' }}>
                    {currentClozeData.text}
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              ref={inputRef}
              type="text"
              className="quiz-input"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !feedback && userAnswer.trim()) {
                  handleAnswer();
                }
              }}
              placeholder={hintLetter ? `Hint: ${hintLetter}...` : 'Fill in the blank...'}
              disabled={!!feedback}
              autoFocus
              style={{ flex: 1 }}
            />
            {!feedback && !hintUsed && (
              <button
                className="btn"
                onClick={handleHint}
                title="Show first letter (H)"
                style={{ whiteSpace: 'nowrap' }}
              >
                💡 Hint
              </button>
            )}
            {hintUsed && !feedback && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '0 12px',
                color: '#656d76',
                fontSize: '14px'
              }}>
                Hint: {hintLetter}...
              </div>
            )}
          </div>

          {feedback && (
            <div>
              <div className={`quiz-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
                {feedback.message}
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleNext} 
                style={{ width: '100%', marginTop: '8px' }}
              >
                Next Sentence (Space/Enter)
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
              Check Answer (Enter)
            </button>
          )}

          <KeyboardShortcuts 
            mode="type" 
            hasFeedback={!!feedback}
            customShortcuts={[
              { key: 'H', description: 'Show hint (first letter)' },
              { key: 'Enter', description: 'Submit answer / Continue' },
              { key: 'Space', description: 'Continue after feedback' }
            ]}
          />
        </div>
      ) : (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
            {practiceSentences.length === 0 
              ? 'No sentences available. All sentences are mastered or no sentences found!'
              : 'Loading...'}
          </p>
        </div>
      )}
    </div>
  );
}
