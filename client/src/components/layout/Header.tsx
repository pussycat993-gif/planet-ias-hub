import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

const BLUE_DARK = '#1565c0';

export default function Header() {
  const { user } = useAuthStore();
  const { myStatus, myStatusMessage, openModal, toggleAIPanel } = useUIStore();

  const statusColors = { online: '#4caf50', away: '#ff9800', offline: '#bbb' };
  const statusLabels = { online: '● Online', away: '● Away', offline: '● Offline' };

  return (
    <header style={{
      display: 'flex', alignItems: 'center', padding: '0 14px',
      background: BLUE_DARK, height: 44, gap: 10, flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,.2)',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
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

      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 320, margin: '0 auto', display: 'flex',
        alignItems: 'center', background: 'rgba(255,255,255,.15)',
        borderRadius: 20, padding: '4px 12px', gap: 6,
      }}>
        <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>🔍</span>
        <input
          type="text"
          placeholder="Search messages, people, files..."
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: 12, width: '100%',
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {[
          { icon: '📞', title: 'Audio Call' },
          { icon: '📹', title: 'Video Call' },
          { icon: '🤖', title: 'AI Assistant', onClick: toggleAIPanel },
          { icon: '🔔', title: 'Notifications' },
        ].map(({ icon, title, onClick }) => (
          <div key={title} title={title} onClick={onClick} style={{
            width: 34, height: 34, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 15, color: 'rgba(255,255,255,.85)',
            transition: 'background .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {icon}
          </div>
        ))}
      </div>

      {/* User chip */}
      <div
        onClick={() => openModal('setStatus')}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
          padding: '3px 10px 3px 4px', borderRadius: 20,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{
          width: 30, height: 30, borderRadius: '50%', position: 'relative',
          background: user?.avatar_url ? 'transparent' : 'rgba(255,255,255,.25)',
          backgroundImage: user?.avatar_url ? `url(${user.avatar_url})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>
          {!user?.avatar_url && user?.name?.charAt(0)}
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 9, height: 9, borderRadius: '50%',
            background: statusColors[myStatus],
            border: `2px solid ${BLUE_DARK}`,
          }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>
            {user?.name}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>
            {myStatusMessage || statusLabels[myStatus]}
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 10, marginLeft: 2 }}>▾</span>
      </div>
    </header>
  );
}
