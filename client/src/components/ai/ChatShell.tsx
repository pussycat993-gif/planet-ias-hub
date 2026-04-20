import React, { useEffect, useRef } from 'react';
import { useAskIASStore, type Turn } from '../../store/askIASStore';
import { useAskIAS } from '../../hooks/useAskIAS';
import ResponseRenderer from './ResponseRenderer';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

/**
 * Ask IAS — ChatShell.
 *
 * Scrollable list of turns. User turns render as right-aligned gray bubbles.
 * Assistant turns render as full-width blocks containing the ResponseRenderer
 * (or a loading / error state).
 *
 * Auto-scrolls to the bottom whenever a new turn is added.
 */
export default function ChatShell() {
  const { history } = useAskIASStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom on every history change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history.length, history[history.length - 1]?.loading]);

  if (history.length === 0) return <EmptyState />;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '14px 18px 18px',
    }}>
      <style>{`
        @keyframes ias-turn-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes ias-dots {
          0%, 80%, 100% { opacity: .3; }
          40%            { opacity: 1;  }
        }
      `}</style>

      {history.map(turn => (
        <div key={turn.id} style={{ animation: 'ias-turn-in .22s ease-out' }}>
          {turn.role === 'user'
            ? <UserBubble turn={turn} />
            : <AssistantBlock turn={turn} />}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
//  Empty state — shown when no turns exist yet
// ────────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '28px 24px',
      color: '#888',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 34, marginBottom: 10, opacity: .45 }}>✨</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 4 }}>
        What can I help you with?
      </div>
      <div style={{ fontSize: 11, color: '#aaa', maxWidth: 380 }}>
        Pick one of the questions below, or type your own. I can pull from your
        tasks, meetings, unread channels, and pinned messages.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
//  User turn — right-aligned gray bubble
// ────────────────────────────────────────────────────────────────────
function UserBubble({ turn }: { turn: Turn }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        maxWidth: '78%',
        padding: '9px 13px',
        background: '#f0f2f5',
        color: '#1a1a2e',
        borderRadius: '14px 14px 4px 14px',
        fontSize: 13,
        lineHeight: 1.45,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {turn.content}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
//  Assistant turn — full-width block
// ────────────────────────────────────────────────────────────────────
function AssistantBlock({ turn }: { turn: Turn }) {
  const isFallback = turn.parsed?.source === 'rules_fallback';

  return (
    <div style={{
      width: '100%',
      border: `1px solid ${isFallback ? '#ffcc80' : '#e6eaf0'}`,
      borderRadius: 12,
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* Small header strip */}
      <div style={{
        padding: '6px 12px',
        background: isFallback ? '#fff8e1' : '#f8fafd',
        borderBottom: `1px solid ${isFallback ? '#ffe082' : '#eef1f5'}`,
        fontSize: 10,
        fontWeight: 700,
        color: isFallback ? '#8a6d00' : BLUE_DARK,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span>✨</span>
        <span>Ask IAS</span>
        {turn.parsed?.source === 'cache' && (
          <span style={{ color: '#aaa', fontWeight: 500, textTransform: 'none', marginLeft: 'auto' }}>cached</span>
        )}
        {isFallback && (
          <span style={{ color: '#8a6d00', fontWeight: 600, textTransform: 'none', marginLeft: 'auto' }}>
            offline · showing local data
          </span>
        )}
        {typeof turn.parsed?.generated_in_ms === 'number' && !isFallback && turn.parsed.source !== 'cache' && (
          <span style={{ color: '#aaa', fontWeight: 500, textTransform: 'none', marginLeft: 'auto' }}>
            {Math.round(turn.parsed.generated_in_ms / 100) / 10}s
          </span>
        )}
      </div>

      {/* Fallback notice */}
      {isFallback && (
        <div style={{
          padding: '8px 12px',
          fontSize: 11,
          color: '#8a6d00',
          background: '#fffdf4',
          borderBottom: '1px solid #fff3c4',
          lineHeight: 1.45,
        }}>
          I couldn't reach the AI right now. Here's what I could pull from your calendar and tasks:
        </div>
      )}

      {/* Body */}
      {turn.loading && <LoadingBody />}
      {turn.error && <ErrorBody error={turn.error} turnId={turn.id} />}
      {!turn.loading && !turn.error && turn.parsed && (
        <ResponseRenderer response={turn.parsed} />
      )}
    </div>
  );
}

function LoadingBody() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '14px 14px',
      fontSize: 12,
      color: '#888',
    }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: BLUE,
            animation: `ias-dots 1.3s infinite`,
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
      </span>
      <span>Thinking…</span>
    </div>
  );
}

function ErrorBody({ error, turnId }: { error: string; turnId: string }) {
  const { retryTurn } = useAskIAS();
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try { await retryTurn(turnId); } finally { setRetrying(false); }
  };

  return (
    <div style={{
      padding: '12px 14px',
      fontSize: 12,
      background: '#ffebee',
      borderTop: '1px solid #ffcdd2',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 3, color: '#c62828' }}>
        Could not get an answer.
      </div>
      <div style={{ fontSize: 11, color: '#8a1c1c', marginBottom: 8 }}>{error}</div>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 600,
          border: '1px solid #c62828',
          background: retrying ? '#ffcdd2' : '#fff',
          color: '#c62828',
          borderRadius: 5,
          cursor: retrying ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
        onMouseEnter={e => { if (!retrying) e.currentTarget.style.background = '#ffebee'; }}
        onMouseLeave={e => { if (!retrying) e.currentTarget.style.background = '#fff'; }}
      >
        {retrying ? 'Retrying…' : '↻ Retry'}
      </button>
    </div>
  );
}
