import { useState } from 'react';
import { ClozeCourse, ClozeSentence } from '../types';
import { storage } from '../storage';

interface ClozeCourseSettingsProps {
  course: ClozeCourse;
  sentences: ClozeSentence[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function ClozeCourseSettings({ course, sentences, onClose, onUpdate }: ClozeCourseSettingsProps) {
  const [activeSection, setActiveSection] = useState<'general' | 'sentences'>('general');
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description || '');
  const [isPublic, setIsPublic] = useState(course.isPublic);
  const [tags, setTags] = useState(course.tags.join(', '));
  const [author, setAuthor] = useState(course.author || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingSentenceId, setDeletingSentenceId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const filteredSentences = sentences.filter(s => 
    s.native.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.target.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = () => {
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    storage.updateClozeCourse(course.id, {
      name,
      description,
      isPublic,
      tags: tagArray,
      author,
    });

    onUpdate();
  };

  const handleDeleteSentence = (sentenceId: string) => {
    if (confirm('Are you sure you want to delete this sentence? This action cannot be undone.')) {
      setDeletingSentenceId(sentenceId);
      storage.deleteClozeSentence(sentenceId);
      onUpdate();
      setDeletingSentenceId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <button className="btn" onClick={onClose} style={{ marginBottom: '16px' }}>
          ← Back to Course
        </button>
        <h1 className="card-title" style={{ marginBottom: '8px' }}>Settings</h1>
        <div style={{ fontSize: '14px', color: '#656d76' }}>
          {course.nativeLanguage} → {course.targetLanguage}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px' }}>
        {/* Sidebar Navigation */}
        <div>
          <nav style={{ position: 'sticky', top: '80px' }}>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '4px' }}>
                <button
                  onClick={() => setActiveSection('general')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'block',
                    padding: '8px 12px',
                    color: activeSection === 'general' ? '#ffffff' : '#24292f',
                    textDecoration: 'none',
                    fontSize: '14px',
                    borderRadius: '6px',
                    backgroundColor: activeSection === 'general' ? '#0969da' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (activeSection !== 'general') {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeSection !== 'general') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  General
                </button>
              </li>
              <li style={{ marginBottom: '4px' }}>
                <button
                  onClick={() => setActiveSection('sentences')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'block',
                    padding: '8px 12px',
                    color: activeSection === 'sentences' ? '#ffffff' : '#24292f',
                    textDecoration: 'none',
                    fontSize: '14px',
                    borderRadius: '6px',
                    backgroundColor: activeSection === 'sentences' ? '#0969da' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (activeSection !== 'sentences') {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeSection !== 'sentences') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  Sentences
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <div>
          {/* General Settings */}
          {activeSection === 'general' && (
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #d0d7de' }}>
              General
            </h2>

            <div className="card" style={{ marginBottom: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Course Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ maxWidth: '400px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Description
                </label>
                <textarea
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  style={{ resize: 'vertical', maxWidth: '600px' }}
                  placeholder="Describe your course..."
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Author
                </label>
                <input
                  type="text"
                  className="input"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  style={{ maxWidth: '400px' }}
                  placeholder="Your name"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Tags
                </label>
                <input
                  type="text"
                  className="input"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  style={{ maxWidth: '400px' }}
                  placeholder="beginner, vocabulary, grammar"
                />
                <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                  Separate tags with commas
                </div>
              </div>

              <div style={{ 
                padding: '16px', 
                backgroundColor: '#f6f8fa', 
                borderRadius: '6px',
                border: '1px solid #d0d7de',
                marginTop: '16px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Make this course public</div>
                    <div style={{ fontSize: '12px', color: '#656d76' }}>
                      Public courses are visible in the repository and can be imported by other users.
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ marginTop: '24px' }}>
                <button className="btn btn-primary" onClick={handleSave}>
                  Save changes
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Sentences Management */}
          {activeSection === 'sentences' && (
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #d0d7de' }}>
              Sentences ({sentences.length})
            </h2>

            <div className="card">
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Search Sentences
                </label>
                <input
                  type="text"
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by native or target text..."
                  style={{ maxWidth: '400px' }}
                />
              </div>

              {filteredSentences.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#656d76' }}>
                  {searchQuery ? 'No sentences found matching your search.' : 'No sentences in this course.'}
                </div>
              ) : (
                <div style={{ border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr auto',
                    gap: '16px',
                    padding: '12px 16px',
                    backgroundColor: '#f6f8fa',
                    borderBottom: '1px solid #d0d7de',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#656d76'
                  }}>
                    <div>Sentence</div>
                    <div style={{ textAlign: 'right' }}>Actions</div>
                  </div>
                  {filteredSentences.map((sentence, index) => (
                    <div
                      key={sentence.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '16px',
                        padding: '16px',
                        borderBottom: index < filteredSentences.length - 1 ? '1px solid #d0d7de' : 'none',
                        alignItems: 'start',
                      }}
                    >
                      <div>
                        <div style={{ marginBottom: '8px', fontWeight: 500 }}>
                          {sentence.native}
                        </div>
                        <div style={{ fontSize: '14px', color: '#656d76' }}>
                          {sentence.target}
                        </div>
                        <div style={{ fontSize: '12px', color: '#656d76', marginTop: '8px' }}>
                          Mastery: {sentence.masteryLevel}/5 • Correct: {sentence.correctCount} • Wrong: {sentence.wrongCount}
                        </div>
                      </div>
                      <div>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteSentence(sentence.id)}
                          disabled={deletingSentenceId === sentence.id}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          {deletingSentenceId === sentence.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* Danger Zone */}
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #d0d7de', color: '#d1242f' }}>
              Danger Zone
            </h2>
            <div className="card" style={{ border: '1px solid #d1242f', backgroundColor: '#fff8f8' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>Delete this course</div>
                <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '16px' }}>
                  Once you delete a course, there is no going back. Please be certain.
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete this course
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: '#d1242f' }}>Delete Course</h2>
              <button className="close-btn" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '16px' }}>
              <p style={{ marginBottom: '16px' }}>
                Are you absolutely sure? This will permanently delete <strong>{course.name}</strong> and all its sentences. This action cannot be undone.
              </p>
              <p style={{ marginBottom: '16px', fontSize: '14px', color: '#656d76' }}>
                Please type <strong>{course.name}</strong> to confirm:
              </p>
              <input
                type="text"
                className="input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={course.name}
                style={{ marginBottom: '16px' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (deleteConfirmText === course.name) {
                      storage.deleteClozeCourse(course.id);
                      onUpdate();
                      onClose();
                    }
                  }}
                  disabled={deleteConfirmText !== course.name}
                  style={{
                    opacity: deleteConfirmText === course.name ? 1 : 0.5,
                    cursor: deleteConfirmText === course.name ? 'pointer' : 'not-allowed'
                  }}
                >
                  I understand the consequences, delete this course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
