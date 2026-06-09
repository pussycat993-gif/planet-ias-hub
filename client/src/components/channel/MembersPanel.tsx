import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, X } from '@/components/ui/Icon';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = 'var(--blue-primary)';
const BLUE_DARK = 'var(--blue-dark)';

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  status?: string;
}

function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function statusDot(status?: string) {
  const color = status === 'online' ? '#4caf50' : status === 'away' ? '#ff9800' : '#bbb';
  return <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, border: '1.5px solid var(--surface)', flexShrink: 0 }} />;
}

interface MemberRowProps {
  m: Member;
  onMessageUser?: (userId: number) => void;
}

function MemberRow({ m, onMessageUser }: MemberRowProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--neutral-light-active)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-xlight)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {m.avatar_url && !imgError ? (
          <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden' }}>
            <img src={m.avatar_url} alt={m.name} onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
          </div>
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: stringToColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: -1, right: -1 }}>
          {statusDot(m.status)}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.role || m.email}</div>
      </div>

      <div style={{ fontSize: 10, color: m.status === 'online' ? '#4caf50' : m.status === 'away' ? '#ff9800' : '#bbb', flexShrink: 0, fontWeight: 600 }}>
        {m.status === 'online' ? 'Online' : m.status === 'away' ? 'Away' : 'Offline'}
      </div>

      {onMessageUser && (
        <div onClick={e => { e.stopPropagation(); onMessageUser(m.id); }}
          style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, flexShrink: 0 }}
          title="Send message"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--blue-xlight)'; e.currentTarget.style.color = BLUE; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)'; }}>
          💬
        </div>
      )}
    </div>
  );
}

interface Props {
  channelId: number;
  onClose: () => void;
  onMessageUser?: (userId: number) => void;
}

export default function MembersPanel({ channelId, onClose, onMessageUser }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get(`${API}/channels/${channelId}/members`)
      .then(r => setMembers(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId]);

  const online  = members.filter(m => m.status === 'online');
  const away    = members.filter(m => m.status === 'away');
  const offline = members.filter(m => !m.status || m.status === 'offline');

  const filtered = search
    ? members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.role?.toLowerCase().includes(search.toLowerCase()))
    : null;

  const renderSection = (label: string, list: Member[], color: string) => {
    if (list.length === 0) return null;
    return (
      <>
        <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
          {label} — {list.length}
        </div>
        {list.map(m => <MemberRow key={m.id} m={m} onMessageUser={onMessageUser} />)}
      </>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 2500, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 320, background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,.15)', fontFamily: 'var(--font-sans)', animation: 'slideIn .2s ease' }}>

        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: BLUE_DARK }}>Members</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{members.length} total · {online.length} online</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'inline-flex' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--neutral-light-active)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--grey-light)', borderRadius: 8, padding: '5px 10px', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text3)', display: 'inline-flex' }}><Search size={14} /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, flex: 1, fontFamily: 'inherit', color: 'var(--text)' }} />
            {search && <span onClick={() => setSearch('')} style={{ color: 'var(--text3)', cursor: 'pointer', display: 'inline-flex' }}><X size={14} /></span>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading members...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No members found</div>
          ) : filtered ? (
            filtered.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No results</div>
              : filtered.map(m => <MemberRow key={m.id} m={m} onMessageUser={onMessageUser} />)
          ) : (
            <>
              {renderSection('Online', online, '#4caf50')}
              {renderSection('Away', away, '#ff9800')}
              {renderSection('Offline', offline, '#bbb')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
