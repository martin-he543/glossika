import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppState } from '../types';
import { storage } from '../storage';
import CharacterCourseSettings from './CharacterCourseSettings';

interface CharacterCourseDetailProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function CharacterCourseDetail({ appState, updateState }: CharacterCourseDetailProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  const course = appState.characterCourses.find(c => c.id === courseId);
  const characters = appState.kanji.filter(k => k.language === course?.language);

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
      locked: characters.filter(k => k.srsStage === 'locked').length,
      apprentice: characters.filter(k => k.srsStage === 'apprentice').length,
      guru: characters.filter(k => k.srsStage === 'guru').length,
      master: characters.filter(k => k.srsStage === 'master').length,
      enlightened: characters.filter(k => k.srsStage === 'enlightened').length,
      burned: characters.filter(k => k.srsStage === 'burned').length,
    };

    const learned = characters.filter(k => k.srsStage !== 'locked').length;
    const mastered = characters.filter(k => k.srsStage === 'burned').length;

    // Get levels from course or extract from characters
    const courseLevels = course.levels || [1];
    const levelStats = courseLevels.map(level => ({
      level,
      total: characters.filter(k => (k.level || k.waniKaniLevel || 1) === level).length,
      learned: characters.filter(k => (k.level || k.waniKaniLevel || 1) === level && k.srsStage !== 'locked').length,
      mastered: characters.filter(k => (k.level || k.waniKaniLevel || 1) === level && k.srsStage === 'burned').length,
    }));

    return { srsStages, learned, mastered, levelStats };
  }, [characters, course]);

  return (
    <div>
      <div className="card-header">
        <div>
          <h1 className="card-title">{course.name}</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {course.language === 'japanese' ? 'Japanese' : 'Chinese'} Characters
          </div>
          {course.description && (
            <div style={{ fontSize: '14px', color: '#656d76', marginTop: '8px' }}>
              {course.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => navigate(`/character-course/${courseId}/practice`)}>
            Practice
          </button>
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
            <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '4px' }}>Total Characters</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {characters.length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '4px' }}>Learned</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a7f37' }}>
              {stats.learned}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '4px' }}>Mastered</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9a6700' }}>
              {stats.mastered}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>SRS Stages</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🔒 Locked</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.locked}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🔴 Apprentice</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.apprentice}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🟣 Guru</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.guru}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>🔵 Master</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.master}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>⚪ Enlightened</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.enlightened}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid #d0d7de', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '4px' }}>⚫ Burned</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats.srsStages.burned}</div>
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
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSettings && (
        <CharacterCourseSettings
          course={course}
          onClose={() => setShowSettings(false)}
          onUpdate={refreshData}
        />
      )}
    </div>
  );
}

