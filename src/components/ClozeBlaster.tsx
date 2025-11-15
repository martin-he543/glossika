import { useState, useEffect, useCallback } from 'react';
import { AppState, ClozeSentence, ClozeCourse } from '../types';
import { storage } from '../storage';
import { parseCSV, createClozeFromTatoeba } from '../utils/csv';
import Papa from 'papaparse';
import KeyboardShortcuts from './KeyboardShortcuts';
import { LANGUAGES } from '../utils/languages';
import CreateClozeCourseModal from './CreateClozeCourseModal';
import ClozeCourseDetail from './ClozeCourseDetail';

interface ClozeBlasterProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function ClozeBlaster({ appState, updateState }: ClozeBlasterProps) {
  const [activeTab, setActiveTab] = useState<'courses' | 'repository'>('courses');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const courses = appState.clozeCourses || [];
  const publicCourses = courses.filter(c => c.isPublic);

  const refreshData = () => {
    const newState = storage.load();
    updateState(newState);
  };

  if (selectedCourseId) {
    const course = courses.find(c => c.id === selectedCourseId);
    if (course) {
      return (
        <ClozeCourseDetail
          course={course}
          appState={appState}
          updateState={updateState}
          onBack={() => setSelectedCourseId(null)}
        />
      );
    }
  }

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title" style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ClozeBlaster
        </h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          Create Course
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          My Courses
        </button>
        <button
          className={`tab ${activeTab === 'repository' ? 'active' : ''}`}
          onClick={() => setActiveTab('repository')}
        >
          Repository
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'courses' && (
          <div>
            {courses.length === 0 ? (
              <div className="card">
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  No courses yet. Create your first course to get started!
                </p>
              </div>
            ) : (
              <div className="grid">
                {courses.map(course => {
                  const sentences = appState.clozeSentences.filter(s => s.courseId === course.id);
                  const mastered = sentences.filter(s => s.masteryLevel >= 5).length;
                  const total = sentences.length;
                  const progressPercent = total > 0 ? (mastered / total) * 100 : 0;

                  return (
                    <div
                      key={course.id}
                      className="course-card"
                      onClick={() => setSelectedCourseId(course.id)}
                    >
                      <div className="course-card-title">{course.name}</div>
                      {course.description && (
                        <p style={{ color: '#656d76', marginTop: '8px', fontSize: '14px' }}>
                          {course.description}
                        </p>
                      )}
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
                        {mastered} / {total} sentences mastered
                      </div>
                      <button
                        className="btn btn-danger"
                        style={{ marginTop: '12px', width: '100%' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this course?')) {
                            storage.deleteClozeCourse(course.id);
                            refreshData();
                          }
                        }}
                      >
                        Delete Course
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'repository' && (
          <div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <h3>Public Cloze Courses</h3>
              <p style={{ color: '#656d76', marginTop: '8px' }}>
                Browse and import public sentence courses created by the community
              </p>
            </div>

            {publicCourses.length === 0 ? (
              <div className="card">
                <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
                  No public courses available yet. Create and publish a course to share it!
                </p>
              </div>
            ) : (
              <div className="grid">
                {publicCourses.map(course => {
                  const handleImport = () => {
                    // Copy course and sentences to user's collection
                    const newCourse: ClozeCourse = {
                      ...course,
                      id: `cloze-course-${Date.now()}`,
                      isPublic: false,
                      createdAt: Date.now(),
                    };

                    const sentences = appState.clozeSentences
                      .filter(s => s.courseId === course.id)
                      .map(s => ({
                        ...s,
                        id: `cloze-${Date.now()}-${s.id}`,
                        courseId: newCourse.id,
                        masteryLevel: 0,
                        correctCount: 0,
                        wrongCount: 0,
                      }));

                    storage.addClozeCourse(newCourse);
                    for (const sentence of sentences) {
                      storage.addClozeSentence(sentence);
                    }
                    refreshData();
                    setTimeout(() => {
                      setSelectedCourseId(newCourse.id);
                    }, 100);
                  };

                  return (
                    <div key={course.id} className="course-card">
                      <div className="course-card-title">{course.name}</div>
                      {course.description && (
                        <p style={{ color: '#656d76', marginTop: '8px', fontSize: '14px' }}>
                          {course.description}
                        </p>
                      )}
                      <div className="course-card-meta">
                        {course.nativeLanguage} → {course.targetLanguage}
                      </div>
                      {course.author && (
                        <div className="course-card-meta">By {course.author}</div>
                      )}
                      {course.tags.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          {course.tags.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="course-card-meta" style={{ marginTop: '8px' }}>
                        {course.sentenceCount} sentences
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '12px', width: '100%' }}
                        onClick={handleImport}
                      >
                        Import Course
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateClozeCourseModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(course) => {
            refreshData();
            setShowCreateModal(false);
            setSelectedCourseId(course.id);
          }}
        />
      )}
    </div>
  );
}
