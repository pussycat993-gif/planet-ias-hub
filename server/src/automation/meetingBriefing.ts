import pool from '../db/auth';
import { getPCIContact } from '../pci/client';
import { io } from '../index';

interface BriefingData {
  meeting_id: number;
  channel_id: number;
  subject: string;
  meeting_date: string;
  participants: string[];
  pci_activities: Array<{ person: string; subject: string; status: string }>;
  jira_sprint: { name: string; done: number; in_progress: number; to_do: number } | null;
  last_interactions: Array<{ person: string; last_activity: string }>;
}

export async function checkAndSendBriefings(minutesBefore: number = 15): Promise<void> {
  const { rows: upcomingMeetings } = await pool.query(
    `SELECT sm.*, c.name AS channel_name
     FROM scheduled_meetings sm
     JOIN channels c ON c.id = sm.channel_id
     WHERE sm.status = 'scheduled'
     AND sm.meeting_date BETWEEN NOW() + INTERVAL '${minutesBefore - 1} minutes'
                              AND NOW() + INTERVAL '${minutesBefore + 1} minutes'`
  );

  for (const meeting of upcomingMeetings) {
    try {
      await sendBriefing(meeting, minutesBefore);
      // Mark briefing as sent
      await pool.query(
        "UPDATE scheduled_meetings SET status = 'briefing_sent', updated_at = NOW() WHERE id = $1",
        [meeting.id]
      );
    } catch (err) {
      console.error(`Briefing failed for meeting ${meeting.id}:`, err);
    }
  }
}

async function sendBriefing(meeting: any, minutesBefore: number): Promise<void> {
  const participants: string[] = meeting.participants || [];

  // Fetch PCI context for participants (simplified — in production fetch per pci_person_id)
  const pciActivities: BriefingData['pci_activities'] = [];
  const lastInteractions: BriefingData['last_interactions'] = [];

  // Build briefing payload
  const briefingPayload = {
    type: 'briefing_card',
    subject: meeting.subject,
    meeting_date: meeting.meeting_date,
    minutes_before: minutesBefore,
    attendees: participants,
    pci_activities: pciActivities,
    jira_sprint: null, // populated when Jira MCP connected
    last_interactions: lastInteractions,
    pci_activity_id: meeting.pci_activity_id,
  };

  // Post briefing card message to channel
  const { rows } = await pool.query(
    `INSERT INTO messages (channel_id, sender_id, message_type, body, automation_payload)
     VALUES ($1, NULL, 'briefing_card', $2, $3) RETURNING id`,
    [
      meeting.channel_id,
      `Meeting Prep: ${meeting.subject} in ${minutesBefore} minutes`,
      JSON.stringify(briefingPayload),
    ]
  );

  // Log automation event
  await pool.query(
    `INSERT INTO automation_events (event_type, channel_id, triggered_by, payload, status)
     VALUES ('meeting_briefing', $1, 'system', $2, 'success')`,
    [meeting.channel_id, JSON.stringify({ meeting_id: meeting.id, subject: meeting.subject })]
  );

  // Emit via Socket.io to channel room
  io.to(`channel:${meeting.channel_id}`).emit('automation:card', {
    channelId: meeting.channel_id,
    messageId: rows[0].id,
    card: briefingPayload,
  });

  // Send notifications to channel members
  const { rows: members } = await pool.query(
    'SELECT user_id FROM channel_members WHERE channel_id = $1',
    [meeting.channel_id]
  );

  for (const member of members) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel_id)
       VALUES ($1, 'meeting', $2, $3, $4)`,
      [
        member.user_id,
        `Meeting in ${minutesBefore} min: ${meeting.subject}`,
        `Briefing posted in #${meeting.channel_name}`,
        meeting.channel_id,
      ]
    );
    io.to(`user:${member.user_id}`).emit('notification:new', {
      type: 'meeting',
      title: `Meeting in ${minutesBefore} min`,
      body: meeting.subject,
    });
  }
}
