import { Router, Request, Response } from 'express';
import {
  getPCIContact,
  getPCIUsers,
  pushScheduledMeeting,
  cancelScheduledMeeting,
  logActivityToPCI,
  updatePCIPresence,
} from '../pci/client';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';
import { io } from '../index';

const router = Router();

// ── GET /pci/context/:personId — right panel data ─────────
router.get('/context/:personId', async (req: Request, res: Response) => {
  try {
    const { data } = await getPCIContact(parseInt(req.params.personId));
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: 'PCI API unavailable',
      details: err.response?.data,
    });
  }
});

// ── GET /pci/users — full roster for SSO matching ─────────
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { data } = await getPCIUsers();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Failed to fetch PCI users' });
  }
});

// ── POST /pci/activity-log ────────────────────────────────
router.post('/activity-log', async (req: Request, res: Response) => {
  try {
    const { data } = await logActivityToPCI(req.body);
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: 'Failed to log activity to PCI',
      details: err.response?.data,
    });
  }
});

// ── POST /pci/scheduled-meeting — from PCI webhook ────────
router.post('/scheduled-meeting', async (req: Request, res: Response) => {
  const { channel_id, pci_activity_id, subject, meeting_date, duration_minutes, participants } = req.body;

  if (!channel_id || !pci_activity_id || !subject || !meeting_date) {
    return res.status(422).json({ success: false, error: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Post meeting card message
    const { rows: msgRows } = await client.query(
      `INSERT INTO messages (channel_id, sender_id, message_type, body, pinned, automation_payload)
       VALUES ($1, NULL, 'meeting_card', $2, TRUE, $3) RETURNING *`,
      [
        channel_id,
        `Scheduled Meeting: ${subject}`,
        JSON.stringify({ subject, meeting_date, duration_minutes, participants, pci_activity_id }),
      ]
    );

    // Save in scheduled_meetings
    const { rows: meetRows } = await client.query(
      `INSERT INTO scheduled_meetings
         (channel_id, message_id, pci_activity_id, subject, meeting_date, duration_minutes, participants)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [channel_id, msgRows[0].id, pci_activity_id, subject, meeting_date, duration_minutes, JSON.stringify(participants)]
    );

    await client.query('COMMIT');

    // Emit via Socket.io
    io.to(`channel:${channel_id}`).emit('automation:card', {
      channelId: channel_id,
      messageId: msgRows[0].id,
      card: { type: 'meeting_card', subject, meeting_date, duration_minutes, participants, pci_activity_id },
    });

    // Log automation event
    await pool.query(
      `INSERT INTO automation_events (event_type, channel_id, triggered_by, payload, status)
       VALUES ('scheduled_meeting', $1, 'pci', $2, 'success')`,
      [channel_id, JSON.stringify(req.body)]
    );

    return res.status(201).json({
      success: true,
      data: { message_id: msgRows[0].id, meeting_id: meetRows[0].id },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('scheduled-meeting error:', err);
    return res.status(500).json({ success: false, error: 'Failed to post meeting card' });
  } finally {
    client.release();
  }
});

// ── DELETE /pci/scheduled-meeting/:id — cancel ────────────
router.delete('/scheduled-meeting/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `UPDATE scheduled_meetings SET status = 'canceled', updated_at = NOW()
       WHERE pci_activity_id = $1 RETURNING message_id, channel_id`,
      [req.params.id]
    );

    if (rows[0]?.message_id) {
      await pool.query(
        `UPDATE messages SET
           automation_payload = automation_payload || '{"status":"canceled"}'::jsonb
         WHERE id = $1`,
        [rows[0].message_id]
      );

      // Notify channel
      io.to(`channel:${rows[0].channel_id}`).emit('meeting:canceled', {
        messageId: rows[0].message_id,
        pciActivityId: req.params.id,
      });
    }

    return res.json({ success: true, data: { canceled: true } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to cancel meeting' });
  }
});

// ── POST /pci/presence/:userId — sync presence to PCI ─────
router.post('/presence/:userId', async (req: Request, res: Response) => {
  const { status } = req.body;
  try {
    await updatePCIPresence(parseInt(req.params.userId), status);
    return res.json({ success: true });
  } catch {
    return res.json({ success: true }); // non-critical, don't fail
  }
});

export default router;
