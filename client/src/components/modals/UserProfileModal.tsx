import React from 'react';

interface UserProfileModalProps {
  user: { id: number; name: string; email?: string; role?: string; avatar_url?: string; status?: string; };
  onClose: () => void;
  onMessage?: () => void;
}

function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function UserProfileModal({ user, onClose, onMessage }: UserProfileModalProps) {
  const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const statusColor = user.status === 'online' ? '#4caf50' : user.status === 'away' ? '#ff9800' : '#bbb';
  const statusLabel = user.status === 'online' ? '● Online' : user.status === 'away' ? '● Away' : '● Offline';
  const BLUE = '#1976d2';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 300, boxShadow: '0 8px 40px rgba(0,0,0,.2)', fontFamily: 'Segoe UI, Arial, sans-serif', overflow: 'hidden' }}>

        {/* Banner */}
        <div style={{ height: 70, background: `linear-gradient(135deg, ${stringToColor(user.name)}, ${BLUE})`, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 10, background: 'rgba(0,0,0,.2)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: -36 }}>
          <div style={{ position: 'relative' }}>
            {user.avatar_url ? (
              <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
                <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: stringToColor(user.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#fff', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
                {initials}
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: statusColor, border: '2.5px solid #fff' }} />
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '12px 20px 16px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 2 }}>{user.name}</div>
          {user.role && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{user.role}</div>}
          <div style={{ fontSize: 11, color: statusColor, marginBottom: 12 }}>{statusLabel}</div>

          {user.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', background: '#f8f9fa', borderRadius: 8, marginBottom: 8, textAlign: 'left' }}>
              <span style={{ fontSize: 14 }}>📧</span>
              <a href={`mailto:${user.email}`} style={{ fontSize: 12, color: BLUE, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</a>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={onMessage} style={{ flex: 1, padding: '8px', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
              💬 Message
            </button>
            <button style={{ flex: 1, padding: '8px', background: '#fff', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              📞 Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
