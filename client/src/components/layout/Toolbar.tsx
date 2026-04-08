import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { useCallStore } from '../../store/callStore';
import { useChatStore } from '../../store/chatStore';

const btn = (active = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', border: `1px solid ${active ? '#90caf9' : '#dde1e7'}`,
  background: active ? '#e3f2fd' : '#fff', color: active ? '#1976d2' : '#555',
  cursor: 'pointer', fontSize: 11, borderRadius: 6, whiteSpace: 'nowrap',
  fontFamily: 'inherit', transition: 'all .15s',
});

const primaryBtn: React.CSSProperties = {
  ...btn(), background: '#1976d2', color: '#fff', border: '1px solid #1976d2',
};

const autoBtn: React.CSSProperties = {
  ...btn(), background: '#f3e5f5', color: '#6a1b9a', border: '1px solid #ce93d8',
};

export default function Toolbar() {
  const { toggleRightPanel, toggleAIPanel, toggleAutoPanel, openModal, myStatus, setMyStatus } = useUIStore();
  const { activeChannelId } = useChatStore();
  const { startCall } = useCallStore();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '4px 12px',
      background: '#fff', borderBottom: '1px solid #dde1e7',
      gap: 4, flexShrink: 0, flexWrap: 'wrap',
    }}>
      <button style={primaryBtn} onClick={() => openModal('newChannel')}>+ New Channel</button>
      <button style={primaryBtn} onClick={() => openModal('newMessage')}>✎ New Message</button>
      <button style={btn()} onClick={() => openModal('newGroup')}>⬡ New Group</button>

      <div style={{ width: 1, height: 20, background: '#dde1e7', margin: '0 3px' }} />

      <button style={btn()} onClick={() => activeChannelId && startCall(activeChannelId, 'audio')}>
        📞 Audio Call
      </button>
      <button style={btn()} onClick={() => activeChannelId && startCall(activeChannelId, 'video')}>
        📹 Video Call
      </button>

      <div style={{ width: 1, height: 20, background: '#dde1e7', margin: '0 3px' }} />

      <button style={btn()} onClick={() => {
        const next = myStatus === 'online' ? 'away' : myStatus === 'away' ? 'offline' : 'online';
        setMyStatus(next);
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          background: myStatus === 'online' ? '#4caf50' : myStatus === 'away' ? '#ff9800' : '#bbb',
        }} />
        {myStatus === 'online' ? 'Online' : myStatus === 'away' ? 'Away' : 'Offline'} ▾
      </button>

      <div style={{ width: 1, height: 20, background: '#dde1e7', margin: '0 3px' }} />

      <button style={autoBtn} onClick={toggleAutoPanel}>⚡ Automations</button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <button style={btn()} onClick={toggleRightPanel}>◧ Context</button>
        <button style={btn()} onClick={toggleAIPanel}>🤖 AI</button>
        <button style={btn()} onClick={() => window.open(import.meta.env.VITE_PCI_URL, '_blank')}>
          ↗ Open PCI
        </button>
      </div>
    </div>
  );
}
