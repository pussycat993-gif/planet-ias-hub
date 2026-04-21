import { Router, Request, Response } from 'express';
import pool from '../db/auth';
import { io } from '../index';

const router = Router();

// GET /messages/pinned — all pinned messages (client filters by known channels)
router.get('/pinned', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.channel_id, m.body, m.message_type, m.created_at, m.pinned,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar_url', u.avatar_url
        ) AS sender,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'type', c.type,
          'logo_color', c.logo_color,
          'logo_abbr', c.logo_abbr
        ) AS channel,
        CASE WHEN f.id IS NOT NULL THEN json_build_object(
          'name', f.file_name,
          'mime_type', f.mime_type
        ) END AS file
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN channels c ON c.id = m.channel_id
       LEFT JOIN files f ON f.message_id = m.id
       WHERE m.pinned = TRUE AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 100`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /messages/pinned error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch pinned messages' });
  }
});

// GET /messages/:channelId/messages
router.get('/:channelId/messages', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { limit = '50', before } = req.query;
  try {
    const params: any[] = [channelId, parseInt(limit as string) + 1];
    let query = `
      SELECT m.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar_url', u.avatar_url,
          'status', u.status
        ) AS sender,
        CASE WHEN f.id IS NOT NULL THEN json_build_object(
          'id', f.id,
          'name', f.file_name,
          'size', f.file_size,
          'mime_type', f.mime_type,
          'basename', regexp_replace(f.storage_path, '^.*/', '')
        ) END AS file,
        COALESCE(json_agg(json_build_object('emoji', mr.emoji, 'user_id', mr.user_id))
          FILTER (WHERE mr.id IS NOT NULL), '[]') AS reactions,
        (SELECT COUNT(*)::int FROM messages child
          WHERE child.reply_to_id = m.id AND child.deleted_at IS NULL) AS thread_count,
        (SELECT MAX(child.created_at) FROM messages child
          WHERE child.reply_to_id = m.id AND child.deleted_at IS NULL) AS thread_last_reply_at
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN files f ON f.message_id = m.id
      LEFT JOIN message_reactions mr ON mr.message_id = m.id
      WHERE m.channel_id = $1 AND m.deleted_at IS NULL AND m.reply_to_id IS NULL
    `;
    if (before) {
      query += ` AND m.created_at < $3`;
      params.push(before);
    }
    query += ` GROUP BY m.id, u.id, f.id ORDER BY m.created_at DESC LIMIT $2`;
    const { rows } = await pool.query(query, params);
    const hasMore = rows.length > parseInt(limit as string);
    const messages = hasMore ? rows.slice(0, -1).reverse() : rows.reverse();
    return res.json({ success: true, data: { messages, has_more: hasMore } });
  } catch (err) {
    console.error('GET messages error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// GET /messages/:parentId/thread — fetch all replies for a parent message
router.get('/:parentId/thread', async (req: Request, res: Response) => {
  const { parentId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar_url', u.avatar_url,
          'status', u.status
        ) AS sender,
        CASE WHEN f.id IS NOT NULL THEN json_build_object(
          'id', f.id,
          'name', f.file_name,
          'size', f.file_size,
          'mime_type', f.mime_type,
          'basename', regexp_replace(f.storage_path, '^.*/', '')
        ) END AS file,
        COALESCE(json_agg(json_build_object('emoji', mr.emoji, 'user_id', mr.user_id))
          FILTER (WHERE mr.id IS NOT NULL), '[]') AS reactions
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN files f ON f.message_id = m.id
       LEFT JOIN message_reactions mr ON mr.message_id = m.id
       WHERE (m.id = $1 OR m.reply_to_id = $1) AND m.deleted_at IS NULL
       GROUP BY m.id, u.id, f.id
       ORDER BY m.created_at ASC`,
      [parentId]
    );
    // First row is the parent, rest are replies in chronological order
    const parent = rows.find(r => String(r.id) === String(parentId)) || null;
    const replies = rows.filter(r => String(r.id) !== String(parentId));
    return res.json({ success: true, data: { parent, replies } });
  } catch (err) {
    console.error('GET thread error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch thread' });
  }
});

// POST /messages/:channelId/messages
router.post('/:channelId/messages', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { body, message_type = 'text', reply_to_id, automation_payload } = req.body;
  try {
    const { rows: inserted } = await pool.query(
      `INSERT INTO messages (channel_id, sender_id, body, message_type, reply_to_id, automation_payload)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.params.channelId, userId, body, message_type, reply_to_id, automation_payload ? JSON.stringify(automation_payload) : null]
    );
    const messageId = inserted[0].id;

    // Re-fetch with sender joined for a ready-to-render payload
    const { rows } = await pool.query(
      `SELECT m.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'avatar_url', u.avatar_url,
          'status', u.status
        ) AS sender,
        '[]'::json AS reactions
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1`,
      [messageId]
    );
    const message = rows[0];

    // Broadcast to everyone in the channel room
    io.to(`channel:${req.params.channelId}`).emit('message:receive', message);

    // If this is a threaded reply, also emit a thread-update so open thread
    // panels refresh and parent messages update their reply counter.
    if (reply_to_id) {
      io.to(`channel:${req.params.channelId}`).emit('thread:update', {
        parent_id: reply_to_id,
        reply: message,
      });
    }

    return res.status(201).json({ success: true, data: message });
  } catch (err) {
    console.error('POST message error:', err);
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

// DELETE /messages/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('UPDATE messages SET deleted_at = NOW(), body = NULL WHERE id = $1', [req.params.id]);
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
    // Broadcast pin state change so other clients update their pinned lists
    if (rows[0]) {
      io.to(`channel:${rows[0].channel_id}`).emit('message:pin-changed', { id: rows[0].id, pinned: !!pinned });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to pin message' });
  }
});

export default router;
