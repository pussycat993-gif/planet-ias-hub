import { Router, Request, Response } from 'express';
import pool from '../db/auth';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /meetings/upcoming — scheduled meetings in the user's channels in the
// next N hours (default 48). Used by the UpcomingMeetingBanner and the
// quick-view UI.
router.get('/upcoming', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const hours = parseInt((req.query.hours as string) || '48');

  try {
    const { rows } = await pool.query(
      `SELECT
         sm.id, sm.channel_id, sm.pci_activity_id, sm.subject,
         sm.meeting_date, sm.duration_minutes, sm.participants, sm.status,
         json_build_object(
           'id', c.id,
           'name', c.name,
           'type', c.type,
           'logo_color', c.logo_color,
           'logo_abbr', c.logo_abbr
         ) AS channel
       FROM scheduled_meetings sm
       JOIN channels c ON c.id = sm.channel_id
       JOIN channel_members cm ON cm.channel_id = sm.channel_id AND cm.user_id = $1
       WHERE sm.meeting_date > NOW()
         AND sm.meeting_date < NOW() + ($2 || ' hours')::INTERVAL
         AND (sm.status IS NULL OR sm.status != 'canceled')
       ORDER BY sm.meeting_date ASC
       LIMIT 50`,
      [userId, hours]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /meetings/upcoming error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch upcoming meetings' });
  }
});

export default router;
