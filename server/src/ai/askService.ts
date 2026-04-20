/**
 * Ask IAS — Ask service.
 *
 * Orchestrates the full flow for a single question:
 *   1. Check response cache (30s, keyed by userId + question + history hash)
 *   2. Assemble context (cached internally for 30s)
 *   3. Call Anthropic with the built messages
 *   4. Parse + validate the JSON response
 *   5. Enrich links (verify channel/meeting ids actually exist)
 *   6. On any failure, fall back to a rules-based list using what we have
 *   7. Return a typed response
 */

import axios from 'axios';
import pool from '../db/auth';
import { assembleContext, type AssembledContext } from './contextAssembly';
import { buildSystemPrompt, buildMessages, type PromptMessage } from './promptBuilder';

// ────────────────────────────────────────────────────────────────────
//  Public response types
// ────────────────────────────────────────────────────────────────────

export interface ListItem {
  title: string;
  reason: string;
  urgency_badge?: string;
  type_badge: string;
  link: { kind: 'channel' | 'activity' | 'meeting' | 'external'; target_id: number | string };
  source_id?: string;
  supports_done: boolean;
}

export type AskContent =
  | { items: ListItem[] }
  | { heading: string; body: string; bullet_highlights?: string[] }
  | { columns: string[]; rows: string[][]; caption?: string };

export interface AskResponse {
  format: 'list' | 'summary' | 'table';
  content: AskContent;
  generated_in_ms: number;
  source: 'ai' | 'rules_fallback' | 'cache';
  meta?: {
    sources_ok?: string[];
    sources_failed?: string[];
    retry_used?: boolean;
    error_reason?: string;
  };
}

// ────────────────────────────────────────────────────────────────────
//  Response cache — 30s TTL keyed on (userId, question, history hash)
// ────────────────────────────────────────────────────────────────────

const RESPONSE_CACHE_TTL_MS = 30_000;
const responseCache = new Map<string, { resp: AskResponse; expiresAt: number }>();

function cacheKey(userId: number, question: string, history: PromptMessage[]) {
  const hist = JSON.stringify(history.map(h => [h.role, h.content.length]));
  return `${userId}::${question.trim().toLowerCase()}::${hist}`;
}

// ────────────────────────────────────────────────────────────────────
//  Anthropic call
// ────────────────────────────────────────────────────────────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_TIMEOUT_MS = 10_000;

async function callAnthropic(messages: PromptMessage[], system: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const { data } = await axios.post(
    ANTHROPIC_URL,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      temperature: 0.2,
      system,
      messages,
    },
    {
      timeout: ANTHROPIC_TIMEOUT_MS,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }
  );

  // Content blocks → concatenate the text parts
  const text = (data?.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('Anthropic returned empty response');
  return text;
}

// ────────────────────────────────────────────────────────────────────
//  JSON parsing + validation
// ────────────────────────────────────────────────────────────────────

function stripFences(s: string): string {
  // Handles cases where the AI slipped and wrapped the JSON in ```json ... ```
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  }
  return t;
}

function parseAndValidate(raw: string): { format: AskResponse['format']; content: AskContent } {
  const obj = JSON.parse(stripFences(raw));

  if (!obj || typeof obj !== 'object') throw new Error('Response is not an object');
  if (!obj.format || !obj.content) throw new Error('Missing format or content');

  if (obj.format === 'list') {
    const items = obj.content.items;
    if (!Array.isArray(items)) throw new Error('list.items must be an array');
    // Validate shape of each item
    const clean: ListItem[] = items.slice(0, 5).map((it: any, idx: number) => {
      if (!it.title || !it.reason || !it.type_badge || !it.link) {
        throw new Error(`Item ${idx} missing required fields`);
      }
      if (!it.link.kind || it.link.target_id === undefined) {
        throw new Error(`Item ${idx} link malformed`);
      }
      return {
        title: String(it.title),
        reason: String(it.reason),
        urgency_badge: it.urgency_badge ? String(it.urgency_badge) : undefined,
        type_badge: String(it.type_badge),
        link: {
          kind: it.link.kind,
          target_id: it.link.target_id,
        },
        source_id: it.source_id ? String(it.source_id) : undefined,
        supports_done: it.supports_done !== false, // default true when ambiguous
      };
    });
    return { format: 'list', content: { items: clean } };
  }

  if (obj.format === 'summary') {
    if (typeof obj.content.heading !== 'string' || typeof obj.content.body !== 'string') {
      throw new Error('summary requires heading and body strings');
    }
    const hi = Array.isArray(obj.content.bullet_highlights)
      ? obj.content.bullet_highlights.slice(0, 5).map((x: any) => String(x))
      : undefined;
    return {
      format: 'summary',
      content: {
        heading: obj.content.heading,
        body: obj.content.body,
        bullet_highlights: hi,
      },
    };
  }

  if (obj.format === 'table') {
    if (!Array.isArray(obj.content.columns) || !Array.isArray(obj.content.rows)) {
      throw new Error('table requires columns and rows arrays');
    }
    return {
      format: 'table',
      content: {
        columns: obj.content.columns.map((c: any) => String(c)).slice(0, 6),
        rows: obj.content.rows
          .slice(0, 10)
          .map((r: any) => (Array.isArray(r) ? r.map((c: any) => String(c)) : [])),
        caption: obj.content.caption ? String(obj.content.caption) : undefined,
      },
    };
  }

  throw new Error(`Unknown format: ${obj.format}`);
}

// ────────────────────────────────────────────────────────────────────
//  Link enrichment — verify channel_id / meeting target exists; strip if not
// ────────────────────────────────────────────────────────────────────

async function enrichLinks(resp: AskResponse, userId: number): Promise<void> {
  if (resp.format !== 'list') return;
  const items = (resp.content as { items: ListItem[] }).items;
  if (!items.length) return;

  // Collect channel ids we need to verify
  const channelIds = items
    .filter(it => (it.link.kind === 'channel' || it.link.kind === 'meeting') && typeof it.link.target_id === 'number')
    .map(it => Number(it.link.target_id));
  if (channelIds.length === 0) return;

  const { rows } = await pool.query(
    `SELECT DISTINCT c.id
     FROM channels c
     JOIN channel_members cm ON cm.channel_id = c.id
     WHERE cm.user_id = $1 AND c.id = ANY($2::int[])`,
    [userId, channelIds]
  );
  const reachable = new Set(rows.map((r: any) => r.id));
  for (const it of items) {
    if ((it.link.kind === 'channel' || it.link.kind === 'meeting')
        && typeof it.link.target_id === 'number'
        && !reachable.has(it.link.target_id)) {
      // Keep the item but drop the dangling link so UI shows it read-only
      it.link = { kind: 'external', target_id: '' };
    }
  }
}

// ────────────────────────────────────────────────────────────────────
//  Rules-based fallback — when Anthropic is unavailable or fails twice
// ────────────────────────────────────────────────────────────────────

function rulesFallback(ctx: AssembledContext): AskResponse {
  const items: ListItem[] = [];

  // 1. Overdue activities first
  for (const a of ctx.activities) {
    if (a.is_overdue && a.status === 'Active') {
      items.push({
        title: a.subject,
        reason: `Overdue since ${new Date(a.date).toLocaleDateString('en-GB')}`,
        urgency_badge: 'Overdue',
        type_badge: a.type,
        link: { kind: 'activity', target_id: a.id },
        source_id: String(a.id),
        supports_done: a.type !== 'Meeting' && a.type !== 'Note',
      });
      if (items.length >= 5) break;
    }
  }

  // 2. Today's meetings
  if (items.length < 5) {
    for (const m of ctx.meetings_today) {
      items.push({
        title: m.subject,
        reason: m.is_in_progress
          ? `In progress in ${m.channel_name}`
          : `Starts ${new Date(m.meeting_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} in ${m.channel_name}`,
        urgency_badge: m.is_in_progress ? 'Live' : 'Today',
        type_badge: 'Meeting',
        link: { kind: 'meeting', target_id: m.channel_id },
        supports_done: false,
      });
      if (items.length >= 5) break;
    }
  }

  // 3. Remaining active tasks
  if (items.length < 5) {
    for (const a of ctx.activities) {
      if (!a.is_overdue && a.status === 'Active') {
        items.push({
          title: a.subject,
          reason: `${a.type} · due ${new Date(a.date).toLocaleDateString('en-GB')}`,
          urgency_badge: undefined,
          type_badge: a.type,
          link: { kind: 'activity', target_id: a.id },
          source_id: String(a.id),
          supports_done: a.type !== 'Meeting' && a.type !== 'Note',
        });
        if (items.length >= 5) break;
      }
    }
  }

  return {
    format: 'list',
    content: { items },
    generated_in_ms: 0,
    source: 'rules_fallback',
    meta: {
      sources_ok: ctx._meta.sources_ok,
      sources_failed: ctx._meta.sources_failed,
      error_reason: 'Anthropic unavailable; using rules-based priority',
    },
  };
}

// ────────────────────────────────────────────────────────────────────
//  Public entrypoint
// ────────────────────────────────────────────────────────────────────

export async function askIAS(
  userId: number,
  question: string,
  history: PromptMessage[] = []
): Promise<AskResponse> {
  const startedAt = Date.now();

  // Response cache
  const key = cacheKey(userId, question, history);
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.resp, source: 'cache' };
  }

  // Context
  const ctx = await assembleContext(userId);

  const system = buildSystemPrompt();
  const messages = buildMessages(ctx, question, history);

  // Try Anthropic with one retry on parse failure
  let raw: string | null = null;
  let parsed: { format: AskResponse['format']; content: AskContent } | null = null;
  let retryUsed = false;
  let errorReason: string | undefined;

  try {
    raw = await callAnthropic(messages, system);
    try {
      parsed = parseAndValidate(raw);
    } catch (parseErr: any) {
      // Retry once with a stricter nudge
      retryUsed = true;
      const stricter = [
        ...messages,
        { role: 'assistant' as const, content: raw },
        {
          role: 'user' as const,
          content: `Your previous reply did not match the required JSON schema: ${parseErr.message}. Return ONLY a valid JSON object matching the schema. No prose, no backticks.`,
        },
      ];
      raw = await callAnthropic(stricter, system);
      parsed = parseAndValidate(raw);
    }
  } catch (err: any) {
    errorReason = err?.message || 'Anthropic call failed';
    console.error('Ask IAS: Anthropic failed', errorReason);
  }

  let response: AskResponse;
  if (parsed) {
    response = {
      format: parsed.format,
      content: parsed.content,
      generated_in_ms: Date.now() - startedAt,
      source: 'ai',
      meta: {
        sources_ok: ctx._meta.sources_ok,
        sources_failed: ctx._meta.sources_failed,
        retry_used: retryUsed || undefined,
      },
    };
    try { await enrichLinks(response, userId); } catch { /* non-fatal */ }
  } else {
    response = rulesFallback(ctx);
    response.generated_in_ms = Date.now() - startedAt;
    if (response.meta) response.meta.error_reason = errorReason;
  }

  responseCache.set(key, { resp: response, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
  return response;
}
