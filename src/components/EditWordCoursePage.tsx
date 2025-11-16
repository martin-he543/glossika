import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppState, Word, Course } from '../types';
import { storage } from '../storage';
import { parseCSV, createWordsFromCSV } from '../utils/csv';

interface EditWordCoursePageProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function EditWordCoursePage({ appState, updateState }: EditWordCoursePageProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ wordId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [bulkLevel, setBulkLevel] = useState<number>(1);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [lastSelectedWord, setLastSelectedWord] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeCol, setNativeCol] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [levelCol, setLevelCol] = useState('');
  const [delimiter, setDelimiter] = useState<string>('auto');
  
  const inputRef = useRef<HTMLInputElement>(null);

  const course = appState.courses.find(c => c.id === courseId);
  const words = appState.words.filter(w => w.courseId === courseId);

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

  const filteredWords = useMemo(() => {
    if (!searchQuery) return words;
    const query = searchQuery.toLowerCase();
    return words.filter(w => 
      w.native.toLowerCase().includes(query) ||
      w.target.toLowerCase().includes(query) ||
      w.partOfSpeech?.toLowerCase().includes(query) ||
      w.pronunciation?.toLowerCase().includes(query)
    );
  }, [words, searchQuery]);

  const courseLevels = course.levels || [1];
  const maxLevel = Math.max(...courseLevels, 1);

  const handleCellClick = (word: Word, field: string) => {
    let value = '';
    switch (field) {
      case 'native':
        value = word.native;
        break;
      case 'target':
        value = word.target;
        break;
      case 'partOfSpeech':
        value = word.partOfSpeech || '';
        break;
      case 'pronunciation':
        value = word.pronunciation || '';
        break;
      case 'level':
        value = String(word.level || 1);
        break;
    }
    setEditingCell({ wordId: word.id, field });
    setEditValue(value);
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const word = words.find(w => w.id === editingCell.wordId);
    if (!word) return;

    const updates: Partial<Word> = {};
    
    switch (editingCell.field) {
      case 'native':
        updates.native = editValue.trim();
        break;
      case 'target':
        updates.target = editValue.trim();
        break;
      case 'partOfSpeech':
        updates.partOfSpeech = editValue.trim() || undefined;
        break;
      case 'pronunciation':
        updates.pronunciation = editValue.trim() || undefined;
        break;
      case 'level':
        const level = parseInt(editValue, 10);
        if (!isNaN(level) && level > 0) {
          updates.level = level;
        }
        break;
    }

    storage.updateWord(editingCell.wordId, updates);
    
    // If level was updated, recalculate course levels and update course in state
    if (editingCell.field === 'level') {
      const allWords = storage.load().words.filter(w => w.courseId === course.id);
      const uniqueLevels = Array.from(new Set(allWords.map(w => w.level || 1))).sort((a, b) => a - b);
      storage.updateCourse(course.id, { levels: uniqueLevels });
      updateState({ 
        words: storage.load().words,
        courses: storage.load().courses
      });
    } else {
      updateState({ words: storage.load().words });
    }
    
    setEditingCell(null);
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const handleSelectAll = () => {
    if (selectedWords.size === filteredWords.length) {
      setSelectedWords(new Set());
      setLastSelectedWord(null);
    } else {
      const allIds = filteredWords.map(w => w.id);
      setSelectedWords(new Set(allIds));
      setLastSelectedWord(allIds[allIds.length - 1]);
    }
  };

  const handleSelectWord = (wordId: string, e: React.MouseEvent) => {
    const newSelected = new Set(selectedWords);
    
    if (e.shiftKey && lastSelectedWord) {
      // Shift-click: select range
      const currentIndex = filteredWords.findIndex(w => w.id === wordId);
      const lastIndex = filteredWords.findIndex(w => w.id === lastSelectedWord);
      
      if (currentIndex !== -1 && lastIndex !== -1) {
        const startIndex = Math.min(currentIndex, lastIndex);
        const endIndex = Math.max(currentIndex, lastIndex);
        
        for (let i = startIndex; i <= endIndex; i++) {
          newSelected.add(filteredWords[i].id);
        }
      }
      setLastSelectedWord(wordId);
    } else {
      // Normal click: toggle single item
      if (newSelected.has(wordId)) {
        newSelected.delete(wordId);
        setLastSelectedWord(null);
      } else {
        newSelected.add(wordId);
        setLastSelectedWord(wordId);
      }
    }
    
    setSelectedWords(newSelected);
  };

  const handleDeleteWord = (wordId: string) => {
    const word = words.find(w => w.id === wordId);
    if (word && confirm(`Delete "${word.native}" - "${word.target}"?`)) {
      const state = storage.load();
      state.words = state.words.filter(w => w.id !== wordId);
      storage.save(state);
      updateState({ words: storage.load().words });
      
      // Remove from selection if selected
      const newSelected = new Set(selectedWords);
      newSelected.delete(wordId);
      setSelectedWords(newSelected);
    }
  };

  const handleBulkDelete = () => {
    if (selectedWords.size === 0) {
      alert('Please select at least one word to delete');
      return;
    }

    if (confirm(`Delete ${selectedWords.size} word(s)? This action cannot be undone.`)) {
      const state = storage.load();
      state.words = state.words.filter(w => !selectedWords.has(w.id));
      storage.save(state);
      
      // Update course word count and levels
      const allWords = storage.getWordsByCourse(course.id);
      const uniqueLevels = Array.from(new Set(allWords.map(w => w.level || 1))).sort((a, b) => a - b);
      storage.updateCourse(course.id, {
        wordCount: allWords.length,
        levels: uniqueLevels,
      });
      
      updateState({ 
        words: storage.load().words,
        courses: storage.load().courses
      });
      setSelectedWords(new Set());
      setLastSelectedWord(null);
    }
  };

  const handleBulkAssignLevel = () => {
    if (selectedWords.size === 0) {
      alert('Please select at least one word');
      return;
    }

    if (confirm(`Assign level ${bulkLevel} to ${selectedWords.size} word(s)?`)) {
      selectedWords.forEach(wordId => {
        storage.updateWord(wordId, { level: bulkLevel });
      });

      // Recalculate all levels from words (not just add the new one)
      const allWords = storage.getWordsByCourse(course.id);
      const uniqueLevels = Array.from(new Set(allWords.map(w => w.level || 1))).sort((a, b) => a - b);
      storage.updateCourse(course.id, { levels: uniqueLevels });

      setSelectedWords(new Set());
      updateState({ 
        words: storage.load().words,
        courses: storage.load().courses
      });
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

      const headers = Object.keys(rows[0] || {});
      
      if (headers.length < 2) {
        throw new Error('CSV/TSV file must have at least 2 columns');
      }

      const nativePatterns = ['native', 'english', 'en', 'source', 'definition'];
      const targetPatterns = ['target', 'translation', 'trans', 'foreign', 'label'];
      const levelPatterns = ['level', 'lvl'];
      
      let detectedNative: string | undefined;
      let detectedTarget: string | undefined;
      let detectedLevel: string | undefined;
      
      for (const header of headers) {
        const lower = header.toLowerCase().trim();
        if (!detectedNative && nativePatterns.some(p => lower === p || lower.includes(p))) {
          detectedNative = header;
        }
        if (!detectedTarget && targetPatterns.some(p => lower === p || lower.includes(p))) {
          detectedTarget = header;
        }
        if (!detectedLevel && levelPatterns.some(p => lower === p)) {
          detectedLevel = header;
        }
      }
      
      if (!detectedNative) detectedNative = headers[0];
      if (!detectedTarget) detectedTarget = headers[1] || headers[0];
      
      setNativeCol(detectedNative.toLowerCase().trim());
      setTargetCol(detectedTarget.toLowerCase().trim());
      setLevelCol(detectedLevel?.toLowerCase().trim() || '');

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setLoading(false);
    }
  };

  const handleImportWords = async () => {
    if (!file || !nativeCol || !targetCol) {
      setError('Please select a CSV file and verify column names');
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
      const newWords = createWordsFromCSV(rows, course.id, nativeCol, targetCol, levelCol || undefined);

      if (newWords.length === 0) {
        throw new Error('No valid words found in CSV');
      }

      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < newWords.length; i += SAVE_BATCH_SIZE) {
        const batch = newWords.slice(i, i + SAVE_BATCH_SIZE);
        storage.addWords(batch);
      }

      const allWords = storage.getWordsByCourse(course.id);
      const uniqueLevels = Array.from(new Set(allWords.map(w => w.level || 1))).sort((a, b) => a - b);
      storage.updateCourse(course.id, {
        wordCount: allWords.length,
        levels: uniqueLevels,
      });

      setFile(null);
      updateState({ words: storage.load().words });
      setShowImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import words');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    const newState = storage.load();
    updateState(newState);
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <Link to={`/course/${course.id}`} className="btn" style={{ marginBottom: '8px' }}>
            ← Back to Course
          </Link>
          <h1 className="card-title">Edit: {course.name}</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {course.nativeLanguage} → {course.targetLanguage}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => setShowImport(!showImport)}>
            {showImport ? 'Hide Import' : 'Import More Words'}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>Import Words from CSV/TSV</h3>
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
              <div>
                <div style={{ marginBottom: '12px', fontSize: '14px' }}>
                  <strong>Column Names:</strong>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                      Native Column ({course.nativeLanguage})
                    </label>
                    <input
                      type="text"
                      value={nativeCol}
                      onChange={(e) => setNativeCol(e.target.value)}
                      style={{ width: '100%', padding: '6px', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                      Target Column ({course.targetLanguage})
                    </label>
                    <input
                      type="text"
                      value={targetCol}
                      onChange={(e) => setTargetCol(e.target.value)}
                      style={{ width: '100%', padding: '6px', fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                      Level Column (optional)
                    </label>
                    <input
                      type="text"
                      value={levelCol}
                      onChange={(e) => setLevelCol(e.target.value)}
                      style={{ width: '100%', padding: '6px', fontSize: '14px' }}
                    />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleImportWords} disabled={loading}>
                  Import Words
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
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ flex: 1, marginRight: '16px' }}>
            <input
              type="text"
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={bulkLevel}
              onChange={(e) => setBulkLevel(parseInt(e.target.value, 10))}
              style={{ padding: '6px 12px', fontSize: '14px' }}
            >
              {Array.from({ length: maxLevel + 5 }, (_, i) => i + 1).map(level => (
                <option key={level} value={level}>Level {level}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={handleBulkAssignLevel} disabled={selectedWords.size === 0}>
              Bulk Assign Level ({selectedWords.size})
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleBulkDelete} 
              disabled={selectedWords.size === 0}
              style={{ backgroundColor: '#da3633', color: '#ffffff', borderColor: '#da3633' }}
            >
              Delete ({selectedWords.size})
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '16px', fontSize: '9pt' }}>
          <strong>{filteredWords.length}</strong> words | Click any cell to edit | Shift+Click to select range
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d0d7de' }}>
                <th style={{ padding: '8px', textAlign: 'left', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedWords.size === filteredWords.length && filteredWords.length > 0}
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
                  Part of Speech
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Pronunciation
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Level
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
              {filteredWords.map(word => {
                const isEditing = editingCell?.wordId === word.id;
                return (
                  <tr key={word.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selectedWords.has(word.id)}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectWord(word.id, e);
                        }}
                      />
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(word, 'native')}
                    >
                      {isEditing && editingCell?.field === 'native' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '9pt' }}
                        />
                      ) : (
                        word.native
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(word, 'target')}
                    >
                      {isEditing && editingCell?.field === 'target' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '9pt' }}
                        />
                      ) : (
                        word.target
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(word, 'partOfSpeech')}
                    >
                      {isEditing && editingCell?.field === 'partOfSpeech' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '9pt' }}
                        />
                      ) : (
                        word.partOfSpeech || '-'
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(word, 'pronunciation')}
                    >
                      {isEditing && editingCell?.field === 'pronunciation' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '9pt' }}
                        />
                      ) : (
                        word.pronunciation || '-'
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(word, 'level')}
                    >
                      {isEditing && editingCell?.field === 'level' ? (
                        <input
                          ref={inputRef}
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '9pt' }}
                          min="1"
                        />
                      ) : (
                        word.level || 1
                      )}
                    </td>
                    <td style={{ padding: '8px', fontSize: '9pt' }}>{word.correctCount}</td>
                    <td style={{ padding: '8px', fontSize: '9pt' }}>{word.wrongCount}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWord(word.id);
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
                        title="Delete word"
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

