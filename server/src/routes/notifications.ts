import { Router, Request, Response } from 'express';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /notifications — current user's notifications
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { limit = '30', unread_only } = req.query;

  try {
    let query = `
      SELECT n.*,
        c.name AS channel_name,
        m.body AS message_preview
      FROM notifications n
      LEFT JOIN channels c ON c.id = n.channel_id
      LEFT JOIN messages m ON m.id = n.message_id
      WHERE n.user_id = $1
    `;
    const params: any[] = [userId];

    if (unread_only === 'true') {
      query += ' AND n.read = FALSE';
    }

    query += ` ORDER BY n.created_at DESC LIMIT ${parseInt(limit as string)}`;

    const { rows } = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// GET /notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [userId]
    );
    return res.json({ success: true, data: { count: parseInt(rows[0].count) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch count' });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

// POST /notifications/read-all
router.post('/read-all', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const { rowCount } = await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [userId]
    );
    return res.json({ success: true, data: { marked: rowCount } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

export default router;
