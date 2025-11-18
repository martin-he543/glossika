import Papa from 'papaparse';
import { Word, ClozeSentence, Kanji } from '../types';

export interface CSVRow {
  [key: string]: string;
}

/**
 * Remove UTF-8 BOM from text if present
 */
function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

/**
 * Parse a CSV/TSV file into an array of row objects
 * Handles any size file, any delimiter, quoted values, UTF-8, BOM, etc.
 * Fully standards-compliant CSV parsing
 */
export function parseCSV(
  file: File, 
  onProgress?: (progress: number) => void,
  delimiter?: string
): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    // Auto-detect delimiter based on file extension
    let fileDelimiter = delimiter;
    if (!fileDelimiter) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.tsv')) {
        fileDelimiter = '\t';
      } else {
        fileDelimiter = ','; // Default to comma for CSV
      }
    } else {
      // Convert string delimiter to actual delimiter character
      if (fileDelimiter === 'semicolon') {
        fileDelimiter = ';';
      } else if (fileDelimiter === 'tab') {
        fileDelimiter = '\t';
      } else if (fileDelimiter === 'comma') {
        fileDelimiter = ',';
      }
    }
    
    // Force tab for TSV files
    const finalDelimiter = file.name.toLowerCase().endsWith('.tsv') ? '\t' : fileDelimiter;

    // Configure PapaParse for robust CSV parsing
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy', // Only skip truly empty lines (whitespace-only), not lines with empty fields
      delimiter: finalDelimiter,
      quoteChar: '"',
      escapeChar: '"',
      // Transform headers: normalize to lowercase and trim whitespace
      transformHeader: (header: string) => {
        // Remove BOM if present
        const cleaned = removeBOM(header);
        return cleaned.trim().toLowerCase();
      },
      // Properly handle encoding
      encoding: 'UTF-8',
      // Use complete mode for reliability - this ensures all rows are parsed
      complete: (results) => {
        if (!results) {
          reject(new Error('CSV parsing failed: no results returned'));
          return;
        }

        // Log parsing results for debugging
        console.log(`CSV parsing: ${results.data?.length || 0} rows parsed, ${results.errors?.length || 0} errors`);

        // Check for critical parsing errors (but allow warnings)
        const criticalErrors = results.errors?.filter(e => 
          e.type === 'Quotes' || e.type === 'Delimiter' || e.type === 'FieldMismatch'
        ) || [];
        
        if (criticalErrors.length > 0) {
          console.error('Critical CSV parsing errors:', criticalErrors);
          reject(new Error(
            `CSV parsing errors: ${criticalErrors.map((e: any) => 
              `Row ${e.row}: ${e.message || String(e)}`
            ).join(', ')}`
          ));
          return;
        }

        if (!results.data) {
          reject(new Error('CSV parsing failed: no data returned'));
          return;
        }
        
        // Convert results.data to CSVRow array
        // Don't filter out rows - let createWordsFromCSV decide what to skip
        let allRows: CSVRow[] = [];
        
        if (Array.isArray(results.data)) {
          // Process ALL rows - don't filter here, just clean them
          allRows = results.data.map((row: any) => {
            // Handle invalid rows
            if (!row || typeof row !== 'object') {
              // Return empty row object instead of filtering
              return {} as CSVRow;
            }
            
            // Ensure all values are strings and properly cleaned
            const cleanedRow: CSVRow = {};
            for (const [key, value] of Object.entries(row)) {
              if (value === null || value === undefined) {
                cleanedRow[key] = '';
              } else {
                // PapaParse already handles quotes, so we just need to trim
                // Don't manually remove quotes - PapaParse does this correctly
                const trimmed = String(value).trim();
                cleanedRow[key] = trimmed;
              }
            }
            return cleanedRow;
          }).filter((row: CSVRow) => {
            // Only filter out completely empty row objects (no keys at all)
            return Object.keys(row).length > 0;
          });
        } else if (results.data && typeof results.data === 'object') {
          // Single row case
          const cleanedRow: CSVRow = {};
          for (const [key, value] of Object.entries(results.data)) {
            cleanedRow[key] = value === null || value === undefined ? '' : String(value).trim();
          }
          allRows = [cleanedRow];
        }
        
        console.log(`CSV parsing complete: ${allRows.length} rows after cleaning`);
        
        // Track progress if callback provided
        if (onProgress) {
          onProgress(100);
        }
        
        if (allRows.length > 0) {
          resolve(allRows);
        } else {
          reject(new Error(
            'CSV file appears to be empty or invalid. ' +
            `Parsed ${results.data?.length || 0} rows but all were empty.`
          ));
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        reject(new Error(`CSV parsing failed: ${error.message || String(error)}`));
      },
    });
  });
}

/**
 * Get value from row with proper column matching
 * This is case-insensitive and handles whitespace differences
 */
function getValueFromRow(row: CSVRow, columnName: string): string {
  if (!columnName || !row) return '';
  
  const normalizedColumnName = columnName.toLowerCase().trim();
  
  // Try exact match first (headers are already normalized to lowercase by PapaParse)
  if (normalizedColumnName in row && row[normalizedColumnName] !== undefined && row[normalizedColumnName] !== null) {
    return String(row[normalizedColumnName]).trim();
  }
  
  // Try finding matching key with fuzzy matching
  const matchingKey = Object.keys(row).find(key => {
    const normalizedKey = key.toLowerCase().trim();
    return normalizedKey === normalizedColumnName;
  });
  
  if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
    return String(row[matchingKey]).trim();
  }
  
  return '';
}

/**
 * Validate that required columns exist in the CSV
 */
function validateColumns(
  rows: CSVRow[],
  nativeCol: string,
  targetCol: string,
  levelCol?: string
): { valid: boolean; missing: string[]; available: string[] } {
  if (rows.length === 0) {
    return { valid: false, missing: [nativeCol, targetCol], available: [] };
  }

  const headers = Object.keys(rows[0] || {});
  const available = headers.map(h => h.toLowerCase().trim());
  
  const normalizedNativeCol = nativeCol.toLowerCase().trim();
  const normalizedTargetCol = targetCol.toLowerCase().trim();
  const normalizedLevelCol = levelCol ? levelCol.toLowerCase().trim() : undefined;
  
  const missing: string[] = [];
  
  if (!available.includes(normalizedNativeCol)) {
    missing.push(nativeCol);
  }
  if (!available.includes(normalizedTargetCol)) {
    missing.push(targetCol);
  }
  if (normalizedLevelCol && !available.includes(normalizedLevelCol)) {
    missing.push(levelCol!);
  }
  
  return {
    valid: missing.length === 0,
    missing,
    available: headers
  };
}

/**
 * Create Word objects from CSV rows
 * Handles any CSV format with flexible column detection
 * Preserves quoted fields and handles commas correctly
 */
export function createWordsFromCSV(
  rows: CSVRow[],
  courseId: string,
  nativeCol: string,
  targetCol: string,
  levelCol?: string,
  partOfSpeechCol?: string,
  pronunciationCol?: string
): Word[] {
  const words: Word[] = [];
  const now = Date.now();

  if (!rows || rows.length === 0) {
    return words;
  }

  // Validate columns exist
  const validation = validateColumns(rows, nativeCol, targetCol, levelCol);
  if (!validation.valid) {
    throw new Error(
      `Missing required columns: ${validation.missing.join(', ')}. ` +
      `Available columns: ${validation.available.join(', ')}`
    );
  }

  // Get headers from first row
  const headers = Object.keys(rows[0] || {});
  
  // Use provided partOfSpeechCol or auto-detect
  let finalPartOfSpeechCol = partOfSpeechCol;
  if (!finalPartOfSpeechCol) {
    finalPartOfSpeechCol = headers.find(h => {
      const lower = h.toLowerCase().trim();
      return (lower.includes('part') && (lower.includes('speech') || lower.includes('pos'))) ||
             lower === 'pos' || 
             lower === 'type' ||
             lower === 'part of speech';
    });
  }
  
  // Use provided pronunciationCol or auto-detect
  let finalPronunciationCol = pronunciationCol;
  if (!finalPronunciationCol) {
    finalPronunciationCol = headers.find(h => {
      const lower = h.toLowerCase().trim();
      return lower.includes('pronunciation') || 
             lower.includes('phonetic') || 
             lower.includes('ipa') || 
             lower.includes('reading') ||
             lower === 'pronunciation';
    });
  }

  // Normalize column names for matching
  const normalizedNativeCol = nativeCol.toLowerCase().trim();
  const normalizedTargetCol = targetCol.toLowerCase().trim();
  const normalizedLevelCol = levelCol ? levelCol.toLowerCase().trim() : undefined;

  // Process each row
  let skippedCount = 0;
  let firstSkippedRows: Array<{index: number; native: string; target: string; keys: string[]}> = [];
  
  // Debug: Check if column names match actual row keys
  if (rows.length > 0) {
    const firstRowKeys = Object.keys(rows[0]);
    const normalizedKeys = firstRowKeys.map(k => k.toLowerCase().trim());
    if (!normalizedKeys.includes(normalizedNativeCol)) {
      console.error(`Column "${normalizedNativeCol}" not found in CSV. Available columns:`, firstRowKeys);
    }
    if (!normalizedKeys.includes(normalizedTargetCol)) {
      console.error(`Column "${normalizedTargetCol}" not found in CSV. Available columns:`, firstRowKeys);
    }
  }
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') {
      skippedCount++;
      continue;
    }

    // Get native and target values using safe column matching
    // PapaParse already handles quotes and commas correctly, so we don't need to split
    let native = getValueFromRow(row, normalizedNativeCol);
    let target = getValueFromRow(row, normalizedTargetCol);

    // Skip rows with empty required fields
    // Collect first few skipped rows for detailed debugging
    if (!native || native.length === 0 || !target || target.length === 0) {
      skippedCount++;
      if (firstSkippedRows.length < 10) {
        firstSkippedRows.push({
          index: i,
          native,
          target,
          keys: Object.keys(row)
        });
      }
      continue;
    }

    // Parse level
    let level = 1;
    if (normalizedLevelCol) {
      const levelValue = getValueFromRow(row, normalizedLevelCol);
      if (levelValue) {
        const parsed = parseInt(levelValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
          level = parsed;
        }
      }
    }

    // Get part of speech - preserve the full value (PapaParse already handled quotes)
    // Only split on comma if it's clearly a multi-value field (like "conjunction, pronoun")
    // But preserve single values with commas (like "Part of Speech: noun, verb")
    let partOfSpeech: string | undefined = undefined;
    if (finalPartOfSpeechCol) {
      const posValue = getValueFromRow(row, finalPartOfSpeechCol);
      if (posValue) {
        // For part of speech, we might want to take just the first if it's comma-separated
        // But only if it looks like a list (no quotes, multiple words)
        // For now, preserve the full value
        partOfSpeech = posValue;
      }
    }

    // Get pronunciation - preserve full value
    let pronunciation: string | undefined = undefined;
    if (finalPronunciationCol) {
      const pronValue = getValueFromRow(row, finalPronunciationCol);
      if (pronValue) {
        pronunciation = pronValue;
      }
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

  console.log(`createWordsFromCSV: Processed ${rows.length} rows, created ${words.length} words, skipped ${skippedCount}`);
  
  // Log detailed information about skipped rows
  if (skippedCount > 0 && firstSkippedRows.length > 0) {
    console.warn('First skipped rows:', firstSkippedRows);
    console.warn(`Using columns: native="${normalizedNativeCol}", target="${normalizedTargetCol}"`);
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
  
  // Find columns with flexible matching
  const nativeCol = headers.find(h => {
    const lower = h.toLowerCase().trim();
    return ['native', 'english', 'en', 'sentence1'].includes(lower);
  }) || headers[0];
  
  const targetCol = headers.find(h => {
    const lower = h.toLowerCase().trim();
    return ['target', 'translation', 'trans', 'sentence2'].includes(lower);
  }) || headers[1] || headers[0];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    const native = getValueFromRow(row, nativeCol);
    const target = getValueFromRow(row, targetCol);

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
  const normalizedCharCol = (characterCol || headers.find(h => {
    const lower = h.toLowerCase().trim();
    return ['character', 'kanji', 'hanzi'].includes(lower);
  }) || headers[0]).toLowerCase().trim();

  const normalizedMeaningCol = (meaningCol || headers.find(h => {
    const lower = h.toLowerCase().trim();
    return ['meaning', 'meanings'].includes(lower);
  }) || headers[1] || headers[0]).toLowerCase().trim();

  const normalizedPronunciationCol = (pronunciationCol || headers.find(h => {
    const lower = h.toLowerCase().trim();
    return ['pronunciation', 'reading', 'pinyin'].includes(lower);
  }) || '').toLowerCase().trim();

  const normalizedLevelCol = (levelCol || headers.find(h => {
    const lower = h.toLowerCase().trim();
    return ['level', 'lvl'].includes(lower);
  }) || '').toLowerCase().trim();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;

    const character = getValueFromRow(row, normalizedCharCol);
    const meaning = getValueFromRow(row, normalizedMeaningCol);

    if (!character || !meaning) continue;

    const pronunciation = normalizedPronunciationCol ? getValueFromRow(row, normalizedPronunciationCol) : '';

    let level = 1;
    if (normalizedLevelCol) {
      const levelValue = getValueFromRow(row, normalizedLevelCol);
      if (levelValue) {
        const parsed = parseInt(levelValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
          level = Math.min(60, Math.max(1, parsed));
        }
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
