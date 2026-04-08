import React from 'react';
import { useUIStore } from '../../store/uiStore';

type Tab = 'channels' | 'dms' | 'calls' | 'files';
const TABS: { key: Tab; label: string }[] = [
  { key: 'channels', label: 'Channels' },
  { key: 'dms', label: 'Direct Messages' },
  { key: 'calls', label: 'Calls' },
  { key: 'files', label: 'Files' },
];

export default function TabBar() {
  const { mainTab, setMainTab } = useUIStore();

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', padding: '0 12px',
      background: '#fff', borderBottom: '2px solid #1976d2', flexShrink: 0,
    }}>
      {TABS.map(({ key, label }) => (
        <div
          key={key}
          onClick={() => setMainTab(key)}
          style={{
            padding: '6px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            borderRadius: '6px 6px 0 0', transition: 'all .15s',
            background: mainTab === key ? '#1976d2' : 'transparent',
            color: mainTab === key ? '#fff' : '#555',
          }}
          onMouseEnter={e => {
            if (mainTab !== key) {
              e.currentTarget.style.background = '#f0f7ff';
              e.currentTarget.style.color = '#1976d2';
            }
          }}
          onMouseLeave={e => {
            if (mainTab !== key) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#555';
            }
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
