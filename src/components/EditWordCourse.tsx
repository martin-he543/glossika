import { useState, useEffect, useMemo } from 'react';
import { Word, Course } from '../types';
import { storage } from '../storage';
import { parseCSV, createWordsFromCSV, CSVRow } from '../utils/csv';

interface EditWordCourseProps {
  course: Course;
  words: Word[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditWordCourse({ course, words, onClose, onUpdate }: EditWordCourseProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'import' | 'bulk'>('edit');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [editNative, setEditNative] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editPartOfSpeech, setEditPartOfSpeech] = useState('');
  const [editPronunciation, setEditPronunciation] = useState('');
  const [editLevel, setEditLevel] = useState<number>(1);
  
  // Bulk level assignment
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [bulkLevel, setBulkLevel] = useState<number>(1);
  const [selectAll, setSelectAll] = useState(false);
  
  // CSV Import
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nativeCol, setNativeCol] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [levelCol, setLevelCol] = useState('');
  const [delimiter, setDelimiter] = useState<string>('auto');

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

  // Handle word editing
  const handleEdit = (word: Word) => {
    setEditingWord(word);
    setEditNative(word.native);
    setEditTarget(word.target);
    setEditPartOfSpeech(word.partOfSpeech || '');
    setEditPronunciation(word.pronunciation || '');
    setEditLevel(word.level || 1);
  };

  const handleSaveEdit = () => {
    if (!editingWord) return;
    
    // Update word in storage
    storage.updateWord(editingWord.id, {
      native: editNative.trim(),
      target: editTarget.trim(),
      partOfSpeech: editPartOfSpeech.trim() || undefined,
      pronunciation: editPronunciation.trim() || undefined,
      level: editLevel,
    });

    // Update course levels if needed
    if (!courseLevels.includes(editLevel)) {
      const newLevels = [...courseLevels, editLevel].sort((a, b) => a - b);
      storage.updateCourse(course.id, { levels: newLevels });
    }

    setEditingWord(null);
    onUpdate();
  };

  const handleCancelEdit = () => {
    setEditingWord(null);
  };

  // Bulk level assignment
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(filteredWords.map(w => w.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectWord = (wordId: string) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(wordId)) {
      newSelected.delete(wordId);
    } else {
      newSelected.add(wordId);
    }
    setSelectedWords(newSelected);
    setSelectAll(newSelected.size === filteredWords.length);
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

      // Update course levels if needed
      if (!courseLevels.includes(bulkLevel)) {
        const newLevels = [...courseLevels, bulkLevel].sort((a, b) => a - b);
        storage.updateCourse(course.id, { levels: newLevels });
      }

      setSelectedWords(new Set());
      setSelectAll(false);
      onUpdate();
    }
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

      const headers = Object.keys(rows[0] || {});
      
      if (headers.length < 2) {
        throw new Error('CSV/TSV file must have at least 2 columns');
      }

      // Simple column detection
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
      
      const finalNative = detectedNative.toLowerCase().trim();
      const finalTarget = detectedTarget.toLowerCase().trim();
      const finalLevel = detectedLevel?.toLowerCase().trim() || '';
      
      setNativeCol(finalNative);
      setTargetCol(finalTarget);
      setLevelCol(finalLevel);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setLoading(false);
      setProgress(0);
    }
  };

  const handleImportWords = async () => {
    if (!file || !nativeCol || !targetCol) {
      setError('Please select a CSV file and verify column names');
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

      const newWords = createWordsFromCSV(rows, course.id, nativeCol, targetCol, levelCol || undefined);
      
      setProgress(90);

      if (newWords.length === 0) {
        throw new Error('No valid words found in CSV');
      }

      // Add words in batches
      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < newWords.length; i += SAVE_BATCH_SIZE) {
        const batch = newWords.slice(i, i + SAVE_BATCH_SIZE);
        storage.addWords(batch);
        setProgress(90 + Math.floor((i / newWords.length) * 10));
      }

      // Update course word count and levels
      const allWords = storage.getWordsByCourse(course.id);
      const uniqueLevels = Array.from(new Set(allWords.map(w => w.level || 1))).sort((a, b) => a - b);
      storage.updateCourse(course.id, {
        wordCount: allWords.length,
        levels: uniqueLevels,
      });

      setProgress(100);
      setFile(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import words');
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
              Edit Words
            </button>
            <button
              className={`tab ${activeTab === 'bulk' ? 'active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              Bulk Assign Levels
            </button>
            <button
              className={`tab ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              Import More Words
            </button>
          </div>

          {activeTab === 'edit' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search words..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                />
              </div>

              {editingWord ? (
                <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                  <h3 style={{ marginBottom: '16px' }}>Edit Word</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        {course.nativeLanguage}
                      </label>
                      <input
                        type="text"
                        value={editNative}
                        onChange={(e) => setEditNative(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        {course.targetLanguage}
                      </label>
                      <input
                        type="text"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        Part of Speech (optional)
                      </label>
                      <input
                        type="text"
                        value={editPartOfSpeech}
                        onChange={(e) => setEditPartOfSpeech(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                        placeholder="noun, verb, adjective, etc."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        Pronunciation (optional)
                      </label>
                      <input
                        type="text"
                        value={editPronunciation}
                        onChange={(e) => setEditPronunciation(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                        placeholder="IPA, phonetic, etc."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        Level
                      </label>
                      <select
                        value={editLevel}
                        onChange={(e) => setEditLevel(parseInt(e.target.value, 10))}
                        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                      >
                        {Array.from({ length: maxLevel + 5 }, (_, i) => i + 1).map(level => (
                          <option key={level} value={level}>Level {level}</option>
                        ))}
                      </select>
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
                {filteredWords.map(word => (
                  <div
                    key={word.id}
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
                    onClick={() => handleEdit(word)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '4px' }}>
                        <strong>{word.native}</strong>
                        <span style={{ color: '#656d76' }}>→</span>
                        <strong>{word.target}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#656d76' }}>
                        {word.partOfSpeech && <span>POS: {word.partOfSpeech} | </span>}
                        {word.pronunciation && <span>Pron: {word.pronunciation} | </span>}
                        Level: {word.level || 1} | Correct: {word.correctCount} | Wrong: {word.wrongCount}
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(word);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bulk' && (
            <div>
              <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                <h3 style={{ marginBottom: '12px' }}>Bulk Assign Level</h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 600 }}>
                    Assign Level:
                  </label>
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
                    Assign to {selectedWords.size} word(s)
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search words..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                  <span>Select All ({filteredWords.length} words)</span>
                </label>
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {filteredWords.map(word => (
                  <div
                    key={word.id}
                    style={{
                      padding: '12px',
                      border: '1px solid #d0d7de',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedWords.has(word.id)}
                      onChange={() => handleSelectWord(word.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '4px' }}>
                        <strong>{word.native}</strong>
                        <span style={{ color: '#656d76' }}>→</span>
                        <strong>{word.target}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#656d76' }}>
                        Current Level: {word.level || 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div>
              <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ marginBottom: '12px' }}>Import Words from CSV/TSV</h3>
                <p style={{ color: '#656d76', marginBottom: '16px', fontSize: '14px' }}>
                  Import additional words to this course. The CSV should have at least two columns (native and target).
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
                      <div style={{ marginBottom: '12px', fontSize: '14px' }}>
                        <strong>Detected Columns:</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        <div>
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
                        <div>
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
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                            Level Column (optional)
                          </label>
                          <input
                            type="text"
                            value={levelCol}
                            onChange={(e) => setLevelCol(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '14px' }}
                            placeholder="Leave empty if no level column"
                          />
                        </div>
                      </div>
                      <button className="btn btn-primary" onClick={handleImportWords}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

