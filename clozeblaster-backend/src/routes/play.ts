import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';
import { updateStagedSRS, calculatePoints, type UserProgress } from '../utils/srs';
import { authenticateToken } from './auth';

const router = Router();

// All play routes require authentication
router.use(authenticateToken);

/**
 * GET /api/play/new
 * Get a batch of new cloze items for practice
 */
router.get('/new', async (req: Request, res: Response) => {
  try {
    const { language, mode = 'mc', page = 1, limit = 20, collection_id } = req.query;
    const userId = (req as any).userId; // Set by auth middleware

    if (!language) {
      return res.status(400).json({ error: 'Language parameter required' });
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Build query
    let query = `
      SELECT 
        ci.id,
        ci.sentence_id,
        ci.cloze_word,
        ci.masked_text,
        ci.word_position,
        ci.mode_flags,
        ci.audio_url,
        s.text_native,
        s.text_target,
        s.difficulty,
        s.frequency_rank,
        l.code as language_code,
        l.name as language_name,
        COALESCE(usp.mastery_percent, 0) as mastery_percent,
        COALESCE(usp.srs_stage, 0) as srs_stage,
        COALESCE(usp.next_review_at, CURRENT_TIMESTAMP) as next_review_at,
        COALESCE(usp.correct_count, 0) as correct_count,
        COALESCE(usp.incorrect_count, 0) as incorrect_count
      FROM cloze_items ci
      JOIN sentences s ON ci.sentence_id = s.id
      JOIN languages l ON s.language_id = l.id
      LEFT JOIN user_sentence_progress usp ON usp.cloze_item_id = ci.id AND usp.user_id = $1
      WHERE l.code = $2
    `;

    const params: any[] = [userId, language];

    if (collection_id) {
      query += ` AND s.id IN (
        SELECT sentence_id FROM collection_sentences WHERE collection_id = $3
      )`;
      params.push(collection_id);
    }

    query += ` ORDER BY COALESCE(usp.next_review_at, '1970-01-01'::timestamp) ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // Generate distractors for multiple choice mode
    const items = await Promise.all(
      result.rows.map(async (row) => {
        let distractors: string[] = [];
        
        if (mode === 'mc') {
          // Get distractors from same difficulty/frequency
          const distractorQuery = `
            SELECT DISTINCT ci.cloze_word
            FROM cloze_items ci
            JOIN sentences s ON ci.sentence_id = s.id
            WHERE s.language_id = (SELECT language_id FROM sentences WHERE id = $1)
              AND ci.cloze_word != $2
              AND s.difficulty = $3
            ORDER BY RANDOM()
            LIMIT 3
          `;
          const distractorResult = await pool.query(distractorQuery, [
            row.sentence_id,
            row.cloze_word,
            row.difficulty
          ]);
          distractors = distractorResult.rows.map(r => r.cloze_word);
        }

        return {
          id: row.id,
          sentenceId: row.sentence_id,
          clozeWord: row.cloze_word,
          maskedText: row.masked_text,
          wordPosition: row.word_position,
          textNative: row.text_native,
          textTarget: row.text_target,
          difficulty: row.difficulty,
          frequencyRank: row.frequency_rank,
          language: {
            code: row.language_code,
            name: row.language_name
          },
          progress: {
            masteryPercent: row.mastery_percent,
            srsStage: row.srs_stage,
            nextReviewAt: row.next_review_at,
            correctCount: row.correct_count,
            incorrectCount: row.incorrect_count
          },
          distractors: distractors.length > 0 
            ? [...distractors, row.cloze_word].sort(() => Math.random() - 0.5)
            : [],
          audioUrl: row.audio_url,
          modeFlags: row.mode_flags
        };
      })
    );

    res.json({
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching play items:', error);
    res.status(500).json({ error: 'Failed to fetch play items' });
  }
});

/**
 * POST /api/play/answer
 * Submit an answer and update progress
 */
router.post('/answer', async (req: Request, res: Response) => {
  try {
    const { cloze_item_id, answer, time_ms } = req.body;
    const userId = (req as any).userId;

    if (!cloze_item_id || answer === undefined) {
      return res.status(400).json({ error: 'cloze_item_id and answer required' });
    }

    // Get cloze item and current progress
    const itemQuery = `
      SELECT ci.cloze_word, ci.sentence_id, s.language_id
      FROM cloze_items ci
      JOIN sentences s ON ci.sentence_id = s.id
      WHERE ci.id = $1
    `;
    const itemResult = await pool.query(itemQuery, [cloze_item_id]);
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cloze item not found' });
    }

    const clozeWord = itemResult.rows[0].cloze_word;
    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(clozeWord);

    // Get or create progress
    const progressQuery = `
      SELECT 
        mastery_percent, srs_stage, last_seen, next_review_at,
        correct_count, incorrect_count
      FROM user_sentence_progress
      WHERE user_id = $1 AND cloze_item_id = $2
    `;
    const progressResult = await pool.query(progressQuery, [userId, cloze_item_id]);

    let currentProgress: UserProgress;
    if (progressResult.rows.length === 0) {
      currentProgress = {
        masteryPercent: 0,
        srsStage: 0,
        lastSeen: new Date(),
        nextReviewAt: new Date(),
        correctCount: 0,
        incorrectCount: 0
      };
    } else {
      const row = progressResult.rows[0];
      currentProgress = {
        masteryPercent: row.mastery_percent,
        srsStage: row.srs_stage,
        lastSeen: row.last_seen,
        nextReviewAt: row.next_review_at,
        correctCount: row.correct_count,
        incorrectCount: row.incorrect_count
      };
    }

    // Update progress using SRS
    const newProgress = updateStagedSRS(currentProgress, isCorrect);
    const pointsAwarded = calculatePoints(isCorrect, 0); // TODO: Get actual streak

    // Upsert progress
    const upsertQuery = `
      INSERT INTO user_sentence_progress (
        user_id, cloze_item_id, mastery_percent, srs_stage,
        last_seen, next_review_at, correct_count, incorrect_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, cloze_item_id)
      DO UPDATE SET
        mastery_percent = EXCLUDED.mastery_percent,
        srs_stage = EXCLUDED.srs_stage,
        last_seen = EXCLUDED.last_seen,
        next_review_at = EXCLUDED.next_review_at,
        correct_count = EXCLUDED.correct_count,
        incorrect_count = EXCLUDED.incorrect_count,
        updated_at = CURRENT_TIMESTAMP
    `;
    await pool.query(upsertQuery, [
      userId,
      cloze_item_id,
      newProgress.masteryPercent,
      newProgress.srsStage,
      newProgress.lastSeen,
      newProgress.nextReviewAt,
      newProgress.correctCount,
      newProgress.incorrectCount
    ]);

    // Record review
    const reviewQuery = `
      INSERT INTO reviews (
        user_id, cloze_item_id, answer, is_correct, time_ms,
        mastery_before, mastery_after, points_awarded
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await pool.query(reviewQuery, [
      userId,
      cloze_item_id,
      answer,
      isCorrect,
      time_ms || 0,
      currentProgress.masteryPercent,
      newProgress.masteryPercent,
      pointsAwarded
    ]);

    // Update user points
    if (pointsAwarded > 0) {
      await pool.query(
        'UPDATE users SET points = points + $1 WHERE id = $2',
        [pointsAwarded, userId]
      );
    }

    res.json({
      correct: isCorrect,
      correctAnswer: clozeWord,
      newMastery: newProgress.masteryPercent,
      nextReviewAt: newProgress.nextReviewAt,
      pointsAwarded
    });
  } catch (error) {
    console.error('Error processing answer:', error);
    res.status(500).json({ error: 'Failed to process answer' });
  }
});

/**
 * Normalize answer for comparison (case-insensitive, trim, handle accents)
 */
function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
}

export default router;

