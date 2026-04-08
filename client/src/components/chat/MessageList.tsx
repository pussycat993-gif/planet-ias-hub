import React, { useEffect, useRef } from 'react';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    'text': { bg: '#1565c0', label: 'Delivered' },
    'read': { bg: '#2e7d32', label: 'Read' },
    'sent': { bg: '#1976d2', label: 'Sent' },
  };
  const s = map[status] || { bg: '#888', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 10,
      fontSize: 10, fontWeight: 600, background: s.bg, color: '#fff',
    }}>
      {s.label}
    </span>
  );
}

function MessageRow({ msg, prevMsg }: { msg: Message; prevMsg?: Message }) {
  const { user } = useAuthStore();
  const isMine = msg.sender?.id === user?.id;
  const isContinuation = prevMsg?.sender?.id === msg.sender?.id;

  if (msg.message_type === 'meeting_card' && msg.automation_payload) {
    const p = msg.automation_payload;
    return (
      <div style={{ margin: '6px 12px', border: '1px solid #90caf9', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#1976d2', color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
          📅 Scheduled Meeting &nbsp;<span style={{ fontSize: 10, opacity: .8, fontWeight: 400 }}>from PLANet IAS</span>
        </div>
        <div style={{ padding: '8px 12px', fontSize: 12 }}>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Subject</span><strong>{p.subject}</strong></div>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Date</span>{new Date(p.meeting_date).toLocaleString()}</div>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Duration</span>{p.duration_minutes} min</div>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Invited</span>{(p.participants || []).join(', ')}</div>
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid #dde1e7', display: 'flex', gap: 8 }}>
          <button style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#1976d2', color: '#fff', border: 'none' }}>
            📹 Join Call
          </button>
          <button style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', border: '1px solid #dde1e7' }}>
            ↗ Open in PCI
          </button>
        </div>
      </div>
    );
  }

  if (msg.message_type === 'dwm_card' && msg.automation_payload) {
    const p = msg.automation_payload;
    return (
      <div style={{ margin: '6px 12px', border: '1px solid #ce93d8', borderRadius: 8, overflow: 'hidden', background: '#f3e5f5' }}>
        <div style={{ background: '#6a1b9a', color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
          🔄 DWM Workflow Trigger
        </div>
        <div style={{ padding: '8px 12px', fontSize: 12 }}>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Workflow</span><strong>{p.workflow_name}</strong></div>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Document</span>{p.document}</div>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Step</span>{p.step}</div>
          <div><span style={{ color: '#888', width: 74, display: 'inline-block' }}>Status</span><span style={{ color: '#e65100', fontWeight: 600 }}>⏳ Awaiting approval</span></div>
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', gap: 8 }}>
          <button style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#6a1b9a', color: '#fff', border: 'none' }}>✅ Approve</button>
          <button style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', border: '1px solid #ef9a9a', color: '#c62828' }}>✕ Reject</button>
          <button style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', border: '1px solid #dde1e7' }}>↗ Open in PCI</button>
        </div>
      </div>
    );
  }

  if (msg.deleted_at) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '120px 70px 1fr 90px', padding: '5px 12px', margin: '1px 4px' }}>
        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
          {!isContinuation ? (msg.sender?.name || 'System') : ''}
        </div>
        <div style={{ fontSize: 10, color: '#888' }}>{formatTime(msg.created_at)}</div>
        <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Message deleted</div>
        <div />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '120px 70px 1fr 90px',
        padding: '5px 12px', borderBottom: '1px solid #f2f2f2',
        alignItems: 'start', cursor: 'pointer', background: isMine ? '#fafeff' : '#fff',
        transition: 'background .1s', margin: '1px 4px', borderRadius: 4,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
      onMouseLeave={e => (e.currentTarget.style.background = isMine ? '#fafeff' : '#fff')}
    >
      <div style={{ fontSize: 11, color: '#1976d2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isMine ? 600 : 400 }}>
        {!isContinuation ? (msg.sender?.name || 'System') : ''}
      </div>
      <div style={{ fontSize: 10, color: '#888' }}>{formatTime(msg.created_at)}</div>
      <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>
        {msg.body}
      </div>
      <div style={{ textAlign: 'right' }}>
        <StatusPill status="text" />
      </div>
    </div>
  );
}

export default function MessageList() {
  const { messages, activeChannelId, loadingMessages, hasMoreMessages, fetchMessages } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChannelId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
        Select a channel to start messaging
      </div>
    );
  }

  const grouped = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = formatDate(msg.created_at);
    const last = acc[acc.length - 1];
    if (!last || last.date !== date) acc.push({ date, msgs: [msg] });
    else last.msgs.push(msg);
    return acc;
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
      {hasMoreMessages && (
        <div style={{ textAlign: 'center', padding: 8 }}>
          <button
            onClick={() => fetchMessages(activeChannelId, messages[0]?.created_at)}
            disabled={loadingMessages}
            style={{ border: '1px solid #dde1e7', background: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}
          >
            {loadingMessages ? 'Loading...' : 'Load older messages'}
          </button>
        </div>
      )}

      {/* Column header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 70px 1fr 90px',
        background: '#eef2f7', borderTop: '1px solid #dde1e7', borderBottom: '1px solid #dde1e7',
        padding: '3px 12px', color: '#1565c0', fontWeight: 700, fontSize: 10,
        textTransform: 'uppercase', letterSpacing: '.04em',
      }}>
        <div>Sender</div><div>Time</div><div>Message</div><div style={{ textAlign: 'right' }}>Status</div>
      </div>

      {grouped.map(({ date, msgs }) => (
        <React.Fragment key={date}>
          <div style={{
            textAlign: 'center', padding: 5, color: '#888', fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 8, margin: '4px 12px',
          }}>
            <div style={{ flex: 1, height: 1, background: '#dde1e7' }} />
            {date}
            <div style={{ flex: 1, height: 1, background: '#dde1e7' }} />
          </div>
          {msgs.map((msg, i) => (
            <MessageRow key={msg.id} msg={msg} prevMsg={msgs[i - 1]} />
          ))}
        </React.Fragment>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
