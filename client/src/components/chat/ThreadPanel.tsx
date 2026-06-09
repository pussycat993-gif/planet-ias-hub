import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useThreadLastViewed } from '../../hooks/useThreadLastViewed';
import { getSocket } from '../../hooks/useSocket';
import { renderMarkdown } from '../../utils/markdown';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = 'var(--blue-primary)';
const BLUE_DARK = 'var(--blue-dark)';

function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ name, avatarUrl, size = 28 }: { name: string; avatarUrl?: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const bg = stringToColor(name);
  if (avatarUrl && !imgError) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <img src={avatarUrl} alt={name} onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── One message row in the thread (parent or reply) ──────────
function ThreadMessageRow({ msg, isParent = false }: { msg: Message; isParent?: boolean }) {
  const { user } = useAuthStore();
  const isMine = msg.sender?.id === user?.id;
  const senderName = msg.sender?.name || 'System';

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '8px 14px',
      background: isParent ? 'var(--grey-light)' : 'transparent',
      borderBottom: isParent ? '1px solid var(--border)' : 'none',
      borderLeft: isMine && !isParent ? `3px solid ${BLUE}` : '3px solid transparent',
    }}>
      <Avatar name={senderName} avatarUrl={msg.sender?.avatar_url} size={isParent ? 32 : 28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: isMine ? BLUE_DARK : 'var(--text)' }}>
            {isMine ? 'You' : senderName}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{formatTime(msg.created_at)}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, wordBreak: 'break-word' }}>
          {renderMarkdown(msg.body || '')}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────
export default function ThreadPanel() {
  const { activeThreadId, closeThread } = useUIStore();
  const { activeChannelId } = useChatStore();
  const { user } = useAuthStore();
  const { markViewed } = useThreadLastViewed();

  const [parent, setParent] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [alsoSendToChannel, setAlsoSendToChannel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch thread on open
  useEffect(() => {
    if (!activeThreadId) return;
    setLoading(true);
    axios.get(`${API}/messages/${activeThreadId}/thread`)
      .then(r => {
        setParent(r.data.data.parent);
        setReplies(r.data.data.replies || []);
      })
      .catch(err => console.error('Fetch thread error:', err))
      .finally(() => setLoading(false));
  }, [activeThreadId]);

  // Auto-focus composer when thread opens (after loading settles)
  useEffect(() => {
    if (!loading && activeThreadId) {
      // Small delay to let the panel layout settle
      const t = setTimeout(() => textareaRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [loading, activeThreadId]);

  // Mark thread as viewed whenever we see new replies (or open the panel)
  useEffect(() => {
    if (!activeThreadId || loading) return;
    const newest = replies.length > 0 ? replies[replies.length - 1].created_at : parent?.created_at;
    if (newest) markViewed(activeThreadId, newest);
  }, [activeThreadId, loading, replies.length, parent?.created_at, markViewed]);

  // Listen for new replies via socket
  useEffect(() => {
    if (!activeThreadId) return;
    const socket = getSocket();
    if (!socket) return;

    const handleThreadUpdate = (payload: { parent_id: number; reply: Message }) => {
      if (String(payload.parent_id) !== String(activeThreadId)) return;
      setReplies(prev => {
        // De-dup in case the local send also echoed back
        if (prev.some(r => r.id === payload.reply.id)) return prev;
        return [...prev, payload.reply];
      });
    };

    socket.on('thread:update', handleThreadUpdate);
    return () => {
      socket.off('thread:update', handleThreadUpdate);
    };
  }, [activeThreadId]);

  // Auto-scroll to bottom as replies stream in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length, loading]);

  const handleSend = async () => {
    if (!text.trim() || !activeThreadId || !activeChannelId) return;
    setSending(true);
    const body = text.trim();
    try {
      // 1) Send as a thread reply
      const { data } = await axios.post(`${API}/messages/${activeChannelId}/messages`, {
        body,
        reply_to_id: activeThreadId,
      });
      // Optimistically append — socket echo will be deduped
      setReplies(prev => {
        if (prev.some(r => r.id === data.data.id)) return prev;
        return [...prev, data.data];
      });

      // 2) If "Also send to channel" is checked, post as a top-level message too.
      //    This mirrors Slack's behavior so a reply can surface in the main channel.
      if (alsoSendToChannel) {
        axios.post(`${API}/messages/${activeChannelId}/messages`, { body }).catch(() => {});
      }

      setText('');
      setAlsoSendToChannel(false);
    } catch (err) {
      console.error('Thread send error:', err);
    }
    setSending(false);
  };

  if (!activeThreadId) return null;

  return (
    <div style={{
      width: 380, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: BLUE_DARK, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💬</span>
            <span>Thread</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </div>
        </div>
        <span onClick={closeThread} style={{ cursor: 'pointer', fontSize: 20, color: 'var(--text3)' }} title="Close thread">✕</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Loading thread…</div>
        ) : !parent ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#c62828', fontSize: 12 }}>
            Thread not found
          </div>
        ) : (
          <>
            <ThreadMessageRow msg={parent} isParent />

            {replies.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                No replies yet. Start the thread below.
              </div>
            ) : (
              <div style={{ paddingTop: 4 }}>
                {replies.map(r => <ThreadMessageRow key={r.id} msg={r} />)}
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', flexShrink: 0, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {user && <div style={{ paddingTop: 4 }}><Avatar name={user.name} avatarUrl={user.avatar_url} size={28} /></div>}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Reply in thread…"
              disabled={sending || loading}
              rows={Math.max(1, Math.min(6, (text.match(/\n/g) || []).length + 1))}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid var(--border)', borderRadius: 10,
                padding: '8px 12px',
                fontSize: 13, fontFamily: 'inherit', outline: 'none',
                background: 'var(--grey-light)', color: 'var(--text)',
                resize: 'vertical', minHeight: 36,
                lineHeight: 1.5,
              }}
              onFocus={e => (e.currentTarget.style.background = 'var(--surface)')}
              onBlur={e => (e.currentTarget.style.background = 'var(--grey-light)')}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={alsoSendToChannel}
                  onChange={e => setAlsoSendToChannel(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Also send to channel</span>
              </label>

              <button
                onClick={handleSend}
                disabled={!text.trim() || sending || loading}
                style={{
                  padding: '6px 16px',
                  background: text.trim() && !sending ? BLUE : 'var(--neutral-light-active)',
                  color: text.trim() && !sending ? '#fff' : 'var(--text3)',
                  border: 'none', borderRadius: 8,
                  cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
