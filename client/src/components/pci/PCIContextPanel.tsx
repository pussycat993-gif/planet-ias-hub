import React from 'react';
import { usePCIStore, PCIActivity } from '../../store/pciStore';
import { useUIStore } from '../../store/uiStore';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string }> = {
    Active: { bg: BLUE },
    Complete: { bg: '#2e7d32' },
    Canceled: { bg: '#c62828' },
  };
  const s = map[status] || { bg: '#888' };
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 8,
      fontSize: 9, fontWeight: 700, background: s.bg, color: '#fff',
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {status}
    </span>
  );
}

function ActivityRow({ act }: { act: PCIActivity }) {
  const isActive = act.status === 'Active';
  return (
    <div style={{
      display: 'flex', padding: '4px 11px', borderBottom: '1px solid #f5f5f5',
      gap: 6, cursor: 'pointer', alignItems: 'center',
      background: isActive ? '#f0f6ff' : act.status === 'Complete' ? '#f1f8f2' : '#fff',
    }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(.97)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
    >
      <span style={{ color: '#888', fontSize: 10, width: 58, flexShrink: 0 }}>
        {act.date?.slice(0, 10).replace(/-/g, '/').slice(2)}
      </span>
      <span style={{ color: '#888', fontSize: 10, width: 70, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {act.type}
      </span>
      <span style={{ color: BLUE, fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {act.subject}
      </span>
      <StatusBadge status={act.status} />
    </div>
  );
}

export default function PCIContextPanel() {
  const { context, loading } = usePCIStore();
  const { rightPanelTab } = useUIStore();

  if (rightPanelTab !== 'pci') return null;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: 12 }}>
        Loading PCI context...
      </div>
    );
  }

  if (!context || !context.person) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: 12 }}>
        Select a conversation to see PCI context
      </div>
    );
  }

  const { person, recent_activities, open_tasks, entities } = context;

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {/* Person header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderBottom: '1px solid #dde1e7' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: BLUE,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          backgroundImage: person.avatar_url ? `url(${person.avatar_url})` : 'none',
          backgroundSize: 'cover',
        }}>
          {!person.avatar_url && person.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: BLUE_DARK }}>{person.name}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{person.role}</div>
          <span style={{
            display: 'inline-block', padding: '1px 7px', background: '#e8f5e9',
            color: '#2e7d32', borderRadius: 10, fontSize: 9, fontWeight: 700,
            border: '1px solid #a5d6a7', marginTop: 3,
          }}>● {person.status}</span>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: '4px 11px 0' }}>
        {[
          { label: 'E-mail', value: person.email, link: true },
          { label: 'Company', value: person.company },
          { label: 'Activities', value: recent_activities.length.toString() },
          { label: 'Open Tasks', value: open_tasks.length.toString() },
          ...(entities[0] ? [{ label: 'Primary Entity', value: entities[0].name, link: true }] : []),
        ].map(({ label, value, link }) => (
          <div key={label} style={{ display: 'flex', padding: '3px 0', borderBottom: '1px solid #f5f5f5' }}>
            <span style={{ color: '#888', width: 80, flexShrink: 0, fontSize: 11 }}>{label}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, flex: 1,
              color: link ? BLUE : '#1a1a2e',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: link ? 'pointer' : 'default',
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Open in PCI */}
      <div style={{ padding: '6px 11px 8px' }}>
        <button
          onClick={() => window.open(`${import.meta.env.VITE_PCI_URL}/people/${person.id}`, '_blank')}
          style={{
            width: '100%', padding: 5, border: `1px solid ${BLUE}`,
            color: BLUE, background: '#fff', cursor: 'pointer',
            fontSize: 11, borderRadius: 6, fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = BLUE; }}
        >
          ↗ Open in PCI
        </button>
      </div>

      {/* Recent Activities */}
      <div style={{
        background: '#eef2f7', color: BLUE_DARK, fontSize: 10, fontWeight: 700,
        padding: '3px 11px', borderTop: '1px solid #dde1e7', borderBottom: '1px solid #dde1e7',
        textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', justifyContent: 'space-between',
        marginTop: 4,
      }}>
        <span>Recent Activities</span>
        <span
          style={{ fontWeight: 400, color: '#5c6bc0', cursor: 'pointer' }}
          onClick={() => window.open(`${import.meta.env.VITE_PCI_URL}/activity-list?person=${person.id}`, '_blank')}
        >
          View All
        </span>
      </div>

      {recent_activities.length === 0 ? (
        <div style={{ padding: '8px 11px', fontSize: 11, color: '#888' }}>No recent activities</div>
      ) : (
        recent_activities.slice(0, 5).map(act => <ActivityRow key={act.id} act={act} />)
      )}

      {/* Open Tasks */}
      {open_tasks.length > 0 && (
        <>
          <div style={{
            background: '#eef2f7', color: BLUE_DARK, fontSize: 10, fontWeight: 700,
            padding: '3px 11px', borderTop: '1px solid #dde1e7', borderBottom: '1px solid #dde1e7',
            textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 4,
          }}>
            Open Tasks
          </div>
          {open_tasks.map(task => <ActivityRow key={task.id} act={task} />)}
        </>
      )}
    </div>
  );
}
