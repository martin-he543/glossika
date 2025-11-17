import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { AppState, Word } from '../types';
import { storage } from '../storage';
import { getWordsDueForReview } from '../utils/srs';
import { leaderboard } from '../utils/leaderboard';
import LearnWords from './LearnWords';
import ReviewWords from './ReviewWords';
import SpeedReview from './SpeedReview';
import Flashcards from './Flashcards';
import DifficultWords from './DifficultWords';
import CourseSettings from './CourseSettings';
import LearnWordsModal from './LearnWordsModal';
import LevelDetailModal from './LevelDetailModal';
import StreakDisplay from './StreakDisplay';

interface CourseDetailProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function CourseDetail({ appState, updateState }: CourseDetailProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [learnModalMode, setLearnModalMode] = useState<'learn' | 'review' | 'speed' | 'flashcards' | 'difficult'>('learn');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const course = appState.courses.find(c => c.id === courseId);
  const words = appState.words.filter(w => w.courseId === courseId);

  // Refresh course data when navigating back from edit page
  useEffect(() => {
    // Only refresh if we're on the course detail page (not the edit page)
    if (location.pathname === `/course/${courseId}`) {
      const newState = storage.load();
      updateState({ 
        courses: newState.courses,
        words: newState.words 
      });
    }
  }, [location.pathname, courseId, updateState]);

  useEffect(() => {
    if (!course && courseId) {
      // Try loading from storage if course not found in appState
      const state = storage.load();
      const foundCourse = state.courses.find(c => c.id === courseId);
      if (foundCourse) {
        updateState({ 
          courses: state.courses,
          words: state.words 
        });
      } else {
        navigate('/');
      }
    }
  }, [course, courseId, navigate, updateState]);

  if (!course) {
    return <div className="loading">Course not found</div>;
  }

  const refreshData = () => {
    const newState = storage.load();
    updateState(newState);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const srsStages = {
      seed: words.filter(w => w.srsLevel === 0).length,
      sprout: words.filter(w => w.srsLevel >= 1 && w.srsLevel <= 2).length,
      seedling: words.filter(w => w.srsLevel >= 3 && w.srsLevel <= 5).length,
      plant: words.filter(w => w.srsLevel >= 6 && w.srsLevel <= 10).length,
      tree: words.filter(w => w.srsLevel > 10).length,
    };

    const longTermMemory = words.filter(w => w.srsLevel >= 10 || w.masteryLevel === 'tree').length;
    const dueForReview = getWordsDueForReview(words).length;

    // Get levels from course or extract from words
    const courseLevels = course.levels || [1];
    const levelStats = courseLevels.map(level => ({
      level,
      total: words.filter(w => (w.level || 1) === level).length,
      learned: words.filter(w => (w.level || 1) === level && w.srsLevel > 0).length,
      mastered: words.filter(w => (w.level || 1) === level && (w.srsLevel >= 10 || w.masteryLevel === 'tree')).length,
    }));

    return { srsStages, longTermMemory, dueForReview, levelStats };
  }, [words, course]);

  const courseLevels = course.levels || [1];

  return (
    <div>
      <div className="card-header">
        <div>
          <h1 className="card-title">{course.name}</h1>
          {course.author && (
            <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
              By {course.author}
            </div>
          )}
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {course.nativeLanguage} → {course.targetLanguage}
          </div>
          {course.description && (
            <p style={{ color: '#656d76', marginTop: '12px', fontSize: '14px', lineHeight: '1.5', maxWidth: '800px' }}>
              {course.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to={`/leaderboard/course/${course.id}`} className="btn">
            Leaderboard
          </Link>
          <Link to="/glossary" className="btn">
            Glossary
          </Link>
          <Link to={`/course/${course.id}/edit`} className="btn">
            Edit
          </Link>
          <button className="btn" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>
      </div>

      {/* Streak Display */}
      <div style={{ marginBottom: '24px' }}>
        <StreakDisplay courseId={course.id} />
      </div>

      {/* Course Statistics */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Course Statistics</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '4px' }}>Words Due for Review</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stats.dueForReview > 0 ? '#d1242f' : '#656d76' }}>
              {stats.dueForReview}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '4px' }}>Long-term Memory</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {stats.longTermMemory} / {words.length}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>SRS Stages</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌱 Seed</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.seed}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌿 Sprout</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.sprout}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌱 Seedling</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.seedling}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌳 Plant</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.plant}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🌲 Tree</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.tree}</div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Levels</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {stats.levelStats.map(({ level, total, learned, mastered }) => (
              <div 
                key={level} 
                style={{ 
                  padding: '12px', 
                  border: '1px solid #d0d7de', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setSelectedLevel(level)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f6f8fa';
                  e.currentTarget.style.borderColor = '#0969da';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#d0d7de';
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Level {level}</div>
                <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>
                  Total: {total}
                </div>
                <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>
                  Learned: {learned}
                </div>
                <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>
                  Mastered: {mastered}
                </div>
                {total > 0 && (
                  <div className="progress-bar" style={{ marginTop: '8px', height: '6px' }}>
                    <div 
                      className="progress-fill" 
                      style={{ width: `${(learned / total) * 100}%` }} 
                    />
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#656d76', marginTop: '8px', textAlign: 'center' }}>
                  Click to view words
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <button
          className={`btn ${showLearnModal && learnModalMode === 'learn' ? 'btn-learn' : ''}`}
          onClick={() => {
            setLearnModalMode('learn');
            setActiveTab('learn');
            setShowLearnModal(true);
          }}
          onMouseEnter={(e) => {
            if (!(showLearnModal && learnModalMode === 'learn')) {
              e.currentTarget.style.backgroundColor = '#2da44e';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#2da44e';
            }
          }}
          onMouseLeave={(e) => {
            const isActive = showLearnModal && learnModalMode === 'learn';
            e.currentTarget.style.backgroundColor = isActive ? '#2da44e' : '';
            e.currentTarget.style.color = isActive ? '#ffffff' : '';
            e.currentTarget.style.borderColor = isActive ? '#2da44e' : '';
          }}
          style={{ 
            padding: '16px', 
            fontSize: '16px', 
            fontWeight: 600,
            backgroundColor: showLearnModal && learnModalMode === 'learn' ? '#2da44e' : undefined,
            color: showLearnModal && learnModalMode === 'learn' ? '#ffffff' : undefined,
            borderColor: showLearnModal && learnModalMode === 'learn' ? '#2da44e' : undefined
          }}
        >
          Learn
        </button>
        <button
          className={`btn ${showLearnModal && learnModalMode === 'review' ? 'btn-review' : ''}`}
          onClick={() => {
            setLearnModalMode('review');
            setActiveTab('review');
            setShowLearnModal(true);
          }}
          onMouseEnter={(e) => {
            if (!(showLearnModal && learnModalMode === 'review')) {
              e.currentTarget.style.backgroundColor = '#87ceeb';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#87ceeb';
            }
          }}
          onMouseLeave={(e) => {
            const isActive = showLearnModal && learnModalMode === 'review';
            e.currentTarget.style.backgroundColor = isActive ? '#87ceeb' : '';
            e.currentTarget.style.color = isActive ? '#ffffff' : '';
            e.currentTarget.style.borderColor = isActive ? '#87ceeb' : '';
          }}
          style={{ 
            padding: '16px', 
            fontSize: '16px', 
            fontWeight: 600,
            backgroundColor: showLearnModal && learnModalMode === 'review' ? '#87ceeb' : undefined,
            color: showLearnModal && learnModalMode === 'review' ? '#ffffff' : undefined,
            borderColor: showLearnModal && learnModalMode === 'review' ? '#87ceeb' : undefined
          }}
        >
          Review
        </button>
        <button
          className={`btn ${showLearnModal && learnModalMode === 'speed' ? 'btn-quick-review' : ''}`}
          onClick={() => {
            setLearnModalMode('speed');
            setActiveTab('speed');
            setShowLearnModal(true);
          }}
          onMouseEnter={(e) => {
            if (!(showLearnModal && learnModalMode === 'speed')) {
              e.currentTarget.style.backgroundColor = '#ff4444';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#ff4444';
            }
          }}
          onMouseLeave={(e) => {
            const isActive = showLearnModal && learnModalMode === 'speed';
            e.currentTarget.style.backgroundColor = isActive ? '#ff4444' : '';
            e.currentTarget.style.color = isActive ? '#ffffff' : '';
            e.currentTarget.style.borderColor = isActive ? '#ff4444' : '';
          }}
          style={{ 
            padding: '16px', 
            fontSize: '16px', 
            fontWeight: 600,
            backgroundColor: showLearnModal && learnModalMode === 'speed' ? '#ff4444' : undefined,
            color: showLearnModal && learnModalMode === 'speed' ? '#ffffff' : undefined,
            borderColor: showLearnModal && learnModalMode === 'speed' ? '#ff4444' : undefined
          }}
        >
          Speed Review
        </button>
        <button
          className={`btn ${showLearnModal && learnModalMode === 'flashcards' ? 'btn-flashcards' : ''}`}
          onClick={() => {
            setLearnModalMode('flashcards');
            setActiveTab('flashcards');
            setShowLearnModal(true);
          }}
          onMouseEnter={(e) => {
            if (!(showLearnModal && learnModalMode === 'flashcards')) {
              e.currentTarget.style.backgroundColor = '#9370db';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#9370db';
            }
          }}
          onMouseLeave={(e) => {
            const isActive = showLearnModal && learnModalMode === 'flashcards';
            e.currentTarget.style.backgroundColor = isActive ? '#9370db' : '';
            e.currentTarget.style.color = isActive ? '#ffffff' : '';
            e.currentTarget.style.borderColor = isActive ? '#9370db' : '';
          }}
          style={{ 
            padding: '16px', 
            fontSize: '16px', 
            fontWeight: 600,
            backgroundColor: showLearnModal && learnModalMode === 'flashcards' ? '#9370db' : undefined,
            color: showLearnModal && learnModalMode === 'flashcards' ? '#ffffff' : undefined,
            borderColor: showLearnModal && learnModalMode === 'flashcards' ? '#9370db' : undefined
          }}
        >
          Flashcards
        </button>
        <button
          className={`btn ${showLearnModal && learnModalMode === 'difficult' ? 'btn-difficult' : ''}`}
          onClick={() => {
            setLearnModalMode('difficult');
            setActiveTab('difficult');
            setShowLearnModal(true);
          }}
          onMouseEnter={(e) => {
            if (!(showLearnModal && learnModalMode === 'difficult')) {
              e.currentTarget.style.backgroundColor = '#ffd700';
              e.currentTarget.style.color = '#24292f';
              e.currentTarget.style.borderColor = '#ffd700';
            }
          }}
          onMouseLeave={(e) => {
            const isActive = showLearnModal && learnModalMode === 'difficult';
            e.currentTarget.style.backgroundColor = isActive ? '#ffd700' : '';
            e.currentTarget.style.color = isActive ? '#24292f' : '';
            e.currentTarget.style.borderColor = isActive ? '#ffd700' : '';
          }}
          style={{ 
            padding: '16px', 
            fontSize: '16px', 
            fontWeight: 600,
            backgroundColor: showLearnModal && learnModalMode === 'difficult' ? '#ffd700' : undefined,
            color: showLearnModal && learnModalMode === 'difficult' ? '#24292f' : undefined,
            borderColor: showLearnModal && learnModalMode === 'difficult' ? '#ffd700' : undefined
          }}
        >
          Difficult Words
        </button>
      </div>

      {showLearnModal && (
        <LearnWordsModal
          courseId={course.id}
          words={words}
          course={course}
          mode={learnModalMode}
          onClose={() => {
            setShowLearnModal(false);
            setActiveTab(null);
            refreshData();
          }}
          onUpdate={refreshData}
        />
      )}

      {showSettings && (
        <CourseSettings
          course={course}
          onClose={() => setShowSettings(false)}
          onUpdate={refreshData}
        />
      )}

      {selectedLevel !== null && (
        <LevelDetailModal
          level={selectedLevel}
          words={words}
          course={course}
          onClose={() => setSelectedLevel(null)}
        />
      )}
    </div>
  );
}

