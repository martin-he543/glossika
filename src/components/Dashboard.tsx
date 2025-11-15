import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, Course } from '../types';
import { storage } from '../storage';
import { LANGUAGES } from '../utils/languages';
import { parseCSV, createWordsFromCSV } from '../utils/csv';
import CreateCourseModal from './CreateCourseModal';

interface DashboardProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function Dashboard({ appState, updateState }: DashboardProps) {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCourseClick = (courseId: string) => {
    navigate(`/course/${courseId}`);
  };

  const handleDeleteCourse = (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this course?')) {
      storage.deleteCourse(courseId);
      updateState({
        courses: storage.load().courses,
        words: storage.load().words,
        courseProgress: storage.load().courseProgress,
      });
    }
  };

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">My Courses</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          Create Course
        </button>
      </div>

      {appState.courses.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
            No courses yet. Create your first course to get started!
          </p>
        </div>
      ) : (
        <div className="grid">
          {appState.courses.map(course => {
            const progress = appState.courseProgress.find(p => p.courseId === course.id);
            const words = appState.words.filter(w => w.courseId === course.id);
            const learned = words.filter(w => w.srsLevel > 0).length;
            const total = words.length;
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
                  {learned} / {total} words learned
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
    </div>
  );
}

