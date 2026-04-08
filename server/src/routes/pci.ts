import { Router, Request, Response } from 'express';
import { getPCIContact, getPCIUsers, pushScheduledMeeting, cancelScheduledMeeting, logActivityToPCI } from '../pci/client';
import pool from '../db/auth';

const router = Router();

// GET /pci/context/:personId — right panel data
router.get('/context/:personId', async (req: Request, res: Response) => {
  try {
    const { data } = await getPCIContact(parseInt(req.params.personId));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'PCI API unreachable' });
  }
});

// GET /pci/users — PCI user roster for SSO
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { data } = await getPCIUsers();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Failed to fetch PCI users' });
  }
});

// POST /pci/scheduled-meeting — called by PCI Laravel webhook
router.post('/scheduled-meeting', async (req: Request, res: Response) => {
  const { channel_id, pci_activity_id, subject, meeting_date, duration_minutes, participants } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Post system message card in channel
    const { rows: msgRows } = await client.query(
      `INSERT INTO messages (channel_id, sender_id, message_type, body, pinned, automation_payload)
       VALUES ($1, NULL, 'meeting_card', $2, TRUE, $3) RETURNING *`,
      [channel_id, `Scheduled Meeting: ${subject}`, JSON.stringify({ subject, meeting_date, duration_minutes, participants, pci_activity_id })]
    );
    // Store in scheduled_meetings
    const { rows: meetRows } = await client.query(
      `INSERT INTO scheduled_meetings (channel_id, message_id, pci_activity_id, subject, meeting_date, duration_minutes, participants)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [channel_id, msgRows[0].id, pci_activity_id, subject, meeting_date, duration_minutes, JSON.stringify(participants)]
    );
    await client.query('COMMIT');
    return res.status(201).json({ success: true, data: { message_id: msgRows[0].id, meeting_id: meetRows[0].id } });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: 'Failed to post meeting card' });
  } finally {
    client.release();
  }
});

// DELETE /pci/scheduled-meeting/:id — cancel meeting card
router.delete('/scheduled-meeting/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'UPDATE scheduled_meetings SET status = $1, updated_at = NOW() WHERE pci_activity_id = $2 RETURNING message_id',
      ['canceled', req.params.id]
    );
    if (rows[0]?.message_id) {
      await pool.query(
        `UPDATE messages SET automation_payload = automation_payload || '{"status":"canceled"}' WHERE id = $1`,
        [rows[0].message_id]
      );
    }
    return res.json({ success: true, data: { canceled: true } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to cancel meeting' });
  }
});

// POST /pci/activity-log
router.post('/activity-log', async (req: Request, res: Response) => {
  try {
    const { data } = await logActivityToPCI(req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Failed to log to PCI' });
  }
});

export default router;
