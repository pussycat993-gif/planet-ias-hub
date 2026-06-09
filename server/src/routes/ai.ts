import { Router, Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../db/auth';
import pciClient, { logActivityToPCI } from '../pci/client';
import axios from 'axios';
import { askIAS, type AskResponse } from '../ai/askService';
import { invalidateUserContext } from '../ai/contextAssembly';

const router = Router();

const JIRA_CLOUD_ID = process.env.JIRA_CLOUD_ID || '016ccab4-41b8-4069-b389-0e6f7385b912';
const JIRA_BASE = `https://api.atlassian.com/ex/jira/${JIRA_CLOUD_ID}/rest/api/3`;

// ── POST /ai/ask ──────────────────────────────
// New Ask IAS endpoint. Accepts a question + optional multi-turn history,
// returns a typed response (list | summary | table) built by askService.
router.post('/ask', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { question, history } = req.body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ success: false, error: 'Question required' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ success: false, error: 'Question too long (max 1000 chars)' });
  }

  // Validate history shape if provided
  const validatedHistory = Array.isArray(history)
    ? history
        .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .slice(-10) // cap at last 10 turns to keep prompt budget in check
    : [];

  try {
    const response: AskResponse = await askIAS(userId, question.trim(), validatedHistory);
    return res.json({ success: true, data: response });
  } catch (err: any) {
    console.error('Ask IAS error:', err);
    return res.status(500).json({ success: false, error: 'Ask IAS failed', details: err.message });
  }
});

// ── POST /ai/activity-suggest ─────────────────────
// Phase 1 of the Activity Suggestion feature. Takes a free-text blob (a note
// or subject) and asks the model to fill out the PCI activity fields. We force
// JSON-only output and strip any stray markdown fences before parsing.
// Body: { text: string }
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

const ACTIVITY_SUGGEST_SYSTEM = `You extract structured PCI activity fields from free text.
Return ONLY valid JSON — no prose, no explanation, and no markdown code fences.

The JSON object must have exactly these keys:
{
  "subject": string,          // a concise title, under 80 characters
  "activity_type": string,    // one of: Meeting, Call, Email, Task, Note
  "activity_class": string,   // one of: Business, Internal, Client, Personal
  "note": string,             // a 1-3 sentence English summary of the text
  "priority": boolean,        // true only if the text signals urgency/importance
  "people": string[],         // names of people; ONLY those mentioned in the input
  "entities": string[],       // organizations/projects; ONLY those in the input
  "tags": string[]            // short topic keywords drawn from the input
}

Rules:
- subject must be under 80 characters.
- activity_type must be exactly one of Meeting, Call, Email, Task, Note.
- activity_class must be exactly one of Business, Internal, Client, Personal.
- people and entities must come ONLY from the input text. Do not invent names.
- If a field has no value, use an empty string, empty array, or false.`;

function stripFences(s: string): string {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  }
  return t;
}

router.post('/activity-suggest', async (req: Request, res: Response) => {
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'text required' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

    const { data } = await axios.post(
      ANTHROPIC_URL,
      {
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        temperature: 0.2,
        system: ACTIVITY_SUGGEST_SYSTEM,
        messages: [{ role: 'user', content: text.slice(0, 4000) }],
      },
      {
        timeout: 15_000,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );

    const raw = (data?.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();

    const parsed = JSON.parse(stripFences(raw));

    const data_out = {
      subject: String(parsed.subject || '').slice(0, 80),
      activity_type: ['Meeting', 'Call', 'Email', 'Task', 'Note'].includes(parsed.activity_type) ? parsed.activity_type : 'Note',
      activity_class: ['Business', 'Internal', 'Client', 'Personal'].includes(parsed.activity_class) ? parsed.activity_class : 'Business',
      note: String(parsed.note || ''),
      priority: Boolean(parsed.priority),
      people: Array.isArray(parsed.people) ? parsed.people.map(String) : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities.map(String) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };

    return res.json({ success: true, data: data_out });
  } catch (err: any) {
    console.error('Activity suggest error:', err);
    return res.status(500).json({ success: false, error: 'Suggestion failed' });
  }
});

// ── POST /ai/mark-done ───────────────────────────
// Called when the user clicks Done on an Ask IAS list item. We log a
// Complete activity to PCI referencing the source item in the Note field,
// and invalidate the user's context cache so the item stops showing up on
// their next question. PCI-side handling of "marking the original activity
// complete" is out of scope here — this just records the signal.
//
// Body: { source_id: string, title: string, type_badge: string }
router.post('/mark-done', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { source_id, title, type_badge } = req.body || {};

  if (!source_id || !title) {
    return res.status(400).json({ success: false, error: 'source_id and title required' });
  }

  // Look up the user's PCI id so we can attribute the log correctly.
  let pciPersonId: number | null = null;
  try {
    const { rows } = await pool.query('SELECT pci_id FROM users WHERE id = $1', [userId]);
    pciPersonId = rows[0]?.pci_id || null;
  } catch { /* non-fatal */ }

  // Best-effort PCI log. If PCI is unreachable we still invalidate cache so
  // the UI is consistent; the client sees success and can move on.
  let pciOk = false;
  try {
    await logActivityToPCI({
      activity_type: 'Task',
      Activity_Subject: `Completed via Ask IAS: ${String(title).slice(0, 180)}`,
      Activity_DateTime: new Date().toISOString(),
      Duration: 0,
      Status: 'Complete',
      People: pciPersonId ? [pciPersonId] : [],
      Entities: [],
      Note: `Source: ${source_id} | Type: ${type_badge || 'unknown'} | Marked done from IAS Hub.`,
    });
    pciOk = true;
  } catch (err: any) {
    console.warn('Ask IAS mark-done: PCI log failed (continuing)', err.message);
  }

  invalidateUserContext(userId);
  return res.json({ success: true, data: { source_id, pci_ok: pciOk } });
});

// ── POST /ai/query ────────────────────────────────────────
router.post('/query', async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { question, channel_id } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ success: false, error: 'Question required' });
  }

  try {
    const q = question.toLowerCase();
    let response = '';
    let actions: Array<{ label: string; type: string; url?: string; payload?: any }> = [];

    // ── Open tasks ────────────────────────────────────────
    if (q.includes('task') || q.includes('open') || q.includes('todo') || q.includes('assigned')) {
      const jiraData = await queryJira(
        `assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC`,
        ['summary', 'status', 'priority', 'issuetype']
      );
      const issues = jiraData.issues || [];
      if (issues.length === 0) {
        response = '✅ No open tasks found in Jira.';
      } else {
        const list = issues.slice(0, 8).map((i: any) =>
          `• **${i.key}** — ${i.fields.summary} _(${i.fields.status.name})_`
        ).join('\n');
        response = `📋 **Your open Jira tasks (${issues.length} total):**\n\n${list}`;
        actions = [{ label: '↗ Open in Jira', type: 'url', url: `https://planetsystemsgroup.atlassian.net/jira/software/projects/IAS/boards` }];
      }
    }

    // ── Sprint status ─────────────────────────────────────
    else if (q.includes('sprint') || q.includes('board')) {
      const sprintData = await queryJira(
        `project = IAS AND sprint in openSprints()`,
        ['summary', 'status', 'assignee', 'issuetype']
      );
      const issues = sprintData.issues || [];
      const done = issues.filter((i: any) => i.fields.status.statusCategory.key === 'done').length;
      const inProgress = issues.filter((i: any) => i.fields.status.statusCategory.key === 'indeterminate').length;
      const todo = issues.filter((i: any) => i.fields.status.statusCategory.key === 'new').length;
      response = `🏃 **Current Sprint (IAS):**\n\n• Total: **${issues.length}** issues\n• ✅ Done: **${done}**\n• 🔄 In Progress: **${inProgress}**\n• 📋 To Do: **${todo}**`;
      actions = [{ label: '↗ Open Jira Board', type: 'url', url: `https://planetsystemsgroup.atlassian.net/jira/software/projects/IAS/boards` }];
    }

    // ── Specific Jira issue ───────────────────────────────
    else if (/[A-Z]+-\d+/.test(question)) {
      const match = question.match(/([A-Z]+-\d+)/)?.[1];
      if (match) {
        const issueData = await queryJiraIssue(match);
        const f = issueData.fields;
        response = `🔵 **${match}** — ${f.summary}\n\n• Status: **${f.status.name}**\n• Assignee: **${f.assignee?.displayName || 'Unassigned'}**\n• Priority: ${f.priority?.name || 'None'}\n• Type: ${f.issuetype?.name}`;
        if (f.description) response += '\n\n' + extractTextFromADF(f.description);
        actions = [{ label: `↗ Open ${match}`, type: 'url', url: `https://planetsystemsgroup.atlassian.net/browse/${match}` }];
      }
    }

    // ── Schedule / today ──────────────────────────────────
    else if (q.includes('schedule') || q.includes('today') || q.includes('meeting')) {
      try {
        const { data } = await pciClient.get('/api/ias-connect/users');
        const user = data.data?.find((u: any) => u.id === userId);
        response = `📅 **Today's schedule:**\n\nConnect to PCI to see your activities for today. Make sure PLANet Contact IAS is accessible at \`${process.env.PCI_API_URL}\`.`;
        actions = [{ label: '↗ Open PCI Activity List', type: 'url', url: `${process.env.PCI_API_URL}/activity-list` }];
      } catch {
        response = '📅 Could not fetch schedule from PCI. Check PCI connection in settings.';
      }
    }

    // ── Chat summary ──────────────────────────────────────
    else if (q.includes('summar') || q.includes('discussion') || q.includes('log')) {
      if (channel_id) {
        const { rows } = await pool.query(
          `SELECT m.body, u.name AS sender
           FROM messages m LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.channel_id = $1 AND m.deleted_at IS NULL AND m.message_type = 'text'
           ORDER BY m.created_at DESC LIMIT 20`,
          [channel_id]
        );
        const transcript = rows.reverse().map((r: any) => `${r.sender}: ${r.body}`).join('\n');
        const jiraTickets = [...new Set([...transcript.matchAll(/\b([A-Z]+-\d+)\b/g)].map(m => m[1]))];

        response = `📝 **Conversation summary:**\n\n`;
        if (jiraTickets.length > 0) response += `**Jira tickets mentioned:** ${jiraTickets.join(', ')}\n\n`;
        response += `**Recent messages:** ${rows.length} messages analyzed\n\n`;
        response += `Key topics from last ${rows.length} messages have been extracted. Log this to PCI as an activity?`;
        actions = [{ label: '↗ Log to PCI', type: 'log_to_pci', payload: { channel_id, jira_tickets: jiraTickets } }];
      } else {
        response = 'Select a channel first to summarize the conversation.';
      }
    }

    // ── Contact / person ──────────────────────────────────
    else if (q.includes('contact') || q.includes('person') || q.includes('history with')) {
      response = '👤 To see contact history, open a Direct Message conversation with that person. The PCI Context panel on the right will show their activities, open tasks, and entities.';
    }

    // ── Fallback ──────────────────────────────────────────
    else {
      response = `I can help you with:\n\n• **Open tasks** — "What are my open tasks?"\n• **Sprint status** — "What's left in the sprint?"\n• **Jira issues** — "What's IAS-537?"\n• **Today's schedule** — "What's on my schedule today?"\n• **Chat summary** — "Summarize this conversation"\n\nFor a full AI experience, connect an LLM endpoint in Settings.`;
    }

    return res.json({ success: true, data: { response, actions } });
  } catch (err: any) {
    console.error('AI query error:', err.message);
    return res.status(500).json({ success: false, error: 'AI query failed', details: err.message });
  }
});

// ── Jira helpers ──────────────────────────────────────────
async function queryJira(jql: string, fields: string[] = []) {
  const jiraToken = process.env.JIRA_API_TOKEN;
  const jiraEmail = process.env.JIRA_EMAIL;

  if (!jiraToken || !jiraEmail) {
    throw new Error('Jira credentials not configured (JIRA_EMAIL, JIRA_API_TOKEN)');
  }

  const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
  const { data } = await axios.get(`${JIRA_BASE}/search`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    params: { jql, fields: fields.join(','), maxResults: 20 },
  });
  return data;
}

async function queryJiraIssue(issueKey: string) {
  const jiraToken = process.env.JIRA_API_TOKEN;
  const jiraEmail = process.env.JIRA_EMAIL;
  const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
  const { data } = await axios.get(`${JIRA_BASE}/issue/${issueKey}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  return data;
}

function extractTextFromADF(adf: any): string {
  if (!adf?.content) return '';
  return adf.content
    .flatMap((block: any) => block.content || [])
    .filter((node: any) => node.type === 'text')
    .map((node: any) => node.text)
    .join(' ')
    .slice(0, 300);
}

export default router;
