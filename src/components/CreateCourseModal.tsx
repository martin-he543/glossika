import { useState } from 'react';
import { Course } from '../types';
import { storage } from '../storage';
import { LANGUAGES } from '../utils/languages';
import { parseCSV, createWordsFromCSV, CSVRow } from '../utils/csv';
import { auth } from '../utils/auth';
import { userProfile } from '../utils/userProfile';

interface CreateCourseModalProps {
  onClose: () => void;
  onSuccess: (course: Course) => void;
}

export default function CreateCourseModal({ onClose, onSuccess }: CreateCourseModalProps) {
  const [name, setName] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [customNative, setCustomNative] = useState('');
  const [customTarget, setCustomTarget] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nativeCol, setNativeCol] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [levelCol, setLevelCol] = useState('');
  const [partOfSpeechCol, setPartOfSpeechCol] = useState('');
  const [pronunciationCol, setPronunciationCol] = useState('');
  const [delimiter, setDelimiter] = useState<string>('auto');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<CSVRow[]>([]);

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
        // Auto-detect based on file extension
        const fileName = selectedFile.name.toLowerCase();
        if (fileName.endsWith('.tsv')) {
          fileDelimiter = '\t';
        }
      }

      // Parse CSV
      const rows = await parseCSV(selectedFile, (progress) => {
        setProgress(Math.min(90, progress));
      }, fileDelimiter);

      setProgress(100);

      if (rows.length === 0) {
        throw new Error('CSV file is empty or could not be parsed');
      }

      // Get headers
      const headers = Object.keys(rows[0] || {});
      
      if (headers.length < 2) {
        const fileName = selectedFile.name.toLowerCase();
        const isTSV = fileName.endsWith('.tsv');
        throw new Error(
          `CSV/TSV file must have at least 2 columns, but only found ${headers.length} column(s). ` +
          (isTSV ? 'Please ensure the file uses tab characters as delimiters.' : 'Please check your delimiter settings.')
        );
      }

      // Simple, robust column detection
      // 1. Try exact matches first
      // 2. Try language names
      // 3. Fall back to positional (first = native, second = target)
      
      // Find native column
      const nativePatterns = ['native', 'english', 'en', 'source', 'definition'];
      const targetPatterns = ['target', 'translation', 'trans', 'foreign', 'label'];
      const levelPatterns = ['level', 'lvl'];
      
      // Language names
      const commonLanguages = ['english', 'french', 'spanish', 'german', 'italian', 'portuguese', 
                               'russian', 'chinese', 'japanese', 'korean', 'arabic', 'hindi'];
      
      let detectedNative: string | undefined;
      let detectedTarget: string | undefined;
      let detectedLevel: string | undefined;
      
      // Look for exact pattern matches
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
      
      // Look for language names
      for (const header of headers) {
        const lower = header.toLowerCase().trim();
        for (const lang of commonLanguages) {
          if (lower === lang || lower.includes(lang)) {
            if (lang === 'english' && !detectedNative) {
              detectedNative = header;
            } else if (!detectedTarget && lang !== 'english') {
              detectedTarget = header;
            }
          }
        }
      }
      
      // Fallback to positional
      if (!detectedNative) {
        detectedNative = headers[0];
      }
      if (!detectedTarget) {
        // Find first column that's not native and not level
        const available = headers.find(h => 
          h.toLowerCase().trim() !== detectedNative?.toLowerCase().trim() &&
          !levelPatterns.includes(h.toLowerCase().trim())
        );
        detectedTarget = available || headers[1] || headers[0];
      }
      
      // Normalize to lowercase (headers are already lowercase from PapaParse)
      const finalNative = detectedNative.toLowerCase().trim();
      const finalTarget = detectedTarget.toLowerCase().trim();
      const finalLevel = detectedLevel?.toLowerCase().trim() || '';
      
      setNativeCol(finalNative);
      setTargetCol(finalTarget);
      setLevelCol(finalLevel);

      // Store all available columns for dropdowns
      setAvailableColumns(headers);
      
      // Auto-detect part of speech column
      const detectedPartOfSpeech = headers.find(h => {
        const lower = h.toLowerCase().trim();
        return (lower.includes('part') && (lower.includes('speech') || lower.includes('pos'))) ||
               lower === 'pos' || 
               lower === 'type' ||
               lower === 'part of speech';
      });
      if (detectedPartOfSpeech) {
        setPartOfSpeechCol(detectedPartOfSpeech.toLowerCase().trim());
      }
      
      // Auto-detect pronunciation column
      const detectedPronunciation = headers.find(h => {
        const lower = h.toLowerCase().trim();
        return lower.includes('pronunciation') || 
               lower.includes('phonetic') || 
               lower.includes('ipa') || 
               lower.includes('reading') ||
               lower === 'pronunciation';
      });
      if (detectedPronunciation) {
        setPronunciationCol(detectedPronunciation.toLowerCase().trim());
      }

      // Store rows for preview
      setCsvPreviewRows(rows);

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
      setError('Please fill in all fields and select a CSV file');
      return;
    }

    if (!nativeCol || !targetCol) {
      setError('Please specify column names');
      return;
    }

    // Check for duplicate course name across all course types
    const allCourses = storage.load();
    const existingNames = [
      ...(allCourses.courses || []).map(c => c.name.toLowerCase().trim()),
      ...(allCourses.clozeCourses || []).map(c => c.name.toLowerCase().trim())
    ];
    
    if (existingNames.includes(name.toLowerCase().trim())) {
      setError(`A course with the name "${name}" already exists. Course names must be unique.`);
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
      // Progress tracking is approximate since PapaParse doesn't provide real-time progress
      const rows = await parseCSV(file, (progress) => {
        // Only update progress after parsing is complete
        if (progress >= 100) {
          setProgress(50);
        }
      }, fileDelimiter);
      
      console.log(`Parsed ${rows.length} rows from CSV file`);

      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      setProgress(50);

      // Get current user's username or email for author
      const currentUser = auth.getCurrentUser();
      let author: string | undefined = undefined;
      if (currentUser) {
        const profile = userProfile.getCurrentProfile();
        author = profile?.username || currentUser.email;
      }

      const course: Course = {
        id: `course-${Date.now()}`,
        name,
        nativeLanguage: finalNativeLanguage,
        targetLanguage: finalTargetLanguage,
        createdAt: Date.now(),
        isPublic: false,
        tags: [],
        wordCount: 0,
        author,
      };

      // Process all rows at once (createWordsFromCSV handles it efficiently)
      const allWords = createWordsFromCSV(
        rows, 
        course.id, 
        nativeCol, 
        targetCol, 
        levelCol || undefined,
        partOfSpeechCol || undefined,
        pronunciationCol || undefined
      );
      
      setProgress(90);
      
      if (allWords.length === 0) {
        const sampleRow = rows[0];
        const availableHeaders = Object.keys(sampleRow || {});
        throw new Error(
          `No valid words found in CSV. ` +
          `Processed ${rows.length} rows but created 0 words. ` +
          `Available columns: ${availableHeaders.join(', ')}. ` +
          `Using columns: Native="${nativeCol}", Target="${targetCol}". ` +
          `Please check that the column names match the CSV headers.`
        );
      }

      course.wordCount = allWords.length;

      // Extract unique levels from words
      const uniqueLevels = Array.from(new Set(allWords.map(w => w.level || 1))).sort((a, b) => a - b);
      course.levels = uniqueLevels.length > 0 ? uniqueLevels : [1];

      // Check storage size before importing
      const storageInfo = storage.getStorageSizeSync();
      const currentSizeMB = parseFloat(storageInfo.usedMB);
      
      // Estimate size of new words (rough estimate: ~200 bytes per word)
      const estimatedWordSizeMB = (allWords.length * 200) / (1024 * 1024);
      const estimatedTotalMB = currentSizeMB + estimatedWordSizeMB;
      
      if (estimatedTotalMB > 4.5) {
        const needsCleanup = estimatedTotalMB > 5;
        const errorMsg = needsCleanup
          ? `Importing ${allWords.length} words would exceed storage quota (estimated ${estimatedTotalMB.toFixed(2)} MB). Please clear old data first.`
          : `Warning: Importing ${allWords.length} words will use ~${estimatedTotalMB.toFixed(2)} MB of storage (close to quota limit).`;
        
        if (needsCleanup) {
          setError(errorMsg);
          setLoading(false);
          setProgress(0);
          return;
        } else {
          // Show warning but continue
          console.warn(errorMsg);
        }
      }

      // Save words in batches to avoid localStorage issues
      setProgress(90);
      const SAVE_BATCH_SIZE = 500;
      let savedCount = 0;
      let lastError: any = null;
      
      for (let i = 0; i < allWords.length; i += SAVE_BATCH_SIZE) {
        const batch = allWords.slice(i, i + SAVE_BATCH_SIZE);
        try {
          storage.addWords(batch);
          savedCount += batch.length;
          console.log(`Saved batch ${Math.floor(i / SAVE_BATCH_SIZE) + 1}: ${batch.length} words (total saved: ${savedCount}/${allWords.length})`);
        } catch (e: any) {
          console.error(`Failed to save batch starting at index ${i}:`, e);
          lastError = e;
          
          // If quota exceeded, stop here
          if (e?.message?.includes('quota') || e?.name === 'QuotaExceededError' || e?.code === 22) {
            // Try to optimize storage and retry
            try {
              const optimizeResult = storage.optimizeStorage();
              console.log(`Optimized storage: removed ${optimizeResult.removed} duplicates, freed ${optimizeResult.freedMB} MB`);
              
              // Try saving this batch again
              try {
                storage.addWords(batch);
                savedCount += batch.length;
                console.log(`Successfully saved batch after optimization`);
                continue;
              } catch (retryError) {
                // Still failed, give up
                break;
              }
            } catch (optimizeError) {
              // Optimization failed, give up
              break;
            }
          } else {
            // Other error, give up
            break;
          }
        }
        
        const saveProgress = 90 + Math.floor((i / allWords.length) * 10);
        setProgress(Math.min(99, saveProgress));
      }
      
      // Update course with actual word count
      const finalWordCount = storage.getWordsByCourse(course.id).length;
      course.wordCount = finalWordCount;
      course.levels = Array.from(new Set(allWords.slice(0, savedCount).map(w => w.level || 1))).sort((a, b) => a - b);
      
      if (savedCount < allWords.length) {
        const storageInfo = storage.getStorageSizeSync();
        const errorMsg = `Storage quota exceeded. Saved ${savedCount} of ${allWords.length} words. ` +
          `Current storage: ${storageInfo.usedMB} MB. ` +
          `To import more words, go to Settings and clear old study activity or unused courses.`;
        setError(errorMsg);
        setLoading(false);
        setProgress(0);
        return;
      }
      
      // Verify all words were saved
      if (finalWordCount !== allWords.length) {
        console.warn(`Word count mismatch: Expected ${allWords.length}, but found ${finalWordCount} in storage`);
        setError(`Warning: Expected to save ${allWords.length} words, but only ${finalWordCount} were found in storage.`);
      }

      storage.addCourse(course);
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
          <h2 className="modal-title">Create New Course</h2>
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

          {file && !loading && availableColumns.length > 0 && (
            <>
              {csvPreviewRows.length > 0 && (
                <div className="form-group">
                  <label className="form-label">CSV Preview</label>
                  <div style={{ fontSize: '12px', color: '#656d76', marginBottom: '8px' }}>
                    Preview of first 3 rows · Total rows: <strong>{csvPreviewRows.length}</strong>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #d0d7de', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ backgroundColor: '#f6f8fa', position: 'sticky', top: 0 }}>
                        <tr>
                          {availableColumns.map(col => (
                            <th key={col} style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #d0d7de', fontWeight: 600 }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.slice(0, 3).map((row, idx) => (
                          <tr key={idx}>
                            {availableColumns.map(col => (
                              <td key={col} style={{ padding: '8px', borderBottom: '1px solid #eaeef2' }}>
                                {String(row[col.toLowerCase().trim()] || row[col] || '').slice(0, 50)}
                                {String(row[col.toLowerCase().trim()] || row[col] || '').length > 50 ? '...' : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Native Language Column</label>
                <select
                  className="select"
                  value={nativeCol}
                  onChange={(e) => setNativeCol(e.target.value)}
                  required
                >
                  <option value="">Select column...</option>
                  {availableColumns.map(col => (
                    <option key={col} value={col.toLowerCase().trim()}>{col}</option>
                  ))}
                </select>
              </div>

            <div className="form-group">
              <label className="form-label">Target Language Column</label>
              <select
                className="select"
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
                required
              >
                <option value="">Select column...</option>
                {availableColumns.map(col => (
                  <option key={col} value={col.toLowerCase().trim()}>{col}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Level Column (optional, like Memrise)</label>
              <select
                className="select"
                value={levelCol}
                onChange={(e) => setLevelCol(e.target.value)}
              >
                <option value="">None</option>
                {availableColumns.map(col => (
                  <option key={col} value={col.toLowerCase().trim()}>{col}</option>
                ))}
              </select>
              <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                If specified, words will be assigned to levels. Otherwise, all words default to level 1.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Part of Speech Column (optional)</label>
              <select
                className="select"
                value={partOfSpeechCol}
                onChange={(e) => setPartOfSpeechCol(e.target.value)}
              >
                <option value="">None</option>
                {availableColumns.map(col => (
                  <option key={col} value={col.toLowerCase().trim()}>{col}</option>
                ))}
              </select>
              <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                If specified, part of speech will be imported and displayed as a tag during practice.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Pronunciation Column (optional)</label>
              <select
                className="select"
                value={pronunciationCol}
                onChange={(e) => setPronunciationCol(e.target.value)}
              >
                <option value="">None</option>
                {availableColumns.map(col => (
                  <option key={col} value={col.toLowerCase().trim()}>{col}</option>
                ))}
              </select>
              <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
                If specified, pronunciation will be imported and displayed in italics after answering.
              </div>
            </div>
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

