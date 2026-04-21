import React from 'react';

const BLUE_DARK = '#1565c0';

interface PinnedMessage {
  id: number;
  body: string | null;
  sender: { name: string } | null;
  created_at: string;
  message_type: string;
}

interface Props {
  messages: PinnedMessage[];
  onClose: () => void;
  onJump: (msgId: number) => void;
}

function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function PinnedPanel({ messages, onClose, onJump }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 2500, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 340, background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,.15)', fontFamily: 'Segoe UI, Arial, sans-serif', animation: 'slideIn .2s ease' }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #eee' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: BLUE_DARK }}>📌 Pinned Messages</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{messages.length} pinned</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {messages.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#aaa' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📌</div>
              <div style={{ fontSize: 13 }}>No pinned messages yet</div>
              <div style={{ fontSize: 11, marginTop: 6, color: '#bbb' }}>Hover a message and click 📌 to pin it</div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} onClick={() => onJump(msg.id)}
                style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', borderLeft: '3px solid #f9a825' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fffde7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                {/* Sender */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: stringToColor(msg.sender?.name || '?'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(msg.sender?.name || '?').charAt(0)}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{msg.sender?.name || 'System'}</span>
                  <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>
                    {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {/* Body */}
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {msg.message_type === 'file' ? `📎 ${msg.body}` : msg.body || 'Message'}
                </div>

                <div style={{ fontSize: 10, color: '#1976d2', marginTop: 5 }}>Jump to message →</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
