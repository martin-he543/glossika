import { useState } from 'react';
import { CharacterCourse } from '../types';
import { storage } from '../storage';
import { LANGUAGES } from '../utils/languages';
import { parseCSV, createKanjiFromCSV } from '../utils/csv';

interface CreateCharacterCourseModalProps {
  onClose: () => void;
  onSuccess: (course: CharacterCourse) => void;
}

export default function CreateCharacterCourseModal({ onClose, onSuccess }: CreateCharacterCourseModalProps) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'japanese' | 'chinese'>('japanese');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [author, setAuthor] = useState('');
  const [characterCol, setCharacterCol] = useState('');
  const [meaningCol, setMeaningCol] = useState('');
  const [pronunciationCol, setPronunciationCol] = useState('');
  const [levelCol, setLevelCol] = useState('');
  const [delimiter, setDelimiter] = useState<string>('auto');
  const [additionalColumns, setAdditionalColumns] = useState<string[]>([]);

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
        // Use requestAnimationFrame for smooth progress updates
        requestAnimationFrame(() => {
          setProgress(Math.min(90, progress));
        });
      }, fileDelimiter);

      setProgress(100);

      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Auto-detect columns
      const headers = Object.keys(rows[0]);
      if (headers.length < 2) {
        throw new Error('CSV must have at least 2 columns');
      }

      // Try to find common column names
      const characterCols = headers.filter(h => 
        h.toLowerCase().includes('character') || 
        h.toLowerCase().includes('kanji') ||
        h.toLowerCase().includes('hanzi')
      );
      const meaningCols = headers.filter(h => 
        h.toLowerCase().includes('meaning') || 
        h.toLowerCase().includes('meanings')
      );
      const pronunciationCols = headers.filter(h => 
        h.toLowerCase().includes('pronunciation') || 
        h.toLowerCase().includes('reading') ||
        h.toLowerCase().includes('pinyin')
      );
      const levelCols = headers.filter(h => 
        h.toLowerCase().includes('level') || 
        h.toLowerCase() === 'lvl'
      );

      setCharacterCol(characterCols[0] || headers[0]);
      setMeaningCol(meaningCols[0] || headers[1]);
      setPronunciationCol(pronunciationCols[0] || headers[2] || '');
      setLevelCol(levelCols[0] || '');

      // Find additional columns (not character, meaning, pronunciation, or level)
      const usedCols = [
        characterCols[0] || headers[0],
        meaningCols[0] || headers[1],
        pronunciationCols[0] || headers[2] || '',
        levelCols[0] || ''
      ].filter(Boolean);
      const otherCols = headers.filter(h => !usedCols.includes(h));
      setAdditionalColumns(otherCols);

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setLoading(false);
      setProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) {
      setError('Please fill in all required fields and select a CSV file');
      return;
    }

    if (!characterCol || !meaningCol) {
      setError('Please specify column names');
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

      // Parse CSV with progress tracking
      const rows = await parseCSV(file, (progress) => {
        // Use requestAnimationFrame for smooth progress updates
        requestAnimationFrame(() => {
          setProgress(Math.min(40, progress * 0.4)); // 40% for parsing
        });
      }, fileDelimiter);

      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      setProgress(50);

      const course: CharacterCourse = {
        id: `character-course-${Date.now()}`,
        name,
        language,
        createdAt: Date.now(),
        isPublic,
        tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        description,
        characterCount: 0,
        author: author || undefined,
      };

      // Process characters in batches for large files
      const BATCH_SIZE = 1000;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      const allKanji: any[] = [];
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, rows.length);
        const batch = rows.slice(start, end);
        
        const batchKanji = createKanjiFromCSV(
          batch, 
          language, 
          course.id,
          characterCol,
          meaningCol,
          pronunciationCol || undefined,
          levelCol || undefined
        );
        allKanji.push(...batchKanji);
        
        // Update progress with requestAnimationFrame for smooth UI updates
        const progressPercent = 50 + Math.floor(((i + 1) / totalBatches) * 40);
        requestAnimationFrame(() => {
          setProgress(progressPercent);
        });
        
        // Yield to browser for large files
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      if (allKanji.length === 0) {
        throw new Error('No valid characters found in CSV. Please check column names.');
      }

      course.characterCount = allKanji.length;

      // Extract unique levels from characters
      const uniqueLevels = Array.from(new Set(allKanji.map(k => k.level || 1))).sort((a, b) => a - b);
      course.levels = uniqueLevels.length > 0 ? uniqueLevels : [1];

      // Save in batches to avoid localStorage issues
      setProgress(90);
      const SAVE_BATCH_SIZE = 500;
      for (let i = 0; i < allKanji.length; i += SAVE_BATCH_SIZE) {
        const batch = allKanji.slice(i, i + SAVE_BATCH_SIZE);
        batch.forEach(kanji => {
          storage.addKanji(kanji);
        });
        
        const saveProgress = 90 + Math.floor((i / allKanji.length) * 10);
        requestAnimationFrame(() => {
          setProgress(Math.min(99, saveProgress));
        });
        
        // Yield to browser periodically for large files
        if (i % (SAVE_BATCH_SIZE * 5) === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      storage.addCharacterCourse(course);
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
          <h2 className="modal-title">Create Character Course</h2>
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
            <label className="form-label">Language</label>
            <select
              className="select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'japanese' | 'chinese')}
              required
            >
              <option value="japanese">Japanese (Kanji)</option>
              <option value="chinese">Chinese (Hanzi)</option>
            </select>
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
              placeholder="beginner, kanji, hsk"
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

          {file && !loading && (
            <>
              <div className="form-group">
                <label className="form-label">Character Column</label>
                <input
                  type="text"
                  className="input"
                  value={characterCol}
                  onChange={(e) => setCharacterCol(e.target.value)}
                  required
                />
                <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                  Column name containing the character (e.g., "character", "kanji", "hanzi")
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Meaning Column</label>
                <input
                  type="text"
                  className="input"
                  value={meaningCol}
                  onChange={(e) => setMeaningCol(e.target.value)}
                  required
                />
                <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                  Column name containing the meaning (e.g., "meaning", "meanings")
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Pronunciation Column (optional)</label>
                <input
                  type="text"
                  className="input"
                  value={pronunciationCol}
                  onChange={(e) => setPronunciationCol(e.target.value)}
                  placeholder="pronunciation, reading, pinyin"
                />
                <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                  Column name containing pronunciation (e.g., "pronunciation", "reading", "pinyin")
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Level Column (optional, like Memrise)</label>
                <input
                  type="text"
                  className="input"
                  value={levelCol}
                  onChange={(e) => setLevelCol(e.target.value)}
                  placeholder="Leave empty if no level column"
                />
                <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                  If specified, characters will be assigned to levels. Otherwise, all characters default to level 1.
                </div>
              </div>

              {additionalColumns.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Additional Columns (optional)</label>
                  <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '8px' }}>
                    These columns will be preserved but are not required for character creation.
                    Examples: mnemonic, radical, stroke count, etc.
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
            </>
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
