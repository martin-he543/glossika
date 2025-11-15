import Papa from 'papaparse';
import { Word, Course, ClozeSentence, ClozeCourse, Kanji } from '../types';

export interface CSVRow {
  [key: string]: string;
}

export function parseCSV(
  file: File, 
  onProgress?: (progress: number) => void,
  delimiter?: string
): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CSVRow[] = [];
    let totalBytes = 0;
    let processedBytes = 0;

    // Auto-detect delimiter if not provided
    let detectedDelimiter = delimiter;
    if (!detectedDelimiter) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.tsv')) {
        detectedDelimiter = '\t';
      } else {
        // Default to comma, but PapaParse will auto-detect
        detectedDelimiter = ',';
      }
    }

    // Get file size for progress tracking
    if (file.size) {
      totalBytes = file.size;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: detectedDelimiter,
      transformHeader: (header) => header.trim().toLowerCase(),
      // Process in chunks for large files to avoid blocking
      chunk: (results) => {
        if (results.data) {
          rows.push(...(results.data as CSVRow[]));
        }
        
        // Update progress if callback provided
        if (onProgress && totalBytes > 0) {
          // Estimate progress based on file position (approximate)
          processedBytes += results.data ? JSON.stringify(results.data).length : 0;
          const progress = Math.min(95, Math.floor((processedBytes / totalBytes) * 100));
          onProgress(progress);
        }
      },
      // More lenient parsing - continue even with errors
      error: (error) => {
        // Log but don't reject - try to continue with partial data
        console.warn('CSV parsing warning:', error);
      },
      complete: (results) => {
        // Combine chunked data with any remaining data
        const allRows = rows.length > 0 ? rows : (results.data as CSVRow[] || []);
        
        if (onProgress) {
          onProgress(100);
        }
        
        // If we have data, use it even if there were errors
        if (allRows.length > 0) {
          resolve(allRows);
        } else if (results.errors.length > 0) {
          // Only reject if we have no data AND there are errors
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
        } else {
          // Empty file
          reject(new Error('CSV file appears to be empty'));
        }
      },
    });
  });
}

export function createWordsFromCSV(
  rows: CSVRow[],
  courseId: string,
  nativeCol: string,
  targetCol: string,
  levelCol?: string
): Word[] {
  const words: Word[] = [];
  const now = Date.now();

  for (const row of rows) {
    const native = row[nativeCol]?.trim();
    const target = row[targetCol]?.trim();

    if (!native || !target) {
      continue; // Skip empty rows
    }

    // Parse level from CSV if level column is specified
    let level: number | undefined = undefined;
    if (levelCol && row[levelCol]) {
      const levelValue = parseInt(row[levelCol].trim(), 10);
      if (!isNaN(levelValue) && levelValue > 0) {
        level = levelValue;
      }
    }
    // Default to level 1 if no level specified
    if (!level) {
      level = 1;
    }

    words.push({
      id: `${courseId}-${now}-${words.length}`,
      native,
      target,
      courseId,
      createdAt: now,
      wrongCount: 0,
      correctCount: 0,
      srsLevel: 0,
      masteryLevel: 'seed',
      level,
    });
  }

  return words;
}

export function createClozeFromTatoeba(rows: CSVRow[], courseId: string): ClozeSentence[] {
  const sentences: ClozeSentence[] = [];
  const now = Date.now();

  if (rows.length === 0) return sentences;

  // Auto-detect column names - try multiple variations
  const headers = Object.keys(rows[0] || {});
  
  // Find native/english column (try many variations)
  const findNativeColumn = (row: CSVRow): string => {
    const possibleNames = [
      'native', 'english', 'en', 'sentence1', 'sentence_1', 'source', 'source_text',
      'text', 'original', 'base', 'first', 'column1', 'col1', 'a', '1'
    ];
    for (const name of possibleNames) {
      const value = row[name]?.trim();
      if (value) return value;
    }
    // If no match, try first column that has content
    for (const header of headers) {
      const value = row[header]?.trim();
      if (value && header.toLowerCase().includes('eng')) return value;
      if (value && !header.toLowerCase().includes('target') && !header.toLowerCase().includes('trans')) {
        return value;
      }
    }
    return '';
  };

  // Find target/translation column
  const findTargetColumn = (row: CSVRow): string => {
    const possibleNames = [
      'target', 'translation', 'trans', 'sentence2', 'sentence_2', 'translated', 'target_text',
      'text', 'translated_text', 'second', 'column2', 'col2', 'b', '2'
    ];
    for (const name of possibleNames) {
      const value = row[name]?.trim();
      if (value) return value;
    }
    // If no match, try second column or any column with "target" or "trans" in name
    for (const header of headers) {
      const value = row[header]?.trim();
      if (value && (header.toLowerCase().includes('target') || header.toLowerCase().includes('trans'))) {
        return value;
      }
    }
    // Try second column if first didn't work
    if (headers.length >= 2) {
      const value = row[headers[1]]?.trim();
      if (value) return value;
    }
    return '';
  };

  // Find language column
  const findLanguage = (row: CSVRow): string => {
    const possibleNames = [
      'language', 'lang', 'code', 'iso', 'locale', 'target_language', 'target_lang'
    ];
    for (const name of possibleNames) {
      const value = row[name]?.trim();
      if (value) return value;
    }
    return 'unknown';
  };

  for (const row of rows) {
    try {
      const native = findNativeColumn(row);
      const target = findTargetColumn(row);
      const language = findLanguage(row);

      // Skip if both are empty
      if (!native && !target) continue;
      
      // If only one is provided, use it for both (for single-language practice)
      const finalNative = native || target;
      const finalTarget = target || native;

      if (!finalNative || !finalTarget) continue;

      // Create cloze - try to split by words, but also handle single words
      const words = finalTarget.split(/\s+/).filter(w => w.length > 0);
      
      // If only one word, use the whole word as the blank
      if (words.length === 0) continue;
      
      let answer: string;
      let clozeText: string;
      
      if (words.length === 1) {
        // Single word - blank the whole thing
        answer = words[0];
        clozeText = '_____';
      } else {
        // Multiple words - blank a random one
        const randomIndex = Math.floor(Math.random() * words.length);
        answer = words[randomIndex];
        words[randomIndex] = '_____';
        clozeText = words.join(' ');
      }

      sentences.push({
        id: `cloze-${now}-${sentences.length}`,
        native: finalNative,
        target: finalTarget,
        clozeText,
        answer,
        language,
        courseId,
        createdAt: now,
        masteryLevel: 0,
        correctCount: 0,
        wrongCount: 0,
      });
    } catch (err) {
      // Skip invalid rows instead of failing entirely
      console.warn('Skipping invalid row:', row, err);
      continue;
    }
  }

  return sentences;
}

export function createKanjiFromCSV(rows: CSVRow[], language: 'japanese' | 'chinese'): Kanji[] {
  const kanji: Kanji[] = [];
  const now = Date.now();

  for (const row of rows) {
    const character = row['character'] || row['kanji'] || row['hanzi'] || '';
    const meaning = row['meaning'] || row['meanings'] || '';
    const pronunciation = row['pronunciation'] || row['reading'] || row['pinyin'] || '';

    if (!character || !meaning) continue;

    kanji.push({
      id: `kanji-${now}-${kanji.length}`,
      character,
      meaning,
      pronunciation,
      language,
      createdAt: now,
      srsLevel: 0,
      masteryLevel: 0,
      waniKaniLevel: 1, // Start at level 1
      correctCount: 0,
      wrongCount: 0,
    });
  }

  return kanji;
}

