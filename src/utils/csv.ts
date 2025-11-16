import Papa from 'papaparse';
import { Word, Course, ClozeSentence, ClozeCourse, Kanji } from '../types';

export interface CSVRow {
  [key: string]: string;
}

/**
 * Parse a CSV/TSV file into an array of row objects
 * Handles any size file, any delimiter, quoted values, etc.
 */
export function parseCSV(
  file: File, 
  onProgress?: (progress: number) => void,
  delimiter?: string
): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CSVRow[] = [];
    const fileSize = file.size || 0;
    
    // Auto-detect delimiter based on file extension
    let fileDelimiter = delimiter;
    if (!fileDelimiter) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.tsv')) {
        fileDelimiter = '\t';
      } else {
        fileDelimiter = ','; // Default to comma
      }
    }
    
    // Force tab for TSV files
    const finalDelimiter = file.name.toLowerCase().endsWith('.tsv') ? '\t' : fileDelimiter;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: finalDelimiter,
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header) => header.trim().toLowerCase(),
      // Use step mode for all files - it's the most reliable
      step: (result) => {
        if (result.data && typeof result.data === 'object') {
          rows.push(result.data as CSVRow);
        }
      },
      error: (error) => {
        console.warn('CSV parsing warning:', error);
      },
      complete: (results) => {
        // Use rows collected from step callback, fallback to results.data if empty
        const allRows = rows.length > 0 ? rows : (Array.isArray(results.data) ? results.data as CSVRow[] : []);
        
        if (onProgress) {
          onProgress(100);
        }
        
        if (allRows.length > 0) {
          resolve(allRows);
        } else if (results.errors && results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map((e: any) => e.message || String(e)).join(', ')}`));
        } else {
          reject(new Error('CSV file appears to be empty or invalid'));
        }
      },
    });
  });
}

/**
 * Create Word objects from CSV rows
 * Handles any CSV format with flexible column detection
 */
export function createWordsFromCSV(
  rows: CSVRow[],
  courseId: string,
  nativeCol: string,
  targetCol: string,
  levelCol?: string
): Word[] {
  const words: Word[] = [];
  const now = Date.now();

  if (!rows || rows.length === 0) {
    return words;
  }

  // Get headers from first row
  const headers = Object.keys(rows[0] || {});
  
  // Helper to get value from row (case-insensitive, handles whitespace)
  const getValue = (row: CSVRow, colName: string): string => {
    if (!colName || !row) return '';
    
    const normalized = colName.toLowerCase().trim();
    
    // Try exact match
    if (row[normalized] !== undefined && row[normalized] !== null) {
      const value = String(row[normalized]).trim();
      // Remove surrounding quotes if present
      return value.replace(/^["']|["']$/g, '').trim();
    }
    
    // Try finding matching key
    const key = Object.keys(row).find(k => k.toLowerCase().trim() === normalized);
    if (key && row[key] !== undefined && row[key] !== null) {
      const value = String(row[key]).trim();
      return value.replace(/^["']|["']$/g, '').trim();
    }
    
    return '';
  };

  // Auto-detect part of speech and pronunciation columns
  const partOfSpeechCol = headers.find(h => {
    const lower = h.toLowerCase();
    return lower.includes('part') && (lower.includes('speech') || lower.includes('pos')) ||
           lower === 'pos' || lower === 'type';
  });
  
  const pronunciationCol = headers.find(h => {
    const lower = h.toLowerCase();
    return lower.includes('pronunciation') || lower.includes('phonetic') || 
           lower.includes('ipa') || lower.includes('reading');
  });

  // Normalize column names
  const normalizedNativeCol = nativeCol.toLowerCase().trim();
  const normalizedTargetCol = targetCol.toLowerCase().trim();
  const normalizedLevelCol = levelCol ? levelCol.toLowerCase().trim() : undefined;

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;

    // Get native and target values
    let native = getValue(row, normalizedNativeCol);
    let target = getValue(row, normalizedTargetCol);

    // Handle multi-value fields (e.g., "and, though" -> take first value)
    if (native.includes(',')) {
      native = native.split(',')[0].trim();
    }
    if (target.includes(',')) {
      target = target.split(',')[0].trim();
    }

    // Skip empty rows
    if (!native || !target || native.length === 0 || target.length === 0) {
      continue;
    }

    // Parse level
    let level = 1;
    if (normalizedLevelCol) {
      const levelValue = getValue(row, normalizedLevelCol);
      if (levelValue) {
        const parsed = parseInt(levelValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
          level = parsed;
        }
      }
    }

    // Get part of speech (take first value if multiple)
    let partOfSpeech: string | undefined = undefined;
    if (partOfSpeechCol) {
      const posValue = getValue(row, partOfSpeechCol);
      if (posValue) {
        // Handle multi-value part of speech (e.g., "conjunction, pronoun" -> "conjunction")
        partOfSpeech = posValue.split(',')[0].trim();
      }
    }

    // Get pronunciation
    let pronunciation: string | undefined = undefined;
    if (pronunciationCol) {
      pronunciation = getValue(row, pronunciationCol) || undefined;
    }

    words.push({
      id: `${courseId}-${now}-${i}`,
      native,
      target,
      courseId,
      createdAt: now,
      wrongCount: 0,
      correctCount: 0,
      srsLevel: 0,
      masteryLevel: 'seed',
      level,
      partOfSpeech,
      pronunciation,
    });
  }

  return words;
}

/**
 * Create ClozeSentence objects from CSV rows (for Tatoeba format)
 */
export function createClozeFromTatoeba(rows: CSVRow[], courseId: string): ClozeSentence[] {
  const sentences: ClozeSentence[] = [];
  const now = Date.now();

  if (!rows || rows.length === 0) return sentences;

  const headers = Object.keys(rows[0] || {});
  
  // Find columns
  const nativeCol = headers.find(h => 
    ['native', 'english', 'en', 'sentence1'].includes(h.toLowerCase())
  ) || headers[0];
  
  const targetCol = headers.find(h => 
    ['target', 'translation', 'trans', 'sentence2'].includes(h.toLowerCase())
  ) || headers[1] || headers[0];

  for (const row of rows) {
    if (!row) continue;

    const native = (row[nativeCol] || '').trim();
    const target = (row[targetCol] || '').trim();

    if (!native || !target) continue;

    const words = target.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) continue;

    const randomIndex = Math.floor(Math.random() * words.length);
    const answer = words[randomIndex];
    words[randomIndex] = '_____';
    const clozeText = words.join(' ');

    sentences.push({
      id: `cloze-${now}-${sentences.length}`,
      native,
      target,
      clozeText,
      answer,
      language: 'unknown',
      courseId,
      createdAt: now,
      masteryLevel: 'seed',
      srsLevel: 0,
      correctCount: 0,
      wrongCount: 0,
    });
  }

  return sentences;
}

/**
 * Create Kanji objects from CSV rows
 */
export function createKanjiFromCSV(
  rows: CSVRow[], 
  language: 'japanese' | 'chinese',
  courseId: string,
  characterCol?: string,
  meaningCol?: string,
  pronunciationCol?: string,
  levelCol?: string
): Kanji[] {
  const kanji: Kanji[] = [];
  const now = Date.now();

  if (!rows || rows.length === 0) return kanji;

  const headers = Object.keys(rows[0] || {});

  // Auto-detect columns if not provided
  const normalizedCharCol = (characterCol || headers.find(h => 
    ['character', 'kanji', 'hanzi'].includes(h.toLowerCase())
  ) || headers[0]).toLowerCase();

  const normalizedMeaningCol = (meaningCol || headers.find(h => 
    ['meaning', 'meanings'].includes(h.toLowerCase())
  ) || headers[1] || headers[0]).toLowerCase();

  const normalizedPronunciationCol = (pronunciationCol || headers.find(h => 
    ['pronunciation', 'reading', 'pinyin'].includes(h.toLowerCase())
  ) || '').toLowerCase();

  const normalizedLevelCol = (levelCol || headers.find(h => 
    ['level', 'lvl'].includes(h.toLowerCase())
  ) || '').toLowerCase();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const character = (row[normalizedCharCol] || '').trim();
    const meaning = (row[normalizedMeaningCol] || '').trim();

    if (!character || !meaning) continue;

    const pronunciation = normalizedPronunciationCol ? (row[normalizedPronunciationCol] || '').trim() : '';

    let level = 1;
    if (normalizedLevelCol) {
      const levelValue = (row[normalizedLevelCol] || '').trim();
      const parsed = parseInt(levelValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        level = Math.min(60, Math.max(1, parsed));
      }
    }

    kanji.push({
      id: `kanji-${now}-${i}`,
      character,
      meaning,
      pronunciation,
      mnemonic: '',
      radicalIds: [],
      language,
      level,
      srsStage: 'locked',
      correctCount: 0,
      wrongCount: 0,
      meaningCorrect: 0,
      meaningWrong: 0,
      readingCorrect: 0,
      readingWrong: 0,
      createdAt: now,
      srsLevel: 0,
      masteryLevel: 0,
      waniKaniLevel: level,
    });
  }

  return kanji;
}
