/**
 * Ask IAS — Context assembly service.
 *
 * Gathers everything the AI needs to answer "what should I focus on" type
 * questions: user's PCI activities, today's meetings, unread channels,
 * assigned DWM workflow tasks, pinned messages, expiring documents,
 * and recent messages from their most active channels.
 *
 * Each data source is wrapped in its own try/catch so one failing source
 * (e.g. PCI API unreachable) never takes down the whole context. The assembled
 * result is cached per-user for 30 seconds to keep follow-up questions snappy.
 */

import pool from '../db/auth';
import { getPCIContact } from '../pci/client';

// ────────────────────────────────────────────────────────────────────
//  Types — what the prompt-builder will see.
// ────────────────────────────────────────────────────────────────────

export interface PCIActivity {
  id: number;
  type: string;              // "Meeting" | "Call" | "Email" | "Task" | "Note"
  subject: string;
  date: string;              // ISO
  status: 'Active' | 'Complete' | 'Canceled';
  is_overdue?: boolean;
}

export interface ContextMeeting {
  id: number;
  channel_id: number;
  channel_name: string;
  subject: string;
  meeting_date: string;      // ISO
  duration_minutes: number;
  participants: any;
  is_in_progress: boolean;
  is_today: boolean;
}

export interface ChannelUnread {
  channel_id: number;
  channel_name: string;
  channel_type: string;
  unread_count: number;
}

export interface WorkflowTask {
  id: number;
  subject: string;
  workflow_name: string;
  due_date: string | null;
  is_overdue: boolean;
}

export interface PinnedMessage {
  id: number;
  channel_id: number;
  channel_name: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface ExpiringItem {
  kind: 'passport' | 'visa' | 'license' | 'subscription' | 'domain' | 'other';
  label: string;
  expires_on: string;
  days_until: number;
  severity: 'critical' | 'warn' | 'notice' | 'ok';
  related_person?: string;
}

export interface RecentMessageBatch {
  channel_id: number;
  channel_name: string;
  channel_type: string;
  messages: Array<{
    sender_name: string;
    body: string;
    created_at: string;
    is_mine: boolean;
  }>;
}

export interface AssembledContext {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    pci_id: number | null;
  };
  now: string; // server-side "now", ISO
  activities: PCIActivity[];
  meetings_today: ContextMeeting[];
  meetings_upcoming: ContextMeeting[];
  unread_summary: {
    total: number;
    by_channel: ChannelUnread[];
  };
  workflow_tasks: WorkflowTask[];
  pinned_messages: PinnedMessage[];
  expiring_items: ExpiringItem[];
  recent_messages: RecentMessageBatch[];
  _meta: {
    assembled_in_ms: number;
    sources_ok: string[];
    sources_failed: string[];
  };
}

// ────────────────────────────────────────────────────────────────────
//  Cache — 30s TTL keyed by userId. In-memory, per-process.
// ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;
const cache = new Map<number, { ctx: AssembledContext; expiresAt: number }>();

export function invalidateUserContext(userId: number) {
  cache.delete(userId);
}

// ────────────────────────────────────────────────────────────────────
//  Individual source fetchers — each returns a safe default on failure.
// ────────────────────────────────────────────────────────────────────

async function fetchUser(userId: number) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, pci_id FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows[0]) throw new Error(`User ${userId} not found`);
  return rows[0];
}

async function fetchPCIActivities(user: any): Promise<PCIActivity[]> {
  if (!user.pci_id) return [];
  try {
    const { data } = await getPCIContact(user.pci_id);
    const recent = data?.recent_activities || [];
    const open   = data?.open_tasks || [];
    const now = Date.now();
    const enrich = (act: any): PCIActivity => ({
      id: act.id,
      type: act.type,
      subject: act.subject,
      date: act.date,
      status: act.status,
      is_overdue: act.status === 'Active' && act.date && new Date(act.date).getTime() < now,
    });
    return [...open.map(enrich), ...recent.map(enrich)];
  } catch {
    return [];
  }
}

async function fetchMeetings(userId: number): Promise<{ today: ContextMeeting[]; upcoming: ContextMeeting[] }> {
  try {
    const { rows } = await pool.query(
      `SELECT
         sm.id, sm.channel_id, sm.subject, sm.meeting_date,
         sm.duration_minutes, sm.participants,
         c.name AS channel_name
       FROM scheduled_meetings sm
       JOIN channels c ON c.id = sm.channel_id
       JOIN channel_members cm ON cm.channel_id = sm.channel_id AND cm.user_id = $1
       WHERE sm.meeting_date > NOW() - INTERVAL '6 hours'
         AND sm.meeting_date < NOW() + INTERVAL '7 days'
         AND (sm.status IS NULL OR sm.status != 'canceled')
       ORDER BY sm.meeting_date ASC
       LIMIT 40`,
      [userId]
    );

    const now = Date.now();
    const endOfToday = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();

    const mapped: ContextMeeting[] = rows.map(r => {
      const startMs = new Date(r.meeting_date).getTime();
      const endMs = startMs + (r.duration_minutes || 30) * 60_000;
      return {
        id: r.id,
        channel_id: r.channel_id,
        channel_name: r.channel_name,
        subject: r.subject,
        meeting_date: r.meeting_date,
        duration_minutes: r.duration_minutes,
        participants: r.participants,
        is_in_progress: now >= startMs && now < endMs,
        is_today: startMs <= endOfToday && startMs >= now - 6 * 3600_000,
      };
    });

    return {
      today: mapped.filter(m => m.is_today),
      upcoming: mapped.filter(m => !m.is_today),
    };
  } catch {
    return { today: [], upcoming: [] };
  }
}

async function fetchUnread(userId: number): Promise<{ total: number; by_channel: ChannelUnread[] }> {
  try {
    const { rows } = await pool.query(
      `SELECT
         c.id   AS channel_id,
         c.name AS channel_name,
         c.type AS channel_type,
         COUNT(m.id)::int AS unread_count
       FROM channel_members cm
       JOIN channels c ON c.id = cm.channel_id
       LEFT JOIN messages m ON m.channel_id = c.id
         AND m.deleted_at IS NULL
         AND m.sender_id != $1
         AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
       WHERE cm.user_id = $1
       GROUP BY c.id, c.name, c.type
       HAVING COUNT(m.id) > 0
       ORDER BY unread_count DESC
       LIMIT 20`,
      [userId]
    );
    return {
      total: rows.reduce((s, r) => s + r.unread_count, 0),
      by_channel: rows,
    };
  } catch {
    return { total: 0, by_channel: [] };
  }
}

async function fetchWorkflowTasks(_userId: number): Promise<WorkflowTask[]> {
  // TODO: When DWM workflow runtime is live (IAS-535..542), query assigned
  // step-activities for this user. For now, return empty — Ask IAS still works
  // on the remaining sources.
  return [];
}

async function fetchPinnedMessages(userId: number): Promise<PinnedMessage[]> {
  try {
    const { rows } = await pool.query(
      `SELECT
         m.id, m.channel_id, m.body, m.created_at,
         c.name AS channel_name,
         u.name AS sender_name
       FROM messages m
       JOIN channels c ON c.id = m.channel_id
       JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = $1
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.pinned = TRUE AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 20`,
      [userId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function fetchExpiringItems(_user: any): Promise<ExpiringItem[]> {
  // TODO: Pull from PCI contact documents (passports, visas) and DWM tracked
  // licenses/subscriptions. PCI API endpoint for this doesn't exist yet.
  // Placeholder structure kept here so the prompt builder and tests can rely
  // on the shape without waiting for the backend integration.
  return [];
}

async function fetchRecentMessages(userId: number): Promise<RecentMessageBatch[]> {
  try {
    // Pick top 3 channels by unread count; fall back to most-recently-active
    // if there are no unreads (so the AI still has some conversational ground).
    const { rows: topChannels } = await pool.query(
      `SELECT c.id, c.name, c.type,
         COALESCE(SUM(CASE
           WHEN m.id IS NOT NULL
                AND m.sender_id != $1
                AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
           THEN 1 ELSE 0 END), 0)::int AS unread,
         MAX(m.created_at) AS last_msg_at
       FROM channel_members cm
       JOIN channels c ON c.id = cm.channel_id
       LEFT JOIN messages m ON m.channel_id = c.id AND m.deleted_at IS NULL
       WHERE cm.user_id = $1
       GROUP BY c.id, c.name, c.type
       ORDER BY unread DESC, last_msg_at DESC NULLS LAST
       LIMIT 3`,
      [userId]
    );

    if (topChannels.length === 0) return [];

    const batches = await Promise.all(topChannels.map(async (ch: any) => {
      const { rows: msgs } = await pool.query(
        `SELECT m.body, m.created_at, m.sender_id,
                u.name AS sender_name
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.channel_id = $1
           AND m.deleted_at IS NULL
           AND m.body IS NOT NULL
           AND m.reply_to_id IS NULL
         ORDER BY m.created_at DESC
         LIMIT 20`,
        [ch.id]
      );
      return {
        channel_id: ch.id,
        channel_name: ch.name,
        channel_type: ch.type,
        messages: msgs.reverse().map(m => ({
          sender_name: m.sender_name || 'System',
          body: m.body,
          created_at: m.created_at,
          is_mine: m.sender_id === userId,
        })),
      };
    }));

    return batches;
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────
//  Main entrypoint.
// ────────────────────────────────────────────────────────────────────

export async function assembleContext(userId: number): Promise<AssembledContext> {
  // Cache check
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ctx;
  }

  const startedAt = Date.now();
  const user = await fetchUser(userId);

  // Run every source in parallel. Wrap each in a marker so we can track
  // which ones failed (for _meta diagnostics) without bringing down the batch.
  const sources = [
    { name: 'activities',      run: () => fetchPCIActivities(user)      },
    { name: 'meetings',        run: () => fetchMeetings(userId)         },
    { name: 'unread',          run: () => fetchUnread(userId)           },
    { name: 'workflow_tasks',  run: () => fetchWorkflowTasks(userId)    },
    { name: 'pinned_messages', run: () => fetchPinnedMessages(userId)   },
    { name: 'expiring_items',  run: () => fetchExpiringItems(user)      },
    { name: 'recent_messages', run: () => fetchRecentMessages(userId)   },
  ];

  const sources_ok: string[] = [];
  const sources_failed: string[] = [];

  const results = await Promise.all(sources.map(async s => {
    try {
      const value = await s.run();
      sources_ok.push(s.name);
      return { name: s.name, value };
    } catch (err) {
      console.error(`Ask IAS context: ${s.name} failed`, err);
      sources_failed.push(s.name);
      return { name: s.name, value: null };
    }
  }));

  const byName = Object.fromEntries(results.map(r => [r.name, r.value])) as any;

  const meetingsSlice = byName.meetings || { today: [], upcoming: [] };

  const ctx: AssembledContext = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'Team Member',
      pci_id: user.pci_id || null,
    },
    now: new Date().toISOString(),
    activities:        byName.activities || [],
    meetings_today:    meetingsSlice.today,
    meetings_upcoming: meetingsSlice.upcoming,
    unread_summary:    byName.unread || { total: 0, by_channel: [] },
    workflow_tasks:    byName.workflow_tasks || [],
    pinned_messages:   byName.pinned_messages || [],
    expiring_items:    byName.expiring_items || [],
    recent_messages:   byName.recent_messages || [],
    _meta: {
      assembled_in_ms: Date.now() - startedAt,
      sources_ok,
      sources_failed,
    },
  };

  cache.set(userId, { ctx, expiresAt: Date.now() + CACHE_TTL_MS });
  return ctx;
}
