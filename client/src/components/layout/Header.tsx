import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import { useAskIASStore } from '../../store/askIASStore';
import NotifDropdown from './NotifDropdown';
import AskIASButton from '../ai/AskIASButton';
import { retrySocketNow } from '../../hooks/useSocket';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE_DARK = '#1565c0';
const BLUE = '#1976d2';

function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Connection status indicator ───────────────────────────
function ConnectionIndicator() {
  const { connectionStatus } = useUIStore();
  const [hovered, setHovered] = useState(false);

  const map = {
    connected:    { color: '#4caf50', label: 'Connected',    pulse: false },
    reconnecting: { color: '#ff9800', label: 'Reconnecting…', pulse: true  },
    disconnected: { color: '#e53935', label: 'Offline',       pulse: false },
  };
  const cur = map[connectionStatus];

  // Only show anything beyond a dot if not connected
  const showLabel = connectionStatus !== 'connected' || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={cur.label}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px', height: 30, borderRadius: 15, cursor: connectionStatus === 'disconnected' ? 'pointer' : 'default', background: showLabel && connectionStatus !== 'connected' ? 'rgba(255,255,255,.15)' : 'transparent', transition: 'background .15s' }}
      onClick={() => { if (connectionStatus === 'disconnected') retrySocketNow(); }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: cur.color,
        boxShadow: cur.pulse ? `0 0 0 0 ${cur.color}` : 'none',
        animation: cur.pulse ? 'ias-pulse 1.4s infinite' : 'none',
      }} />
      {showLabel && (
        <span style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {connectionStatus === 'disconnected' ? 'Offline · Click to retry' : cur.label}
        </span>
      )}
      <style>{`@keyframes ias-pulse { 0% { box-shadow: 0 0 0 0 rgba(255,152,0,.7); } 70% { box-shadow: 0 0 0 6px rgba(255,152,0,0); } 100% { box-shadow: 0 0 0 0 rgba(255,152,0,0); } }`}</style>
    </div>
  );
}

// ── Help modal (keyboard shortcuts) ───────────────────────
function HelpModal({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['Cmd / Ctrl + K',    'Focus search'],
    ['Cmd / Ctrl + Shift + F', 'Open global search (filters, messages, files)'],
    ['Cmd / Ctrl + N',    'New direct message'],
    ['Cmd / Ctrl + Shift + M', 'Toggle Do Not Disturb'],
    ['Cmd / Ctrl + B',     'Bold selection'],
    ['Cmd / Ctrl + I',     'Italic selection'],
    ['Cmd / Ctrl + E',     'Inline code'],
    ['Shift + Enter',      'New line in composer'],
    ['Esc',                'Close modal or dropdown'],
    ['↑ / ↓ in search',   'Navigate results'],
    ['Enter in search',   'Open selected result'],
  ];
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', width: 460, maxWidth: '92vw', borderRadius: 12, boxShadow: '0 16px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ background: BLUE_DARK, color: '#fff', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Keyboard shortcuts</span>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, opacity: .8 }}>✕</span>
        </div>
        <div style={{ padding: '8px 18px 18px' }}>
          {rows.map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
              <span style={{ color: '#1a1a2e' }}>{desc}</span>
              <kbd style={{ background: '#f5f6f8', border: '1px solid #dde1e7', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontFamily: 'Segoe UI, Arial, sans-serif', color: '#555' }}>{key}</kbd>
            </div>
          ))}
          <div style={{ marginTop: 12, fontSize: 11, color: '#888' }}>
            Need more help? Contact <a href="mailto:support@planetsg.com" style={{ color: BLUE }}>support@planetsg.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile dropdown ──────────────────────────────────────
function ProfileDropdown({ onClose, onOpenHelp }: { onClose: () => void; onOpenHelp: () => void }) {
  const { user, logout, setAutoStatus } = useAuthStore();
  const { myStatus, myStatusMessage, setMyStatus, setMyStatusMessage, dnd, toggleDnd, openModal } = useUIStore();

  // Auto-status takes precedence over the manual status.
  const autoStatus = user?.auto_status;
  const manualColor = myStatus === 'online' ? '#4caf50' : myStatus === 'away' ? '#ff9800' : '#bbb';
  const statusColor = autoStatus === 'focus' ? '#e65100'
    : autoStatus === 'in_call' ? '#2e7d32'
    : manualColor;
  const autoLabel = autoStatus === 'focus' ? '🎯 Focus mode'
    : autoStatus === 'in_call' ? '📞 In a call'
    : autoStatus === 'in_meeting' ? '🎥 In a meeting'
    : null;

  const applyStatus = (s: 'online' | 'away' | 'offline') => {
    setMyStatus(s);
    if (user) axios.patch(`${API}/users/${user.id}/status`, { status: s }).catch(() => {});
  };

  const clearAutoStatus = async () => {
    await setAutoStatus(null, null);
    if (autoStatus === 'focus' && dnd) toggleDnd();
  };

  const initials = (user?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ width: 300, background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.18)', border: '1px solid #e8e8e8', fontFamily: 'Segoe UI, Arial, sans-serif', overflow: 'hidden' }}>
      {/* Avatar + name + email */}
      <div style={{ padding: '20px 16px 14px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 10px', position: 'relative', overflow: 'hidden', background: user?.avatar_url ? 'transparent' : stringToColor(user?.name || 'U'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,.12)' }}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : initials}
          {/* Emoji overlay if set, else status dot */}
          {user?.status_emoji ? (
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}>
              {user.status_emoji}
            </div>
          ) : (
            <div style={{ position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: statusColor, border: '2.5px solid #fff' }} />
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 3 }}>{user?.name || 'User'}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{user?.email || ''}</div>

        {(autoLabel || myStatusMessage) && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: autoStatus === 'focus' ? '#fff3e0' : '#f0f7ff', border: `1px solid ${autoStatus === 'focus' ? '#ffcc80' : '#c5def9'}`, borderRadius: 12, fontSize: 11, color: autoStatus === 'focus' ? '#e65100' : BLUE_DARK, fontWeight: 600 }}>
            {autoLabel ? <span>{autoLabel}</span> : <span>💬 {myStatusMessage}</span>}
          </div>
        )}

        <button style={{ marginTop: 12, width: '100%', padding: '8px 12px', border: '1px solid #dde1e7', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, color: '#1a1a2e' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          Manage account
        </button>
      </div>

      {/* Status section */}
      <div style={{ borderBottom: '1px solid #f0f0f0' }}>
        <div
          onClick={() => { openModal('setStatus'); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>
            {user?.status_emoji || '😊'}
          </span>
          <span style={{ fontSize: 14, color: '#1a1a2e', flex: 1 }}>
            {user?.status_emoji || myStatusMessage ? 'Update status & emoji' : 'Set a status & emoji'}
          </span>
          <span style={{ fontSize: 12, color: '#bbb' }}>›</span>
        </div>

        {autoLabel && (
          <div
            onClick={clearAutoStatus}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', background: '#fff8e1' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fff3e0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff8e1')}>
            <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{autoStatus === 'focus' ? '🎯' : autoStatus === 'in_call' ? '📞' : '🎥'}</span>
            <span style={{ fontSize: 12, color: '#e65100', flex: 1, fontWeight: 600 }}>{autoLabel}</span>
            <span style={{ fontSize: 11, color: '#888' }}>Clear</span>
          </div>
        )}

        <div onClick={() => applyStatus(myStatus === 'away' ? 'online' : 'away')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ width: 22, textAlign: 'center' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: manualColor, display: 'inline-block' }} />
          </span>
          <span style={{ fontSize: 14, color: '#1a1a2e' }}>Set yourself as <strong>{myStatus === 'away' ? 'online' : 'away'}</strong></span>
        </div>

        {/* DND toggle */}
        <div onClick={toggleDnd} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{dnd ? '🔕' : '🔔'}</span>
          <span style={{ fontSize: 14, color: '#1a1a2e', flex: 1 }}>Do not disturb</span>
          <span style={{
            width: 32, height: 18, borderRadius: 9, background: dnd ? BLUE : '#ddd', position: 'relative', transition: 'background .15s', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', top: 2, left: dnd ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </span>
        </div>
      </div>

      {/* Menu items */}
      <div style={{ borderBottom: '1px solid #f0f0f0' }}>
        {[['👤', 'My profile'], ['⚙️', 'Preferences']].map(([icon, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 14, color: '#1a1a2e' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
        <div onClick={() => { onOpenHelp(); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 14, color: '#1a1a2e' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>❓</span>
          <span>Help & shortcuts</span>
        </div>
      </div>
      <div style={{ borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 14, color: '#1a1a2e' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>📥</span>
          <span>Download apps</span>
        </div>
      </div>
      <div onClick={() => { logout(); onClose(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', fontSize: 14, color: '#c62828' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>↪</span>
        <span>Log out of PLANet Systems Group</span>
      </div>
    </div>
  );
}

// ── Global search dropdown ────────────────────────────────
interface SearchResult {
  type: 'channel' | 'group' | 'dm' | 'message' | 'file' | 'pinned';
  id: number;
  label: string;
  sublabel?: string;
  icon?: string;
  logoColor?: string;
  logoAbbr?: string;
  channelId?: number;
  messageId?: number;
}

interface PinnedMsg {
  id: number;
  channel_id: number;
  body: string | null;
  message_type: string;
  created_at: string;
  sender: { id: number; name: string; avatar_url?: string } | null;
  channel: { id: number; name: string; type: string; logo_color?: string; logo_abbr?: string };
  file?: { name: string; mime_type: string } | null;
}

function SearchDropdown({ query, onSelect, onClose }: {
  query: string;
  onSelect: (r: SearchResult) => void;
  onClose: () => void;
}) {
  const { channels, messages } = useChatStore();
  const [pinned, setPinned] = useState<PinnedMsg[]>([]);

  // Fetch all pinned messages once when the dropdown opens
  useEffect(() => {
    axios.get(`${API}/messages/pinned`)
      .then(r => setPinned(r.data.data || []))
      .catch(() => setPinned([]));
  }, []);

  const results = React.useMemo((): SearchResult[] => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    channels.public.concat(channels.private).forEach(ch => {
      if (ch.name.toLowerCase().includes(q)) {
        out.push({ type: 'channel', id: ch.id, label: ch.name, sublabel: 'Channel', icon: '#' });
      }
    });

    channels.groups.forEach(ch => {
      if (ch.name.toLowerCase().includes(q)) {
        out.push({ type: 'group', id: ch.id, label: ch.name, sublabel: 'Group', logoColor: ch.logo_color, logoAbbr: ch.logo_abbr });
      }
    });

    channels.dms.forEach(ch => {
      const name = ch.other_user?.name || ch.name;
      if (name.toLowerCase().includes(q)) {
        out.push({ type: 'dm', id: ch.id, label: name, sublabel: 'Direct Message', icon: '💬' });
      }
    });

    messages.forEach(msg => {
      if (msg.body?.toLowerCase().includes(q) && msg.sender) {
        out.push({ type: 'message', id: msg.id, label: msg.body?.slice(0, 60) || '', sublabel: `from ${msg.sender.name}`, icon: '💬' });
      }
    });

    return out.slice(0, 10);
  }, [query, channels, messages]);

  if (results.length === 0 && query.length >= 2) {
    return (
      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.15)', border: '1px solid #eee', zIndex: 4000, padding: '16px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
        No results for "{query}"
      </div>
    );
  }

  // Filter pinned messages by query — show top few unconditionally
  const q = query.trim().toLowerCase();
  const matchedPinned = q
    ? pinned.filter(p =>
        p.body?.toLowerCase().includes(q) ||
        p.sender?.name.toLowerCase().includes(q) ||
        p.channel.name.toLowerCase().includes(q)
      ).slice(0, 8)
    : pinned.slice(0, 5);

  if (results.length === 0 && matchedPinned.length === 0) return null;

  const groups: Record<string, SearchResult[]> = {};
  results.forEach(r => {
    const key = r.type === 'channel' || r.type === 'group' ? 'Channels & Groups'
      : r.type === 'dm' ? 'People' : 'Messages';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)', border: '1px solid #eee', zIndex: 4000, overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {Object.entries(groups).map(([groupLabel, items]) => (
        <div key={groupLabel}>
          <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em', background: '#fafafa', borderBottom: '1px solid #f5f5f5' }}>
            {groupLabel}
          </div>
          {items.map((r, i) => (
            <div key={i} onClick={() => { onSelect(r); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #f8f8f8' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              {r.type === 'group' ? (
                <div style={{ width: 28, height: 28, borderRadius: 7, background: r.logoColor || BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {r.logoAbbr || r.label.slice(0, 2).toUpperCase()}
                </div>
              ) : r.type === 'dm' ? (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: stringToColor(r.label), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {r.label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: BLUE, flexShrink: 0 }}>
                  {r.icon || '#'}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.label}
                </div>
                {r.sublabel && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{r.sublabel}</div>}
              </div>

              <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>
                {r.type === 'channel' ? 'Channel' : r.type === 'group' ? 'Group' : r.type === 'dm' ? 'DM' : 'Message'}
              </span>
            </div>
          ))}
        </div>
      ))}

      {/* Pinned Messages section — below regular results */}
      {matchedPinned.length > 0 && (
        <div>
          <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, color: '#f9a825', textTransform: 'uppercase', letterSpacing: '.06em', background: '#fffde7', borderBottom: '1px solid #ffe082', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>📌</span> Pinned Messages
          </div>
          {matchedPinned.map(p => {
            const fmtDate = (iso: string) => {
              const d = new Date(iso);
              const today = new Date();
              const yest = new Date(today); yest.setDate(today.getDate() - 1);
              const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
              if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
              return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + time;
            };
            return (
              <div key={p.id} onClick={() => {
                onSelect({ type: 'pinned', id: p.id, label: p.body || '', channelId: p.channel_id, messageId: p.id });
                onClose();
              }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #fff8e1', borderLeft: '3px solid #f9a825' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fffde7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                {p.channel.type === 'group' ? (
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: p.channel.logo_color || BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {p.channel.logo_abbr || p.channel.name.slice(0, 2).toUpperCase()}
                  </div>
                ) : p.channel.type === 'dm' ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: stringToColor(p.sender?.name || p.channel.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(p.sender?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: BLUE, flexShrink: 0 }}>#</div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{p.sender?.name || 'Unknown'}</span>
                    <span style={{ fontSize: 10, color: '#888' }}>in</span>
                    <span style={{ fontSize: 11, color: BLUE, fontWeight: 500 }}>
                      {p.channel.type === 'dm' ? p.sender?.name : p.channel.type === 'public' ? '#' + p.channel.name : p.channel.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#555', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
                    {p.message_type === 'file' ? `📎 ${p.body || p.file?.name || 'File'}` : p.body}
                  </div>
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 3 }}>{fmtDate(p.created_at)}</div>
                </div>

                <span style={{ fontSize: 10, color: '#f9a825', flexShrink: 0, marginTop: 2 }}>Jump →</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Popup wrapper ─────────────────────────────────────────
function Popup({ trigger, children, align = 'right' }: { trigger: React.ReactNode; children: (close: () => void) => React.ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && <div style={{ position: 'absolute', top: '100%', [align]: 0, marginTop: 6, zIndex: 3000 } as React.CSSProperties}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

interface HeaderProps {
  onSearch: (q: string) => void;
  searchQuery: string;
}

export default function Header({ onSearch, searchQuery }: HeaderProps) {
  const { user } = useAuthStore();
  const { myStatus, myStatusMessage, dnd, toggleDnd } = useUIStore();
  const { selectChannel } = useChatStore();

  const [localSearch, setLocalSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Auto-status takes precedence in the header chip (like ProfileDropdown does).
  const autoStatus = user?.auto_status;
  const manualColor = myStatus === 'online' ? '#4caf50' : myStatus === 'away' ? '#ff9800' : '#bbb';
  const statusColor = autoStatus === 'focus' ? '#e65100'
    : autoStatus === 'in_call' ? '#2e7d32'
    : manualColor;
  const statusLine = autoStatus === 'focus' ? 'Focus mode'
    : autoStatus === 'in_call' ? 'In a call'
    : autoStatus === 'in_meeting' ? 'In a meeting'
    : myStatusMessage
      ? myStatusMessage
      : myStatus === 'online' ? '● Online' : myStatus === 'away' ? '● Away' : '● Offline';

  // Load initial unread count
  useEffect(() => {
    axios.get(`${API}/notifications?limit=20`).then(r => {
      setUnreadNotifs((r.data.data || []).filter((n: any) => !n.read).length);
    }).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keyboard: Cmd+Shift+M toggles DND
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleDnd();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [toggleDnd]);

  // Keyboard: Cmd/Ctrl + Shift + F opens the global search modal.
  // This is the canonical Slack/Linear shortcut for powerful search.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        useUIStore.getState().openGlobalSearch();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Keyboard: Cmd/Ctrl + K toggles Ask IAS. If the modal is already open we
  // just focus its prompt input (via the store's focus token) instead of
  // closing the modal — matches the standard command palette behavior.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const store = useAskIASStore.getState();
        if (store.isOpen) {
          store.requestPromptFocus();
        } else {
          store.open();
        }
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    setShowDropdown(val.length >= 2);
    onSearch(val);
  };

  const handleSelectResult = (r: SearchResult) => {
    if (r.type === 'channel' || r.type === 'group' || r.type === 'dm') {
      selectChannel(r.id);
      setLocalSearch('');
      onSearch('');
      setShowDropdown(false);
    } else if (r.type === 'pinned' && r.channelId && r.messageId) {
      // Navigate to the channel, then scroll-to-message after the channel mounts
      selectChannel(r.channelId);
      setTimeout(() => useUIStore.getState().jumpToMessage(r.messageId!), 300);
      setLocalSearch('');
      onSearch('');
      setShowDropdown(false);
    }
  };

  const handleClear = () => {
    setLocalSearch('');
    onSearch('');
    setShowDropdown(false);
  };

  return (
    <>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <header style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: BLUE_DARK, height: 44, gap: 8, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
        <style>{`.ias-search::placeholder { color: rgba(255,255,255,.7); }`}</style>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="112" height="32" viewBox="0 0 112 32" fill="none">
            <circle cx="16" cy="16" r="4.5" fill="none" stroke="#fff" strokeWidth="1.8"/>
            <circle cx="16" cy="16" r="2" fill="#fff"/>
            <line x1="16" y1="11.5" x2="16" y2="5" stroke="#90caf9" strokeWidth="1.4"/>
            <line x1="16" y1="20.5" x2="16" y2="27" stroke="#90caf9" strokeWidth="1.4"/>
            <line x1="11.5" y1="16" x2="5" y2="16" stroke="#90caf9" strokeWidth="1.4"/>
            <line x1="20.5" y1="16" x2="27" y2="16" stroke="#90caf9" strokeWidth="1.4"/>
            <circle cx="16" cy="4" r="2.8" fill="#90caf9"/>
            <circle cx="16" cy="28" r="2.8" fill="#90caf9"/>
            <circle cx="4" cy="16" r="2.8" fill="#90caf9"/>
            <circle cx="28" cy="16" r="2.8" fill="#4caf50"/>
            <text x="34" y="21" fontFamily="Segoe UI,Arial,sans-serif" fontSize="15" fontWeight="800" fill="#fff" letterSpacing="-0.4">IAS</text>
            <rect x="62" y="8" width="34" height="16" rx="8" fill="rgba(255,255,255,0.22)"/>
            <text x="79" y="20.5" fontFamily="Segoe UI,Arial,sans-serif" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">Hub</text>
          </svg>
        </div>

        {/* Search with dropdown */}
        <div ref={searchRef} style={{ flex: 1, maxWidth: 400, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: localSearch ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.15)', borderRadius: 20, padding: '4px 12px', gap: 6, border: localSearch ? '1px solid rgba(255,255,255,.4)' : '1px solid transparent', transition: 'all .2s' }}>
            <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 13 }}>🔍</span>
            <input
              className="ias-search"
              type="text"
              value={localSearch}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => { if (localSearch.length >= 2) setShowDropdown(true); }}
              placeholder="Search channels, people, messages..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 12, width: '100%' }}
            />
            {localSearch && (
              <span onClick={handleClear} style={{ color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</span>
            )}
          </div>

          {showDropdown && (
            <SearchDropdown
              query={localSearch}
              onSelect={handleSelectResult}
              onClose={() => setShowDropdown(false)}
            />
          )}
        </div>

        {/* Ask IAS entry point */}
        <AskIASButton />

        {/* Connection status */}
        <ConnectionIndicator />

        {/* DND toggle */}
        <div title={dnd ? 'Do Not Disturb — ON (click to disable)' : 'Do Not Disturb'} onClick={toggleDnd}
          style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: dnd ? '#ff9800' : 'rgba(255,255,255,.85)', background: dnd ? 'rgba(255,152,0,.18)' : 'transparent', transition: 'all .15s', position: 'relative' }}
          onMouseEnter={e => { if (!dnd) e.currentTarget.style.background = 'rgba(255,255,255,.15)'; }}
          onMouseLeave={e => { if (!dnd) e.currentTarget.style.background = 'transparent'; }}>
          {dnd ? '🔕' : '🔔'}
        </div>

        {/* Notifications bell */}
        <Popup trigger={
          <div title="Notifications" style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: 'rgba(255,255,255,.85)', transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            📬
            {unreadNotifs > 0 && (
              <div style={{ position: 'absolute', top: 3, right: 3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#e53935', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${BLUE_DARK}` }}>
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </div>
            )}
          </div>
        }>
          {close => <NotifDropdown onClose={close} onUnreadChange={setUnreadNotifs} />}
        </Popup>

        {/* Profile chip */}
        <Popup trigger={
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '3px 10px 3px 4px', borderRadius: 20 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', position: 'relative', overflow: 'hidden', background: user?.avatar_url ? 'transparent' : 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : user?.name?.charAt(0)}
              {/* Corner indicator: custom emoji > status dot */}
              {user?.status_emoji ? (
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, boxShadow: '0 0 0 1.5px rgba(0,0,0,.1)' }}>
                  {user.status_emoji}
                </div>
              ) : (
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: statusColor, border: `2px solid ${BLUE_DARK}` }} />
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{user?.name}</span>
              <span style={{ fontSize: 10, color: autoStatus === 'focus' ? '#ffcc80' : autoStatus === 'in_call' ? '#a5d6a7' : 'rgba(255,255,255,.7)', fontWeight: autoStatus ? 600 : 400 }}>{statusLine}</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 10 }}>▾</span>
          </div>
        }>
          {close => <ProfileDropdown onClose={close} onOpenHelp={() => setShowHelp(true)} />}
        </Popup>
      </header>
    </>
  );
}

// Re-export SearchResult type
export type { SearchResult };
