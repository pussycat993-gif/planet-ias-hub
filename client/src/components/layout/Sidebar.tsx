import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useChatStore, Channel } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useFavorites } from '../../hooks/useFavorites';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── Channel avatar ────────────────────────────────────────
function ChannelAvatar({ ch }: { ch: Channel }) {
  if (ch.type === 'dm' && ch.other_user) {
    const u = ch.other_user;
    const dotColor = u.status === 'online' ? '#4caf50' : u.status === 'away' ? '#ff9800' : '#bbb';
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {u.avatar_url ? (
          <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden' }}>
            <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
            {u.name.charAt(0)}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: dotColor, border: '1.5px solid #fff' }} />
      </div>
    );
  }
  if (ch.logo_url) {
    return <div style={{ width: 24, height: 24, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}><img src={ch.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  }
  if (ch.type === 'group') {
    const bg = ch.logo_color || BLUE;
    const abbr = ch.logo_abbr || ch.name.slice(0, 2).toUpperCase();
    return <div style={{ width: 24, height: 24, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{abbr}</div>;
  }
  return <span style={{ color: '#aaa', fontSize: 14, width: 24, textAlign: 'center', flexShrink: 0 }}>#</span>;
}

// ── Channel row ───────────────────────────────────────────
function ChannelRow({ ch, isSelected, isFav, onClick, onToggleFav }: {
  ch: Channel; isSelected: boolean; isFav: boolean;
  onClick: () => void; onToggleFav: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const displayName = ch.type === 'dm' ? ch.other_user?.name : ch.name;

  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', padding: '5px 8px 5px 10px', cursor: 'pointer', gap: 7, borderRadius: 6, margin: '1px 5px', background: isSelected ? '#e3f2fd' : hovered ? '#f0f7ff' : 'transparent', borderLeft: isSelected ? `3px solid ${BLUE}` : '3px solid transparent', paddingLeft: isSelected ? 7 : 10, transition: 'all .12s' }}>
      <ChannelAvatar ch={ch} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: isSelected ? BLUE : '#1a1a2e', fontWeight: isSelected || (ch.unread_count || 0) > 0 ? 700 : 400 }}>
        {displayName}
      </span>
      {(ch.unread_count || 0) > 0 && (
        <span style={{ background: '#e53935', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700, flexShrink: 0 }}>{ch.unread_count}</span>
      )}
      {(hovered || isFav) && (
        <span onClick={onToggleFav} style={{ fontSize: 13, cursor: 'pointer', color: isFav ? '#f9a825' : '#ccc', flexShrink: 0, lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f9a825')}
          onMouseLeave={e => (e.currentTarget.style.color = isFav ? '#f9a825' : '#ccc')}>★</span>
      )}
    </div>
  );
}

function SectionHeader({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div style={{ padding: '8px 10px 3px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{label}</span>
      {onAdd && <span onClick={onAdd} style={{ cursor: 'pointer', fontSize: 16, color: '#bbb' }} onMouseEnter={e => (e.currentTarget.style.color = BLUE)} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>+</span>}
    </div>
  );
}

// ── Dummy call history ────────────────────────────────────
const DUMMY_CALLS = [
  { id: 1, name: 'Staša Bugarski',   type: 'video', duration: 2820, minsAgo: 90,   missed: false },
  { id: 2, name: 'Dean Bedford',     type: 'video', duration: 5400, minsAgo: 200,  missed: false },
  { id: 3, name: 'Fedor Drmanović',  type: 'audio', duration: 0,    minsAgo: 480,  missed: true  },
  { id: 4, name: 'Peđa Jovanović',   type: 'audio', duration: 1260, minsAgo: 1440, missed: false },
  { id: 5, name: 'Veselko Pešut',    type: 'video', duration: 3300, minsAgo: 3060, missed: false },
  { id: 6, name: 'Workgroup Team',   type: 'video', duration: 4200, minsAgo: 4320, missed: false },
  { id: 7, name: 'Dušan Mandić',     type: 'video', duration: 2700, minsAgo: 7360, missed: false },
  { id: 8, name: 'Staša Bugarski',   type: 'audio', duration: 840,  minsAgo: 9000, missed: false },
];

function fmtDuration(secs: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtAgo(mins: number): string {
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function CallHistoryList() {
  return (
    <div>
      <SectionHeader label="Recent Calls" />
      {DUMMY_CALLS.map(call => (
        <div key={call.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, margin: '1px 5px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: stringToColor(call.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {call.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: call.missed ? '#c62828' : '#1a1a2e' }}>
              {call.missed && '↗ '}{call.name}
            </div>
            <div style={{ fontSize: 10, color: '#888' }}>
              {call.type === 'video' ? '📹' : '📞'} {call.missed ? 'Missed' : fmtDuration(call.duration)} · {fmtAgo(call.minsAgo)}
            </div>
          </div>
          <span style={{ fontSize: 14, cursor: 'pointer', color: '#bbb' }} title="Call back"
            onMouseEnter={e => (e.currentTarget.style.color = '#2e7d32')}
            onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>
            {call.type === 'video' ? '📹' : '📞'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Global files list (Files tab) ──────────────────────
// Lists all uploaded files across channels the user has access to.
interface GlobalFile {
  id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  basename: string;
  uploader: { id: number; name: string; avatar_url?: string } | null;
  channel: { id: number; name: string; type: string; logo_color?: string; logo_abbr?: string };
}

function fileIcon(name: string, mime?: string): string {
  if (mime?.startsWith('image/')) return '🖼️';
  if (mime?.startsWith('video/')) return '🎬';
  if (mime?.startsWith('audio/')) return '🎙️';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
    sql: '🗄️', md: '📋', txt: '📋', fig: '🎨', zip: '🗜️',
    webm: '🎙️', ogg: '🎙️', mp3: '🎙️', wav: '🎙️', m4a: '🎙️',
    mp4: '🎬', mov: '🎬',
  };
  return map[ext] || '📎';
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtAgoShort(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / 1440);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type FileFilterType = 'all' | 'images' | 'docs' | 'media';

function matchesType(f: GlobalFile, filter: FileFilterType): boolean {
  if (filter === 'all') return true;
  const mime = f.mime_type || '';
  const ext = f.file_name.split('.').pop()?.toLowerCase() || '';
  if (filter === 'images') return mime.startsWith('image/') || /^(png|jpe?g|gif|webp)$/.test(ext);
  if (filter === 'media')  return mime.startsWith('audio/') || mime.startsWith('video/') || /^(webm|ogg|mp3|wav|m4a|mp4|mov|mkv)$/.test(ext);
  if (filter === 'docs')   return /^(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|csv|sql)$/.test(ext);
  return true;
}

function GlobalFilesList() {
  const { selectChannel } = useChatStore();
  const [files, setFiles] = useState<GlobalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileFilterType>('all');

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/files/all?limit=100`)
      .then(r => setFiles(r.data.data || []))
      .catch(err => console.error('Fetch files error:', err))
      .finally(() => setLoading(false));
  }, []);

  const API_ROOT = API.replace(/\/api$/, '');

  const filtered = files
    .filter(f => matchesType(f, typeFilter))
    .filter(f => !search.trim() || f.file_name.toLowerCase().includes(search.trim().toLowerCase()));

  const FILTER_CHIPS: { key: FileFilterType; label: string }[] = [
    { key: 'all',    label: 'All' },
    { key: 'images', label: '🖼 Images' },
    { key: 'docs',   label: '📄 Docs' },
    { key: 'media',  label: '🎬 Media' },
  ];

  return (
    <div>
      {/* Search */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f5f6f8', borderRadius: 8, padding: '4px 9px', border: '1px solid #eee' }}>
          <span style={{ color: '#bbb', fontSize: 12 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, flex: 1, color: '#1a1a2e', fontFamily: 'inherit' }}
          />
          {search && <span onClick={() => setSearch('')} style={{ color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</span>}
        </div>
      </div>

      {/* Type filter chips */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
        {FILTER_CHIPS.map(c => (
          <span key={c.key} onClick={() => setTypeFilter(c.key)}
            style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 10, cursor: 'pointer',
              background: typeFilter === c.key ? BLUE : '#f5f6f8',
              color: typeFilter === c.key ? '#fff' : '#555',
              fontWeight: typeFilter === c.key ? 700 : 500,
              border: `1px solid ${typeFilter === c.key ? BLUE : '#eee'}`,
              transition: 'all .12s',
            }}>
            {c.label}
          </span>
        ))}
      </div>

      {/* File list */}
      {loading ? (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>Loading files…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '20px 12px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
          {search ? 'No files match your search' : 'No files yet'}
        </div>
      ) : (
        <div>
          <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {filtered.length} {filtered.length === 1 ? 'file' : 'files'}
          </div>
          {filtered.map(f => {
            const streamUrl = `${API_ROOT}/uploads/${f.basename}`;
            const downloadUrl = `${API_ROOT}/api/files/${f.id}/download`;
            const isImage = f.mime_type?.startsWith('image/');
            return (
              <div key={f.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => selectChannel(f.channel.id)}>
                {isImage ? (
                  <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#f5f5f5' }}>
                    <img src={streamUrl} alt={f.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <span style={{ fontSize: 22, flexShrink: 0, width: 32, textAlign: 'center' }}>
                    {fileIcon(f.file_name, f.mime_type)}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: BLUE_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.file_name}
                  </div>
                  <div style={{ fontSize: 9, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fmtBytes(f.file_size)} · {f.uploader?.name || 'Unknown'} · {fmtAgoShort(f.created_at)}
                  </div>
                  <div style={{ fontSize: 9, color: BLUE, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.channel.type === 'group' ? f.channel.name : `#${f.channel.name}`}
                  </div>
                </div>
                <a href={downloadUrl} download={f.file_name}
                  onClick={e => e.stopPropagation()}
                  title="Download"
                  style={{ fontSize: 12, color: '#bbb', textDecoration: 'none', padding: '2px 4px', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
                  onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>⬇</a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────
export default function Sidebar() {
  const { channels, activeChannelId, selectChannel } = useChatStore();
  const { user, logout } = useAuthStore();
  const { myStatus, myStatusMessage, openModal, mainTab, showUnreadOnly, toggleShowUnreadOnly } = useUIStore();
  const { favs, toggle: toggleFav } = useFavorites();

  const [search, setSearch] = useState('');

  const statusColor = myStatus === 'online' ? '#4caf50' : myStatus === 'away' ? '#ff9800' : '#bbb';
  const statusLabel = myStatus === 'online' ? '● Online' : myStatus === 'away' ? '● Away' : '● Offline';

  const allChannels = [...channels.public, ...channels.private, ...channels.groups, ...channels.dms];
  const favorites = allChannels.filter(ch => favs.includes(ch.id));
  const totalUnread = allChannels.reduce((sum, ch) => sum + (ch.unread_count || 0), 0);

  const filterCh = (list: Channel[]) => {
    let out = list;
    if (search) {
      out = out.filter(ch => {
        const name = ch.type === 'dm' ? ch.other_user?.name : ch.name;
        return name?.toLowerCase().includes(search.toLowerCase());
      });
    }
    if (showUnreadOnly) {
      out = out.filter(ch => (ch.unread_count || 0) > 0 || ch.id === activeChannelId);
    }
    return out;
  };

  const renderRow = (ch: Channel) => (
    <ChannelRow key={ch.id} ch={ch} isSelected={activeChannelId === ch.id} isFav={favs.includes(ch.id)}
      onClick={() => selectChannel(ch.id)}
      onToggleFav={e => { e.stopPropagation(); toggleFav(ch.id); }}
    />
  );

  const headerLabels: Record<string, string> = { all: 'All', dms: 'Messages', calls: 'Calls', files: 'Files' };
  const headerAdd: Record<string, (() => void) | undefined> = {
    all: () => openModal('newChannel'),
    dms: () => openModal('newMessage'),
  };

  return (
    <div style={{ width: 230, borderRight: '1px solid #dde1e7', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ background: BLUE, color: '#fff', padding: '5px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{headerLabels[mainTab] || 'All'}</span>
        {headerAdd[mainTab] && (
          <div onClick={headerAdd[mainTab]} style={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>+</div>
        )}
      </div>

      {/* Search */}
      {mainTab !== 'calls' && mainTab !== 'files' && (
        <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f5f6f8', borderRadius: 8, padding: '4px 9px', border: '1px solid #eee' }}>
            <span style={{ color: '#bbb', fontSize: 12 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, flex: 1, color: '#1a1a2e', fontFamily: 'inherit' }}
            />
            {search && <span onClick={() => setSearch('')} style={{ color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</span>}
          </div>

          {/* Unread-only filter toggle */}
          <div onClick={toggleShowUnreadOnly}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 6, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
              background: showUnreadOnly ? '#e3f2fd' : 'transparent',
              border: `1px solid ${showUnreadOnly ? '#90caf9' : 'transparent'}`,
              transition: 'all .12s',
            }}
            onMouseEnter={e => { if (!showUnreadOnly) e.currentTarget.style.background = '#f5f6f8'; }}
            onMouseLeave={e => { if (!showUnreadOnly) e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: showUnreadOnly ? BLUE_DARK : '#666', fontWeight: showUnreadOnly ? 600 : 400 }}>
              <span style={{ fontSize: 12 }}>{showUnreadOnly ? '●' : '○'}</span>
              Unread only
            </span>
            {totalUnread > 0 && (
              <span style={{
                fontSize: 9, background: showUnreadOnly ? BLUE : '#e53935', color: '#fff',
                padding: '1px 5px', borderRadius: 7, fontWeight: 700,
              }}>
                {totalUnread}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ALL TAB */}
        {mainTab === 'all' && (
          <>
            {favorites.length > 0 && (
              <>
                <SectionHeader label="⭐ Favorites" />
                {filterCh(favorites).map(renderRow)}
              </>
            )}
            {filterCh(channels.groups).length > 0 && (
              <>
                <SectionHeader label="Groups" onAdd={() => openModal('newGroup')} />
                {filterCh(channels.groups).map(renderRow)}
              </>
            )}
            {filterCh(channels.public).length > 0 && (
              <>
                <SectionHeader label="Channels" onAdd={() => openModal('newChannel')} />
                {filterCh(channels.public).map(renderRow)}
              </>
            )}
            {filterCh(channels.private).length > 0 && (
              <>
                <SectionHeader label="Private" onAdd={() => openModal('newChannel')} />
                {filterCh(channels.private).map(renderRow)}
              </>
            )}
            {allChannels.length === 0 && (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
                No channels yet.
                <div onClick={() => openModal('newChannel')} style={{ color: BLUE, cursor: 'pointer', marginTop: 6 }}>+ Create one</div>
              </div>
            )}
          </>
        )}

        {/* DMS TAB */}
        {mainTab === 'dms' && (
          <>
            {filterCh(favorites.filter(ch => ch.type === 'dm')).length > 0 && (
              <>
                <SectionHeader label="⭐ Favorites" />
                {filterCh(favorites.filter(ch => ch.type === 'dm')).map(renderRow)}
              </>
            )}
            {filterCh(channels.dms).length > 0 ? (
              <>
                <SectionHeader label="All Messages" onAdd={() => openModal('newMessage')} />
                {filterCh(channels.dms).map(renderRow)}
              </>
            ) : (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
                {search ? 'No results' : 'No direct messages'}
                {!search && <div onClick={() => openModal('newMessage')} style={{ color: BLUE, cursor: 'pointer', marginTop: 6 }}>+ New Message</div>}
              </div>
            )}
          </>
        )}

        {/* CALLS TAB */}
        {mainTab === 'calls' && <CallHistoryList />}

        {/* FILES TAB */}
        {mainTab === 'files' && <GlobalFilesList />}
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 10px', borderTop: '1px solid #dde1e7', display: 'flex', alignItems: 'center', gap: 7 }}>
        {/* User avatar */}
        {user?.avatar_url ? (
          <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {user?.name?.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: statusColor }}>{myStatusMessage || statusLabel}</div>
        </div>

        {/* Logout */}
        <span style={{ cursor: 'pointer', color: '#bbb', fontSize: 14 }} title="Logout" onClick={logout}>⎋</span>
      </div>
    </div>
  );
}
