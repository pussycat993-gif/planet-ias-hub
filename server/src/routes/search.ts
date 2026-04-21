import { Router, Response } from 'express';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ── GET /search ────────────────────────────────────────────────
// Unified full-text search across messages, channels, and people —
// scoped to what the current user is allowed to see.
//
// Query params (all optional except `q`):
//   q           required — the text to search for (ILIKE %q%)
//   from        user_id of message sender to filter by
//   channel     channel_id to restrict messages to
//   has         'file' — only messages with file attachments
//               'link' — only messages that contain a URL in the body
//   before      ISO datetime; messages older than this
//   after       ISO datetime; messages newer than this
//   type        'messages' | 'channels' | 'people' | 'all' (default 'all')
//   limit       max results per section (default 30, capped at 100)
//
// Returns: { messages, channels, users } each bounded by `limit`.
//
// Authorization: messages and channels are intersected with the user's
// channel_members rows so a user never sees results from conversations
// they don't belong to. People search returns the full tenant directory
// (same visibility as the sidebar directory).
router.get('/', async (req, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const rawQ = (req.query.q as string | undefined)?.trim() || '';
  const fromId = req.query.from ? parseInt(req.query.from as string, 10) : null;
  const channelId = req.query.channel ? parseInt(req.query.channel as string, 10) : null;
  const has = req.query.has as string | undefined;
  const before = req.query.before as string | undefined;
  const after = req.query.after as string | undefined;
  const type = (req.query.type as string | undefined) || 'all';
  const limit = Math.min(parseInt((req.query.limit as string) || '30', 10) || 30, 100);

  // An empty q plus no filters would match the world — refuse it. Allow
  // empty q when the user is only filtering (e.g. "all files from @alice").
  if (!rawQ && !fromId && !channelId && !has) {
    return res.json({ success: true, data: { messages: [], channels: [], users: [] } });
  }

  // Escape ILIKE wildcards so a user typing "10%" doesn't match everything
  const qLike = `%${rawQ.replace(/[\\%_]/g, s => '\\' + s)}%`;

  try {
    const out: { messages: any[]; channels: any[]; users: any[] } = {
      messages: [], channels: [], users: [],
    };

    // ── Messages ────────────────────────────────────────────────
    if (type === 'all' || type === 'messages') {
      const conds: string[] = [
        'm.deleted_at IS NULL',
        'cm.user_id = $1',                 // user must be a member of the channel
      ];
      const params: any[] = [userId];

      if (rawQ) {
        conds.push(`m.body ILIKE $${params.length + 1}`);
        params.push(qLike);
      }
      if (fromId) {
        conds.push(`m.sender_id = $${params.length + 1}`);
        params.push(fromId);
      }
      if (channelId) {
        conds.push(`m.channel_id = $${params.length + 1}`);
        params.push(channelId);
      }
      if (has === 'file') {
        conds.push(`m.message_type = 'file'`);
      } else if (has === 'link') {
        conds.push(`m.body ~* 'https?://[^\\s]+'`);
      }
      if (before) {
        conds.push(`m.created_at < $${params.length + 1}`);
        params.push(before);
      }
      if (after) {
        conds.push(`m.created_at > $${params.length + 1}`);
        params.push(after);
      }

      params.push(limit);

      const sql = `
        SELECT
          m.id, m.body, m.message_type, m.created_at,
          u.id           AS sender_id,
          u.name         AS sender_name,
          u.avatar_url   AS sender_avatar,
          c.id           AS channel_id,
          c.name         AS channel_name,
          c.type         AS channel_type,
          c.logo_color   AS channel_logo_color,
          c.logo_abbr    AS channel_logo_abbr,
          f.id           AS file_id,
          f.file_name    AS file_name,
          f.mime_type    AS file_mime
        FROM messages m
        JOIN channels c        ON c.id = m.channel_id
        JOIN channel_members cm ON cm.channel_id = m.channel_id
        LEFT JOIN users u      ON u.id = m.sender_id
        LEFT JOIN files f      ON f.message_id = m.id
        WHERE ${conds.join(' AND ')}
        ORDER BY m.created_at DESC
        LIMIT $${params.length}
      `;
      const { rows } = await pool.query(sql, params);
      out.messages = rows.map(r => ({
        id: r.id,
        body: r.body,
        message_type: r.message_type,
        created_at: r.created_at,
        sender: r.sender_id ? { id: r.sender_id, name: r.sender_name, avatar_url: r.sender_avatar } : null,
        channel: {
          id: r.channel_id, name: r.channel_name, type: r.channel_type,
          logo_color: r.channel_logo_color, logo_abbr: r.channel_logo_abbr,
        },
        file: r.file_id ? { id: r.file_id, name: r.file_name, mime_type: r.file_mime } : null,
      }));
    }

    // ── Channels ────────────────────────────────────────────────
    if ((type === 'all' || type === 'channels') && rawQ) {
      const { rows } = await pool.query(
        `SELECT c.id, c.name, c.type, c.description, c.logo_color, c.logo_abbr, c.logo_url
         FROM channels c
         JOIN channel_members cm ON cm.channel_id = c.id
         WHERE cm.user_id = $1
           AND c.archived = FALSE
           AND c.name ILIKE $2
         ORDER BY c.name ASC
         LIMIT $3`,
        [userId, qLike, limit]
      );
      out.channels = rows;
    }

    // ── People ──────────────────────────────────────────────────
    if ((type === 'all' || type === 'people') && rawQ) {
      const { rows } = await pool.query(
        `SELECT id, name, email, avatar_url, role, status, status_message, status_emoji
         FROM users
         WHERE (name ILIKE $1 OR email ILIKE $1) AND id <> $2
         ORDER BY name ASC
         LIMIT $3`,
        [qLike, userId, limit]
      );
      out.users = rows;
    }

    return res.json({ success: true, data: out });
  } catch (err) {
    console.error('GET /search error:', err);
    return res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
