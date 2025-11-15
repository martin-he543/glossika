import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { authenticateToken } from './auth';

const router = Router();

/**
 * GET /api/reviews/queue
 * Get items due for review
 */
router.get('/queue', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { language } = req.query;
    const userId = (req as any).userId;

    let query = `
      SELECT 
        ci.id,
        ci.sentence_id,
        ci.cloze_word,
        ci.masked_text,
        ci.word_position,
        s.text_native,
        s.text_target,
        s.difficulty,
        usp.mastery_percent,
        usp.srs_stage,
        usp.next_review_at
      FROM user_sentence_progress usp
      JOIN cloze_items ci ON usp.cloze_item_id = ci.id
      JOIN sentences s ON ci.sentence_id = s.id
      JOIN languages l ON s.language_id = l.id
      WHERE usp.user_id = $1
        AND usp.next_review_at <= CURRENT_TIMESTAMP
    `;

    const params: any[] = [userId];

    if (language) {
      query += ` AND l.code = $2`;
      params.push(language);
    }

    query += ` ORDER BY usp.next_review_at ASC LIMIT 50`;

    const result = await pool.query(query, params);

    res.json({
      items: result.rows.map(row => ({
        id: row.id,
        sentenceId: row.sentence_id,
        clozeWord: row.cloze_word,
        maskedText: row.masked_text,
        textNative: row.text_native,
        textTarget: row.text_target,
        difficulty: row.difficulty,
        masteryPercent: row.mastery_percent,
        srsStage: row.srs_stage,
        nextReviewAt: row.next_review_at
      })),
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

export default router;

