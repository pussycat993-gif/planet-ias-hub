import { Router, Request, Response } from 'express';
import pool from '../db/auth';
import { handleDWMTrigger, handleDWMAction, handleAutoChannel } from './index';

const router = Router();

// GET /automation/settings
router.get('/settings', async (req: Request, res: Response) => {
  const tenantId = process.env.TENANT_ID || 'default';
  try {
    const { rows } = await pool.query(
      'SELECT * FROM automation_settings WHERE tenant_id = $1',
      [tenantId]
    );
    return res.json({ success: true, data: rows[0] || getDefaults() });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' });
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
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id) DO UPDATE SET
         smart_logger=$2, meeting_briefing=$3, briefing_minutes_before=$4,
         dwm_trigger=$5, auto_channel=$6, smart_notif=$7, updated_at=NOW()
       RETURNING *`,
      [tenantId, smart_logger, meeting_briefing, briefing_minutes_before, dwm_trigger, auto_channel, smart_notif]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// GET /automation/events
router.get('/events', async (req: Request, res: Response) => {
  const { limit = '50', type } = req.query;
  try {
    const params: any[] = [];
    let query = 'SELECT * FROM automation_events';
    if (type) { query += ' WHERE event_type = $1'; params.push(type); }
    query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit as string)}`;
    const { rows } = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// POST /automation/dwm-trigger — called by PCI webhook
router.post('/dwm-trigger', async (req: Request, res: Response) => {
  try {
    await handleDWMTrigger(req.body);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'DWM trigger failed' });
  }
});

// POST /automation/dwm-action — user approves/rejects from IAS Hub
router.post('/dwm-action', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { workflow_step_id, action } = req.body;
  try {
    await handleDWMAction(workflow_step_id, action, userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'DWM action failed' });
  }
});

// POST /automation/auto-channel — called by PCI webhook
router.post('/auto-channel', async (req: Request, res: Response) => {
  try {
    await handleAutoChannel(req.body);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Auto-channel failed' });
  }
});

function getDefaults() {
  return { smart_logger: true, meeting_briefing: true, briefing_minutes_before: 15, dwm_trigger: true, auto_channel: false, smart_notif: true };
}

export default router;
