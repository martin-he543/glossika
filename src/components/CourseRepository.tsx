import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, Course, ClozeCourse } from '../types';
import { storage } from '../storage';

interface CourseRepositoryProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function CourseRepository({ appState, updateState }: CourseRepositoryProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [courseType, setCourseType] = useState<'words' | 'cloze'>('words');

  const publicCourses = courseType === 'words' 
    ? appState.courses.filter(c => c.isPublic)
    : (appState.clozeCourses || []).filter(c => c.isPublic);
  
  // Get unique languages and tags
  const languages = Array.from(new Set(publicCourses.flatMap(c => [c.nativeLanguage, c.targetLanguage])));
  const tags = Array.from(new Set(publicCourses.flatMap(c => c.tags)));

  const filteredCourses = publicCourses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLanguage = selectedLanguage === 'all' ||
      course.nativeLanguage === selectedLanguage ||
      course.targetLanguage === selectedLanguage;
    
    const matchesTag = selectedTag === 'all' ||
      course.tags.includes(selectedTag);

    return matchesSearch && matchesLanguage && matchesTag;
  });

  const handleImportCourse = (course: Course | ClozeCourse) => {
    if (courseType === 'words') {
      const wordCourse = course as Course;
      // Copy course and words to user's collection
      const newCourse: Course = {
        ...wordCourse,
        id: `course-${Date.now()}`,
        isPublic: false, // Imported courses are private by default
        createdAt: Date.now(),
      };

      const words = appState.words
        .filter(w => w.courseId === wordCourse.id)
        .map(w => ({
          ...w,
          id: `${newCourse.id}-${Date.now()}-${w.id}`,
          courseId: newCourse.id,
          srsLevel: 0, // Reset progress
          masteryLevel: 'seed' as const,
          correctCount: 0,
          wrongCount: 0,
        }));

      storage.addCourse(newCourse);
      storage.addWords(words);
      updateState({
        courses: storage.load().courses,
        words: storage.load().words,
      });

      navigate(`/course/${newCourse.id}`);
    } else {
      const clozeCourse = course as ClozeCourse;
      // Copy cloze course and sentences to user's collection
      const newCourse: ClozeCourse = {
        ...clozeCourse,
        id: `cloze-course-${Date.now()}`,
        isPublic: false,
        createdAt: Date.now(),
      };

      const sentences = appState.clozeSentences
        .filter(s => s.courseId === clozeCourse.id)
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
      updateState({
        clozeCourses: storage.load().clozeCourses,
        clozeSentences: storage.load().clozeSentences,
      });

      // Navigate to ClozePractice - we'll need to handle this differently
      window.location.href = '/clozepractice';
    }
  };

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">Course Repository</h1>
        <p style={{ color: '#656d76', marginTop: '4px' }}>
          Browse and import public courses created by the community
        </p>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">Course Type</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${courseType === 'words' ? 'btn-primary' : ''}`}
              onClick={() => setCourseType('words')}
            >
              Word Courses
            </button>
            <button
              className={`btn ${courseType === 'cloze' ? 'btn-primary' : ''}`}
              onClick={() => setCourseType('cloze')}
            >
              Cloze Courses
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: '16px' }}>
          <div>
            <label className="form-label">Search</label>
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses..."
            />
          </div>
          <div>
            <label className="form-label">Language</label>
            <select
              className="select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="all">All Languages</option>
              {languages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Tag</label>
            <select
              className="select"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="all">All Tags</option>
              {tags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#656d76', padding: '32px' }}>
            {publicCourses.length === 0
              ? 'No public courses available yet. Create and publish a course to share it!'
              : 'No courses match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid">
          {filteredCourses.map(course => (
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
                {courseType === 'words' ? (course as Course).wordCount : (course as ClozeCourse).sentenceCount} {courseType === 'words' ? 'words' : 'sentences'}
              </div>
              <button
                className="btn btn-primary"
                style={{ marginTop: '12px', width: '100%' }}
                onClick={() => handleImportCourse(course)}
              >
                Import Course
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

