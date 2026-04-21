import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from '../../store/callStore';

type MainTab = 'all' | 'dms' | 'calls' | 'files';

const TABS: { key: MainTab; icon: string; label: string }[] = [
  { key: 'all',   icon: '🏠', label: 'All'      },
  { key: 'dms',   icon: '💬', label: 'Messages' },
  { key: 'calls', icon: '📞', label: 'Calls'    },
  { key: 'files', icon: '📁', label: 'Files'    },
];

export default function TabBar() {
  const { mainTab, setMainTab } = useUIStore();
  const { channels } = useChatStore();
  const { active: callActive } = useCallStore();

  const unreadDMs = channels.dms.reduce((sum, ch) => sum + (ch.unread_count || 0), 0);
  const unreadAll = [...channels.public, ...channels.private, ...channels.groups]
    .reduce((sum, ch) => sum + (ch.unread_count || 0), 0);

  const badges: Record<string, number> = {
    all: unreadAll,
    dms: unreadDMs,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', padding: '0 12px',
      background: '#fff', borderBottom: '2px solid #1976d2', flexShrink: 0,
    }}>
      <style>{`@keyframes ias-tab-live-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>

      {TABS.map(({ key, icon, label }) => {
        const isActive = mainTab === key;
        const badge = badges[key] || 0;
        const showLiveOnCalls = key === 'calls' && callActive;

        return (
          <div
            key={key}
            onClick={() => setMainTab(key)}
            style={{
              padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              borderRadius: '6px 6px 0 0', transition: 'all .15s',
              background: isActive ? '#1976d2' : 'transparent',
              color: isActive ? '#fff' : '#555',
              display: 'flex', alignItems: 'center', gap: 6, position: 'relative',
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#f0f7ff'; e.currentTarget.style.color = '#1976d2'; } }}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#555'; } }}
          >
            <span style={{ fontSize: 13 }}>{icon}</span>
            <span>{label}</span>

            {/* Active-call indicator on Calls tab */}
            {showLiveOnCalls && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: '#e53935', color: '#fff',
                fontSize: 8, fontWeight: 800, letterSpacing: '.05em',
                padding: '1px 6px', borderRadius: 8,
                animation: 'ias-tab-live-pulse 1.4s infinite',
                lineHeight: 1.4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                LIVE
              </span>
            )}

            {/* Unread badge */}
            {!showLiveOnCalls && badge > 0 && (
              <span style={{
                background: isActive ? 'rgba(255,255,255,.3)' : '#e53935',
                color: '#fff', fontSize: 9, fontWeight: 700,
                padding: '1px 5px', borderRadius: 8, lineHeight: 1.4,
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
