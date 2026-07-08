import React, { useEffect } from 'react';
import Header from './Header';
import Toolbar from './Toolbar';
import TabBar from './TabBar';
import Sidebar from './Sidebar';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import CallBar from '../calls/CallBar';
import EndCallModal from '../calls/EndCallModal';
import PCIContextPanel from '../pci/PCIContextPanel';
import AIPanel from '../ai/AIPanel';
import Icon, { type IconName } from '@/components/ui/Icon';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useCallStore } from '../../store/callStore';
import { useSocket } from '../../hooks/useSocket';

// Shared user avatar. Renders the photo when available and falls back to
// colored initials if there's no URL or the image fails to load.
// Defined at top level (not nested) to avoid React remount loops.
function avatarColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, avatarUrl, size = 32 }: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const [imgError, setImgError] = React.useState(false);
  const safeName = name || '?';
  const initials = safeName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const showImg = avatarUrl && !imgError;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: avatarColor(safeName), color: '#fff', overflow: 'hidden',
      fontSize: Math.round(size * 0.4), fontWeight: 600,
    }}>
      {showImg ? (
        <img
          src={avatarUrl as string}
          alt={safeName}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : initials}
    </div>
  );
}

export default function Layout() {
  const { fetchChannels, receiveMessage, setTyping, activeChannel } = useChatStore();
  const { rightPanelOpen, rightPanelTab, setRightPanelTab, activeModal } = useUIStore();
  const socket = useSocket();

  useEffect(() => { fetchChannels(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('message:receive', receiveMessage);
    socket.on('typing:update', ({ userId, typing }: any) => setTyping(userId, typing));
    return () => {
      socket.off('message:receive', receiveMessage);
      socket.off('typing:update');
    };
  }, [socket]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text)' }}>
      <Header />
      <Toolbar />
      <TabBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--grey-light)' }}>
          <ChatTitleBar />
          <CallBar />
          <MessageList />
          <MessageInput />
        </div>

        {/* Right panel */}
        {rightPanelOpen && (
          <div style={{ width: 280, borderLeft: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--blue-primary)', background: 'var(--grey-light)', flexShrink: 0 }}>
              {(['pci', 'info', 'files', 'log'] as const).map(t => (
                <div key={t} onClick={() => setRightPanelTab(t)} style={{
                  flex: 1, textAlign: 'center', padding: '6px 2px',
                  fontSize: 11, cursor: 'pointer', fontWeight: 500,
                  background: rightPanelTab === t ? 'var(--blue-primary)' : 'transparent',
                  color: rightPanelTab === t ? '#fff' : 'var(--text2)',
                }}>
                  {t === 'pci' ? 'PCI' : t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>
            <PCIContextPanel />
            {rightPanelTab !== 'pci' && (
              <div style={{ padding: '10px 12px', color: '#888', fontSize: 12 }}>
                {rightPanelTab === 'info' && 'Channel info coming soon'}
                {rightPanelTab === 'files' && 'Shared files coming soon'}
                {rightPanelTab === 'log' && 'PCI log settings coming soon'}
              </div>
            )}
          </div>
        )}

        {/* AI Panel */}
        <AIPanel />
      </div>

      {/* Footer */}
      <div style={{ background: 'var(--blue-dark)', color: '#fff', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {['Channels', 'Calls', 'Notifications', 'Help'].map(l => (
            <span key={l} style={{ fontSize: 10, color: 'rgba(255,255,255,.8)', cursor: 'pointer', textDecoration: 'underline' }}>{l}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, opacity: .7 }}>Design by PLANet Systems Group | © IAS Hub 2026. All rights reserved.</span>
      </div>

      {/* Modals */}
      <EndCallModal />
    </div>
  );
}

function ChatTitleBar() {
  const { activeChannel, activeChannelId } = useChatStore();
  const { startCall } = useCallStore();

  if (!activeChannel) return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 12px', color: 'var(--text3)', fontSize: 12, flexShrink: 0 }}>
      Select a channel to start messaging
    </div>
  );

  const isDM = activeChannel.type === 'dm';
  const iconName: IconName = isDM ? 'message' : activeChannel.type === 'group' ? 'hexagon' : 'hash';

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
      <span style={{ color: 'var(--text3)', display: 'inline-flex' }}><Icon name={iconName} size={15} /></span>
      <span style={{ fontWeight: 700, color: 'var(--blue-dark)', fontSize: 14 }}>
        {isDM ? activeChannel.other_user?.name : activeChannel.name}
      </span>
      <span style={{ color: 'var(--text3)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {isDM
          ? <><Icon name="circle" size={7} fill="currentColor" />{activeChannel.other_user?.status || 'offline'}</>
          : `— ${activeChannel.type}`}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        {([
          { icon: 'pin', label: 'Pinned', onClick: () => {} },
          { icon: 'users', label: 'Members', onClick: () => {} },
          { icon: 'link', label: 'Log to PCI', onClick: () => {} },
          { icon: 'phone', label: 'Audio', green: true, onClick: () => activeChannelId && startCall(activeChannelId, 'audio') },
          { icon: 'video', label: 'Video', green: true, onClick: () => activeChannelId && startCall(activeChannelId, 'video') },
        ] as { icon: IconName; label: string; green?: boolean; onClick: () => void }[]).map(({ icon, label, green, onClick }) => (
          <button key={label} onClick={onClick} style={{
            padding: '4px 10px',
            border: `1px solid ${green ? '#a5d6a7' : 'var(--border)'}`,
            background: 'var(--surface)', color: green ? 'var(--green)' : 'var(--text2)',
            cursor: 'pointer', fontSize: 11, borderRadius: 6, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <Icon name={icon} size={11} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
