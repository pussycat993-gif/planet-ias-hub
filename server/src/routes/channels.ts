import { Router, Request, Response } from 'express';
import pool from '../db/auth';

const router = Router();

// GET /channels — list all channels for current user
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
        cm.notification_pref,
        cm.last_read_at,
        (SELECT COUNT(*) FROM messages m
         WHERE m.channel_id = c.id
         AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
         AND m.deleted_at IS NULL
         AND m.sender_id != $1) AS unread_count,
        -- For DMs: get the other user's info
        CASE WHEN c.type = 'dm' THEN (
          SELECT row_to_json(u)
          FROM users u
          JOIN channel_members cm2 ON cm2.user_id = u.id
          WHERE cm2.channel_id = c.id AND u.id != $1
          LIMIT 1
        ) END AS other_user
       FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.user_id = $1 AND c.archived = FALSE
       ORDER BY c.type, c.name`,
      [userId]
    );

    const grouped = {
      public:  rows.filter(r => r.type === 'public'),
      private: rows.filter(r => r.type === 'private'),
      groups:  rows.filter(r => r.type === 'group'),
      dms:     rows.filter(r => r.type === 'dm'),
    };
    return res.json({ success: true, data: grouped });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch channels' });
  }
});

// POST /channels/dm — get or create DM channel
router.post('/dm', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { user_id: otherId } = req.body;

  if (!otherId) return res.status(422).json({ success: false, error: 'user_id is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if DM already exists between these two users
    const { rows: existing } = await client.query(
      `SELECT c.id FROM channels c
       JOIN channel_members cm1 ON cm1.channel_id = c.id AND cm1.user_id = $1
       JOIN channel_members cm2 ON cm2.channel_id = c.id AND cm2.user_id = $2
       WHERE c.type = 'dm' LIMIT 1`,
      [userId, otherId]
    );

    if (existing[0]) {
      await client.query('ROLLBACK');
      return res.json({ success: true, data: { id: existing[0].id } });
    }

    // Create new DM channel
    const dmName = `dm-${[userId, otherId].sort().join('-')}`;
    const { rows } = await client.query(
      `INSERT INTO channels (name, type) VALUES ($1, 'dm') RETURNING *`,
      [dmName]
    );
    const channel = rows[0];

    await client.query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3)',
      [channel.id, userId, otherId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ success: true, data: channel });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: 'Failed to create DM' });
  } finally {
    client.release();
  }
});

// POST /channels — create channel or group
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name, type, description, logo_color, logo_abbr, logo_url, member_ids = [] } = req.body;
  if (!name || !type) {
    return res.status(422).json({ success: false, error: 'Name and type are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO channels (name, type, description, logo_color, logo_abbr, logo_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, type, description, logo_color, logo_abbr, logo_url || null, userId]
    );
    const channel = rows[0];
    await client.query(
      'INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3)',
      [channel.id, userId, 'owner']
    );
    for (const memberId of member_ids) {
      if (memberId !== userId) {
        await client.query(
          'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [channel.id, memberId]
        );
      }
    }
    await client.query('COMMIT');
    return res.status(201).json({ success: true, data: channel });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: 'Failed to create channel' });
  } finally {
    client.release();
  }
});

// GET /channels/:id
router.get('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
        CASE WHEN c.type = 'dm' THEN (
          SELECT row_to_json(u)
          FROM users u
          JOIN channel_members cm2 ON cm2.user_id = u.id
          WHERE cm2.channel_id = c.id AND u.id != $2
          LIMIT 1
        ) END AS other_user
       FROM channels WHERE id = $1`,
      [req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Channel not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch channel' });
  }
});

// PATCH /channels/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE channels SET name = COALESCE($1, name), description = COALESCE($2, description),
       updated_at = NOW() WHERE id = $3 RETURNING *`,
      [name, description, req.params.id]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update channel' });
  }
});

// DELETE /channels/:id — archive
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('UPDATE channels SET archived = TRUE, updated_at = NOW() WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to archive channel' });
  }
});

// GET /channels/:id/members
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.status, u.status_message,
              cm.role, cm.notification_pref, cm.joined_at
       FROM channel_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.channel_id = $1 ORDER BY u.name`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch members' });
  }
});

// POST /channels/:id/members
router.post('/:id/members', async (req: Request, res: Response) => {
  const { user_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, user_id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to add member' });
  }
});

// POST /channels/:id/read
router.post('/:id/read', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    await pool.query(
      'UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

// PUT /channels/:id/pci-settings
router.put('/:id/pci-settings', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { enabled, trigger, activity_type, subject_template, auto_people, auto_entities, auto_files } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO pci_log_settings
         (channel_id, user_id, enabled, trigger, activity_type, subject_template, auto_people, auto_entities, auto_files)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (channel_id, user_id) DO UPDATE SET
         enabled = EXCLUDED.enabled, trigger = EXCLUDED.trigger,
         activity_type = EXCLUDED.activity_type, subject_template = EXCLUDED.subject_template,
         auto_people = EXCLUDED.auto_people, auto_entities = EXCLUDED.auto_entities,
         auto_files = EXCLUDED.auto_files, updated_at = NOW()
       RETURNING *`,
      [req.params.id, userId, enabled, trigger, activity_type, subject_template, auto_people, auto_entities, auto_files]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to save PCI settings' });
  }
});

export default router;
