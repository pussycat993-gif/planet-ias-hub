import React from 'react';
import { useAskIASStore } from '../../store/askIASStore';
import { useAskIASActions } from '../../hooks/useAskIASActions';

/**
 * Ask IAS — ResponseRenderer.
 *
 * Polished rendering of the three supported response formats. Picks the
 * right sub-component based on `response.format`, falls back to a pretty-
 * printed JSON block for unknown formats (safety net for schema drift).
 *
 * Action buttons in ListResponse are rendered but their onClick is a no-op
 * in this task — HUB-39 wires them to real handlers (selectChannel for
 * channel/meeting links, PCI navigation for activities, mark-as-done
 * endpoint, and the call-join flow for in-progress meetings).
 */

// ── Types ────────────────────────────────────────────────────────────
export interface ListItemLink {
  kind: 'channel' | 'activity' | 'meeting' | 'external';
  target_id: number | string;
}

export interface ListItem {
  title: string;
  reason: string;
  urgency_badge?: string;
  type_badge: string;
  link: ListItemLink;
  source_id?: string;
  supports_done: boolean;
}

export interface AskResponseParsed {
  format: 'list' | 'summary' | 'table';
  content: any;
  generated_in_ms?: number;
  source?: 'ai' | 'rules_fallback' | 'cache';
  meta?: any;
}

// ── Tokens ───────────────────────────────────────────────────────────
const BLUE      = '#1976d2';
const BLUE_DARK = '#1565c0';
const BLUE_SOFT = '#f0f7ff';
const RED       = '#c62828';
const RED_SOFT  = '#ffebee';
const ORANGE    = '#e65100';
const ORANGE_SOFT = '#fff3e0';
const GREEN     = '#2e7d32';
const GREEN_SOFT = '#e8f5e9';
const INK       = '#1a1a2e';
const INK_DIM   = '#555';
const INK_MUTE  = '#888';
const BORDER    = '#e6eaf0';
const BORDER_SOFT = '#f0f2f5';

// ════════════════════════════════════════════════════════════════════
//  Dispatcher
// ════════════════════════════════════════════════════════════════════

export default function ResponseRenderer({ response }: { response: AskResponseParsed }) {
  switch (response.format) {
    case 'list':    return <ListResponse    content={response.content} />;
    case 'summary': return <SummaryResponse content={response.content} />;
    case 'table':   return <TableResponse   content={response.content} />;
    default:        return <UnknownResponse response={response} />;
  }
}

// ════════════════════════════════════════════════════════════════════
//  List — the bread-and-butter format. Numbered rows with action buttons.
// ════════════════════════════════════════════════════════════════════

function ListResponse({ content }: { content: any }) {
  const allItems: ListItem[] = Array.isArray(content?.items) ? content.items : [];
  const dismissed = useAskIASStore(s => s.dismissedSourceIds);

  // Filter out items the user has marked Done this session. Key by source_id
  // when available, otherwise fall back to the link-based key the action
  // handler uses so both sides agree.
  const items = allItems.filter(it => {
    const key = it.source_id || `${it.link?.kind}-${it.link?.target_id}` || it.title;
    return !dismissed.has(key);
  });

  if (items.length === 0) {
    return (
      <div style={{
        padding: '22px 20px',
        textAlign: 'center',
        color: INK_MUTE,
      }}>
        <div style={{ fontSize: 26, marginBottom: 6, opacity: .5 }}>{allItems.length > 0 ? '✅' : '☕'}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: INK_DIM }}>
          {allItems.length > 0 ? 'All caught up!' : 'Nothing urgent right now'}
        </div>
        <div style={{ fontSize: 11, marginTop: 3 }}>
          {allItems.length > 0
            ? 'You’ve cleared everything on this list.'
            : 'Enjoy your morning — I’ll keep watching your inbox and calendar.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {items.map((it, i) => (
        <ListRow key={it.source_id || i} index={i + 1} item={it} isLast={i === items.length - 1} />
      ))}
    </div>
  );
}

function ListRow({ index, item, isLast }: { index: number; item: ListItem; isLast: boolean }) {
  const overdue = (item.urgency_badge || '').toLowerCase().includes('overdue');
  const [hover, setHover] = React.useState(false);
  const { openItem, markDone, canJoin, joinMeeting } = useAskIASActions();

  const handleOpen = () => openItem(item);
  const handleDone = () => markDone(item);
  const handleJoin = () => joinMeeting(item);

  const showJoin = canJoin(item);
  const showDone = item.supports_done && item.type_badge !== 'Meeting';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        gap: 11,
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : `1px solid ${BORDER_SOFT}`,
        background: hover ? BLUE_SOFT : 'transparent',
        transition: 'background .1s',
        cursor: 'pointer',
      }}
      onClick={handleOpen}
    >
      {/* Numbered circle */}
      <div style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: overdue ? RED : BLUE,
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
        boxShadow: overdue ? `0 0 0 3px ${RED_SOFT}` : 'none',
      }}>{index}</div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: INK,
          marginBottom: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          lineHeight: 1.35,
        }}>
          <span>{item.title}</span>
          {item.urgency_badge && <Badge kind="urgency" value={item.urgency_badge} />}
          {item.type_badge && <Badge kind="type" value={item.type_badge} />}
        </div>
        <div style={{ fontSize: 11.5, color: INK_DIM, lineHeight: 1.45 }}>
          {item.reason}
        </div>
      </div>

      {/* Actions */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'flex-start', marginTop: 1 }}
      >
        {showJoin
          ? <ActionButton variant="join" onClick={handleJoin}>📹 Join</ActionButton>
          : <ActionButton variant="open" onClick={handleOpen}>Open</ActionButton>}
        {showDone && (
          <ActionButton variant="done" onClick={handleDone}>✓ Done</ActionButton>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Summary — heading + prose body (lightweight markdown) + highlights
// ════════════════════════════════════════════════════════════════════

function SummaryResponse({ content }: { content: any }) {
  const heading    = typeof content?.heading === 'string' ? content.heading : '';
  const body       = typeof content?.body === 'string'    ? content.body    : '';
  const highlights = Array.isArray(content?.bullet_highlights)
    ? content.bullet_highlights.filter((x: any) => typeof x === 'string')
    : [];

  return (
    <div style={{ padding: '14px 16px 16px' }}>
      {heading && (
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: BLUE_DARK,
          marginBottom: 8,
          lineHeight: 1.35,
        }}>{heading}</div>
      )}

      {body && (
        <div style={{
          fontSize: 13,
          color: INK,
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}>
          {renderInlineMarkdown(body)}
        </div>
      )}

      {highlights.length > 0 && (
        <ul style={{
          marginTop: 12,
          marginBottom: 0,
          paddingLeft: 0,
          listStyle: 'none',
          borderTop: `1px solid ${BORDER_SOFT}`,
          paddingTop: 10,
        }}>
          {highlights.map((h: string, i: number) => (
            <li key={i} style={{
              display: 'flex',
              gap: 8,
              fontSize: 12,
              color: INK_DIM,
              marginBottom: 5,
              lineHeight: 1.5,
            }}>
              <span style={{ color: BLUE, marginTop: 2, flexShrink: 0 }}>▸</span>
              <span>{parseInline(h)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Tiny, safe markdown-lite for summary body:
 *   **bold**, *italic*, `code`, and paragraph breaks on blank lines.
 * No raw HTML, no links, no images — we don't want this to be an XSS
 * vector, and the AI is instructed to keep summaries short.
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.map((p, pi) => (
    <p key={pi} style={{ margin: pi === 0 ? 0 : '10px 0 0' }}>
      {parseInline(p)}
    </p>
  ));
}

function parseInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) out.push(text.slice(lastIndex, m.index));
    if (m[2] !== undefined)      out.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<em key={key++}>{m[3]}</em>);
    else if (m[4] !== undefined) out.push(
      <code key={key++} style={{
        background: '#f5f6f8',
        padding: '1px 5px',
        borderRadius: 4,
        fontFamily: 'Menlo, Consolas, monospace',
        fontSize: '0.92em',
      }}>{m[4]}</code>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

// ════════════════════════════════════════════════════════════════════
//  Table — HTML table with blue header + zebra body + horizontal scroll
// ════════════════════════════════════════════════════════════════════

function TableResponse({ content }: { content: any }) {
  const columns: string[]   = Array.isArray(content?.columns) ? content.columns : [];
  const rows:    string[][] = Array.isArray(content?.rows)    ? content.rows    : [];
  const caption: string     = typeof content?.caption === 'string' ? content.caption : '';

  if (columns.length === 0 || rows.length === 0) {
    return (
      <div style={{ padding: '22px 20px', color: INK_MUTE, fontSize: 12, textAlign: 'center' }}>
        No data to display.
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      <div style={{
        overflowX: 'auto',
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontSize: 12,
          color: INK,
        }}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} style={{
                  background: BLUE_SOFT,
                  color: BLUE_DARK,
                  fontWeight: 700,
                  padding: '9px 12px',
                  textAlign: 'left',
                  borderBottom: `2px solid #bbdefb`,
                  whiteSpace: 'nowrap',
                  letterSpacing: '.02em',
                  fontSize: 11.5,
                }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafbfc' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: '8px 12px',
                    borderBottom: ri < rows.length - 1 ? `1px solid ${BORDER_SOFT}` : 'none',
                    verticalAlign: 'top',
                    lineHeight: 1.45,
                    fontSize: 12,
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <div style={{
          fontSize: 11,
          color: INK_MUTE,
          marginTop: 8,
          fontStyle: 'italic',
        }}>{caption}</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Unknown format — safety net
// ════════════════════════════════════════════════════════════════════

function UnknownResponse({ response }: { response: AskResponseParsed }) {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginBottom: 6 }}>
        Unrecognized response format: {response.format}
      </div>
      <pre style={{
        margin: 0,
        padding: 10,
        fontSize: 10.5,
        background: '#fafbfc',
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        color: INK_DIM,
        overflowX: 'auto',
        lineHeight: 1.5,
      }}>{JSON.stringify(response, null, 2)}</pre>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Shared primitives
// ════════════════════════════════════════════════════════════════════

function Badge({ kind, value }: { kind: 'urgency' | 'type'; value: string }) {
  let bg = '#f0f0f0', color = INK_DIM;
  if (kind === 'urgency') {
    const v = value.toLowerCase();
    if (v.includes('overdue')) {
      bg = RED_SOFT; color = RED;
    } else if (v.includes('today') || v.includes('live') || v.startsWith('in ')) {
      bg = ORANGE_SOFT; color = ORANGE;
    } else if (v.includes('done') || v.includes('complete')) {
      bg = GREEN_SOFT; color = GREEN;
    } else {
      bg = BLUE_SOFT; color = BLUE_DARK;
    }
  } else {
    bg = '#f5f6f8'; color = INK_DIM;
  }
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 700,
      padding: '1px 6px',
      borderRadius: 4,
      textTransform: 'uppercase',
      letterSpacing: '.04em',
      background: bg,
      color,
      whiteSpace: 'nowrap',
    }}>{value}</span>
  );
}

function ActionButton({ variant, onClick, children }: {
  variant: 'open' | 'done' | 'join';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = React.useState(false);

  const palette = variant === 'open'
    ? { border: '#bbdefb', soft: BLUE_SOFT, color: BLUE }
    : variant === 'done'
      ? { border: '#a5d6a7', soft: GREEN_SOFT, color: GREEN }
      : { border: '#ef9a9a', soft: RED_SOFT, color: RED };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        border: `1px solid ${palette.border}`,
        background: hover ? palette.soft : '#fff',
        color: palette.color,
        borderRadius: 5,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: variant === 'join' ? 600 : 500,
        whiteSpace: 'nowrap',
        transition: 'background .1s, border-color .1s',
      }}
    >{children}</button>
  );
}
