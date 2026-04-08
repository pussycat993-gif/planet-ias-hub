import { Router, Request, Response } from 'express';
import pool from '../db/auth';

const router = Router();

// GET /users — list all users in tenant
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, avatar_url, role, user_type, status, status_message, last_seen_at
       FROM users ORDER BY name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// GET /users/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, avatar_url, role, user_type, status, status_message FROM users WHERE id = $1',
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

export default router;
