import React from 'react';
import Icon from '@/components/ui/Icon';

const BLUE_DARK = 'var(--blue-dark)';

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
      <div onClick={e => e.stopPropagation()} style={{ width: 340, background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,.15)', fontFamily: 'var(--font-sans)', animation: 'slideIn .2s ease' }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: BLUE_DARK, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="pin" size={15} /> Pinned Messages</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{messages.length} pinned</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'inline-flex' }}><Icon name="close" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {messages.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ marginBottom: 10 }}><Icon name="pin" size={32} /></div>
              <div style={{ fontSize: 13 }}>No pinned messages yet</div>
              <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text3)' }}>Hover a message and click <Icon name="pin" size={11} style={{ verticalAlign: '-1px' }} /> to pin it</div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} onClick={() => onJump(msg.id)}
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--neutral-light-active)', cursor: 'pointer', borderLeft: '3px solid #f9a825' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fffde7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                {/* Sender */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: stringToColor(msg.sender?.name || '?'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(msg.sender?.name || '?').charAt(0)}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{msg.sender?.name || 'System'}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
                    {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {/* Body */}
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {msg.message_type === 'file'
                    ? <><Icon name="attach" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />{msg.body}</>
                    : msg.body || 'Message'}
                </div>

                <div style={{ fontSize: 10, color: 'var(--blue-primary)', marginTop: 5 }}>Jump to message →</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
