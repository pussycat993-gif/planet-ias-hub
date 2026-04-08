import { Router, Request, Response } from 'express';
import axios from 'axios';
import pool from '../db/auth';
import { logActivityToPCI } from '../pci/client';

const router = Router();

// POST /calls/start
router.post('/start', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { channel_id, call_type } = req.body;
  if (!channel_id || !call_type) {
    return res.status(422).json({ success: false, error: 'channel_id and call_type are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO call_logs (channel_id, call_type, started_at, started_by)
       VALUES ($1, $2, NOW(), $3) RETURNING *`,
      [channel_id, call_type, userId]
    );
    const call = rows[0];
    // Add initiator as participant
    await pool.query(
      'INSERT INTO call_participants (call_id, user_id) VALUES ($1, $2)',
      [call.id, userId]
    );
    return res.status(201).json({
      success: true,
      data: {
        call_id: call.id,
        call_type: call.call_type,
        started_at: call.started_at,
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to start call' });
  }
});

// POST /calls/:id/join
router.post('/:id/join', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    await pool.query(
      'INSERT INTO call_participants (call_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, userId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to join call' });
  }
});

// POST /calls/:id/end
router.post('/:id/end', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const { rows } = await pool.query(
      `UPDATE call_logs
       SET ended_at = NOW(),
           duration_secs = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    // Mark participant as left
    await pool.query(
      'UPDATE call_participants SET left_at = NOW() WHERE call_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to end call' });
  }
});

// GET /calls/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows: callRows } = await pool.query('SELECT * FROM call_logs WHERE id = $1', [req.params.id]);
    if (!callRows[0]) return res.status(404).json({ success: false, error: 'Call not found' });
    const { rows: participants } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, cp.joined_at, cp.left_at, cp.pci_person_id
       FROM call_participants cp JOIN users u ON u.id = cp.user_id WHERE cp.call_id = $1`,
      [req.params.id]
    );
    return res.json({ success: true, data: { ...callRows[0], participants } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch call' });
  }
});

// GET /calls/history
router.get('/history', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const { rows } = await pool.query(
      `SELECT cl.*, 
        json_agg(json_build_object('id', u.id, 'name', u.name)) AS participants
       FROM call_logs cl
       JOIN call_participants cp ON cp.call_id = cl.id
       JOIN users u ON u.id = cp.user_id
       WHERE cl.id IN (
         SELECT call_id FROM call_participants WHERE user_id = $1
       )
       GROUP BY cl.id
       ORDER BY cl.started_at DESC LIMIT 50`,
      [userId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch call history' });
  }
});

// POST /calls/:id/transcribe
router.post('/:id/transcribe', async (req: Request, res: Response) => {
  try {
    // Call local Whisper AI service
    const whisperUrl = process.env.WHISPER_API_URL || 'http://localhost:9000';
    const { data: whisperResult } = await axios.post(`${whisperUrl}/transcribe`, req.body);
    // Save transcript to call log
    await pool.query(
      'UPDATE call_logs SET transcript = $1 WHERE id = $2',
      [whisperResult.transcript, req.params.id]
    );
    return res.json({ success: true, data: { transcript: whisperResult.transcript, ai_summary: whisperResult.summary } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Transcription failed' });
  }
});

// POST /calls/:id/log-to-pci
router.post('/:id/log-to-pci', async (req: Request, res: Response) => {
  const { activity_type, subject, started_at, ended_at, participant_pci_ids, entity_pci_ids, file_names, note } = req.body;
  try {
    const duration = Math.round((new Date(ended_at).getTime() - new Date(started_at).getTime()) / 60000);
    const { data: pciResult } = await logActivityToPCI({
      activity_type,
      Activity_Subject: subject,
      Activity_DateTime: started_at,
      Duration: duration,
      Status: 'Complete',
      People: participant_pci_ids || [],
      Entities: entity_pci_ids || [],
      Documents: file_names,
    });
    // Mark as logged in DB
    await pool.query(
      'UPDATE call_logs SET logged_to_pci = TRUE, pci_activity_id = $1, pci_subject = $2, ai_summary = $3 WHERE id = $4',
      [pciResult.activity_id, subject, note, req.params.id]
    );
    return res.json({ success: true, data: { pci_activity_id: pciResult.activity_id } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to log to PCI' });
  }
});

export default router;
