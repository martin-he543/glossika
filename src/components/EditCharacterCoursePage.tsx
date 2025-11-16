import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppState, Kanji, CharacterCourse } from '../types';
import { storage } from '../storage';
import { parseCSV, createKanjiFromCSV } from '../utils/csv';

interface EditCharacterCoursePageProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function EditCharacterCoursePage({ appState, updateState }: EditCharacterCoursePageProps) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ characterId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [bulkLevel, setBulkLevel] = useState<number>(1);
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [lastSelectedCharacter, setLastSelectedCharacter] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characterCol, setCharacterCol] = useState('');
  const [meaningCol, setMeaningCol] = useState('');
  const [pronunciationCol, setPronunciationCol] = useState('');
  const [levelCol, setLevelCol] = useState('');
  const [delimiter, setDelimiter] = useState<string>('auto');
  
  const inputRef = useRef<HTMLInputElement>(null);

  const course = appState.characterCourses.find(c => c.id === courseId);
  const characters = appState.kanji.filter(k => k.language === course?.language);

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

  const handleCellClick = (kanji: Kanji, field: string) => {
    let value = '';
    switch (field) {
      case 'character':
        value = kanji.character;
        break;
      case 'meaning':
        value = kanji.meaning;
        break;
      case 'pronunciation':
        value = kanji.pronunciation || '';
        break;
      case 'level':
        value = String(kanji.level || kanji.waniKaniLevel || 1);
        break;
    }
    setEditingCell({ characterId: kanji.id, field });
    setEditValue(value);
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const kanji = characters.find(k => k.id === editingCell.characterId);
    if (!kanji) return;

    const updates: Partial<Kanji> = {};
    
    switch (editingCell.field) {
      case 'character':
        updates.character = editValue.trim();
        break;
      case 'meaning':
        updates.meaning = editValue.trim();
        break;
      case 'pronunciation':
        updates.pronunciation = editValue.trim() || undefined;
        break;
      case 'level':
        const level = parseInt(editValue, 10);
        if (!isNaN(level) && level > 0) {
          updates.level = level;
          updates.waniKaniLevel = level;
          // Update course levels if needed
          if (!courseLevels.includes(level)) {
            const newLevels = [...courseLevels, level].sort((a, b) => a - b);
            storage.updateCharacterCourse(course.id, { levels: newLevels });
          }
        }
        break;
    }

    storage.updateKanji(editingCell.characterId, updates);
    
    // If level was updated, recalculate course levels and update course in state
    if (editingCell.field === 'level') {
      const allCharacters = storage.load().kanji.filter(k => k.language === course.language);
      const uniqueLevels = Array.from(new Set(allCharacters.map(k => k.level || k.waniKaniLevel || 1))).sort((a, b) => a - b);
      storage.updateCharacterCourse(course.id, { levels: uniqueLevels });
      updateState({ 
        kanji: storage.load().kanji,
        characterCourses: storage.load().characterCourses
      });
    } else {
      updateState({ kanji: storage.load().kanji });
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
    if (selectedCharacters.size === filteredCharacters.length) {
      setSelectedCharacters(new Set());
      setLastSelectedCharacter(null);
    } else {
      const allIds = filteredCharacters.map(k => k.id);
      setSelectedCharacters(new Set(allIds));
      setLastSelectedCharacter(allIds[allIds.length - 1]);
    }
  };

  const handleSelectCharacter = (characterId: string, e: React.MouseEvent) => {
    const newSelected = new Set(selectedCharacters);
    
    if (e.shiftKey && lastSelectedCharacter) {
      // Shift-click: select range
      const currentIndex = filteredCharacters.findIndex(k => k.id === characterId);
      const lastIndex = filteredCharacters.findIndex(k => k.id === lastSelectedCharacter);
      
      if (currentIndex !== -1 && lastIndex !== -1) {
        const startIndex = Math.min(currentIndex, lastIndex);
        const endIndex = Math.max(currentIndex, lastIndex);
        
        for (let i = startIndex; i <= endIndex; i++) {
          newSelected.add(filteredCharacters[i].id);
        }
      }
      setLastSelectedCharacter(characterId);
    } else {
      // Normal click: toggle single item
      if (newSelected.has(characterId)) {
        newSelected.delete(characterId);
        setLastSelectedCharacter(null);
      } else {
        newSelected.add(characterId);
        setLastSelectedCharacter(characterId);
      }
    }
    
    setSelectedCharacters(newSelected);
  };

  const handleDeleteCharacter = (characterId: string) => {
    const kanji = characters.find(k => k.id === characterId);
    if (kanji && confirm(`Delete character "${kanji.character}"?`)) {
      const state = storage.load();
      state.kanji = state.kanji.filter(k => k.id !== characterId);
      storage.save(state);
      updateState({ kanji: storage.load().kanji });
      
      // Remove from selection if selected
      const newSelected = new Set(selectedCharacters);
      newSelected.delete(characterId);
      setSelectedCharacters(newSelected);
    }
  };

  const handleBulkDelete = () => {
    if (selectedCharacters.size === 0) {
      alert('Please select at least one character to delete');
      return;
    }

    if (confirm(`Delete ${selectedCharacters.size} character(s)? This action cannot be undone.`)) {
      const state = storage.load();
      state.kanji = state.kanji.filter(k => !selectedCharacters.has(k.id));
      storage.save(state);
      
      // Update course levels
      const allCharacters = storage.load().kanji.filter(k => k.language === course.language);
      const uniqueLevels = Array.from(new Set(allCharacters.map(k => k.level || k.waniKaniLevel || 1))).sort((a, b) => a - b);
      storage.updateCharacterCourse(course.id, {
        levels: uniqueLevels,
      });
      
      updateState({ 
        kanji: storage.load().kanji,
        characterCourses: storage.load().characterCourses
      });
      setSelectedCharacters(new Set());
      setLastSelectedCharacter(null);
    }
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

      // Recalculate all levels from characters (not just add the new one)
      const allCharacters = storage.load().kanji.filter(k => k.language === course.language);
      const uniqueLevels = Array.from(new Set(allCharacters.map(k => k.level || k.waniKaniLevel || 1))).sort((a, b) => a - b);
      storage.updateCharacterCourse(course.id, { levels: uniqueLevels });

      setSelectedCharacters(new Set());
      updateState({ 
        kanji: storage.load().kanji,
        characterCourses: storage.load().characterCourses
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
    }
  };

  const handleImportCharacters = async () => {
    if (!file || !characterCol || !meaningCol) {
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
      const newCharacters = createKanjiFromCSV(
        rows,
        course.language,
        course.id,
        characterCol,
        meaningCol,
        pronunciationCol || undefined,
        levelCol || undefined
      );

      if (newCharacters.length === 0) {
        throw new Error('No valid characters found in CSV');
      }

      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < newCharacters.length; i += SAVE_BATCH_SIZE) {
        const batch = newCharacters.slice(i, i + SAVE_BATCH_SIZE);
        batch.forEach(k => storage.addKanji(k));
      }

      const allCharacters = storage.load().kanji.filter(k => k.language === course.language);
      const uniqueLevels = Array.from(new Set(allCharacters.map(k => k.level || k.waniKaniLevel || 1))).sort((a, b) => a - b);
      storage.updateCharacterCourse(course.id, {
        levels: uniqueLevels,
      });

      setFile(null);
      updateState({ 
        kanji: storage.load().kanji,
        characterCourses: storage.load().characterCourses
      });
      setShowImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import characters');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card-header">
        <div>
          <Link to={`/character-course/${course.id}`} className="btn" style={{ marginBottom: '8px' }}>
            ← Back to Course
          </Link>
          <h1 className="card-title">Edit: {course.name}</h1>
          <div style={{ fontSize: '14px', color: '#656d76', marginTop: '4px' }}>
            {course.language === 'japanese' ? 'Japanese' : 'Chinese'} Characters
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => setShowImport(!showImport)}>
            {showImport ? 'Hide Import' : 'Import More Characters'}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>Import Characters from CSV/TSV</h3>
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
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, marginRight: '16px' }}>
            <input
              type="text"
              placeholder="Search characters..."
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
            <button className="btn btn-primary" onClick={handleBulkAssignLevel} disabled={selectedCharacters.size === 0}>
              Bulk Assign Level ({selectedCharacters.size})
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleBulkDelete} 
              disabled={selectedCharacters.size === 0}
              style={{ backgroundColor: '#da3633', color: '#ffffff', borderColor: '#da3633' }}
            >
              Delete ({selectedCharacters.size})
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '16px', fontSize: '9pt' }}>
          <strong>{filteredCharacters.length}</strong> characters | Click any cell to edit | Shift+Click to select range
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d0d7de' }}>
                <th style={{ padding: '8px', textAlign: 'left', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedCharacters.size === filteredCharacters.length && filteredCharacters.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Character
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Meaning
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Pronunciation
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Level
                </th>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '9pt', fontWeight: 600 }}>
                  Stage
                </th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: '9pt', fontWeight: 600, width: '80px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCharacters.map(kanji => {
                const isEditing = editingCell?.characterId === kanji.id;
                return (
                  <tr key={kanji.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selectedCharacters.has(kanji.id)}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCharacter(kanji.id, e);
                        }}
                      />
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '20px', textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => handleCellClick(kanji, 'character')}
                    >
                      {isEditing && editingCell?.field === 'character' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          style={{ width: '100%', padding: '4px', fontSize: '20px', textAlign: 'center' }}
                        />
                      ) : (
                        kanji.character
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(kanji, 'meaning')}
                    >
                      {isEditing && editingCell?.field === 'meaning' ? (
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
                        kanji.meaning
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(kanji, 'pronunciation')}
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
                        kanji.pronunciation || '-'
                      )}
                    </td>
                    <td 
                      style={{ padding: '8px', fontSize: '9pt', cursor: 'pointer' }}
                      onClick={() => handleCellClick(kanji, 'level')}
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
                        kanji.level || kanji.waniKaniLevel || 1
                      )}
                    </td>
                    <td style={{ padding: '8px', fontSize: '9pt' }}>{kanji.srsStage}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCharacter(kanji.id);
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
                        title="Delete character"
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

