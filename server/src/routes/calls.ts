import { Router, Request, Response } from 'express';
import { transcribeBuffer, generateSummary, isWhisperAvailable } from '../whisper/client';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// GET /calls/history
router.get('/history', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const { rows } = await pool.query(
      `SELECT cl.*,
        json_agg(json_build_object('id', u.id, 'name', u.name, 'avatar_url', u.avatar_url)) AS participants
       FROM call_logs cl
       JOIN call_participants cp ON cp.call_id = cl.id
       JOIN users u ON u.id = cp.user_id
       WHERE cl.id IN (SELECT call_id FROM call_participants WHERE user_id = $1)
       GROUP BY cl.id
       ORDER BY cl.started_at DESC LIMIT 50`,
      [userId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// GET /calls/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM call_logs WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Call not found' });
    const { rows: participants } = await pool.query(
      `SELECT u.id, u.name, u.avatar_url, cp.pci_person_id
       FROM call_participants cp JOIN users u ON u.id = cp.user_id WHERE cp.call_id = $1`,
      [req.params.id]
    );
    return res.json({ success: true, data: { ...rows[0], participants } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch call' });
  }
});

// POST /calls/start
router.post('/start', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { channel_id, call_type } = req.body;
  if (!channel_id || !call_type) {
    return res.status(422).json({ success: false, error: 'channel_id and call_type required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO call_logs (channel_id, call_type, started_at, started_by)
       VALUES ($1, $2, NOW(), $3) RETURNING *`,
      [channel_id, call_type, userId]
    );
    await pool.query(
      'INSERT INTO call_participants (call_id, user_id) VALUES ($1, $2)',
      [rows[0].id, userId]
    );
    return res.status(201).json({ success: true, data: { call_id: rows[0].id, call_type: rows[0].call_type } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to start call' });
  }
});

// POST /calls/:id/join
router.post('/:id/join', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
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
  const userId = (req as AuthRequest).userId;
  try {
    const { rows } = await pool.query(
      `UPDATE call_logs
       SET ended_at = NOW(),
           duration_secs = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await pool.query(
      'UPDATE call_participants SET left_at = NOW() WHERE call_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to end call' });
  }
});

// POST /calls/:id/transcribe — Whisper AI transcription
router.post('/:id/transcribe', async (req: Request, res: Response) => {
  const callId = req.params.id;

  // Check Whisper availability
  const available = await isWhisperAvailable();
  if (!available) {
    return res.status(503).json({
      success: false,
      error: 'Whisper AI service unavailable',
      hint: 'Start Whisper service: docker compose up -d whisper',
    });
  }

  try {
    // Get participants for speaker labels
    const { rows: participants } = await pool.query(
      'SELECT u.name FROM call_participants cp JOIN users u ON u.id = cp.user_id WHERE cp.call_id = $1',
      [callId]
    );
    const participantNames = participants.map((p: any) => p.name);

    let result;

    if (req.file) {
      // Audio file uploaded directly
      result = await transcribeBuffer(
        req.file.buffer,
        req.file.originalname,
        participantNames
      );
    } else if (req.body.audio_url) {
      // Download from URL
      const audioResp = await axios.get(req.body.audio_url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(audioResp.data);
      result = await transcribeBuffer(buffer, 'call.webm', participantNames);
    } else {
      return res.status(400).json({ success: false, error: 'Provide audio file or audio_url' });
    }

    // Generate AI summary
    const summary = await generateSummary(result.transcript, participantNames);

    // Save to DB
    await pool.query(
      'UPDATE call_logs SET transcript = $1, ai_summary = $2 WHERE id = $3',
      [result.transcript, summary.full_summary, callId]
    );

    return res.json({
      success: true,
      data: {
        transcript: result.transcript,
        lines: result.lines,
        language: result.language,
        duration: result.duration,
        ai_summary: summary,
      },
    });
  } catch (err: any) {
    console.error('Transcription error:', err.message);
    return res.status(500).json({ success: false, error: 'Transcription failed', details: err.message });
  }
});

// POST /calls/:id/log-to-pci
router.post('/:id/log-to-pci', async (req: Request, res: Response) => {
  const { activity_type, subject, started_at, ended_at, participant_pci_ids, entity_pci_ids, note } = req.body;
  try {
    const duration = Math.round((new Date(ended_at).getTime() - new Date(started_at).getTime()) / 60000);
    const { logActivityToPCI } = await import('../pci/client');
    const { data: pciResult } = await logActivityToPCI({
      activity_type,
      Activity_Subject: subject,
      Activity_DateTime: started_at,
      Duration: duration,
      Status: 'Complete',
      People: participant_pci_ids || [],
      Entities: entity_pci_ids || [],
      Note: note,
    });
    await pool.query(
      'UPDATE call_logs SET logged_to_pci = TRUE, pci_activity_id = $1, pci_subject = $2 WHERE id = $3',
      [pciResult.activity_id, subject, req.params.id]
    );
    return res.json({ success: true, data: { pci_activity_id: pciResult.activity_id } });
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Failed to log to PCI' });
  }
});

export default router;
