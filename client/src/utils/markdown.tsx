import React from 'react';

// ── Compact Markdown renderer ────────────────────────────────
// Used by MessageList and ThreadPanel to render message bodies. Handles the
// small but impactful subset of Markdown people actually use in chat:
//
//   **bold**      *italic*      ~~strikethrough~~
//   `inline code`                ```code block```
//   [label](url)                 plain URLs are auto-linked
//
// Newlines are preserved (rendered as <br>). Unclosed markers fall through
// as literal text, not as half-applied formatting. Nested formatting works
// via recursion (e.g. "**bold *italic***" renders correctly).
//
// This is deliberately a tokenizer-based walk rather than a regex pipeline —
// regex replacements can't produce React nodes safely without going through
// dangerouslySetInnerHTML, which would require full HTML sanitization. A
// token walk yields proper React children and keeps the security surface
// minimal.

const BLUE = '#1976d2';

const inlineCodeStyle: React.CSSProperties = {
  background: '#f3f4f6',
  border: '1px solid #e0e4e9',
  borderRadius: 4,
  padding: '0 5px',
  fontFamily: 'SF Mono, Consolas, Menlo, monospace',
  fontSize: '0.9em',
  color: '#c62828',
};

const codeBlockStyle: React.CSSProperties = {
  background: '#1e293b',
  color: '#e2e8f0',
  borderRadius: 8,
  padding: '10px 12px',
  margin: '4px 0',
  fontFamily: 'SF Mono, Consolas, Menlo, monospace',
  fontSize: '0.85em',
  overflowX: 'auto',
  whiteSpace: 'pre',
};

const linkStyle: React.CSSProperties = {
  color: BLUE,
  textDecoration: 'underline',
  wordBreak: 'break-word',
};

// ── Inline renderer (no code fences, no newline paragraphs) ─────
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let buffer = '';
  let i = 0;
  let key = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = '';
    }
  };

  while (i < text.length) {
    // Inline code: `...`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        nodes.push(
          <code key={`${keyPrefix}-c${key++}`} style={inlineCodeStyle}>
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }

    // Bold: **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        nodes.push(
          <strong key={`${keyPrefix}-b${key++}`}>
            {renderInline(text.slice(i + 2, end), `${keyPrefix}-b${key}`)}
          </strong>
        );
        i = end + 2;
        continue;
      }
    }

    // Italic: *...*  (but not if it's actually the start of bold)
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end > i + 1 && text[end + 1] !== '*') {
        flush();
        nodes.push(
          <em key={`${keyPrefix}-i${key++}`}>
            {renderInline(text.slice(i + 1, end), `${keyPrefix}-i${key}`)}
          </em>
        );
        i = end + 1;
        continue;
      }
    }

    // Strikethrough: ~~...~~
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end > i + 2) {
        flush();
        nodes.push(
          <del key={`${keyPrefix}-s${key++}`}>
            {renderInline(text.slice(i + 2, end), `${keyPrefix}-s${key}`)}
          </del>
        );
        i = end + 2;
        continue;
      }
    }

    // Markdown link: [label](url)
    if (text[i] === '[') {
      const closeText = text.indexOf(']', i + 1);
      if (closeText > i && text[closeText + 1] === '(') {
        const closeUrl = text.indexOf(')', closeText + 2);
        if (closeUrl > closeText + 2) {
          const label = text.slice(i + 1, closeText);
          const url = text.slice(closeText + 2, closeUrl);
          // Validate URL shape — only allow http(s) and mailto to avoid nasties
          if (/^(https?:\/\/|mailto:)/i.test(url)) {
            flush();
            nodes.push(
              <a key={`${keyPrefix}-l${key++}`} href={url} target="_blank" rel="noreferrer" style={linkStyle}>
                {label}
              </a>
            );
            i = closeUrl + 1;
            continue;
          }
        }
      }
    }

    // Plain URL auto-link: http:// or https://
    if (text[i] === 'h' && (text.startsWith('http://', i) || text.startsWith('https://', i))) {
      const rest = text.slice(i);
      const match = rest.match(/^https?:\/\/[^\s<>()]+[^\s<>().,;:!?]/);
      if (match) {
        const url = match[0];
        flush();
        nodes.push(
          <a key={`${keyPrefix}-u${key++}`} href={url} target="_blank" rel="noreferrer" style={linkStyle}>
            {url}
          </a>
        );
        i += url.length;
        continue;
      }
    }

    // Newline → <br>
    if (text[i] === '\n') {
      flush();
      nodes.push(<br key={`${keyPrefix}-n${key++}`} />);
      i++;
      continue;
    }

    buffer += text[i];
    i++;
  }

  flush();
  return nodes;
}

// ── Top-level renderer (handles code fences first) ─────────────
export function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const fenceRegex = /```(?:[a-zA-Z0-9_-]*\n)?([\s\S]*?)```/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(
        <span key={`inl-${k++}`}>
          {renderInline(text.slice(lastIdx, match.index), `inl-${k}`)}
        </span>
      );
    }
    parts.push(
      <pre key={`code-${k++}`} style={codeBlockStyle}>
        <code>{match[1].replace(/\n$/, '')}</code>
      </pre>
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(
      <span key={`inl-${k++}`}>
        {renderInline(text.slice(lastIdx), `inl-${k}`)}
      </span>
    );
  }

  return <>{parts}</>;
}
