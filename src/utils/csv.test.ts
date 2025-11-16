import { describe, it, expect, beforeEach } from 'vitest';
import { parseCSV, createWordsFromCSV, validateColumns } from './csv';
import { CSVRow } from './csv';

// Helper to create a File object from text
function createFileFromText(text: string, filename: string = 'test.csv'): File {
  const blob = new Blob([text], { type: 'text/csv' });
  return new File([blob], filename, { type: 'text/csv' });
}

describe('CSV Parsing', () => {
  describe('parseCSV', () => {
    it('should parse basic CSV file', async () => {
      const csv = `name,value
test,123
hello,world`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ name: 'test', value: '123' });
      expect(rows[1]).toEqual({ name: 'hello', value: 'world' });
    });

    it('should handle quoted fields with commas', async () => {
      const csv = `target,native
hola,"hello, world"
adiós,"goodbye, farewell"`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(2);
      expect(rows[0].native).toBe('hello, world');
      expect(rows[1].native).toBe('goodbye, farewell');
    });

    it('should handle fields with quotes inside quotes', async () => {
      const csv = `target,native
hola,"say ""hello"""
test,"value ""quoted"""`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(2);
      expect(rows[0].native).toBe('say "hello"');
      expect(rows[1].native).toBe('value "quoted"');
    });

    it('should handle UTF-8 characters', async () => {
      const csv = `target,native
你好,hello
안녕,hello
こんにちは,hello`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(3);
      expect(rows[0].target).toBe('你好');
      expect(rows[1].target).toBe('안녕');
      expect(rows[2].target).toBe('こんにちは');
    });

    it('should handle UTF-8 BOM', async () => {
      // Create file with BOM (U+FEFF)
      const bom = String.fromCharCode(0xFEFF);
      const csv = bom + `target,native
test,value`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].target).toBe('test');
      expect(rows[0].native).toBe('value');
    });

    it('should handle fields with line breaks', async () => {
      const csv = `target,native
hola,"hello
world"
test,"multi
line
value"`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(2);
      expect(rows[0].native).toBe('hello\nworld');
      expect(rows[1].native).toBe('multi\nline\nvalue');
    });

    it('should handle empty fields', async () => {
      const csv = `target,native,part of speech
hola,hello,
adios,,preposition
test,world,`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(3);
      expect(rows[0].native).toBe('hello');
      expect(rows[0]['part of speech']).toBe('');
      expect(rows[1].target).toBe('adios');
      expect(rows[1].native).toBe('');
      expect(rows[2]['part of speech']).toBe('');
    });

    it('should handle TSV files', async () => {
      const tsv = `target\tnative
hola\thello
adios\tgoodbye`;
      const file = createFileFromText(tsv, 'test.tsv');
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(2);
      expect(rows[0].target).toBe('hola');
      expect(rows[0].native).toBe('hello');
    });

    it('should normalize headers to lowercase', async () => {
      const csv = `Target,Native,Part of Speech
hola,hello,noun`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].target).toBe('hola');
      expect(rows[0].native).toBe('hello');
      expect(rows[0]['part of speech']).toBe('noun');
    });

    it('should handle headers with extra whitespace', async () => {
      const csv = `  Target  ,  Native  , Part of Speech 
hola,hello,noun`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].target).toBe('hola');
      expect(rows[0].native).toBe('hello');
      expect(rows[0]['part of speech']).toBe('noun');
    });

    it('should skip completely empty rows', async () => {
      const csv = `target,native
hola,hello

adios,goodbye
`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(2);
    });

    it('should handle variable column order', async () => {
      const csv = `native,target,level
hello,hola,1
goodbye,adios,2`;
      const file = createFileFromText(csv);
      const rows = await parseCSV(file);
      
      expect(rows).toHaveLength(2);
      expect(rows[0].native).toBe('hello');
      expect(rows[0].target).toBe('hola');
      expect(rows[0].level).toBe('1');
    });
  });

  describe('createWordsFromCSV', () => {
    const courseId = 'test-course-123';

    it('should create words from CSV rows', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello' },
        { target: 'adios', native: 'goodbye' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].native).toBe('hello');
      expect(words[0].target).toBe('hola');
      expect(words[1].native).toBe('goodbye');
      expect(words[1].target).toBe('adios');
    });

    it('should preserve quoted fields with commas', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello, world' },
        { target: 'test', native: '"hello, there"' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].native).toBe('hello, world');
      expect(words[1].native).toBe('hello, there');
    });

    it('should handle part of speech column', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello', 'part of speech': 'noun' },
        { target: 'correr', native: 'run', 'part of speech': 'verb' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].partOfSpeech).toBe('noun');
      expect(words[1].partOfSpeech).toBe('verb');
    });

    it('should handle pronunciation column', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello', pronunciation: '/ˈoʊlə/' },
        { target: 'adios', native: 'goodbye', pronunciation: '/aˈðjos/' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].pronunciation).toBe('/ˈoʊlə/');
      expect(words[1].pronunciation).toBe('/aˈðjos/');
    });

    it('should handle level column', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello', level: '1' },
        { target: 'correr', native: 'run', level: '5' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target', 'level');
      
      expect(words).toHaveLength(2);
      expect(words[0].level).toBe(1);
      expect(words[1].level).toBe(5);
    });

    it('should skip rows with empty required fields', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello' },
        { target: '', native: 'test' },
        { target: 'adios', native: '' },
        { target: 'correr', native: 'run' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].target).toBe('hola');
      expect(words[1].target).toBe('correr');
    });

    it('should handle case-insensitive column matching', () => {
      const rows: CSVRow[] = [
        { TARGET: 'hola', NATIVE: 'hello' },
        { Target: 'adios', Native: 'goodbye' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].target).toBe('hola');
      expect(words[0].native).toBe('hello');
    });

    it('should throw error for missing required columns', () => {
      const rows: CSVRow[] = [
        { word: 'hola', translation: 'hello' }
      ];
      
      expect(() => {
        createWordsFromCSV(rows, courseId, 'native', 'target');
      }).toThrow('Missing required columns');
    });

    it('should handle UTF-8 characters in values', () => {
      const rows: CSVRow[] = [
        { target: '你好', native: 'hello' },
        { target: '안녕', native: 'hello' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].target).toBe('你好');
      expect(words[1].target).toBe('안녕');
    });

    it('should preserve multi-word values', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello, world' },
        { target: 'adios', native: 'goodbye, farewell, see you' }
      ];
      
      const words = createWordsFromCSV(rows, courseId, 'native', 'target');
      
      expect(words).toHaveLength(2);
      expect(words[0].native).toBe('hello, world');
      expect(words[1].native).toBe('goodbye, farewell, see you');
    });
  });

  describe('validateColumns', () => {
    it('should validate existing columns', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello', level: '1' }
      ];
      
      const result = validateColumns(rows, 'native', 'target', 'level');
      
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing columns', () => {
      const rows: CSVRow[] = [
        { target: 'hola', native: 'hello' }
      ];
      
      const result = validateColumns(rows, 'native', 'target', 'level');
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('level');
    });

    it('should handle case-insensitive column matching', () => {
      const rows: CSVRow[] = [
        { TARGET: 'hola', NATIVE: 'hello' }
      ];
      
      const result = validateColumns(rows, 'native', 'target');
      
      expect(result.valid).toBe(true);
    });
  });
});

