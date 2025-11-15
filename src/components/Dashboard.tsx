import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, Course } from '../types';
import { storage } from '../storage';
import { LANGUAGES } from '../utils/languages';
import { parseCSV, createWordsFromCSV } from '../utils/csv';
import { getOverallStreak } from '../utils/activityTracking';
import CreateCourseModal from './CreateCourseModal';
import CreateClozeCourseModal from './CreateClozeCourseModal';
import CreateCharacterCourseModal from './CreateCharacterCourseModal';
import ActivityHeatmap from './ActivityHeatmap';

interface DashboardProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function Dashboard({ appState, updateState }: DashboardProps) {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateClozeModal, setShowCreateClozeModal] = useState(false);
  const [showCreateCharacterModal, setShowCreateCharacterModal] = useState(false);
  const [courseTypeFilter, setCourseTypeFilter] = useState<'all' | 'words' | 'sentences' | 'characters'>('all');

  const handleCourseClick = (courseId: string, type: 'words' | 'sentences' | 'characters') => {
    if (type === 'words') {
      navigate(`/course/${courseId}`);
    } else if (type === 'sentences') {
      navigate(`/cloze-course/${courseId}`);
    } else if (type === 'characters') {
      navigate(`/character-course/${courseId}/practice`);
    }
  };


  const wordCourses = appState.courses || [];
  const sentenceCourses = appState.clozeCourses || [];
  const characterCourses = appState.characterCourses || [];

  const filteredCourses = {
    words: wordCourses,
    sentences: sentenceCourses,
    characters: characterCourses,
  };

  const allCoursesCount = wordCourses.length + sentenceCourses.length + characterCourses.length;

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">My Courses</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            Create Word Course
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateClozeModal(true)}>
            Create Sentence Course
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateCharacterModal(true)}>
            Create Character Course
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '24px' }}>
        <button
          className={`tab ${courseTypeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCourseTypeFilter('all')}
        >
          All Courses ({allCoursesCount})
        </button>
        <button
          className={`tab ${courseTypeFilter === 'words' ? 'active' : ''}`}
          onClick={() => setCourseTypeFilter('words')}
        >
          My Word Courses ({wordCourses.length})
        </button>
        <button
          className={`tab ${courseTypeFilter === 'sentences' ? 'active' : ''}`}
          onClick={() => setCourseTypeFilter('sentences')}
        >
          My Sentence Courses ({sentenceCourses.length})
        </button>
        <button
          className={`tab ${courseTypeFilter === 'characters' ? 'active' : ''}`}
          onClick={() => setCourseTypeFilter('characters')}
        >
          My Character Courses ({characterCourses.length})
        </button>
      </div>

      {allCoursesCount === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
            No courses yet. Create your first course to get started!
          </p>
        </div>
      ) : (
        <>
          {/* Universal Streak and Heatmap */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {(() => {
                  const overallStreak = getOverallStreak();
                  return overallStreak ? (
                    <div style={{ fontSize: '24px', fontWeight: 600 }}>
                      🔥 {overallStreak.currentStreak} day streak
                    </div>
                  ) : (
                    <div style={{ fontSize: '24px', fontWeight: 600, color: '#656d76' }}>
                      🔥 Start your streak!
                    </div>
                  );
                })()}
              </div>
            </div>
            <ActivityHeatmap days={365} />
          </div>

          <div className="grid">
          {/* Word Courses */}
          {(courseTypeFilter === 'all' || courseTypeFilter === 'words') && wordCourses.map(course => {
            const progress = appState.courseProgress.find(p => p.courseId === course.id);
            const words = appState.words.filter(w => w.courseId === course.id);
            const learned = words.filter(w => w.srsLevel > 0).length;
            const total = words.length;
            const progressPercent = total > 0 ? (learned / total) * 100 : 0;

            return (
              <div
                key={course.id}
                className="course-card"
                onClick={() => handleCourseClick(course.id, 'words')}
                style={{ position: 'relative' }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${course.name}"? This will permanently delete the course and all its words. This action cannot be undone.`)) {
                      storage.deleteCourse(course.id);
                      updateState({
                        courses: storage.load().courses,
                        words: storage.load().words,
                        courseProgress: storage.load().courseProgress,
                      });
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    color: '#da3633',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    transition: 'background-color 0.2s',
                    zIndex: 10,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffebe9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Delete course"
                  aria-label="Delete course"
                >
                  ×
                </button>
                <div className="course-card-title">{course.name}</div>
                <div className="course-card-meta">
                  {course.nativeLanguage} → {course.targetLanguage}
                </div>
                <div className="tag" style={{ marginTop: '8px' }}>Word Course</div>
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
                  {learned} / {total} words learned
                </div>
              </div>
            );
          })}

          {/* Sentence Courses */}
          {(courseTypeFilter === 'all' || courseTypeFilter === 'sentences') && sentenceCourses.map(course => {
            const sentences = appState.clozeSentences.filter(s => s.courseId === course.id);
            const learned = sentences.filter(s => s.masteryLevel > 0).length;
            const total = sentences.length;
            const progressPercent = total > 0 ? (learned / total) * 100 : 0;

            return (
              <div
                key={course.id}
                className="course-card"
                onClick={() => handleCourseClick(course.id, 'sentences')}
                style={{ position: 'relative' }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${course.name}"? This will permanently delete the course and all its sentences. This action cannot be undone.`)) {
                      storage.deleteClozeCourse(course.id);
                      updateState({
                        clozeCourses: storage.load().clozeCourses,
                        clozeSentences: storage.load().clozeSentences,
                      });
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    color: '#da3633',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    transition: 'background-color 0.2s',
                    zIndex: 10,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffebe9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Delete course"
                  aria-label="Delete course"
                >
                  ×
                </button>
                <div className="course-card-title">{course.name}</div>
                <div className="course-card-meta">
                  {course.nativeLanguage} → {course.targetLanguage}
                </div>
                <div className="tag" style={{ marginTop: '8px' }}>Sentence Course</div>
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
              </div>
            );
          })}

          {/* Character Courses */}
          {(courseTypeFilter === 'all' || courseTypeFilter === 'characters') && characterCourses.map(course => {
            const kanji = appState.kanji.filter(k => k.language === course.language);
            const learned = kanji.filter(k => k.srsStage !== 'locked' && k.srsStage !== 'burned').length;
            const total = kanji.length;
            const progressPercent = total > 0 ? (learned / total) * 100 : 0;

            return (
              <div
                key={course.id}
                className="course-card"
                onClick={() => handleCourseClick(course.id, 'characters')}
                style={{ position: 'relative' }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${course.name}"? This will permanently delete the course and all its characters. This action cannot be undone.`)) {
                      storage.deleteCharacterCourse(course.id);
                      updateState({
                        characterCourses: storage.load().characterCourses,
                        kanji: storage.load().kanji,
                      });
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    color: '#da3633',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    transition: 'background-color 0.2s',
                    zIndex: 10,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffebe9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Delete course"
                  aria-label="Delete course"
                >
                  ×
                </button>
                <div className="course-card-title">{course.name}</div>
                <div className="course-card-meta">
                  {course.language === 'japanese' ? 'Japanese' : 'Chinese'} Characters
                </div>
                <div className="tag" style={{ marginTop: '8px' }}>Character Course</div>
                <div className="progress-bar" style={{ marginTop: '12px' }}>
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="course-card-meta">
                  {learned} / {total} characters learned
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateCourseModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(course) => {
            updateState({
              courses: storage.load().courses,
              words: storage.load().words,
            });
            setShowCreateModal(false);
            navigate(`/course/${course.id}`);
          }}
        />
      )}

      {showCreateClozeModal && (
        <CreateClozeCourseModal
          onClose={() => setShowCreateClozeModal(false)}
          onSuccess={(course) => {
            updateState({
              clozeCourses: storage.load().clozeCourses,
              clozeSentences: storage.load().clozeSentences,
            });
            setShowCreateClozeModal(false);
            navigate(`/clozepractice`);
          }}
        />
      )}

      {showCreateCharacterModal && (
        <CreateCharacterCourseModal
          onClose={() => setShowCreateCharacterModal(false)}
          onSuccess={(course) => {
            updateState({
              characterCourses: storage.load().characterCourses,
              kanji: storage.load().kanji,
            });
            setShowCreateCharacterModal(false);
            navigate(`/character-course/${course.id}`);
          }}
        />
      )}
    </div>
  );
}

