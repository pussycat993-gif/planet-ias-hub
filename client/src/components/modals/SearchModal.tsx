import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── Types ──────────────────────────────────────────────────────
interface SearchUser {
  id: number; name: string; email: string; avatar_url?: string;
  role?: string; status?: string; status_message?: string; status_emoji?: string;
}

interface SearchChannel {
  id: number; name: string; type: string;
  description?: string; logo_color?: string; logo_abbr?: string; logo_url?: string;
}

interface SearchMessage {
  id: number;
  body: string | null;
  message_type: string;
  created_at: string;
  sender: { id: number; name: string; avatar_url: string | null } | null;
  channel: { id: number; name: string; type: string; logo_color?: string; logo_abbr?: string };
  file: { id: number; name: string; mime_type: string } | null;
}

interface SearchResults {
  messages: SearchMessage[];
  channels: SearchChannel[];
  users: SearchUser[];
}

// ── Helpers ────────────────────────────────────────────────────
function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24 && d.toDateString() === now.toDateString()) return `${diffHr}h ago`;
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'yesterday';
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Highlights the search substring inside a body preview.
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text || '';
  const q = query.trim();
  const re = new RegExp('(' + q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ background: '#fff59d', padding: '0 1px', borderRadius: 2, color: '#1a1a2e' }}>{p}</mark>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

// Excerpts a snippet of `text` centered on the first match of `q`. Keeps the
// result short so long messages don't blow up the result row, and adds an
// ellipsis when we trim from the start/end.
function snippet(text: string, q: string, radius = 60): string {
  if (!text) return '';
  if (!q.trim() || text.length <= radius * 2) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2) + '…';
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

// ── Small UI atoms ─────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 28 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (avatarUrl && !err) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <img src={avatarUrl} alt={name} onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: stringToColor(name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700 }}>
      {initials}
    </div>
  );
}

function ChannelLogo({ channel, size = 28 }: { channel: { name: string; type: string; logo_color?: string; logo_abbr?: string }; size?: number }) {
  if (channel.type === 'group') {
    return (
      <div style={{
        width: size, height: size, flexShrink: 0, borderRadius: 7,
        background: channel.logo_color || BLUE, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 800,
      }}>
        {channel.logo_abbr || channel.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, flexShrink: 0, borderRadius: '50%',
      background: '#e3f2fd', color: BLUE,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5,
    }}>
      {channel.type === 'dm' ? '💬' : '#'}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      padding: '10px 16px 4px',
      fontSize: 10, fontWeight: 700, color: '#888',
      textTransform: 'uppercase', letterSpacing: '.06em',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>{label}</span>
      <span style={{ background: '#eef2f6', color: '#555', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
        {count}
      </span>
    </div>
  );
}

// ── Filter pill & picker helpers ───────────────────────────────
function FilterPill({ active, onClick, onRemove, children }: {
  active?: boolean; onClick: () => void; onRemove?: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: active ? '4px 6px 4px 10px' : '4px 10px',
      borderRadius: 14,
      background: active ? '#e3f2fd' : '#f5f6f8',
      border: `1px solid ${active ? '#90caf9' : '#e0e4e9'}`,
      color: active ? BLUE_DARK : '#555',
      fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
      cursor: 'pointer', userSelect: 'none',
      transition: 'all .15s',
    }}>
      <span onClick={onClick}>{children}</span>
      {active && onRemove && (
        <span onClick={onRemove} style={{ color: '#888', fontSize: 12, marginLeft: 1, lineHeight: 1, padding: '0 2px' }}>✕</span>
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────
export default function SearchModal() {
  const { globalSearchOpen, closeGlobalSearch } = useUIStore();
  const { selectChannel, channels } = useChatStore();
  const { user } = useAuthStore();

  const [query, setQuery] = useState('');
  const [fromUser, setFromUser] = useState<SearchUser | null>(null);
  const [inChannel, setInChannel] = useState<SearchChannel | null>(null);
  const [hasFilter, setHasFilter] = useState<'file' | 'link' | null>(null);
  const [beforeDate, setBeforeDate] = useState('');
  const [afterDate, setAfterDate] = useState('');

  const [results, setResults] = useState<SearchResults>({ messages: [], channels: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<SearchUser[]>([]);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showInPicker, setShowInPicker] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fromPickerRef = useRef<HTMLDivElement>(null);
  const inPickerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autofocus input on open; reset state on close so next open is clean.
  useEffect(() => {
    if (globalSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setFromUser(null);
      setInChannel(null);
      setHasFilter(null);
      setBeforeDate('');
      setAfterDate('');
      setResults({ messages: [], channels: [], users: [] });
      setShowFromPicker(false);
      setShowInPicker(false);
    }
  }, [globalSearchOpen]);

  // Esc to close
  useEffect(() => {
    if (!globalSearchOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFromPicker) { setShowFromPicker(false); return; }
        if (showInPicker) { setShowInPicker(false); return; }
        closeGlobalSearch();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [globalSearchOpen, showFromPicker, showInPicker, closeGlobalSearch]);

  // Click-outside to close filter pickers
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (showFromPicker && fromPickerRef.current && !fromPickerRef.current.contains(e.target as Node)) {
        setShowFromPicker(false);
      }
      if (showInPicker && inPickerRef.current && !inPickerRef.current.contains(e.target as Node)) {
        setShowInPicker(false);
      }
    };
    if (showFromPicker || showInPicker) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showFromPicker, showInPicker]);

  // Fetch user directory once for the From-picker
  useEffect(() => {
    if (!globalSearchOpen || allUsers.length > 0) return;
    axios.get(`${API}/users`).then(r => setAllUsers(r.data.data || [])).catch(() => {});
  }, [globalSearchOpen, allUsers.length]);

  // Flatten all channels the user has access to, for the In-picker
  const allChannels: SearchChannel[] = useMemo(() => {
    const list: SearchChannel[] = [];
    channels.public.forEach(c => list.push({ id: c.id, name: c.name, type: c.type }));
    channels.private.forEach(c => list.push({ id: c.id, name: c.name, type: c.type }));
    channels.groups.forEach(c => list.push({
      id: c.id, name: c.name, type: c.type, logo_color: c.logo_color, logo_abbr: c.logo_abbr,
    }));
    channels.dms.forEach(c => list.push({
      id: c.id, name: c.other_user?.name || c.name, type: c.type,
    }));
    return list;
  }, [channels]);

  // Debounced search fire
  const runSearch = useCallback(async () => {
    const hasCriteria = query.trim() || fromUser || inChannel || hasFilter;
    if (!hasCriteria) {
      setResults({ messages: [], channels: [], users: [] });
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (fromUser)    params.set('from', String(fromUser.id));
      if (inChannel)   params.set('channel', String(inChannel.id));
      if (hasFilter)   params.set('has', hasFilter);
      if (beforeDate)  params.set('before', new Date(beforeDate).toISOString());
      if (afterDate)   params.set('after',  new Date(afterDate).toISOString());

      const { data } = await axios.get(`${API}/search?${params.toString()}`);
      setResults(data.data || { messages: [], channels: [], users: [] });
    } catch (err) {
      console.error('Search error:', err);
    }
    setLoading(false);
  }, [query, fromUser, inChannel, hasFilter, beforeDate, afterDate]);

  useEffect(() => {
    if (!globalSearchOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSearch, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [runSearch, globalSearchOpen]);

  // ── Result navigation ────────────────────────────────────────
  const jumpToMessage = (channelId: number, messageId: number) => {
    selectChannel(channelId);
    setTimeout(() => useUIStore.getState().jumpToMessage(messageId), 300);
    closeGlobalSearch();
  };

  const jumpToChannel = (channelId: number) => {
    selectChannel(channelId);
    closeGlobalSearch();
  };

  const clearAllFilters = () => {
    setFromUser(null); setInChannel(null); setHasFilter(null);
    setBeforeDate(''); setAfterDate('');
  };

  if (!globalSearchOpen) return null;

  const hasAnyFilter = !!(fromUser || inChannel || hasFilter || beforeDate || afterDate);
  const totalResults = results.messages.length + results.channels.length + results.users.length;

  return (
    <div
      onClick={closeGlobalSearch}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        zIndex: 3500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '8vh',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, width: 680, maxWidth: '92vw', maxHeight: '84vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        fontFamily: 'Segoe UI, Arial, sans-serif', overflow: 'hidden',
      }}>

        {/* Search input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontSize: 18, color: '#888' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search messages, files, people, channels…"
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 16,
              color: '#1a1a2e', fontFamily: 'inherit', background: 'transparent',
            }}
          />
          <span style={{
            display: 'inline-flex', gap: 3, alignItems: 'center', marginRight: 8,
          }}>
            <kbd style={kbdStyle}>Esc</kbd>
            <span style={{ fontSize: 10, color: '#aaa' }}>to close</span>
          </span>
          <span onClick={closeGlobalSearch} style={{
            cursor: 'pointer', color: '#888', fontSize: 18, lineHeight: 1, padding: '0 4px',
          }}>✕</span>
        </div>

        {/* Filter pills row */}
        <div style={{ padding: '10px 16px 10px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 4 }}>Filters:</span>

          {/* From filter */}
          <div ref={fromPickerRef} style={{ position: 'relative' }}>
            <FilterPill
              active={!!fromUser}
              onClick={() => setShowFromPicker(s => !s)}
              onRemove={fromUser ? () => setFromUser(null) : undefined}
            >
              {fromUser ? <>From: <strong>{fromUser.name}</strong></> : '+ From'}
            </FilterPill>
            {showFromPicker && (
              <PickerDropdown>
                <UserPickerList
                  users={allUsers}
                  currentUserId={user?.id}
                  onSelect={u => { setFromUser(u); setShowFromPicker(false); }}
                />
              </PickerDropdown>
            )}
          </div>

          {/* In channel filter */}
          <div ref={inPickerRef} style={{ position: 'relative' }}>
            <FilterPill
              active={!!inChannel}
              onClick={() => setShowInPicker(s => !s)}
              onRemove={inChannel ? () => setInChannel(null) : undefined}
            >
              {inChannel ? <>In: <strong>{inChannel.type === 'dm' ? '@' + inChannel.name : inChannel.type === 'group' ? inChannel.name : '#' + inChannel.name}</strong></> : '+ In'}
            </FilterPill>
            {showInPicker && (
              <PickerDropdown>
                <ChannelPickerList
                  channels={allChannels}
                  onSelect={c => { setInChannel(c); setShowInPicker(false); }}
                />
              </PickerDropdown>
            )}
          </div>

          {/* Has filter — toggle group */}
          <FilterPill
            active={hasFilter === 'file'}
            onClick={() => setHasFilter(h => (h === 'file' ? null : 'file'))}
            onRemove={hasFilter === 'file' ? () => setHasFilter(null) : undefined}
          >
            📎 Has file
          </FilterPill>
          <FilterPill
            active={hasFilter === 'link'}
            onClick={() => setHasFilter(h => (h === 'link' ? null : 'link'))}
            onRemove={hasFilter === 'link' ? () => setHasFilter(null) : undefined}
          >
            🔗 Has link
          </FilterPill>

          {/* Date range (inline) */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' }}>
            After:
            <input type="date" value={afterDate} onChange={e => setAfterDate(e.target.value)}
              style={dateInputStyle} />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' }}>
            Before:
            <input type="date" value={beforeDate} onChange={e => setBeforeDate(e.target.value)}
              style={dateInputStyle} />
          </label>

          {hasAnyFilter && (
            <span onClick={clearAllFilters} style={{ marginLeft: 'auto', fontSize: 11, color: '#c62828', cursor: 'pointer', fontWeight: 600 }}>
              Clear all
            </span>
          )}
        </div>

        {/* Results area */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading && (
            <div style={{ padding: '30px', textAlign: 'center', color: '#888', fontSize: 13 }}>
              Searching…
            </div>
          )}

          {!loading && totalResults === 0 && (query.trim() || hasAnyFilter) && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>No results</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Try different keywords or remove some filters.</div>
            </div>
          )}

          {!loading && totalResults === 0 && !query.trim() && !hasAnyFilter && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>Search your workspace</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Messages, files, channels, and people — filter by who sent it, where, and when.
              </div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 12 }}>
                Tip: press <kbd style={kbdStyle}>Cmd</kbd>+<kbd style={kbdStyle}>Shift</kbd>+<kbd style={kbdStyle}>F</kbd> to open this from anywhere.
              </div>
            </div>
          )}

          {!loading && results.messages.length > 0 && (
            <>
              <SectionHeader label="Messages" count={results.messages.length} />
              {results.messages.map(m => (
                <div key={m.id} onClick={() => jumpToMessage(m.channel.id, m.id)}
                  style={{ display: 'flex', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  {m.sender ? <Avatar name={m.sender.name} avatarUrl={m.sender.avatar_url} /> : <div style={{ width: 28, height: 28, background: '#eee', borderRadius: '50%' }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#1a1a2e' }}>{m.sender?.name || 'System'}</span>
                      <span style={{ color: '#888' }}>in</span>
                      <span style={{ color: BLUE, fontWeight: 500 }}>
                        {m.channel.type === 'dm' ? '💬 DM'
                          : m.channel.type === 'group' ? m.channel.name
                          : '#' + m.channel.name}
                      </span>
                      <span style={{ color: '#bbb', marginLeft: 'auto', fontSize: 10 }}>{formatRelative(m.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#444', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {m.message_type === 'file' && m.file
                        ? <span><span style={{ marginRight: 4 }}>📎</span>{m.file.name}</span>
                        : highlight(snippet(m.body || '', query), query)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!loading && results.channels.length > 0 && (
            <>
              <SectionHeader label="Channels & Groups" count={results.channels.length} />
              {results.channels.map(c => (
                <div key={c.id} onClick={() => jumpToChannel(c.id)}
                  style={{ display: 'flex', gap: 10, padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <ChannelLogo channel={c} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                      {c.type === 'group' ? c.name : '#' + c.name}
                    </div>
                    {c.description && (
                      <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.description}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#bbb' }}>
                    {c.type === 'group' ? 'Group' : c.type === 'private' ? 'Private' : 'Channel'}
                  </span>
                </div>
              ))}
            </>
          )}

          {!loading && results.users.length > 0 && (
            <>
              <SectionHeader label="People" count={results.users.length} />
              {results.users.map(u => (
                <div key={u.id}
                  style={{ display: 'flex', gap: 10, padding: '8px 16px', cursor: 'default', borderBottom: '1px solid #f5f5f5', alignItems: 'center' }}>
                  <Avatar name={u.name} avatarUrl={u.avatar_url} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                      {u.status_emoji && <span>{u.status_emoji}</span>}
                      <span>{u.name}</span>
                      {u.role && <span style={{ fontSize: 10, color: '#888', fontWeight: 400 }}>· {u.role}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
                  </div>
                  <span style={{ fontSize: 10, color: u.status === 'online' ? '#4caf50' : '#bbb' }}>
                    ● {u.status || 'offline'}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Picker dropdown wrapper ─────────────────────────────────────
function PickerDropdown({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10,
      background: '#fff', border: '1px solid #dde1e7', borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,.15)', width: 260, maxHeight: 280, overflowY: 'auto',
    }}>
      {children}
    </div>
  );
}

// ── User picker list ─────────────────────────────────────────────
function UserPickerList({ users, currentUserId, onSelect }: {
  users: SearchUser[]; currentUserId?: number; onSelect: (u: SearchUser) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() =>
    users
      .filter(u => u.id !== currentUserId)
      .filter(u => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 20),
    [users, currentUserId, q]
  );
  return (
    <>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Filter people…"
          style={{ width: '100%', padding: '6px 9px', border: '1px solid #dde1e7', borderRadius: 6, outline: 'none', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
      <div>
        {filtered.length === 0 ? (
          <div style={{ padding: 12, color: '#aaa', fontSize: 12, textAlign: 'center' }}>No matches</div>
        ) : filtered.map(u => (
          <div key={u.id} onClick={() => onSelect(u)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <Avatar name={u.name} avatarUrl={u.avatar_url} size={24} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{u.name}</div>
              <div style={{ fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Channel picker list ──────────────────────────────────────────
function ChannelPickerList({ channels, onSelect }: {
  channels: SearchChannel[]; onSelect: (c: SearchChannel) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() =>
    channels.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30),
    [channels, q]
  );
  return (
    <>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Filter channels…"
          style={{ width: '100%', padding: '6px 9px', border: '1px solid #dde1e7', borderRadius: 6, outline: 'none', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
      <div>
        {filtered.length === 0 ? (
          <div style={{ padding: 12, color: '#aaa', fontSize: 12, textAlign: 'center' }}>No matches</div>
        ) : filtered.map(c => (
          <div key={c.id} onClick={() => onSelect(c)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <ChannelLogo channel={c} size={22} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.type === 'group' ? c.name : c.type === 'dm' ? '@' + c.name : '#' + c.name}
            </span>
            <span style={{ fontSize: 9, color: '#aaa' }}>{c.type}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Shared styles ────────────────────────────────────────────────
const kbdStyle: React.CSSProperties = {
  display: 'inline-block', padding: '1px 5px',
  fontSize: 9, fontFamily: 'inherit', fontWeight: 600,
  background: '#f3f4f6', border: '1px solid #dde1e7', borderRadius: 3,
  color: '#666', lineHeight: 1.4,
};

const dateInputStyle: React.CSSProperties = {
  border: '1px solid #dde1e7', borderRadius: 6, padding: '3px 7px',
  fontSize: 11, fontFamily: 'inherit', outline: 'none', background: '#fff',
  color: '#555',
};
