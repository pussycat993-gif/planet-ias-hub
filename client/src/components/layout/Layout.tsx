import React, { useEffect } from 'react';
import Header from './Header';
import Toolbar from './Toolbar';
import TabBar from './TabBar';
import Sidebar from './Sidebar';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import CallBar from '../calls/CallBar';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/authStore';

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { fetchChannels, receiveMessage, setTyping } = useChatStore();
  const { rightPanelOpen, activeModal } = useUIStore();
  const { user } = useAuthStore();
  const socket = useSocket();

  // Fetch channels on mount
  useEffect(() => { fetchChannels(); }, []);

  // Register socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('message:receive', receiveMessage);
    socket.on('typing:update', ({ userId, typing }: { userId: number; typing: boolean }) => {
      setTyping(userId, typing);
    });
    socket.on('call:incoming', (data: any) => {
      console.log('Incoming call:', data);
      // TODO: show incoming call UI
    });

    return () => {
      socket.off('message:receive', receiveMessage);
      socket.off('typing:update');
      socket.off('call:incoming');
    };
  }, [socket]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 13 }}>
      <Header />
      <Toolbar />
      <TabBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f0f2f5' }}>
          {/* Chat title bar */}
          <ChatTitleBar />
          <CallBar />
          <MessageList />
          <MessageInput />
        </div>

        {/* Right panel */}
        {rightPanelOpen && (
          <div style={{ width: 280, borderLeft: '1px solid #dde1e7', background: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <RightPanelTabs />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#1565c0', color: '#fff', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {['Channels', 'Calls', 'Notifications', 'Help'].map(l => (
            <span key={l} style={{ fontSize: 10, color: 'rgba(255,255,255,.8)', cursor: 'pointer', textDecoration: 'underline' }}>{l}</span>
          ))}
        </div>
        <span style={{ fontSize: 10, opacity: .7 }}>Design by PLANet Systems Group | © IAS Hub 2026. All rights reserved.</span>
      </div>
    </div>
  );
}

function ChatTitleBar() {
  const { activeChannel } = useChatStore();
  const { startCall } = require('../../store/callStore').useCallStore();
  const { activeChannelId } = useChatStore();

  if (!activeChannel) return null;

  const isDM = activeChannel.type === 'dm';
  const icon = isDM ? '💬' : activeChannel.type === 'group' ? '⬡' : '#';

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #dde1e7', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
      <span style={{ color: '#888', fontSize: 15 }}>{icon}</span>
      <span style={{ fontWeight: 700, color: '#1565c0', fontSize: 14 }}>
        {isDM ? activeChannel.other_user?.name : activeChannel.name}
      </span>
      <span style={{ color: '#888', fontSize: 11 }}>
        {isDM ? `● ${activeChannel.other_user?.status}` : `— ${activeChannel.type}`}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        {[
          { label: '📌 Pinned', onClick: () => {} },
          { label: '👥 Members', onClick: () => {} },
          { label: '🔗 Log to PCI', onClick: () => {} },
          { label: '📞 Audio', green: true, onClick: () => activeChannelId && startCall(activeChannelId, 'audio') },
          { label: '📹 Video', green: true, onClick: () => activeChannelId && startCall(activeChannelId, 'video') },
        ].map(({ label, green, onClick }) => (
          <button key={label} onClick={onClick} style={{
            padding: '4px 10px', border: `1px solid ${green ? '#a5d6a7' : '#dde1e7'}`,
            background: '#fff', color: green ? '#2e7d32' : '#555',
            cursor: 'pointer', fontSize: 11, borderRadius: 6, fontFamily: 'inherit',
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RightPanelTabs() {
  const { rightPanelTab, setRightPanelTab } = useUIStore();
  const tabs = ['pci', 'info', 'files', 'log'] as const;

  return (
    <>
      <div style={{ display: 'flex', borderBottom: '2px solid #1976d2', background: '#f8f9fa', flexShrink: 0 }}>
        {tabs.map(t => (
          <div key={t} onClick={() => setRightPanelTab(t)} style={{
            flex: 1, textAlign: 'center', padding: '6px 2px',
            fontSize: 11, cursor: 'pointer', fontWeight: 500,
            background: rightPanelTab === t ? '#1976d2' : 'transparent',
            color: rightPanelTab === t ? '#fff' : '#555',
          }}>
            {t === 'pci' ? 'PCI' : t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div style={{ padding: '8px 12px', color: '#888', fontSize: 12 }}>
          {rightPanelTab === 'pci' ? 'Select a conversation to see PCI context' :
           rightPanelTab === 'info' ? 'Channel information' :
           rightPanelTab === 'files' ? 'Shared files' : 'PCI log settings'}
        </div>
      </div>
    </>
  );
}
