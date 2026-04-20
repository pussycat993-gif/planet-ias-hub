import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

const btn = (active = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '4px 10px', border: `1px solid ${active ? '#90caf9' : '#dde1e7'}`,
  background: active ? '#e3f2fd' : '#fff', color: active ? BLUE : '#555',
  cursor: 'pointer', fontSize: 11, borderRadius: 6, whiteSpace: 'nowrap',
  fontFamily: 'inherit', transition: 'all .15s', fontWeight: active ? 600 : 400,
});

const autoBtn = (active = false): React.CSSProperties => ({
  ...btn(), background: active ? '#e1bee7' : '#f3e5f5',
  color: '#6a1b9a', border: `1px solid ${active ? '#ab47bc' : '#ce93d8'}`,
  fontWeight: active ? 700 : 500,
});

const dndBtn = (active = false): React.CSSProperties => ({
  ...btn(), background: active ? '#fff3e0' : '#fff',
  color: active ? '#e65100' : '#555',
  border: `1px solid ${active ? '#ffb74d' : '#dde1e7'}`,
  fontWeight: active ? 700 : 400,
});

// ── Create dropdown (+ New …) ─────────────────────────
function CreateDropdown() {
  const { openModal } = useUIStore();
  const { activeChannelId } = useChatStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const items = [
    { icon: '💬', label: 'New Message',      sub: 'Direct message',                                                   onClick: () => openModal('newMessage'),      enabled: true },
    { icon: '👥', label: 'New Group',        sub: 'Private group chat',                                               onClick: () => openModal('newGroup'),        enabled: true },
    { icon: '#',  label: 'New Channel',      sub: 'Public or private',                                                onClick: () => openModal('newChannel'),      enabled: true },
    { icon: '📅', label: 'Schedule Meeting', sub: activeChannelId ? 'In current channel' : 'Open a channel first', onClick: () => openModal('scheduleMeeting'), enabled: !!activeChannelId },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 12px',
          background: BLUE, color: '#fff',
          border: `1px solid ${BLUE}`,
          borderRadius: 6, fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
        + New <span style={{ fontSize: 9, opacity: .8 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 2000,
          background: '#fff', border: '1px solid #dde1e7', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,.14)', minWidth: 240, overflow: 'hidden',
        }}>
          {items.map((it, i) => (
            <div
              key={i}
              onClick={() => { if (it.enabled) { it.onClick(); setOpen(false); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                cursor: it.enabled ? 'pointer' : 'not-allowed',
                opacity: it.enabled ? 1 : 0.45,
                borderBottom: i < items.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}
              onMouseEnter={e => { if (it.enabled) e.currentTarget.style.background = '#f0f7ff'; }}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{it.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: BLUE_DARK }}>{it.label}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{it.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Status chip (online/away/offline + DND) ──────────────────
function StatusChip() {
  const { myStatus, openModal } = useUIStore();
  const color = myStatus === 'online' ? '#4caf50' : myStatus === 'away' ? '#ff9800' : '#bbb';
  const label = myStatus === 'online' ? 'Online' : myStatus === 'away' ? 'Away' : 'Offline';
  return (
    <button onClick={() => openModal('setStatus')} style={{ ...btn(), gap: 5 }} title="Change status">
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
      <span style={{ fontSize: 8, opacity: .6, marginLeft: 2 }}>▾</span>
    </button>
  );
}

export default function Toolbar() {
  const {
    toggleRightPanel, rightPanelOpen,
    toggleAutoPanel, autoPanelOpen,
    dnd, toggleDnd,
  } = useUIStore();
  const { logout } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings) return;
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSettings]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '5px 12px',
      background: '#fff', borderBottom: '1px solid #dde1e7',
      gap: 5, flexShrink: 0, flexWrap: 'wrap',
    }}>
      {/* Create dropdown */}
      <CreateDropdown />

      {/* Status */}
      <StatusChip />

      <div style={{ width: 1, height: 20, background: '#dde1e7', margin: '0 3px' }} />

      {/* DND toggle */}
      <button style={dndBtn(dnd)} onClick={toggleDnd} title={dnd ? 'DND active — notifications muted' : 'Toggle Do Not Disturb'}>
        {dnd ? '🌙 DND On' : '🌙 DND'}
      </button>

      {/* Right-side cluster */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
        <button style={autoBtn(autoPanelOpen)} onClick={toggleAutoPanel} title="Automations panel (Cmd+/)">
          ⚡ Automations
        </button>

        <button style={btn(rightPanelOpen)} onClick={toggleRightPanel} title="Toggle context panel">
          {rightPanelOpen ? '◨ Panel' : '◧ Panel'}
        </button>

        <button style={btn()} onClick={() => window.open(import.meta.env.VITE_PCI_URL || 'https://ias-app.planetsg.com', '_blank')}
          title="Open PLANet Contact IAS in new tab">
          ↗ Open PCI
        </button>

        {/* Settings cog */}
        <div ref={settingsRef} style={{ position: 'relative' }}>
          <button style={btn(showSettings)} onClick={() => setShowSettings(o => !o)} title="Settings">⚙</button>
          {showSettings && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 2000,
              background: '#fff', border: '1px solid #dde1e7', borderRadius: 8,
              boxShadow: '0 6px 20px rgba(0,0,0,.14)', minWidth: 180, overflow: 'hidden',
            }}>
              <SettingsItem icon="👤"  label="My Profile"         onClick={() => { setShowSettings(false); }} />
              <SettingsItem icon="🔔" label="Notifications"      onClick={() => { setShowSettings(false); }} />
              <SettingsItem icon="🎨" label="Appearance"         onClick={() => { setShowSettings(false); }} />
              <SettingsItem icon="⌨"  label="Keyboard Shortcuts" onClick={() => { setShowSettings(false); }} />
              <div style={{ height: 1, background: '#f0f0f0' }} />
              <SettingsItem icon="⎋" label="Log out"            onClick={() => { setShowSettings(false); logout(); }} danger />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: danger ? '#c62828' : '#1a1a2e' }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? '#fff5f5' : '#f5f5f5')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
