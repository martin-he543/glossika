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
    let totalBytes = file.size || 0;
    let rowCount = 0;
    let lastProgressUpdate = 0;
    let progressUpdateInterval = 0;

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

    // Use chunk callback for better performance on large files
    // For files > 10MB, use chunk mode; otherwise use step mode for more frequent updates
    const useChunkMode = totalBytes > 10 * 1024 * 1024; // 10MB threshold
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: detectedDelimiter,
      transformHeader: (header) => header.trim().toLowerCase(),
      // Use chunk mode for large files, step mode for smaller files
      ...(useChunkMode ? {} : {
        step: (result) => {
          if (result.data) {
            rows.push(result.data as CSVRow);
            rowCount++;
            
            // Update progress more frequently for smaller files
            if (onProgress && totalBytes > 0) {
              const now = Date.now();
              if (now - lastProgressUpdate > 50 || progressUpdateInterval === 0) {
                // Estimate progress based on row count
                const estimatedBytesPerRow = totalBytes / Math.max(1000, rowCount * 10); // Estimate based on sample
                const processedBytes = rowCount * estimatedBytesPerRow;
                const progress = Math.min(95, Math.floor((processedBytes / totalBytes) * 100));
                
                requestAnimationFrame(() => {
                  onProgress(progress);
                });
                
                lastProgressUpdate = now;
              }
              progressUpdateInterval = (progressUpdateInterval + 1) % 100;
            }
          }
        },
      }),
      // Process in chunks for very large files
      chunk: (results) => {
        if (results.data) {
          const chunkRows = results.data as CSVRow[];
          rows.push(...chunkRows);
          rowCount += chunkRows.length;
          
          // Update progress for chunked processing
          if (onProgress && totalBytes > 0) {
            const now = Date.now();
            if (now - lastProgressUpdate > 200 || progressUpdateInterval === 0) {
              // More accurate progress for chunked processing
              // Estimate based on file position (PapaParse processes sequentially)
              const estimatedBytesPerRow = totalBytes / Math.max(10000, rowCount * 5);
              const processedBytes = rowCount * estimatedBytesPerRow;
              const progress = Math.min(95, Math.floor((processedBytes / totalBytes) * 100));
              
              requestAnimationFrame(() => {
                onProgress(progress);
              });
              
              lastProgressUpdate = now;
            }
            progressUpdateInterval = (progressUpdateInterval + 1) % 50;
          }
        }
      },
      // More lenient parsing - continue even with errors
      error: (error) => {
        // Log but don't reject - try to continue with partial data
        console.warn('CSV parsing warning:', error);
      },
      complete: (results) => {
        // Combine step data with any chunk data
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

  for (const row of rows) {
    // Use specified columns or try common variations
    const character = characterCol 
      ? (row[characterCol] || '')
      : (row['character'] || row['kanji'] || row['hanzi'] || '');
    
    const meaning = meaningCol
      ? (row[meaningCol] || '')
      : (row['meaning'] || row['meanings'] || '');
    
    const pronunciation = pronunciationCol
      ? (row[pronunciationCol] || '')
      : (row['pronunciation'] || row['reading'] || row['pinyin'] || '');
    
    // Parse level if level column is specified
    let level = 1; // Default to level 1
    if (levelCol && row[levelCol]) {
      const parsedLevel = parseInt(row[levelCol], 10);
      if (!isNaN(parsedLevel) && parsedLevel > 0) {
        level = parsedLevel;
      }
    } else if (row['level'] || row['lvl']) {
      const parsedLevel = parseInt(row['level'] || row['lvl'] || '1', 10);
      if (!isNaN(parsedLevel) && parsedLevel > 0) {
        level = parsedLevel;
      }
    }

    if (!character || !meaning) continue;

    kanji.push({
      id: `kanji-${now}-${kanji.length}`,
      character,
      meaning,
      pronunciation,
      mnemonic: '', // Can be added later
      radicalIds: [], // Can be added later
      language,
      level: Math.min(60, Math.max(1, level)), // Clamp between 1-60
      srsStage: 'locked',
      correctCount: 0,
      wrongCount: 0,
      meaningCorrect: 0,
      meaningWrong: 0,
      readingCorrect: 0,
      readingWrong: 0,
      createdAt: now,
      // Legacy properties for backward compatibility
      srsLevel: 0,
      masteryLevel: 0,
      waniKaniLevel: level,
    });
  }

  return kanji;
}

