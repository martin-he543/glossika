/**
 * Integration test: User answering 3 items and verifying DB updates
 * Run with: npm test -- integration.test.ts
 */

import { pool } from '../db/connection';
import { updateStagedSRS, type UserProgress } from '../utils/srs';

describe('Integration: Answer Flow', () => {
  let userId: number;
  let clozeItemIds: number[];

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, username, hashed_password)
       VALUES ('test@example.com', 'testuser', '$2b$10$dummy')
       RETURNING id`
    );
    userId = userResult.rows[0].id;

    // Get or create test cloze items
    const itemsResult = await pool.query(
      `SELECT id FROM cloze_items LIMIT 3`
    );
    clozeItemIds = itemsResult.rows.map(r => r.id);

    if (clozeItemIds.length < 3) {
      throw new Error('Need at least 3 cloze items in database for testing');
    }
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM reviews WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_sentence_progress WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  it('should update progress correctly after answering 3 items', async () => {
    const initialProgress: UserProgress = {
      masteryPercent: 0,
      srsStage: 0,
      lastSeen: new Date(),
      nextReviewAt: new Date(),
      correctCount: 0,
      incorrectCount: 0
    };

    // Answer 3 items: correct, incorrect, correct
    const answers = [true, false, true];
    const results = [];

    for (let i = 0; i < 3; i++) {
      const clozeItemId = clozeItemIds[i];
      const isCorrect = answers[i];

      // Get current progress
      const progressResult = await pool.query(
        `SELECT mastery_percent, srs_stage, next_review_at, correct_count, incorrect_count
         FROM user_sentence_progress
         WHERE user_id = $1 AND cloze_item_id = $2`,
        [userId, clozeItemId]
      );

      let currentProgress = initialProgress;
      if (progressResult.rows.length > 0) {
        const row = progressResult.rows[0];
        currentProgress = {
          masteryPercent: row.mastery_percent,
          srsStage: row.srs_stage,
          lastSeen: row.last_seen || new Date(),
          nextReviewAt: row.next_review_at || new Date(),
          correctCount: row.correct_count,
          incorrectCount: row.incorrect_count
        };
      }

      // Update using SRS
      const newProgress = updateStagedSRS(currentProgress, isCorrect);

      // Upsert progress
      await pool.query(
        `INSERT INTO user_sentence_progress (
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
          incorrect_count = EXCLUDED.incorrect_count`,
        [
          userId,
          clozeItemId,
          newProgress.masteryPercent,
          newProgress.srsStage,
          newProgress.lastSeen,
          newProgress.nextReviewAt,
          newProgress.correctCount,
          newProgress.incorrectCount
        ]
      );

      results.push({ clozeItemId, isCorrect, newProgress });
    }

    // Verify final state
    const finalResult = await pool.query(
      `SELECT 
        cloze_item_id,
        mastery_percent,
        srs_stage,
        next_review_at,
        correct_count,
        incorrect_count
      FROM user_sentence_progress
      WHERE user_id = $1
      ORDER BY cloze_item_id`,
      [userId]
    );

    expect(finalResult.rows.length).toBe(3);

    // First item: correct -> should be 25% mastery, stage 1
    const firstItem = finalResult.rows.find(r => r.cloze_item_id === clozeItemIds[0]);
    expect(firstItem.mastery_percent).toBe(25);
    expect(firstItem.srs_stage).toBe(1);
    expect(firstItem.correct_count).toBe(1);
    expect(firstItem.incorrect_count).toBe(0);
    expect(new Date(firstItem.next_review_at).getTime()).toBeGreaterThan(Date.now());

    // Second item: incorrect -> should be 0% mastery, stage 0
    const secondItem = finalResult.rows.find(r => r.cloze_item_id === clozeItemIds[1]);
    expect(secondItem.mastery_percent).toBe(0);
    expect(secondItem.srs_stage).toBe(0);
    expect(secondItem.correct_count).toBe(0);
    expect(secondItem.incorrect_count).toBe(1);

    // Third item: correct -> should be 25% mastery, stage 1
    const thirdItem = finalResult.rows.find(r => r.cloze_item_id === clozeItemIds[2]);
    expect(thirdItem.mastery_percent).toBe(25);
    expect(thirdItem.srs_stage).toBe(1);
    expect(thirdItem.correct_count).toBe(1);
    expect(thirdItem.incorrect_count).toBe(0);
  });
});

