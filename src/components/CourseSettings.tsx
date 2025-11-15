import { useState } from 'react';
import { Course } from '../types';
import { storage } from '../storage';

interface CourseSettingsProps {
  course: Course;
  onClose: () => void;
  onUpdate: () => void;
}

export default function CourseSettings({ course, onClose, onUpdate }: CourseSettingsProps) {
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description || '');
  const [isPublic, setIsPublic] = useState(course.isPublic);
  const [tags, setTags] = useState(course.tags.join(', '));
  const [author, setAuthor] = useState(course.author || '');

  const handleSave = () => {
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    storage.updateCourse(course.id, {
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
          <h2 className="modal-title">Course Settings</h2>
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
            style={{ resize: 'vertical' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Author</label>
          <input
            type="text"
            className="input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tags (comma-separated)</label>
          <input
            type="text"
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="beginner, vocabulary, grammar"
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Make this course public (visible in repository)
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

