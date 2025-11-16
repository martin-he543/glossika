import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppState, ClozeSentence, ClozeCourse } from '../types';
import { storage } from '../storage';
import { parseCSV, createClozeFromTatoeba } from '../utils/csv';

interface EditClozeCoursePageProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function EditClozeCoursePage({ appState, updateState }: EditClozeCoursePageProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ sentenceId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedSentences, setSelectedSentences] = useState<Set<string>>(new Set());
  const [lastSelectedSentence, setLastSelectedSentence] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState<string>('auto');
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const course = appState.clozeCourses.find(c => c.id === courseId);
  const sentences = appState.clozeSentences.filter(s => s.courseId === courseId);

  useEffect(() => {
    if (!course) {
      navigate('/');
    }
  }, [course, navigate]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  if (!course) {
    return <div className="loading">Course not found</div>;
  }

  const filteredSentences = useMemo(() => {
    if (!searchQuery) return sentences;
    const query = searchQuery.toLowerCase();
    return sentences.filter(s => 
      s.native.toLowerCase().includes(query) ||
      s.target.toLowerCase().includes(query)
    );
  }, [sentences, searchQuery]);

  const handleCellClick = (sentence: ClozeSentence, field: string) => {
    const value = field === 'native' ? sentence.native : sentence.target;
    setEditingCell({ sentenceId: sentence.id, field });
    setEditValue(value);
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const sentence = sentences.find(s => s.id === editingCell.sentenceId);
    if (!sentence) return;

    if (editingCell.field === 'target') {
      // Regenerate cloze text and answer from target
      const words = editValue.trim().split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) {
        alert('Target sentence cannot be empty');
        setEditingCell(null);
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

      storage.updateClozeSentence(editingCell.sentenceId, {
        target: editValue.trim(),
        clozeText,
        answer,
      });
    } else {
      storage.updateClozeSentence(editingCell.sentenceId, {
        native: editValue.trim(),
      });
    }

    updateState({ clozeSentences: storage.load().clozeSentences });
    setEditingCell(null);
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleCellSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const handleSelectAll = () => {
    if (selectedSentences.size === filteredSentences.length) {
      setSelectedSentences(new Set());
      setLastSelectedSentence(null);
    } else {
      const allIds = filteredSentences.map(s => s.id);
      setSelectedSentences(new Set(allIds));
      setLastSelectedSentence(allIds[allIds.length - 1]);
    }
  };

  const handleSelectSentence = (sentenceId: string, e: React.MouseEvent) => {
    const newSelected = new Set(selectedSentences);
    
    if (e.shiftKey && lastSelectedSentence) {
      // Shift-click: select range
      const currentIndex = filteredSentences.findIndex(s => s.id === sentenceId);
      const lastIndex = filteredSentences.findIndex(s => s.id === lastSelectedSentence);
      
      if (currentIndex !== -1 && lastIndex !== -1) {
        const startIndex = Math.min(currentIndex, lastIndex);
        const endIndex = Math.max(currentIndex, lastIndex);
        
        for (let i = startIndex; i <= endIndex; i++) {
          newSelected.add(filteredSentences[i].id);
        }
      }
      setLastSelectedSentence(sentenceId);
    } else {
      // Normal click: toggle single item
      if (newSelected.has(sentenceId)) {
        newSelected.delete(sentenceId);
        setLastSelectedSentence(null);
      } else {
        newSelected.add(sentenceId);
        setLastSelectedSentence(sentenceId);
      }
    }
    
    setSelectedSentences(newSelected);
  };

  const handleDeleteSentence = (sentenceId: string) => {
    const sentence = sentences.find(s => s.id === sentenceId);
    if (sentence && confirm(`Delete sentence "${sentence.native}"?`)) {
      storage.deleteClozeSentence(sentenceId);
      updateState({ clozeSentences: storage.load().clozeSentences });
      
      // Update course sentence count
      const allSentences = storage.load().clozeSentences.filter(s => s.courseId === course.id);
      storage.updateClozeCourse(course.id, {
        sentenceCount: allSentences.length,
      });
      
      // Remove from selection if selected
      const newSelected = new Set(selectedSentences);
      newSelected.delete(sentenceId);
      setSelectedSentences(newSelected);
    }
  };

  const handleBulkDelete = () => {
    if (selectedSentences.size === 0) {
      alert('Please select at least one sentence to delete');
      return;
    }

    if (confirm(`Delete ${selectedSentences.size} sentence(s)? This action cannot be undone.`)) {
      selectedSentences.forEach(sentenceId => {
        storage.deleteClozeSentence(sentenceId);
      });
      
      // Update course sentence count
      const allSentences = storage.load().clozeSentences.filter(s => s.courseId === course.id);
      storage.updateClozeCourse(course.id, {
        sentenceCount: allSentences.length,
      });
      
      updateState({ clozeSentences: storage.load().clozeSentences });
      setSelectedSentences(new Set());
      setLastSelectedSentence(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);

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

      const rows = await parseCSV(selectedFile, undefined, fileDelimiter);

      if (rows.length === 0) {
        throw new Error('CSV file is empty or could not be parsed');
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setLoading(false);
    }
  };

  const handleImportSentences = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);

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

      const rows = await parseCSV(file, undefined, fileDelimiter);
      const newSentences = createClozeFromTatoeba(rows, course.id);

      if (newSentences.length === 0) {
        throw new Error('No valid sentences found in CSV');
      }

      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < newSentences.length; i += SAVE_BATCH_SIZE) {
        const batch = newSentences.slice(i, i + SAVE_BATCH_SIZE);
        batch.forEach(s => storage.addClozeSentence(s));
      }

      const allSentences = storage.load().clozeSentences.filter(s => s.courseId === course.id);
      storage.updateClozeCourse(course.id, {
        sentenceCount: allSentences.length,
      });

      setFile(null);
      updateState({ clozeSentences: storage.load().clozeSentences });
      setShowImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import sentences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <Link to={`/cloze-course/${course.id}`} className="btn" style={{ marginBottom: '8px' }}>
            ← Back to Course
          </Link>
          <h1 className="card-title">Edit: {course.name}</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {course.nativeLanguage} → {course.targetLanguage}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => setShowImport(!showImport)}>
            {showImport ? 'Hide Import' : 'Import More Sentences'}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>Import Sentences from CSV/TSV</h3>
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

            {file && !loading && (
              <button className="btn btn-primary" onClick={handleImportSentences}>
                Import Sentences
              </button>
            )}

            {error && (
              <div style={{ padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', color: '#856404' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, marginRight: '16px' }}>
            <input
              type="text"
              placeholder="Search sentences..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
          </div>
          <button 
            className="btn btn-danger" 
            onClick={handleBulkDelete} 
            disabled={selectedSentences.size === 0}
            style={{ backgroundColor: '#da3633', color: '#ffffff', borderColor: '#da3633' }}
          >
            Delete ({selectedSentences.size})
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '16px', fontSize: '9pt' }}>
          <strong>{filteredSentences.length}</strong> sentences | Click any cell to edit (Ctrl+Enter to save, Esc to cancel) | Shift+Click to select range
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d0d7de' }}>
                <th style={{ padding: '8px', textAlign: 'left', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedSentences.size === filteredSentences.length && filteredSentences.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  {course.nativeLanguage}
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  {course.targetLanguage}
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Cloze Text
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Correct
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Wrong
                </th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: '9pt', fontWeight: 600, width: '80px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSentences.map(sentence => {
                const isEditing = editingCell?.sentenceId === sentence.id;
                return (
                  <tr key={sentence.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selectedSentences.has(sentence.id)}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSentence(sentence.id, e);
                        }}
                      />
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(sentence, 'native')}
                    >
                      {isEditing && editingCell?.field === 'native' ? (
                        <textarea
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '9pt', minHeight: '40px', resize: 'vertical' }}
                        />
                      ) : (
                        sentence.native
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(sentence, 'target')}
                    >
                      {isEditing && editingCell?.field === 'target' ? (
                        <textarea
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '9pt', minHeight: '40px', resize: 'vertical' }}
                        />
                      ) : (
                        sentence.target
                      )}
                    </td>
                    <td style={{ padding: '8px', fontSize: '9pt' }}>{sentence.clozeText}</td>
                    <td style={{ padding: '8px', fontSize: '9pt' }}>{sentence.correctCount}</td>
                    <td style={{ padding: '8px', fontSize: '9pt' }}>{sentence.wrongCount}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSentence(sentence.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#da3633',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                        title="Delete sentence"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

