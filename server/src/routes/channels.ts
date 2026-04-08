import { Router, Request, Response } from 'express';
import pool from '../db/auth';

const router = Router();

// GET /channels — list all channels for current user
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const { rows } = await pool.query(
      `SELECT c.*, cm.notification_pref, cm.last_read_at,
        (SELECT COUNT(*) FROM messages m
         WHERE m.channel_id = c.id
         AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
         AND m.deleted_at IS NULL) AS unread_count
       FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.user_id = $1 AND c.archived = FALSE
       ORDER BY c.type, c.name`,
      [userId]
    );
    const grouped = {
      public: rows.filter(r => r.type === 'public'),
      private: rows.filter(r => r.type === 'private'),
      groups: rows.filter(r => r.type === 'group'),
      dms: rows.filter(r => r.type === 'dm'),
    };
    return res.json({ success: true, data: grouped });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch channels' });
  }
});

// POST /channels — create channel or group
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name, type, description, logo_color, logo_abbr, member_ids = [] } = req.body;
  if (!name || !type) {
    return res.status(422).json({ success: false, error: 'Name and type are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO channels (name, type, description, logo_color, logo_abbr, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, description, logo_color, logo_abbr, userId]
    );
    const channel = rows[0];
    // Add creator as owner
    await client.query(
      'INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3)',
      [channel.id, userId, 'owner']
    );
    // Add other members
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
  try {
    const { rows } = await pool.query('SELECT * FROM channels WHERE id = $1', [req.params.id]);
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
    return res.json({ success: true, data: { archived: true } });
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
       WHERE cm.channel_id = $1
       ORDER BY u.name`,
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
    return res.json({ success: true, data: { added: true } });
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

// GET /channels/:id/pci-settings
router.get('/:id/pci-settings', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pci_log_settings WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    return res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch PCI settings' });
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
         enabled = EXCLUDED.enabled,
         trigger = EXCLUDED.trigger,
         activity_type = EXCLUDED.activity_type,
         subject_template = EXCLUDED.subject_template,
         auto_people = EXCLUDED.auto_people,
         auto_entities = EXCLUDED.auto_entities,
         auto_files = EXCLUDED.auto_files,
         updated_at = NOW()
       RETURNING *`,
      [req.params.id, userId, enabled, trigger, activity_type, subject_template, auto_people, auto_entities, auto_files]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to save PCI settings' });
  }
});

export default router;
