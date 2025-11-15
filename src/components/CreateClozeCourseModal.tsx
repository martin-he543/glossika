import { useState } from 'react';
import { ClozeCourse, ClozeSentence } from '../types';
import { storage } from '../storage';
import { LANGUAGES } from '../utils/languages';
import { parseCSV, createClozeFromTatoeba } from '../utils/csv';
import Papa from 'papaparse';

interface CreateClozeCourseModalProps {
  onClose: () => void;
  onSuccess: (course: ClozeCourse) => void;
}

export default function CreateClozeCourseModal({ onClose, onSuccess }: CreateClozeCourseModalProps) {
  const [name, setName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [customNative, setCustomNative] = useState('');
  const [customTarget, setCustomTarget] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [author, setAuthor] = useState('');
  const [delimiter, setDelimiter] = useState<string>('auto');
  const [additionalColumns, setAdditionalColumns] = useState<string[]>([]);

  const finalNativeLanguage = nativeLanguage === 'Other' ? customNative : nativeLanguage;
  const finalTargetLanguage = targetLanguage === 'Other' ? customTarget : targetLanguage;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);
    setProgress(0);

    try {
      // Determine delimiter
      let fileDelimiter: string | undefined = undefined;
      if (delimiter !== 'auto') {
        fileDelimiter = delimiter === 'semicolon' ? ';' : delimiter === 'tab' ? '\t' : ',';
      } else {
        const fileName = selectedFile.name.toLowerCase();
        if (fileName.endsWith('.tsv')) {
          fileDelimiter = '\t';
        }
      }

      const rows = await parseCSV(selectedFile, (progress) => {
        setProgress(Math.min(90, progress));
      }, fileDelimiter);

      setProgress(100);
      
      // Detect additional columns
      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const standardCols = ['native', 'target', 'language', 'english', 'translation', 'sentence1', 'sentence2'];
        const otherCols = headers.filter(h => 
          !standardCols.some(sc => h.toLowerCase().includes(sc.toLowerCase()))
        );
        setAdditionalColumns(otherCols);
      }
      
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setLoading(false);
      setProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name || !finalNativeLanguage || !finalTargetLanguage) {
      setError('Please fill in all required fields and select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Determine delimiter
      let fileDelimiter: string | undefined = undefined;
      if (delimiter !== 'auto') {
        fileDelimiter = delimiter === 'semicolon' ? ';' : delimiter === 'tab' ? '\t' : ',';
      } else {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.tsv')) {
          fileDelimiter = '\t';
        }
      }

      const rows = await parseCSV(file, (progress) => {
        setProgress(Math.min(40, progress * 0.4));
      }, fileDelimiter);

      setProgress(50);

      const course: ClozeCourse = {
        id: `cloze-course-${Date.now()}`,
        name,
        nativeLanguage: finalNativeLanguage,
        targetLanguage: finalTargetLanguage,
        createdAt: Date.now(),
        isPublic,
        tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        description,
        sentenceCount: 0,
        author: author || undefined,
      };

      // Process in batches
      const BATCH_SIZE = 1000;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      const allSentences: ClozeSentence[] = [];
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, rows.length);
        const batch = rows.slice(start, end);
        
        const batchSentences = createClozeFromTatoeba(batch, course.id);
        allSentences.push(...batchSentences);
        
        const progressPercent = 50 + Math.floor(((i + 1) / totalBatches) * 40);
        setProgress(progressPercent);
      }

      if (allSentences.length === 0) {
        throw new Error('No valid sentences found in CSV. Please check the format.');
      }

      course.sentenceCount = allSentences.length;

      // Save in batches
      setProgress(90);
      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < allSentences.length; i += SAVE_BATCH_SIZE) {
        const batch = allSentences.slice(i, i + SAVE_BATCH_SIZE);
        for (const sentence of batch) {
          storage.addClozeSentence(sentence);
        }
        const saveProgress = 90 + Math.floor((i / allSentences.length) * 10);
        setProgress(Math.min(99, saveProgress));
      }

      storage.addClozeCourse(course);
      setProgress(100);

      setTimeout(() => {
        onSuccess(course);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course');
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Cloze Course</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Course Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Native Language</label>
            <select
              className="select"
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              required
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            {nativeLanguage === 'Other' && (
              <input
                type="text"
                className="input"
                style={{ marginTop: '8px' }}
                value={customNative}
                onChange={(e) => setCustomNative(e.target.value)}
                placeholder="Enter language name"
                required
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Target Language</label>
            <select
              className="select"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              required
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            {targetLanguage === 'Other' && (
              <input
                type="text"
                className="input"
                style={{ marginTop: '8px' }}
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                placeholder="Enter language name"
                required
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Author (optional)</label>
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

          <div className="form-group">
            <label className="form-label">CSV/TSV File</label>
            <input
              type="file"
              accept=".csv,.tsv"
              onChange={handleFileChange}
              required
            />
            <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
              Supports CSV (.csv) and TSV (.tsv) files
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Delimiter</label>
            <select
              className="select"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
            >
              <option value="auto">Auto-detect (from file extension)</option>
              <option value="comma">Comma (,)</option>
              <option value="semicolon">Semicolon (;)</option>
              <option value="tab">Tab (TSV)</option>
            </select>
            <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
              TSV files automatically use tab delimiter
            </div>
          </div>

          {loading && (
            <div className="form-group">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                {progress < 100 ? `Processing... ${progress}%` : 'Complete!'}
              </div>
            </div>
          )}

          {additionalColumns.length > 0 && (
            <div className="form-group">
              <label className="form-label">Additional Columns Detected (optional)</label>
              <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '8px' }}>
                These columns will be preserved in the data but are not required for sentence creation.
                Examples: notes, phonetic guide, difficulty level, etc.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', backgroundColor: '#f6f8fa', borderRadius: '4px' }}>
                {additionalColumns.map(col => (
                  <span key={col} style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#ffffff', border: '1px solid #d0d7de', borderRadius: '4px' }}>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

