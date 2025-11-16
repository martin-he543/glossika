import { useState, useMemo } from 'react';
import { ClozeSentence, ClozeCourse } from '../types';
import { storage } from '../storage';
import { parseCSV, createClozeFromTatoeba, CSVRow } from '../utils/csv';

interface EditClozeCourseProps {
  course: ClozeCourse;
  sentences: ClozeSentence[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditClozeCourse({ course, sentences, onClose, onUpdate }: EditClozeCourseProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'import'>('edit');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSentence, setEditingSentence] = useState<ClozeSentence | null>(null);
  const [editNative, setEditNative] = useState('');
  const [editTarget, setEditTarget] = useState('');
  
  // CSV Import
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState<string>('auto');

  const filteredSentences = useMemo(() => {
    if (!searchQuery) return sentences;
    const query = searchQuery.toLowerCase();
    return sentences.filter(s => 
      s.native.toLowerCase().includes(query) ||
      s.target.toLowerCase().includes(query)
    );
  }, [sentences, searchQuery]);

  // Handle sentence editing
  const handleEdit = (sentence: ClozeSentence) => {
    setEditingSentence(sentence);
    setEditNative(sentence.native);
    setEditTarget(sentence.target);
  };

  const handleSaveEdit = () => {
    if (!editingSentence) return;
    
    // Regenerate cloze text and answer from target
    const words = editTarget.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      alert('Target sentence cannot be empty');
      return;
    }

    let clozeText: string;
    let answer: string;
    
    if (words.length === 1) {
      answer = words[0];
      clozeText = '_____';
    } else {
      const randomIndex = Math.floor(Math.random() * words.length);
      answer = words[randomIndex];
      words[randomIndex] = '_____';
      clozeText = words.join(' ');
    }

    // Update sentence in storage
    storage.updateClozeSentence(editingSentence.id, {
      native: editNative.trim(),
      target: editTarget.trim(),
      clozeText,
      answer,
    });

    setEditingSentence(null);
    onUpdate();
  };

  const handleCancelEdit = () => {
    setEditingSentence(null);
  };

  // CSV Import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);
    setProgress(0);

    try {
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

      if (rows.length === 0) {
        throw new Error('CSV file is empty or could not be parsed');
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setLoading(false);
      setProgress(0);
    }
  };

  const handleImportSentences = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
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
        setProgress(Math.min(90, progress));
      }, fileDelimiter);

      const newSentences = createClozeFromTatoeba(rows, course.id);
      
      setProgress(90);

      if (newSentences.length === 0) {
        throw new Error('No valid sentences found in CSV');
      }

      // Add sentences in batches
      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < newSentences.length; i += SAVE_BATCH_SIZE) {
        const batch = newSentences.slice(i, i + SAVE_BATCH_SIZE);
        batch.forEach(s => storage.addClozeSentence(s));
        setProgress(90 + Math.floor((i / newSentences.length) * 10));
      }

      // Update course sentence count
      const allSentences = storage.load().clozeSentences.filter(s => s.courseId === course.id);
      storage.updateClozeCourse(course.id, {
        sentenceCount: allSentences.length,
      });

      setProgress(100);
      setFile(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import sentences');
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>Edit Course: {course.name}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="tabs" style={{ marginBottom: '24px' }}>
            <button
              className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              Edit Sentences
            </button>
            <button
              className={`tab ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              Import More Sentences
            </button>
          </div>

          {activeTab === 'edit' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search sentences..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                />
              </div>

              {editingSentence ? (
                <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                  <h3 style={{ marginBottom: '16px' }}>Edit Sentence</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        {course.nativeLanguage}
                      </label>
                      <textarea
                        value={editNative}
                        onChange={(e) => setEditNative(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '14px', minHeight: '60px', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        {course.targetLanguage}
                      </label>
                      <textarea
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '14px', minHeight: '60px', resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" onClick={handleSaveEdit}>
                        Save
                      </button>
                      <button className="btn" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {filteredSentences.map(sentence => (
                  <div
                    key={sentence.id}
                    style={{
                      padding: '12px',
                      border: '1px solid #d0d7de',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleEdit(sentence)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '8px' }}>
                        <div><strong>{sentence.native}</strong></div>
                        <div style={{ color: '#656d76', marginTop: '4px' }}>{sentence.target}</div>
                        <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                          Cloze: {sentence.clozeText}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#656d76' }}>
                        Mastery: {sentence.masteryLevel} | Correct: {sentence.correctCount} | Wrong: {sentence.wrongCount}
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(sentence);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div>
              <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ marginBottom: '12px' }}>Import Sentences from CSV/TSV</h3>
                <p style={{ color: '#656d76', marginBottom: '16px', fontSize: '14px' }}>
                  Import additional sentences to this course. The CSV should have columns for native and target sentences.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                      Delimiter
                    </label>
                    <select
                      value={delimiter}
                      onChange={(e) => setDelimiter(e.target.value)}
                      style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                    >
                      <option value="auto">Auto-detect</option>
                      <option value="comma">Comma (,)</option>
                      <option value="semicolon">Semicolon (;)</option>
                      <option value="tab">Tab (TSV)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                      CSV/TSV File
                    </label>
                    <input
                      type="file"
                      accept=".csv,.tsv"
                      onChange={handleFileChange}
                      disabled={loading}
                      style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                    />
                  </div>

                  {loading && (
                    <div>
                      <div style={{ fontSize: '14px', color: '#656d76', marginBottom: '4px' }}>
                        Processing... {progress}%
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  {file && !loading && (
                    <div>
                      <button className="btn btn-primary" onClick={handleImportSentences}>
                        Import Sentences
                      </button>
                    </div>
                  )}

                  {error && (
                    <div style={{ padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', color: '#856404' }}>
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

