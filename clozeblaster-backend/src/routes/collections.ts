import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../db/connection';
import { authenticateToken } from './auth';
import Papa from 'papaparse';
import { generateClozeItems } from '../utils/cloze-generator';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All collection routes require authentication
router.use(authenticateToken);

/**
 * GET /api/collections
 * List collections
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { language } = req.query;
    const userId = (req as any).userId;

    let query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.is_public,
        c.owner_id,
        c.language_id,
        l.code as language_code,
        l.name as language_name,
        COUNT(DISTINCT cs.sentence_id) as sentence_count
      FROM collections c
      JOIN languages l ON c.language_id = l.id
      LEFT JOIN collection_sentences cs ON c.id = cs.collection_id
      WHERE c.owner_id = $1 OR c.is_public = true
    `;

    const params: any[] = [userId];

    if (language) {
      query += ` AND l.code = $2`;
      params.push(language);
    }

    query += ` GROUP BY c.id, l.code, l.name ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      collections: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        isPublic: row.is_public,
        ownerId: row.owner_id,
        language: {
          id: row.language_id,
          code: row.language_code,
          name: row.language_name
        },
        sentenceCount: parseInt(row.sentence_count)
      }))
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

/**
 * POST /api/collections
 * Create collection from CSV upload
 */
router.post('/', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { name, description, language_code } = req.body;
    const userId = (req as any).userId;
    const file = req.file;

    if (!name || !language_code) {
      return res.status(400).json({ error: 'Name and language_code required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'CSV file required' });
    }

    // Get language ID
    const langResult = await pool.query(
      'SELECT id FROM languages WHERE code = $1',
      [language_code]
    );

    if (langResult.rows.length === 0) {
      return res.status(404).json({ error: 'Language not found' });
    }

    const languageId = langResult.rows[0].id;

    // Parse CSV
    const csvText = file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ error: 'Invalid CSV format', details: parseResult.errors });
    }

    // Create collection
    const collectionResult = await pool.query(
      `INSERT INTO collections (name, description, owner_id, language_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, description || null, userId, languageId]
    );

    const collectionId = collectionResult.rows[0].id;

    // Process sentences
    const rows = parseResult.data as any[];
    let sentenceCount = 0;

    for (const row of rows) {
      // Auto-detect columns
      const textNative = row.native || row.english || row.source || row.text_native || '';
      const textTarget = row.target || row.translation || row.text_target || '';

      if (!textNative || !textTarget) continue;

      // Insert sentence
      const sentenceResult = await pool.query(
        `INSERT INTO sentences (language_id, text_native, text_target, source, difficulty)
         VALUES ($1, $2, $3, 'user_upload', 'medium')
         RETURNING id`,
        [languageId, textNative, textTarget]
      );

      const sentenceId = sentenceResult.rows[0].id;

      // Generate and insert cloze items
      const clozeItems = generateClozeItems(textTarget, sentenceId);
      for (const item of clozeItems) {
        await pool.query(
          `INSERT INTO cloze_items (sentence_id, cloze_word, masked_text, word_position, mode_flags)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sentenceId,
            item.clozeWord,
            item.maskedText,
            item.wordPosition,
            JSON.stringify({ mc: true, input: true, audio: true })
          ]
        );
      }

      // Link to collection
      await pool.query(
        'INSERT INTO collection_sentences (collection_id, sentence_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [collectionId, sentenceId]
      );

      sentenceCount++;
    }

    res.status(201).json({
      collection: {
        id: collectionId,
        name,
        description,
        languageId,
        sentenceCount
      }
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

export default router;

