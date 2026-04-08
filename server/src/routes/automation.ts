import { Router, Request, Response } from 'express';
import pool from '../db/auth';

const router = Router();

// GET /automation/settings
router.get('/settings', async (req: Request, res: Response) => {
  const tenantId = process.env.TENANT_ID || 'default';
  try {
    const { rows } = await pool.query(
      'SELECT * FROM automation_settings WHERE tenant_id = $1',
      [tenantId]
    );
    if (!rows[0]) {
      // Return defaults if not yet configured
      return res.json({
        success: true,
        data: {
          smart_logger: true,
          meeting_briefing: true,
          briefing_minutes_before: 15,
          dwm_trigger: true,
          auto_channel: false,
          smart_notif: true,
        }
      });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch automation settings' });
  }
});

// PUT /automation/settings
router.put('/settings', async (req: Request, res: Response) => {
  const tenantId = process.env.TENANT_ID || 'default';
  const { smart_logger, meeting_briefing, briefing_minutes_before, dwm_trigger, auto_channel, smart_notif } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO automation_settings
         (tenant_id, smart_logger, meeting_briefing, briefing_minutes_before, dwm_trigger, auto_channel, smart_notif)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id) DO UPDATE SET
         smart_logger = EXCLUDED.smart_logger,
         meeting_briefing = EXCLUDED.meeting_briefing,
         briefing_minutes_before = EXCLUDED.briefing_minutes_before,
         dwm_trigger = EXCLUDED.dwm_trigger,
         auto_channel = EXCLUDED.auto_channel,
         smart_notif = EXCLUDED.smart_notif,
         updated_at = NOW()
       RETURNING *`,
      [tenantId, smart_logger, meeting_briefing, briefing_minutes_before, dwm_trigger, auto_channel, smart_notif]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to save automation settings' });
  }
});

// GET /automation/events
router.get('/events', async (req: Request, res: Response) => {
  const { limit = '50', type } = req.query;
  try {
    let query = 'SELECT * FROM automation_events';
    const params: any[] = [];
    if (type) {
      query += ' WHERE event_type = $1';
      params.push(type);
    }
    query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit as string)}`;
    const { rows } = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch automation events' });
  }
});

export default router;
