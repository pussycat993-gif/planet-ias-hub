import React from 'react';
import { useChatStore, Channel } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

function Avatar({ url, initials, bg = '#1976d2', color = '#fff', size = 22, presence }:
  { url?: string; initials: string; bg?: string; color?: string; size?: number; presence?: string }) {
  const dot = presence === 'online' ? '#4caf50' : presence === 'away' ? '#ff9800' : null;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', position: 'relative',
      background: url ? 'transparent' : bg,
      backgroundImage: url ? `url(${url})` : 'none',
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color, flexShrink: 0,
    }}>
      {!url && initials}
      {dot && <div style={{
        position: 'absolute', bottom: -1, right: -1,
        width: size * 0.32, height: size * 0.32, borderRadius: '50%',
        background: dot, border: '1.5px solid #fff',
      }} />}
    </div>
  );
}

function GroupLogo({ color, abbr }: { color: string; abbr: string }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 5, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0,
    }}>
      {abbr}
    </div>
  );
}

function ChannelRow({ ch, isSelected, onClick }: { ch: Channel; isSelected: boolean; onClick: () => void }) {
  const isDM = ch.type === 'dm';
  const isGroup = ch.type === 'group';
  const otherUser = ch.other_user;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', padding: '5px 10px',
        cursor: 'pointer', gap: 7, borderRadius: 6, margin: '1px 5px',
        background: isSelected ? '#e3f2fd' : 'transparent',
        borderLeft: isSelected ? '3px solid #1976d2' : '3px solid transparent',
        paddingLeft: isSelected ? 7 : 10, transition: 'all .15s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0f7ff'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {isDM && otherUser && (
        <Avatar
          initials={otherUser.name.charAt(0)}
          presence={otherUser.status}
          url={otherUser.avatar_url}
          size={22}
        />
      )}
      {isGroup && ch.logo_color && ch.logo_abbr && (
        <GroupLogo color={ch.logo_color} abbr={ch.logo_abbr} />
      )}
      {!isDM && !isGroup && (
        <span style={{ color: '#888', fontSize: 13, width: 14, flexShrink: 0 }}>#</span>
      )}
      <span style={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: 12, color: isSelected ? '#1976d2' : '#1a1a2e',
        fontWeight: isSelected ? 700 : 400,
      }}>
        {isDM ? otherUser?.name : ch.name}
      </span>
      {(ch.unread_count || 0) > 0 && (
        <span style={{
          background: '#e53935', color: '#fff', fontSize: 9,
          padding: '1px 5px', borderRadius: 8, fontWeight: 700,
        }}>
          {ch.unread_count}
        </span>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { channels, activeChannelId, selectChannel } = useChatStore();
  const { user, logout } = useAuthStore();
  const { myStatus, myStatusMessage, openModal } = useUIStore();

  const statusColor = myStatus === 'online' ? '#4caf50' : myStatus === 'away' ? '#ff9800' : '#bbb';
  const statusLabel = myStatus === 'online' ? '● Online' : myStatus === 'away' ? '● Away' : '● Offline';

  return (
    <div style={{
      width: 230, borderRight: '1px solid #dde1e7',
      display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        background: '#1976d2', color: '#fff', padding: '5px 10px',
        fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>Channels</span>
        <div
          onClick={() => openModal('newChannel')}
          style={{
            width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >+</div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Public channels */}
        {channels.public.length > 0 && (
          <>
            <div style={{ padding: '7px 10px 3px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Public Channels
            </div>
            {channels.public.map(ch => (
              <ChannelRow key={ch.id} ch={ch} isSelected={activeChannelId === ch.id} onClick={() => selectChannel(ch.id)} />
            ))}
          </>
        )}

        {/* Custom groups */}
        {channels.groups.length > 0 && (
          <>
            <div style={{ padding: '7px 10px 3px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>
              Custom Groups
            </div>
            {channels.groups.map(ch => (
              <ChannelRow key={ch.id} ch={ch} isSelected={activeChannelId === ch.id} onClick={() => selectChannel(ch.id)} />
            ))}
            <div
              onClick={() => openModal('newGroup')}
              style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', cursor: 'pointer', gap: 7, borderRadius: 6, margin: '1px 5px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: '#888', fontSize: 14, width: 14 }}>+</span>
              <span style={{ fontSize: 12, color: '#888' }}>New Custom Group</span>
            </div>
          </>
        )}

        {/* Direct messages */}
        {channels.dms.length > 0 && (
          <>
            <div style={{ padding: '7px 10px 3px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>
              Direct Messages
            </div>
            {channels.dms.map(ch => (
              <ChannelRow key={ch.id} ch={ch} isSelected={activeChannelId === ch.id} onClick={() => selectChannel(ch.id)} />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid #dde1e7',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Avatar initials={(user?.name || 'U').charAt(0)} url={user?.avatar_url} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: statusColor }}>
            {myStatusMessage || statusLabel}
          </div>
        </div>
        <span style={{ cursor: 'pointer', color: '#888', fontSize: 15 }} onClick={() => openModal('automations')}>⚡</span>
        <span style={{ cursor: 'pointer', color: '#888', fontSize: 15 }} onClick={logout}>⚙</span>
      </div>
    </div>
  );
}
