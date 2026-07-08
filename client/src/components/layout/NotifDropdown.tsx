import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useChatStore } from '../../store/chatStore';
import Icon, { type IconName } from '@/components/ui/Icon';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = 'var(--blue-primary)';

export interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  channel_id?: number;
}

export const NOTIF_ICONS: Record<string, IconName> = {
  message: 'message',
  meeting: 'calendar',
  dwm: 'refresh',
  automation: 'zap',
  call_missed: 'phone-missed',
};

interface NotifDropdownProps {
  onClose: () => void;
  onUnreadChange: (n: number) => void;
}

export default function NotifDropdown({ onClose, onUnreadChange }: NotifDropdownProps) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectChannel } = useChatStore();

  useEffect(() => {
    axios.get(`${API}/notifications?limit=20`)
      .then(r => { setNotifs(r.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  const markAll = async () => {
    await axios.post(`${API}/notifications/read-all`).catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    onUnreadChange(0);
  };

  const handleClick = (n: Notif) => {
    if (!n.read) axios.post(`${API}/notifications/${n.id}/read`).catch(() => {});
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    onUnreadChange(Math.max(0, unread - 1));
    if (n.channel_id) selectChannel(n.channel_id);
    onClose();
  };

  return (
    <div style={{ width: 320, background: 'var(--surface)', borderRadius: 10, boxShadow: '0 6px 30px rgba(0,0,0,.18)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          Notifications {unread > 0 && <span style={{ background: BLUE, color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 5 }}>{unread}</span>}
        </span>
        {unread > 0 && <span onClick={markAll} style={{ fontSize: 11, color: BLUE, cursor: 'pointer' }}>Mark all read</span>}
      </div>
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading...</div>
        ) : notifs.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ marginBottom: 6 }}><Icon name="bell" size={26} /></div>
            <div style={{ fontSize: 12 }}>No notifications yet</div>
          </div>
        ) : notifs.map(n => (
          <div key={n.id} onClick={() => handleClick(n)}
            style={{ display: 'flex', gap: 9, padding: '9px 14px', borderBottom: '1px solid var(--neutral-light-active)', cursor: 'pointer', background: n.read ? 'var(--surface)' : 'var(--blue-xlight)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-xlight)')}
            onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'var(--surface)' : 'var(--blue-xlight)')}>
            <span style={{ flexShrink: 0, display: 'inline-flex' }}><Icon name={NOTIF_ICONS[n.type] || 'bell'} size={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: n.read ? 400 : 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{new Date(n.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE, flexShrink: 0, marginTop: 4 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
