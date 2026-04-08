import { Router, Request, Response } from 'express';
import pool from '../db/auth';

const router = Router();

// GET /channels/:id/messages
router.get('/:channelId/messages', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { limit = '50', before } = req.query;
  try {
    const params: any[] = [channelId, parseInt(limit as string) + 1];
    let query = `
      SELECT m.*, 
        json_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url) AS sender,
        COALESCE(json_agg(json_build_object('emoji', mr.emoji, 'user_id', mr.user_id))
          FILTER (WHERE mr.id IS NOT NULL), '[]') AS reactions
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN message_reactions mr ON mr.message_id = m.id
      WHERE m.channel_id = $1 AND m.deleted_at IS NULL
    `;
    if (before) {
      query += ` AND m.created_at < $3`;
      params.push(before);
    }
    query += ` GROUP BY m.id, u.id ORDER BY m.created_at DESC LIMIT $2`;
    const { rows } = await pool.query(query, params);
    const hasMore = rows.length > parseInt(limit as string);
    const messages = hasMore ? rows.slice(0, -1).reverse() : rows.reverse();
    return res.json({ success: true, data: { messages, has_more: hasMore } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// POST /channels/:id/messages
router.post('/:channelId/messages', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { body, message_type = 'text', reply_to_id, automation_payload } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO messages (channel_id, sender_id, body, message_type, reply_to_id, automation_payload)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.channelId, userId, body, message_type, reply_to_id, automation_payload ? JSON.stringify(automation_payload) : null]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// PATCH /messages/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { body } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE messages SET body = $1, edited = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *',
      [body, req.params.id]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to edit message' });
  }
});

// DELETE /messages/:id — soft delete
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query(
      'UPDATE messages SET deleted_at = NOW(), body = NULL WHERE id = $1',
      [req.params.id]
    );
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// POST /messages/:id/reactions
router.post('/:id/reactions', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { emoji } = req.body;
  try {
    await pool.query(
      'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, userId, emoji]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to add reaction' });
  }
});

// DELETE /messages/:id/reactions/:emoji
router.delete('/:id/reactions/:emoji', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    await pool.query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [req.params.id, userId, req.params.emoji]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to remove reaction' });
  }
});

// PATCH /messages/:id/pin
router.patch('/:id/pin', async (req: Request, res: Response) => {
  const { pinned } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE messages SET pinned = $1 WHERE id = $2 RETURNING *',
      [pinned, req.params.id]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to pin message' });
  }
});

export default router;
