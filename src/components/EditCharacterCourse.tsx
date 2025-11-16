import { useState, useMemo } from 'react';
import { Kanji, CharacterCourse } from '../types';
import { storage } from '../storage';
import { parseCSV, createKanjiFromCSV, CSVRow } from '../utils/csv';

interface EditCharacterCourseProps {
  course: CharacterCourse;
  characters: Kanji[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditCharacterCourse({ course, characters, onClose, onUpdate }: EditCharacterCourseProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'import' | 'bulk'>('edit');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCharacter, setEditingCharacter] = useState<Kanji | null>(null);
  const [editCharacter, setEditCharacter] = useState('');
  const [editMeaning, setEditMeaning] = useState('');
  const [editPronunciation, setEditPronunciation] = useState('');
  const [editLevel, setEditLevel] = useState<number>(1);
  
  // Bulk level assignment
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [bulkLevel, setBulkLevel] = useState<number>(1);
  const [selectAll, setSelectAll] = useState(false);
  
  // CSV Import
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [characterCol, setCharacterCol] = useState('');
  const [meaningCol, setMeaningCol] = useState('');
  const [pronunciationCol, setPronunciationCol] = useState('');
  const [levelCol, setLevelCol] = useState('');
  const [delimiter, setDelimiter] = useState<string>('auto');

  const filteredCharacters = useMemo(() => {
    if (!searchQuery) return characters;
    const query = searchQuery.toLowerCase();
    return characters.filter(k => 
      k.character.includes(query) ||
      k.meaning.toLowerCase().includes(query) ||
      k.pronunciation?.toLowerCase().includes(query)
    );
  }, [characters, searchQuery]);

  const courseLevels = course.levels || [1];
  const maxLevel = Math.max(...courseLevels, 1);

  // Handle character editing
  const handleEdit = (kanji: Kanji) => {
    setEditingCharacter(kanji);
    setEditCharacter(kanji.character);
    setEditMeaning(kanji.meaning);
    setEditPronunciation(kanji.pronunciation || '');
    setEditLevel(kanji.level || kanji.waniKaniLevel || 1);
  };

  const handleSaveEdit = () => {
    if (!editingCharacter) return;
    
    // Update character in storage
    storage.updateKanji(editingCharacter.id, {
      character: editCharacter.trim(),
      meaning: editMeaning.trim(),
      pronunciation: editPronunciation.trim() || undefined,
      level: editLevel,
      waniKaniLevel: editLevel,
    });

    // Update course levels if needed
    if (!courseLevels.includes(editLevel)) {
      const newLevels = [...courseLevels, editLevel].sort((a, b) => a - b);
      storage.updateCharacterCourse(course.id, { levels: newLevels });
    }

    setEditingCharacter(null);
    onUpdate();
  };

  const handleCancelEdit = () => {
    setEditingCharacter(null);
  };

  // Bulk level assignment
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCharacters(new Set());
    } else {
      setSelectedCharacters(new Set(filteredCharacters.map(k => k.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectCharacter = (characterId: string) => {
    const newSelected = new Set(selectedCharacters);
    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else {
      newSelected.add(characterId);
    }
    setSelectedCharacters(newSelected);
    setSelectAll(newSelected.size === filteredCharacters.length);
  };

  const handleBulkAssignLevel = () => {
    if (selectedCharacters.size === 0) {
      alert('Please select at least one character');
      return;
    }

    if (confirm(`Assign level ${bulkLevel} to ${selectedCharacters.size} character(s)?`)) {
      selectedCharacters.forEach(characterId => {
        storage.updateKanji(characterId, { 
          level: bulkLevel,
          waniKaniLevel: bulkLevel,
        });
      });

      // Update course levels if needed
      if (!courseLevels.includes(bulkLevel)) {
        const newLevels = [...courseLevels, bulkLevel].sort((a, b) => a - b);
        storage.updateCharacterCourse(course.id, { levels: newLevels });
      }

      setSelectedCharacters(new Set());
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

      // Auto-detect columns
      const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
      const charCol = normalizedHeaders.find(h => ['character', 'kanji', 'hanzi'].includes(h)) || headers[0];
      const meanCol = normalizedHeaders.find(h => ['meaning', 'meanings'].includes(h)) || headers[1] || headers[0];
      const pronCol = normalizedHeaders.find(h => ['pronunciation', 'reading', 'pinyin'].includes(h)) || '';
      const levCol = normalizedHeaders.find(h => ['level', 'lvl'].includes(h)) || '';
      
      setCharacterCol(charCol);
      setMeaningCol(meanCol);
      setPronunciationCol(pronCol);
      setLevelCol(levCol);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setLoading(false);
      setProgress(0);
    }
  };

  const handleImportCharacters = async () => {
    if (!file || !characterCol || !meaningCol) {
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

      const newCharacters = createKanjiFromCSV(
        rows,
        course.language,
        course.id,
        characterCol,
        meaningCol,
        pronunciationCol || undefined,
        levelCol || undefined
      );
      
      setProgress(90);

      if (newCharacters.length === 0) {
        throw new Error('No valid characters found in CSV');
      }

      // Add characters in batches
      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < newCharacters.length; i += SAVE_BATCH_SIZE) {
        const batch = newCharacters.slice(i, i + SAVE_BATCH_SIZE);
        batch.forEach(k => storage.addKanji(k));
        setProgress(90 + Math.floor((i / newCharacters.length) * 10));
      }

      // Update course levels
      const allCharacters = storage.load().kanji.filter(k => k.language === course.language);
      const uniqueLevels = Array.from(new Set(allCharacters.map(k => k.level || k.waniKaniLevel || 1))).sort((a, b) => a - b);
      storage.updateCharacterCourse(course.id, {
        levels: uniqueLevels,
      });

      setProgress(100);
      setFile(null);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import characters');
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
              Edit Characters
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
              Import More Characters
            </button>
          </div>

          {activeTab === 'edit' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search characters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                />
              </div>

              {editingCharacter ? (
                <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
                  <h3 style={{ marginBottom: '16px' }}>Edit Character</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        Character
                      </label>
                      <input
                        type="text"
                        value={editCharacter}
                        onChange={(e) => setEditCharacter(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '20px', textAlign: 'center' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 600 }}>
                        Meaning
                      </label>
                      <input
                        type="text"
                        value={editMeaning}
                        onChange={(e) => setEditMeaning(e.target.value)}
                        style={{ width: '100%', padding: '8px', fontSize: '14px' }}
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
                        placeholder="Reading, pinyin, etc."
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
                {filteredCharacters.map(kanji => (
                  <div
                    key={kanji.id}
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
                    onClick={() => handleEdit(kanji)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ fontSize: '24px', minWidth: '40px', textAlign: 'center' }}>
                        {kanji.character}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{kanji.meaning}</div>
                        <div style={{ fontSize: '12px', color: '#656d76' }}>
                          {kanji.pronunciation && <span>Pron: {kanji.pronunciation} | </span>}
                          Level: {kanji.level || kanji.waniKaniLevel || 1} | Stage: {kanji.srsStage}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(kanji);
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
                  <button className="btn btn-primary" onClick={handleBulkAssignLevel} disabled={selectedCharacters.size === 0}>
                    Assign to {selectedCharacters.size} character(s)
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search characters..."
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
                  <span>Select All ({filteredCharacters.length} characters)</span>
                </label>
              </div>

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {filteredCharacters.map(kanji => (
                  <div
                    key={kanji.id}
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
                      checked={selectedCharacters.has(kanji.id)}
                      onChange={() => handleSelectCharacter(kanji.id)}
                    />
                    <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ fontSize: '24px', minWidth: '40px', textAlign: 'center' }}>
                        {kanji.character}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{kanji.meaning}</div>
                        <div style={{ fontSize: '12px', color: '#656d76' }}>
                          Current Level: {kanji.level || kanji.waniKaniLevel || 1}
                        </div>
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
                <h3 style={{ marginBottom: '12px' }}>Import Characters from CSV/TSV</h3>
                <p style={{ color: '#656d76', marginBottom: '16px', fontSize: '14px' }}>
                  Import additional characters to this course. The CSV should have columns for character, meaning, and optionally pronunciation.
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
                            Character Column
                          </label>
                          <input
                            type="text"
                            value={characterCol}
                            onChange={(e) => setCharacterCol(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                            Meaning Column
                          </label>
                          <input
                            type="text"
                            value={meaningCol}
                            onChange={(e) => setMeaningCol(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                            Pronunciation Column (optional)
                          </label>
                          <input
                            type="text"
                            value={pronunciationCol}
                            onChange={(e) => setPronunciationCol(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '14px' }}
                            placeholder="Leave empty if no pronunciation column"
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
                      <button className="btn btn-primary" onClick={handleImportCharacters}>
                        Import Characters
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

