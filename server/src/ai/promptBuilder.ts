/**
 * Ask IAS — Prompt builder.
 *
 * Turns an AssembledContext + question into the exact messages array we send
 * to Anthropic. The system prompt locks the AI into a strict JSON response
 * schema with one of three formats (list / summary / table). Keeping this in
 * its own module makes it easy to tune the wording without touching the
 * service layer.
 */

import type { AssembledContext } from './contextAssembly';

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function buildSystemPrompt(): string {
  return [
    `You are Ask IAS, an AI assistant embedded in IAS Hub — the private chat and`,
    `collaboration app used by PLANet Systems Group. Your job is to help the`,
    `user focus on what matters most by answering questions about their work.`,
    ``,
    `DATA YOU HAVE:`,
    `The user's context is supplied with every question in JSON form. It`,
    `contains their PCI activities, today's and upcoming meetings, unread`,
    `channels, workflow tasks, pinned messages, expiring documents, and`,
    `recent messages from their top 3 channels. Treat that context as the`,
    `single source of truth. Never invent items that are not in the context.`,
    ``,
    `OUTPUT FORMAT:`,
    `You must respond with a single JSON object only — no prose, no`,
    `backticks, no markdown. Start the reply with "{" and end with "}".`,
    ``,
    `The JSON shape is:`,
    `{`,
    `  "format": "list" | "summary" | "table",`,
    `  "content": { ... shape depends on format ... }`,
    `}`,
    ``,
    `Choose the format that best fits the question:`,
    `- "list" for prioritization, status queries, and "show me X" questions.`,
    `  Use this for: "what should I focus on", "what's blocking me",`,
    `  "overdue tasks", "today's priorities", etc.`,
    `- "summary" for open-ended, narrative questions. Use this for:`,
    `  "summarize this week", "what happened in X channel", "recap".`,
    `- "table" for comparative or tabular data with columns. Use this for:`,
    `  "how many meetings per day", "time spent per client", etc.`,
    ``,
    `SHAPES:`,
    ``,
    `list:`,
    `{`,
    `  "items": [`,
    `    {`,
    `      "title": string,`,
    `      "reason": string,          // one short sentence why this matters`,
    `      "urgency_badge": string?,  // "Overdue" | "Due today" | "In 4h" | "Tomorrow" | null`,
    `      "type_badge": string,      // "Task" | "Meeting" | "Email" | "Message" | "Note"`,
    `      "link": {`,
    `        "kind": "channel" | "activity" | "meeting" | "external",`,
    `        "target_id": number | string`,
    `      },`,
    `      "source_id": string?,      // PCI activity id when relevant`,
    `      "supports_done": boolean   // false for meetings, true for tasks/emails`,
    `    }`,
    `  ]`,
    `}`,
    `Return at most 5 items, ordered by urgency (most urgent first).`,
    ``,
    `summary:`,
    `{`,
    `  "heading": string,              // short title, max 8 words`,
    `  "body": string,                 // markdown, 2-5 sentences`,
    `  "bullet_highlights": string[]?  // 0-5 one-line highlights`,
    `}`,
    ``,
    `table:`,
    `{`,
    `  "columns": string[],            // 2-5 column headers`,
    `  "rows": string[][],             // max 10 rows`,
    `  "caption": string?              // optional description`,
    `}`,
    ``,
    `RULES:`,
    `- Be concise. Reasons are ONE sentence.`,
    `- Never fabricate data. If the context is empty, say so honestly.`,
    `- Always return valid JSON; do not wrap in backticks or prose.`,
    `- When linking to a meeting, set kind="meeting" and target_id to the`,
    `  meeting's channel_id so the UI can route to the channel and start`,
    `  a call if needed.`,
    `- supports_done is false for meetings and notes, true for tasks/emails.`,
  ].join('\n');
}

/**
 * Build the user-turn message for the current question. The context is
 * embedded as a JSON block so the AI can reference specific fields by name.
 */
export function buildUserMessage(ctx: AssembledContext, question: string): string {
  // Trim context to what's actually useful — keep the payload small.
  const trimmed = {
    now: ctx.now,
    user: ctx.user,
    activities: ctx.activities.slice(0, 30),
    meetings_today: ctx.meetings_today,
    meetings_upcoming: ctx.meetings_upcoming.slice(0, 10),
    unread_summary: ctx.unread_summary,
    workflow_tasks: ctx.workflow_tasks,
    pinned_messages: ctx.pinned_messages.slice(0, 15).map(p => ({
      id: p.id,
      channel_id: p.channel_id,
      channel_name: p.channel_name,
      sender: p.sender_name,
      body: (p.body || '').slice(0, 200),
      at: p.created_at,
    })),
    expiring_items: ctx.expiring_items,
    recent_messages: ctx.recent_messages.map(b => ({
      channel_id: b.channel_id,
      channel_name: b.channel_name,
      channel_type: b.channel_type,
      // Keep last 15 of 20 for token budget
      messages: b.messages.slice(-15).map(m => ({
        sender: m.sender_name,
        is_mine: m.is_mine,
        body: (m.body || '').slice(0, 240),
        at: m.created_at,
      })),
    })),
  };

  return [
    `CURRENT CONTEXT (use only this, do not invent):`,
    '```json',
    JSON.stringify(trimmed, null, 2),
    '```',
    '',
    `QUESTION: ${question}`,
    '',
    `Respond with a single JSON object. No prose, no backticks.`,
  ].join('\n');
}

/**
 * Stitch prior turns + the new question together for multi-turn chats.
 * History is passed as Anthropic `messages` (role + string content), ending
 * with the new user turn. Assistant turns in history are the RAW JSON strings
 * we returned previously — the AI gets to see its own prior answers.
 */
export function buildMessages(
  ctx: AssembledContext,
  question: string,
  history: PromptMessage[] = []
): PromptMessage[] {
  const msgs: PromptMessage[] = [];
  for (const h of history) {
    // Guard: only pass user/assistant roles through; drop anything else.
    if (h.role === 'user' || h.role === 'assistant') {
      msgs.push({ role: h.role, content: h.content });
    }
  }
  msgs.push({ role: 'user', content: buildUserMessage(ctx, question) });
  return msgs;
}
