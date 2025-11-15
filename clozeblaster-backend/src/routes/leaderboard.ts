import { Router, Request, Response } from 'express';
import { pool } from '../db/connection';

const router = Router();

/**
 * GET /api/leaderboard
 * Get leaderboard for a language
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { language, limit = 100 } = req.query;

    if (!language) {
      return res.status(400).json({ error: 'Language parameter required' });
    }

    const query = `
      SELECT 
        u.id,
        u.username,
        u.points,
        u.streak,
        le.updated_at
      FROM leaderboard_entries le
      JOIN users u ON le.user_id = u.id
      JOIN languages l ON le.language_id = l.id
      WHERE l.code = $1
      ORDER BY le.points DESC, le.updated_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [language, limit]);

    res.json({
      language,
      entries: result.rows.map((row, index) => ({
        rank: index + 1,
        userId: row.id,
        username: row.username,
        points: row.points,
        streak: row.streak,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;

