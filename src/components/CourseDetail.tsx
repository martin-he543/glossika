import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

interface CourseDetailProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function CourseDetail({ appState, updateState }: CourseDetailProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('learn');
  const [showSettings, setShowSettings] = useState(false);
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [learnModalMode, setLearnModalMode] = useState<'learn' | 'review' | 'speed' | 'flashcards' | 'difficult'>('learn');

  const course = appState.courses.find(c => c.id === courseId);
  const words = appState.words.filter(w => w.courseId === courseId);

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
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {course.nativeLanguage} → {course.targetLanguage}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to={`/leaderboard/course/${course.id}`} className="btn">
            Leaderboard
          </Link>
          <button className="btn" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>
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
              <div key={level} style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Level {level}</div>
                <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>
                  Total: {total}
                </div>
                <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>
                  Learned: {learned}
                </div>
                <div style={{ fontSize: '12px', color: '#656d76' }}>
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
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <button
          className={`btn ${activeTab === 'learn' ? 'btn-primary' : ''}`}
          onClick={() => {
            setLearnModalMode('learn');
            setShowLearnModal(true);
          }}
          style={{ padding: '16px', fontSize: '16px', fontWeight: 600 }}
        >
          Learn New Words
        </button>
        <button
          className={`btn ${activeTab === 'review' ? 'btn-review' : ''}`}
          onClick={() => {
            setLearnModalMode('review');
            setShowLearnModal(true);
          }}
          style={{ padding: '16px', fontSize: '16px', fontWeight: 600 }}
        >
          Review
        </button>
        <button
          className={`btn ${activeTab === 'speed' ? 'btn-quick-review' : ''}`}
          onClick={() => {
            setLearnModalMode('speed');
            setShowLearnModal(true);
          }}
          style={{ padding: '16px', fontSize: '16px', fontWeight: 600 }}
        >
          Speed Review
        </button>
        <button
          className={`btn ${activeTab === 'flashcards' ? 'btn-flashcards' : ''}`}
          onClick={() => {
            setLearnModalMode('flashcards');
            setShowLearnModal(true);
          }}
          style={{ padding: '16px', fontSize: '16px', fontWeight: 600 }}
        >
          Flashcards
        </button>
        <button
          className={`btn ${activeTab === 'difficult' ? 'btn-difficult' : ''}`}
          onClick={() => {
            setLearnModalMode('difficult');
            setShowLearnModal(true);
          }}
          style={{ padding: '16px', fontSize: '16px', fontWeight: 600 }}
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
    </div>
  );
}

