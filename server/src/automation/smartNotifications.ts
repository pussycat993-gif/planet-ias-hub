import pool from '../db/auth';
import { io } from '../index';

const JIRA_TICKET_PATTERN = /\b(IAS-\d+)\b/gi;

interface NotificationRule {
  condition: (event: NotificationEvent, userId: number) => Promise<boolean>;
  priority: 'high' | 'normal' | 'suppress';
  message: (event: NotificationEvent) => string;
}

interface NotificationEvent {
  type: 'message' | 'call_missed' | 'dwm' | 'mention' | 'jira_mention';
  channelId?: number;
  messageId?: number;
  senderId?: number;
  body?: string;
  callId?: number;
  targetUserId?: number;
}

// Rules engine — evaluated in order, first match wins
const RULES: NotificationRule[] = [
  // Rule 1: Always suppress muted channels
  {
    condition: async (event, userId) => {
      if (!event.channelId) return false;
      const { rows } = await pool.query(
        "SELECT notification_pref FROM channel_members WHERE channel_id = $1 AND user_id = $2",
        [event.channelId, userId]
      );
      return rows[0]?.notification_pref === 'mute';
    },
    priority: 'suppress',
    message: () => '',
  },

  // Rule 2: Always deliver @mentions
  {
    condition: async (event, userId) => {
      if (event.type !== 'message' || !event.body) return false;
      const { rows } = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      const name = rows[0]?.name?.split(',')[1]?.trim() || rows[0]?.name;
      return event.body.toLowerCase().includes(`@${name?.toLowerCase()}`);
    },
    priority: 'high',
    message: (e) => `You were mentioned: ${e.body?.substring(0, 80)}`,
  },

  // Rule 3: Elevate if Jira ticket mentioned and user is assignee
  {
    condition: async (event, userId) => {
      if (!event.body) return false;
      const tickets = [...event.body.matchAll(JIRA_TICKET_PATTERN)].map(m => m[1]);
      if (tickets.length === 0) return false;
      // In production: check Jira API if user is assignee of any mentioned ticket
      // For now: elevate if user has pci_id (SSO user, likely team member)
      const { rows } = await pool.query('SELECT pci_id FROM users WHERE id = $1', [userId]);
      return !!rows[0]?.pci_id && tickets.length > 0;
    },
    priority: 'high',
    message: (e) => {
      const tickets = [...(e.body || '').matchAll(JIRA_TICKET_PATTERN)].map(m => m[1]);
      return `Jira ticket mentioned: ${tickets.join(', ')}`;
    },
  },

  // Rule 4: Missed call reminder after 1 hour
  {
    condition: async (event, userId) => {
      return event.type === 'call_missed' && event.targetUserId === userId;
    },
    priority: 'high',
    message: () => 'You have an unanswered call — follow up?',
  },

  // Rule 5: Normal delivery for everything else (if user is online)
  {
    condition: async (event, userId) => {
      const { rows } = await pool.query(
        "SELECT status FROM users WHERE id = $1",
        [userId]
      );
      return rows[0]?.status === 'online';
    },
    priority: 'normal',
    message: (e) => e.body?.substring(0, 100) || 'New message',
  },
];

export async function processNotification(
  event: NotificationEvent,
  targetUserIds: number[]
): Promise<void> {
  for (const userId of targetUserIds) {
    // Skip sender
    if (event.senderId === userId) continue;

    let finalPriority: 'high' | 'normal' | 'suppress' = 'suppress';
    let finalMessage = '';

    for (const rule of RULES) {
      const matches = await rule.condition(event, userId);
      if (matches) {
        finalPriority = rule.priority;
        finalMessage = rule.message(event);
        break;
      }
    }

    if (finalPriority === 'suppress') continue;

    // Store notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel_id, message_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, event.type, 'IAS Hub', finalMessage, event.channelId || null, event.messageId || null]
    );

    // Emit to user's socket room
    io.to(`user:${userId}`).emit('notification:new', {
      type: event.type,
      priority: finalPriority,
      title: 'IAS Hub',
      body: finalMessage,
      channelId: event.channelId,
      messageId: event.messageId,
    });
  }
}

// Cron job: check for unanswered calls every 30 minutes
export async function checkUnansweredCalls(): Promise<void> {
  const { rows: missedCalls } = await pool.query(
    `SELECT cp.user_id AS caller_id, c.channel_id,
            array_agg(DISTINCT cp2.user_id) AS missed_by
     FROM call_logs c
     JOIN call_participants cp ON cp.call_id = c.id AND cp.user_id = c.started_by
     JOIN call_participants cp2 ON cp2.call_id = c.id AND cp2.left_at IS NULL AND cp2.user_id != c.started_by
     WHERE c.ended_at > NOW() - INTERVAL '90 minutes'
     AND c.ended_at < NOW() - INTERVAL '60 minutes'
     GROUP BY cp.user_id, c.channel_id, c.id`
  );

  for (const call of missedCalls) {
    for (const userId of call.missed_by) {
      await processNotification(
        { type: 'call_missed', channelId: call.channel_id, targetUserId: userId },
        [userId]
      );
    }
  }
}
