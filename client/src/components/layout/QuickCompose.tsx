import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

interface QuickComposeProps {
  onScheduleMeeting: () => void;  // parent owns the modal
}

// Floating "+" button bottom-right. Click opens a small menu of quick
// actions: new message, new group, new channel, schedule meeting.
// The parent provides the schedule handler because ScheduleMeetModal is
// channel-scoped and already mounted in Layout.
export default function QuickCompose({ onScheduleMeeting }: QuickComposeProps) {
  const { openModal } = useUIStore();
  const { activeChannelId } = useChatStore();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Esc key closes menu
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  const actions = [
    {
      icon: '💬',
      label: 'New Message',
      sublabel: 'Start a direct message',
      onClick: () => { openModal('newMessage'); setOpen(false); },
      enabled: true,
    },
    {
      icon: '👥',
      label: 'New Group',
      sublabel: 'Private group chat with several people',
      onClick: () => { openModal('newGroup'); setOpen(false); },
      enabled: true,
    },
    {
      icon: '#',
      label: 'New Channel',
      sublabel: 'Public or private channel',
      onClick: () => { openModal('newChannel'); setOpen(false); },
      enabled: true,
    },
    {
      icon: '📅',
      label: 'Schedule Meeting',
      sublabel: activeChannelId ? 'In current channel' : 'Open a channel first',
      onClick: () => { if (activeChannelId) { onScheduleMeeting(); setOpen(false); } },
      enabled: !!activeChannelId,
    },
  ];

  return (
    <div ref={wrapperRef} style={{ position: 'fixed', bottom: 70, right: 24, zIndex: 2500 }}>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: 60,
          right: 0,
          background: '#fff',
          border: '1px solid #dde1e7',
          borderRadius: 12,
          boxShadow: '0 10px 32px rgba(0,0,0,.16)',
          width: 240,
          overflow: 'hidden',
          animation: 'ias-qc-enter .18s ease-out',
        }}>
          <style>{`@keyframes ias-qc-enter { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }`}</style>
          <div style={{ padding: '9px 13px', borderBottom: '1px solid #f0f0f0', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Quick Create
          </div>
          {actions.map((a, i) => (
            <div
              key={i}
              onClick={a.enabled ? a.onClick : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 13px',
                cursor: a.enabled ? 'pointer' : 'not-allowed',
                opacity: a.enabled ? 1 : 0.45,
                borderBottom: i < actions.length - 1 ? '1px solid #f5f5f5' : 'none',
                transition: 'background .12s',
              }}
              onMouseEnter={e => { if (a.enabled) e.currentTarget.style.background = '#f0f7ff'; }}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 18, width: 22, textAlign: 'center', flexShrink: 0 }}>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: BLUE_DARK }}>{a.label}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{a.sublabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        title={open ? 'Close' : 'Quick create'}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg,#c62828,#8e1e1e)'
            : `linear-gradient(135deg,${BLUE},${BLUE_DARK})`,
          color: '#fff',
          border: 'none',
          boxShadow: '0 4px 14px rgba(25,118,210,.4)',
          cursor: 'pointer',
          fontSize: 26,
          fontFamily: 'inherit',
          fontWeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform .2s, background .2s',
          transform: open ? 'rotate(45deg)' : 'rotate(0)',
        }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
      >+</button>
    </div>
  );
}
