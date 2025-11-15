import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CharacterCourse } from '../types';
import { storage } from '../storage';

interface CharacterCourseSettingsProps {
  course: CharacterCourse;
  onClose: () => void;
  onUpdate: () => void;
}

export default function CharacterCourseSettings({ course, onClose, onUpdate }: CharacterCourseSettingsProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description || '');
  const [isPublic, setIsPublic] = useState(course.isPublic);
  const [tags, setTags] = useState(course.tags.join(', '));
  const [author, setAuthor] = useState(course.author || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleSave = () => {
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    storage.updateCharacterCourse(course.id, {
      name,
      description,
      isPublic,
      tags: tagArray,
      author,
    });

    onUpdate();
    onClose();
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Character Course Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="form-group">
          <label className="form-label">Course Name</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tags (comma-separated)</label>
          <input
            type="text"
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., japanese, kanji, beginner"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Author</label>
          <input
            type="text"
            className="input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>Make this course public</span>
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>

        {/* Danger Zone */}
        <div style={{ 
          marginTop: '48px', 
          paddingTop: '24px', 
          borderTop: '1px solid #d0d7de' 
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: 600, 
            marginBottom: '16px',
            color: '#d1242f'
          }}>
            Danger Zone
          </h3>
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#fff8f8', 
            borderRadius: '6px',
            border: '1px solid #d1242f'
          }}>
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
                Are you absolutely sure? This will permanently delete <strong>{course.name}</strong> and all its characters. This action cannot be undone.
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
                      storage.deleteCharacterCourse(course.id);
                      navigate('/');
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

