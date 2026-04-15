import React, { useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    text: { bg: '#1565c0', label: 'Delivered' },
    read: { bg: '#2e7d32', label: 'Read' },
    sent: { bg: '#1976d2', label: 'Sent' },
  };
  const s = map[status] || { bg: '#888', label: status };
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: s.bg, color: '#fff' }}>
      {s.label}
    </span>
  );
}

// ── Automation card renderers ─────────────────────────────

function MeetingCard({ p }: { p: any }) {
  return (
    <div style={{ margin: '6px 12px', border: '1px solid #90caf9', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#1976d2', color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
        📅 Scheduled Meeting <span style={{ fontSize: 10, opacity: .8, fontWeight: 400 }}>from PLANet IAS</span>
      </div>
      <div style={{ padding: '8px 12px', fontSize: 12 }}>
        <Row label="Subject">{p.subject}</Row>
        <Row label="Date">{new Date(p.meeting_date).toLocaleString()}</Row>
        <Row label="Duration">{p.duration_minutes} min</Row>
        <Row label="Invited">{(p.participants || []).join(', ')}</Row>
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid #dde1e7', display: 'flex', gap: 8 }}>
        <CardBtn primary>📹 Join Call</CardBtn>
        <CardBtn>↗ Open in PCI</CardBtn>
      </div>
    </div>
  );
}

function BriefingCard({ p }: { p: any }) {
  return (
    <div style={{ margin: '6px 12px', border: '1px solid #a5d6a7', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#1b5e20', color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
        🚀 Meeting Prep Briefing <span style={{ fontSize: 10, opacity: .8, fontWeight: 400 }}>· starts in {p.minutes_before} min</span>
      </div>
      <div style={{ padding: '8px 12px', fontSize: 12 }}>
        <Row label="Meeting">{p.subject}</Row>
        <Row label="Time">{new Date(p.meeting_date).toLocaleString()}</Row>
        <Row label="Attendees">{(p.attendees || []).join(', ')}</Row>
        {p.pci_activities?.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 700, color: '#555', fontSize: 11, marginBottom: 3 }}>📋 Recent PCI Activities</div>
            {p.pci_activities.map((a: any, i: number) => (
              <div key={i} style={{ fontSize: 11, color: '#555', paddingLeft: 8 }}>· {a.person}: {a.subject}</div>
            ))}
          </div>
        )}
        {p.jira_sprint && (
          <div style={{ marginTop: 6, padding: '5px 8px', background: '#e3f2fd', borderRadius: 6, fontSize: 11 }}>
            <strong>🏃 Sprint:</strong> {p.jira_sprint.done} done · {p.jira_sprint.in_progress} in progress · {p.jira_sprint.to_do} to do
          </div>
        )}
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid #dde1e7', display: 'flex', gap: 8 }}>
        <CardBtn primary>📹 Join Call</CardBtn>
        <CardBtn>↗ Open in PCI</CardBtn>
      </div>
    </div>
  );
}

function DWMCard({ p, messageId }: { p: any; messageId: number }) {
  const [status, setStatus] = React.useState<'pending' | 'approved' | 'rejected' | 'processing'>('pending');

  const handleAction = useCallback(async (action: 'approve' | 'reject') => {
    setStatus('processing');
    try {
      await axios.post(`${API}/automation/dwm-action`, {
        workflow_step_id: p.pci_workflow_step_id,
        action,
      });
      setStatus(action === 'approve' ? 'approved' : 'rejected');
    } catch {
      setStatus('pending');
      alert('Action failed. Please try again.');
    }
  }, [p.pci_workflow_step_id]);

  return (
    <div style={{ margin: '6px 12px', border: '1px solid #ce93d8', borderRadius: 8, overflow: 'hidden', background: '#f3e5f5' }}>
      <div style={{ background: '#6a1b9a', color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
        🔄 DWM Workflow Trigger
      </div>
      <div style={{ padding: '8px 12px', fontSize: 12 }}>
        <Row label="Workflow">{p.workflow_name}</Row>
        <Row label="Document">{p.document}</Row>
        <Row label="Step">{p.step}</Row>
        <Row label="Status">
          {status === 'pending' && <span style={{ color: '#e65100', fontWeight: 600 }}>⏳ Awaiting approval</span>}
          {status === 'processing' && <span style={{ color: '#888' }}>Processing...</span>}
          {status === 'approved' && <span style={{ color: '#2e7d32', fontWeight: 600 }}>✅ Approved</span>}
          {status === 'rejected' && <span style={{ color: '#c62828', fontWeight: 600 }}>✕ Rejected</span>}
        </Row>
      </div>
      {status === 'pending' && (
        <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', gap: 8 }}>
          <CardBtn primary purple onClick={() => handleAction('approve')}>✅ Approve</CardBtn>
          <CardBtn danger onClick={() => handleAction('reject')}>✕ Reject</CardBtn>
          <CardBtn onClick={() => window.open(`${import.meta.env.VITE_PCI_URL}/activity/${p.pci_activity_id}`, '_blank')}>
            ↗ Open in PCI
          </CardBtn>
        </div>
      )}
    </div>
  );
}

function AutoChannelCard({ p }: { p: any }) {
  return (
    <div style={{ margin: '6px 12px', border: '1px solid #80deea', borderRadius: 8, overflow: 'hidden', background: '#e0f7fa' }}>
      <div style={{ background: '#006064', color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
        ⬡ Auto-Channel Created
      </div>
      <div style={{ padding: '8px 12px', fontSize: 12 }}>
        <Row label="Trigger">{p.trigger === 'project' ? '📁 Project' : '🏢 Entity'}</Row>
        <Row label="Name">{p.pci_name}</Row>
        <Row label="Members added">{p.members_added}</Row>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', marginBottom: 2 }}>
      <span style={{ color: '#888', width: 80, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{children}</span>
    </div>
  );
}

function CardBtn({ children, primary, danger, purple, onClick }: {
  children: React.ReactNode;
  primary?: boolean;
  danger?: boolean;
  purple?: boolean;
  onClick?: () => void;
}) {
  const bg = danger ? '#c62828' : purple ? '#6a1b9a' : primary ? '#1976d2' : '#fff';
  const color = (danger || primary || purple) ? '#fff' : '#555';
  const border = (danger || primary || purple) ? 'none' : '1px solid #dde1e7';
  return (
    <button onClick={onClick} style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: bg, color, border }}>
      {children}
    </button>
  );
}

// ── Main message row ──────────────────────────────────────
function MessageRow({ msg, prevMsg }: { msg: Message; prevMsg?: Message }) {
  const { user } = useAuthStore();
  const isMine = msg.sender?.id === user?.id;
  const isContinuation = prevMsg?.sender?.id === msg.sender?.id;

  // Automation card types
  if (msg.message_type === 'meeting_card' && msg.automation_payload) {
    return <MeetingCard p={msg.automation_payload} />;
  }
  if (msg.message_type === 'briefing_card' && msg.automation_payload) {
    return <BriefingCard p={msg.automation_payload} />;
  }
  if (msg.message_type === 'dwm_card' && msg.automation_payload) {
    return <DWMCard p={msg.automation_payload} messageId={msg.id} />;
  }
  if (msg.message_type === 'automation' && msg.automation_payload?.type === 'auto_channel_card') {
    return <AutoChannelCard p={msg.automation_payload} />;
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

// ── MessageList ───────────────────────────────────────────
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
