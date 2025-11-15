import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppState, PathCourse, PathLesson, PathExercise, ExerciseType } from '../types';
import { storage } from '../storage';
import { recordStudyActivity } from '../utils/activityTracking';
import { leaderboard } from '../utils/leaderboard';
import { speakText, stopSpeech } from '../utils/tts';
import './PathLearning.css';

interface PathLearningProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function PathLearning({ appState, updateState }: PathLearningProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'path' | 'lesson'>('path');
  const [currentLesson, setCurrentLesson] = useState<PathLesson | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [xpGained, setXpGained] = useState(0);

  const course = appState.pathCourses.find(c => c.id === courseId);
  const lessons = useMemo(() => {
    if (!courseId) return [];
    return (appState.pathLessons || [])
      .filter(l => l.courseId === courseId)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);
  }, [appState.pathLessons, courseId]);

  const progress = useMemo(() => {
    if (!courseId) return null;
    return (appState.pathProgress || []).find(p => p.courseId === courseId);
  }, [appState.pathProgress, courseId]);

  useEffect(() => {
    if (!course) {
      navigate('/');
    }
  }, [course, navigate]);

  if (!course) {
    return <div className="loading">Course not found</div>;
  }

  const refreshData = () => {
    const newState = storage.load();
    updateState(newState);
  };

  // Unlock lessons based on progress
  const unlockedLessons = useMemo(() => {
    const currentLessonNum = progress?.currentLesson || 0;
    return lessons.map(lesson => ({
      ...lesson,
      unlocked: lesson.lessonNumber <= currentLessonNum + 1 || lesson.lessonNumber === 1,
    }));
  }, [lessons, progress]);

  const handleStartLesson = (lesson: PathLesson) => {
    if (!lesson.unlocked) return;
    setCurrentLesson(lesson);
    setCurrentExerciseIndex(0);
    setUserAnswer('');
    setSelectedOptions([]);
    setFeedback(null);
    setShowExplanation(false);
    setLessonCompleted(false);
    setXpGained(0);
    setViewMode('lesson');
  };

  const handleAnswer = () => {
    if (!currentLesson) return;
    const exercise = currentLesson.exercises[currentExerciseIndex];
    if (!exercise) return;

    let isCorrect = false;

    switch (exercise.type) {
      case 'translation':
      case 'typing':
        isCorrect = userAnswer.trim().toLowerCase() === exercise.correctAnswer.toString().toLowerCase();
        break;
      case 'multiple-choice':
        isCorrect = userAnswer === exercise.correctAnswer.toString();
        break;
      case 'matching':
        // For matching, check if all pairs are correct
        if (Array.isArray(exercise.correctAnswer)) {
          isCorrect = exercise.correctAnswer.every((ans, idx) => 
            selectedOptions[idx]?.toLowerCase() === ans.toLowerCase()
          );
        }
        break;
      case 'listening':
        isCorrect = userAnswer.trim().toLowerCase() === exercise.correctAnswer.toString().toLowerCase();
        break;
      default:
        isCorrect = false;
    }

    setFeedback({
      correct: isCorrect,
      message: isCorrect ? 'Correct! 🎉' : `Incorrect. The answer is "${exercise.correctAnswer}"`,
    });
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (!currentLesson) return;

    if (currentExerciseIndex < currentLesson.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setUserAnswer('');
      setSelectedOptions([]);
      setFeedback(null);
      setShowExplanation(false);
    } else {
      // Lesson completed
      const wasCompleted = currentLesson.completed;
      if (!wasCompleted) {
        // Mark lesson as completed
        storage.updatePathLesson(currentLesson.id, { completed: true });
        
        // Update progress
        const currentProgress = progress || { courseId: courseId!, currentLesson: 0, totalXP: 0, lessonsCompleted: 0 };
        const newCurrentLesson = Math.max(currentProgress.currentLesson, currentLesson.lessonNumber);
        const newTotalXP = currentProgress.totalXP + currentLesson.xpReward;
        const newLessonsCompleted = currentProgress.lessonsCompleted + 1;
        
        storage.updatePathProgress(courseId!, {
          currentLesson: newCurrentLesson,
          totalXP: newTotalXP,
          lessonsCompleted: newLessonsCompleted,
          lastStudied: Date.now(),
        });

        // Unlock next lesson
        const nextLesson = lessons.find(l => l.lessonNumber === currentLesson.lessonNumber + 1);
        if (nextLesson) {
          storage.updatePathLesson(nextLesson.id, { unlocked: true });
        }

        // Award XP
        leaderboard.addXP(currentLesson.xpReward);
        setXpGained(currentLesson.xpReward);
        
        // Record activity
        recordStudyActivity(courseId!, currentLesson.exercises.length);
      }
      
      setLessonCompleted(true);
      refreshData();
    }
  };

  const handleBackToPath = () => {
    setViewMode('path');
    setCurrentLesson(null);
    setCurrentExerciseIndex(0);
    setUserAnswer('');
    setSelectedOptions([]);
    setFeedback(null);
    setShowExplanation(false);
    setLessonCompleted(false);
    refreshData();
  };

  // Path view
  if (viewMode === 'path') {
    return (
      <div className="path-learning-container">
        <div className="path-header">
          <button className="btn" onClick={() => navigate('/')} style={{ marginBottom: '16px' }}>
            ← Back to Dashboard
          </button>
          <div className="path-course-header">
            <div className="path-course-icon">{course.icon || '🇫🇷'}</div>
            <div>
              <h1 className="path-course-title">{course.name}</h1>
              <div className="path-course-meta">
                {course.nativeLanguage} → {course.targetLanguage}
              </div>
            </div>
          </div>
          {progress && (
            <div className="path-stats">
              <div className="path-stat">
                <span className="path-stat-label">XP</span>
                <span className="path-stat-value">{progress.totalXP}</span>
              </div>
              <div className="path-stat">
                <span className="path-stat-label">Lessons</span>
                <span className="path-stat-value">{progress.lessonsCompleted} / {course.lessonCount}</span>
              </div>
            </div>
          )}
        </div>

        <div className="path-container">
          {unlockedLessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className={`path-lesson-node ${lesson.completed ? 'completed' : ''} ${lesson.unlocked ? 'unlocked' : 'locked'}`}
              onClick={() => handleStartLesson(lesson)}
            >
              <div className="lesson-node-icon">
                {lesson.completed ? '✓' : lesson.unlocked ? lesson.lessonNumber : '🔒'}
              </div>
              <div className="lesson-node-info">
                <div className="lesson-node-title">{lesson.title}</div>
                <div className="lesson-node-xp">+{lesson.xpReward} XP</div>
              </div>
              {index < unlockedLessons.length - 1 && (
                <div className="path-connector" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Lesson view
  if (!currentLesson) return null;

  const exercise = currentLesson.exercises[currentExerciseIndex];
  if (!exercise) return null;

  return (
    <div className="path-learning-container">
      <div className="lesson-header">
        <button className="btn" onClick={handleBackToPath} style={{ marginBottom: '8px' }}>
          ← Back to Path
        </button>
        <div className="lesson-progress-bar">
          <div 
            className="lesson-progress-fill" 
            style={{ width: `${((currentExerciseIndex + 1) / currentLesson.exercises.length) * 100}%` }}
          />
        </div>
        <div className="lesson-info">
          <h2>{currentLesson.title}</h2>
          <div className="lesson-exercise-count">
            Exercise {currentExerciseIndex + 1} of {currentLesson.exercises.length}
          </div>
        </div>
      </div>

      {lessonCompleted ? (
        <div className="lesson-completed">
          <div className="completion-icon">🎉</div>
          <h2>Lesson Complete!</h2>
          <p>You earned {xpGained} XP</p>
          <button className="btn btn-primary" onClick={handleBackToPath}>
            Continue Learning
          </button>
        </div>
      ) : (
        <div className="exercise-container">
          <div className="exercise-type-badge">{exercise.type}</div>
          
          <div className="exercise-question">
            {exercise.type === 'listening' && exercise.audioUrl && (
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  // Play audio using TTS
                  speakText(exercise.question, course.targetLanguage);
                }}
                style={{ marginBottom: '16px' }}
              >
                🔊 Play Audio
              </button>
            )}
            <div className="question-text">{exercise.question}</div>
            {exercise.hint && (
              <div className="exercise-hint">💡 {exercise.hint}</div>
            )}
          </div>

          {!feedback && (
            <div className="exercise-answer">
              {exercise.type === 'multiple-choice' && exercise.options && (
                <div className="multiple-choice-options">
                  {exercise.options.map((option, idx) => (
                    <button
                      key={idx}
                      className={`choice-option ${userAnswer === option ? 'selected' : ''}`}
                      onClick={() => setUserAnswer(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {exercise.type === 'matching' && exercise.options && Array.isArray(exercise.correctAnswer) && (
                <div className="matching-exercise">
                  <div className="matching-pairs">
                    {exercise.correctAnswer.map((answer, idx) => (
                      <div key={idx} className="matching-pair">
                        <div className="matching-item">{answer}</div>
                        <select
                          className="matching-select"
                          value={selectedOptions[idx] || ''}
                          onChange={(e) => {
                            const newOptions = [...selectedOptions];
                            newOptions[idx] = e.target.value;
                            setSelectedOptions(newOptions);
                          }}
                        >
                          <option value="">Select...</option>
                          {exercise.options.filter(opt => !selectedOptions.includes(opt) || selectedOptions[idx] === opt).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(exercise.type === 'translation' || exercise.type === 'typing' || exercise.type === 'listening') && (
                <input
                  type="text"
                  className="exercise-input"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && userAnswer.trim()) {
                      handleAnswer();
                    }
                  }}
                  placeholder="Type your answer..."
                  autoFocus
                />
              )}
            </div>
          )}

          {feedback && (
            <div className={`exercise-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
              <div className="feedback-message">{feedback.message}</div>
              {showExplanation && exercise.explanation && (
                <div className="exercise-explanation">{exercise.explanation}</div>
              )}
              <button className="btn btn-primary" onClick={handleNext} style={{ marginTop: '16px' }}>
                {currentExerciseIndex < currentLesson.exercises.length - 1 ? 'Next' : 'Complete Lesson'}
              </button>
            </div>
          )}

          {!feedback && (
            <button 
              className="btn btn-primary" 
              onClick={handleAnswer}
              disabled={
                (exercise.type === 'translation' || exercise.type === 'typing' || exercise.type === 'listening') && !userAnswer.trim() ||
                (exercise.type === 'multiple-choice') && !userAnswer ||
                (exercise.type === 'matching') && selectedOptions.length !== exercise.correctAnswer.length || selectedOptions.some(opt => !opt)
              }
            >
              Check
            </button>
          )}
        </div>
      )}
    </div>
  );
}

