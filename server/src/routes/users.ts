import { Router, Request, Response } from 'express';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';
import { PREF_SCHEMAS, isKnownPrefKey, allDefaults } from '../preferences/schemas';

const router = Router();

// GET /users — list all users in tenant
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, avatar_url, role, user_type,
              status, status_message, status_emoji,
              auto_status, auto_status_until,
              timezone, last_seen_at
       FROM users ORDER BY name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// ──── /me/preferences ────────────────────────────────────
// IMPORTANT: /me/* routes must be registered BEFORE /:id so Express
// doesn't match "me" as the id parameter.

// GET /users/me/preferences — full map of prefs for current user,
// merged with defaults for any key the user hasn't explicitly set.
router.get('/me/preferences', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const { rows } = await pool.query(
      'SELECT key, value FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    const stored: Record<string, any> = {};
    for (const r of rows) stored[r.key] = r.value;
    // Merge: start with defaults, overlay with whatever the user has stored.
    const merged = { ...allDefaults(), ...stored };
    return res.json({ success: true, data: merged });
  } catch (err) {
    console.error('GET /users/me/preferences error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

// PUT /users/me/preferences — upsert a single preference key.
// Body: { key: string, value: any }
router.put('/me/preferences', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { key, value } = req.body || {};

  if (typeof key !== 'string' || !key.trim()) {
    return res.status(400).json({ success: false, error: 'key is required' });
  }
  if (!isKnownPrefKey(key)) {
    return res.status(422).json({ success: false, error: `Unknown preference key: ${key}` });
  }

  const validationError = PREF_SCHEMAS[key].validate(value);
  if (validationError) {
    return res.status(422).json({ success: false, error: validationError, key });
  }

  try {
    await pool.query(
      `INSERT INTO user_preferences (user_id, key, value)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [userId, key, JSON.stringify(value)]
    );
    return res.json({ success: true, data: { key, value } });
  } catch (err) {
    console.error('PUT /users/me/preferences error:', err);
    return res.status(500).json({ success: false, error: 'Failed to save preference' });
  }
});

// GET /users/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, avatar_url, role, user_type,
              status, status_message, status_emoji,
              auto_status, auto_status_until,
              timezone, last_seen_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// PATCH /users/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['online', 'away', 'offline'];
  if (!validStatuses.includes(status)) {
    return res.status(422).json({ success: false, error: 'Invalid status' });
  }
  try {
    await pool.query(
      'UPDATE users SET status = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2',
      [status, req.params.id]
    );
    return res.json({ success: true, data: { status } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// PATCH /users/:id/status-message
router.patch('/:id/status-message', async (req: Request, res: Response) => {
  const { status_message } = req.body;
  try {
    await pool.query(
      'UPDATE users SET status_message = $1, updated_at = NOW() WHERE id = $2',
      [status_message || null, req.params.id]
    );
    return res.json({ success: true, data: { status_message } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update status message' });
  }
});

// PATCH /users/:id/status-emoji — custom emoji next to the user's name
router.patch('/:id/status-emoji', async (req: Request, res: Response) => {
  const { status_emoji } = req.body;
  // Keep it short: a single emoji grapheme, up to 10 bytes (covers ZWJ sequences).
  const clean = typeof status_emoji === 'string' && status_emoji.trim() ? status_emoji.trim().slice(0, 10) : null;
  try {
    await pool.query(
      'UPDATE users SET status_emoji = $1, updated_at = NOW() WHERE id = $2',
      [clean, req.params.id]
    );
    return res.json({ success: true, data: { status_emoji: clean } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update status emoji' });
  }
});

// PATCH /users/:id/auto-status — set or clear an automatic status
// Body: { auto_status: 'in_call' | 'in_meeting' | 'focus' | 'away_auto' | null,
//         until?: ISO datetime string }
router.patch('/:id/auto-status', async (req: Request, res: Response) => {
  const { auto_status, until } = req.body;
  const validAutos = ['in_call', 'in_meeting', 'focus', 'away_auto', null];
  if (auto_status !== null && auto_status !== undefined && !validAutos.includes(auto_status)) {
    return res.status(422).json({ success: false, error: 'Invalid auto_status' });
  }
  const untilIso = until ? new Date(until).toISOString() : null;
  try {
    await pool.query(
      'UPDATE users SET auto_status = $1, auto_status_until = $2, updated_at = NOW() WHERE id = $3',
      [auto_status || null, untilIso, req.params.id]
    );
    return res.json({ success: true, data: { auto_status: auto_status || null, auto_status_until: untilIso } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update auto-status' });
  }
});

// PATCH /users/:id/timezone
router.patch('/:id/timezone', async (req: Request, res: Response) => {
  const { timezone } = req.body;
  const clean = typeof timezone === 'string' && timezone.trim() ? timezone.trim().slice(0, 60) : null;
  try {
    await pool.query(
      'UPDATE users SET timezone = $1, updated_at = NOW() WHERE id = $2',
      [clean, req.params.id]
    );
    return res.json({ success: true, data: { timezone: clean } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update timezone' });
  }
});

export default router;
