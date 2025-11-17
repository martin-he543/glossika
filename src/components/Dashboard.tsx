import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, Course } from '../types';
import { storage } from '../storage';
import { LANGUAGES } from '../utils/languages';
import { parseCSV, createWordsFromCSV } from '../utils/csv';
import { auth } from '../utils/auth';
import { userProfile } from '../utils/userProfile';
import StreakDisplay from './StreakDisplay';
import CreateCourseModal from './CreateCourseModal';
import CreateClozeCourseModal from './CreateClozeCourseModal';

interface DashboardProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function Dashboard({ appState, updateState }: DashboardProps) {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateClozeModal, setShowCreateClozeModal] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [courseTypeFilter, setCourseTypeFilter] = useState<'all' | 'words' | 'sentences'>('all');

  const handleCourseClick = (courseId: string, type: 'words' | 'sentences') => {
    if (type === 'words') {
      navigate(`/course/${courseId}`);
    } else if (type === 'sentences') {
      navigate(`/cloze-course/${courseId}`);
    }
  };


  const wordCourses = appState.courses || [];
  const sentenceCourses = appState.clozeCourses || [];

  const filteredCourses = {
    words: wordCourses,
    sentences: sentenceCourses,
  };

  const allCoursesCount = wordCourses.length + sentenceCourses.length;

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">My Courses</h1>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            style={{ 
              position: 'relative',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            Create
          </button>
          {showCreateDropdown && (
            <>
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 998
                }}
                onClick={() => setShowCreateDropdown(false)}
              />
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d0d7de',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(140, 149, 159, 0.2)',
                  minWidth: '200px',
                  zIndex: 999,
                  animation: 'dropdownFadeIn 0.15s ease-out',
                  transformOrigin: 'top right'
                }}
              >
                <button
                  className="btn"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderRadius: '6px 6px 0 0',
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setShowCreateModal(true);
                    setShowCreateDropdown(false);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f6f8fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Word Course
                </button>
                <button
                  className="btn"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderTop: '1px solid #d0d7de',
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setShowCreateClozeModal(true);
                    setShowCreateDropdown(false);
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f6f8fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Sentence Course
                </button>
              </div>
            </>
          )}
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
      </div>

      {allCoursesCount === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
            No courses yet. Create your first course to get started!
          </p>
        </div>
      ) : (
        <div className="grid">
          {/* Word Courses */}
          {(courseTypeFilter === 'all' || courseTypeFilter === 'words') && wordCourses.map(course => {
            const progress = appState.courseProgress.find(p => p.courseId === course.id);
            const words = appState.words.filter(w => w.courseId === course.id);
            const learned = words.filter(w => w.srsLevel > 0).length;
            const total = words.length;
            const progressPercent = total > 0 ? (learned / total) * 100 : 0;
            
            // Word counts by type
            const wordsToLearn = words.filter(w => w.srsLevel === 0).length;
            const wordsToReview = words.filter(w => w.srsLevel > 0).length;
            const difficultWords = words.filter(w => w.isDifficult || w.wrongCount > w.correctCount).length;
            
            // SRS level counts
            const srsCounts = {
              seed: words.filter(w => w.srsLevel === 0).length,
              sprout: words.filter(w => w.srsLevel >= 1 && w.srsLevel <= 2).length,
              seedling: words.filter(w => w.srsLevel >= 3 && w.srsLevel <= 5).length,
              plant: words.filter(w => w.srsLevel >= 6 && w.srsLevel <= 10).length,
              tree: words.filter(w => w.srsLevel > 10).length,
            };

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
                {course.author && (
                  <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                    By {course.author}
                  </div>
                )}
                {course.description && (
                  <p style={{ color: '#656d76', marginTop: '8px', fontSize: '14px', lineHeight: '1.4' }}>
                    {course.description}
                  </p>
                )}
                <div className="course-card-meta" style={{ marginTop: course.description ? '8px' : '8px' }}>
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
                <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '14px' }}>
                  <span style={{ color: '#656d76' }}>🌱 {wordsToLearn}</span>
                  <span style={{ color: '#656d76' }}>💧 {wordsToReview}</span>
                  <span style={{ color: '#656d76' }}>⚡ {difficultWords}</span>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', alignItems: 'center' }}>
                  {srsCounts.seed > 0 && <span style={{ color: '#656d76' }}>🌱 {srsCounts.seed}</span>}
                  {srsCounts.sprout > 0 && <span style={{ color: '#656d76' }}>🌿 {srsCounts.sprout}</span>}
                  {srsCounts.seedling > 0 && <span style={{ color: '#656d76' }}>🌾 {srsCounts.seedling}</span>}
                  {srsCounts.plant > 0 && <span style={{ color: '#656d76' }}>🌳 {srsCounts.plant}</span>}
                  {srsCounts.tree > 0 && <span style={{ color: '#656d76' }}>🌲 {srsCounts.tree}</span>}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <StreakDisplay courseId={course.id} compact={true} />
                </div>
              </div>
            );
          })}

          {/* Sentence Courses */}
          {(courseTypeFilter === 'all' || courseTypeFilter === 'sentences') && sentenceCourses.map(course => {
            const sentences = appState.clozeSentences.filter(s => s.courseId === course.id);
            const learned = sentences.filter(s => s.masteryLevel !== 'seed' && s.masteryLevel !== 'tree').length;
            const total = sentences.length;
            const progressPercent = total > 0 ? (learned / total) * 100 : 0;
            
            // Sentence counts by type
            const sentencesToLearn = sentences.filter(s => s.srsLevel === 0).length;
            const sentencesToReview = sentences.filter(s => s.srsLevel > 0).length;
            const difficultSentences = sentences.filter(s => s.isDifficult || s.wrongCount > s.correctCount).length;
            
            // SRS level counts
            const srsCounts = {
              seed: sentences.filter(s => s.srsLevel === 0 || s.masteryLevel === 'seed').length,
              sprout: sentences.filter(s => (s.srsLevel >= 1 && s.srsLevel <= 2) || s.masteryLevel === 'sprout').length,
              seedling: sentences.filter(s => (s.srsLevel >= 3 && s.srsLevel <= 5) || s.masteryLevel === 'seedling').length,
              plant: sentences.filter(s => (s.srsLevel >= 6 && s.srsLevel <= 10) || s.masteryLevel === 'plant').length,
              tree: sentences.filter(s => s.srsLevel > 10 || s.masteryLevel === 'tree').length,
            };

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
                {course.author && (
                  <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                    By {course.author}
                  </div>
                )}
                {course.description && (
                  <p style={{ color: '#656d76', marginTop: '8px', fontSize: '14px', lineHeight: '1.4' }}>
                    {course.description}
                  </p>
                )}
                <div className="course-card-meta" style={{ marginTop: course.description ? '8px' : '8px' }}>
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
                <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '14px' }}>
                  <span style={{ color: '#656d76' }}>🌱 {sentencesToLearn}</span>
                  <span style={{ color: '#656d76' }}>💧 {sentencesToReview}</span>
                  <span style={{ color: '#656d76' }}>⚡ {difficultSentences}</span>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', alignItems: 'center' }}>
                  {srsCounts.seed > 0 && <span style={{ color: '#656d76' }}>🌱 {srsCounts.seed}</span>}
                  {srsCounts.sprout > 0 && <span style={{ color: '#656d76' }}>🌿 {srsCounts.sprout}</span>}
                  {srsCounts.seedling > 0 && <span style={{ color: '#656d76' }}>🌾 {srsCounts.seedling}</span>}
                  {srsCounts.plant > 0 && <span style={{ color: '#656d76' }}>🌳 {srsCounts.plant}</span>}
                  {srsCounts.tree > 0 && <span style={{ color: '#656d76' }}>🌲 {srsCounts.tree}</span>}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <StreakDisplay courseId={course.id} compact={true} />
                </div>
              </div>
            );
          })}

        </div>
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

    </div>
  );
}

