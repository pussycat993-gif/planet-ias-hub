import React, { useState } from 'react';
import { usePCIStore } from '../../store/pciStore';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── Mock data — Ivana Vrtunic's own schedule ──────────────
const MOCK_CONTEXT = {
  person: {
    id: 102,
    name: 'Ivana Vrtunic',
    role: 'Project Manager',
    email: 'ivana.vrtunic@planetsg.com',
    company: 'PLANet Systems Group',
    status: 'Active',
    avatar_url: null,
  },
  recent_activities: [
    { id: 1, type: 'Meeting',  subject: 'IAS Hub Sprint Review',          date: '2026-04-15', status: 'Complete' as const },
    { id: 2, type: 'Call',     subject: 'Client demo preparation',          date: '2026-04-14', status: 'Complete' as const },
    { id: 3, type: 'Meeting',  subject: 'DWM Architecture Review',          date: '2026-04-12', status: 'Complete' as const },
    { id: 4, type: 'Task',     subject: 'Update Confluence documentation',   date: '2026-04-10', status: 'Complete' as const },
    { id: 5, type: 'Email',    subject: 'Q3 planning proposal to Dean',      date: '2026-04-09', status: 'Complete' as const },
  ],
  open_tasks: [
    { id: 10, type: 'Meeting', subject: 'Client demo — Friday',             date: '2026-04-18', status: 'Active' as const },
    { id: 11, type: 'Task',    subject: 'Review IAS-533 QA report',          date: '2026-04-17', status: 'Active' as const },
    { id: 12, type: 'Meeting', subject: 'Q3 Architecture planning call',     date: '2026-04-22', status: 'Active' as const },
    { id: 13, type: 'Task',    subject: 'Finalize Dashboard implementation', date: '2026-04-25', status: 'Active' as const },
  ],
  entities: [
    { id: 201, name: 'IAS Hub Project',          type: 'Project' },
    { id: 202, name: 'PLANet Systems Group',      type: 'Company' },
    { id: 203, name: 'DWM Module Development',   type: 'Project' },
  ],
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string }> = {
    Active:   { bg: BLUE      },
    Complete: { bg: '#2e7d32' },
    Canceled: { bg: '#c62828' },
  };
  const c = colors[status] || { bg: '#888' };
  return (
    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: c.bg, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {status}
    </span>
  );
}

function ActivityRow({ act }: { act: typeof MOCK_CONTEXT.recent_activities[0] }) {
  const typeIcon: Record<string, string> = { Meeting: '📅', Call: '📞', Email: '📧', Task: '✅', Note: '📝' };
  return (
    <div style={{ display: 'flex', padding: '5px 11px', borderBottom: '1px solid #f5f5f5', gap: 6, cursor: 'pointer', alignItems: 'center', background: act.status === 'Active' ? '#f0f6ff' : '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(.97)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}>
      <span style={{ fontSize: 11, width: 18, flexShrink: 0 }}>{typeIcon[act.type] || '•'}</span>
      <span style={{ color: '#888', fontSize: 10, width: 50, flexShrink: 0 }}>{act.date.slice(5).replace('-', '/')}</span>
      <span style={{ color: BLUE, fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.subject}</span>
      <StatusBadge status={act.status} />
    </div>
  );
}

function SectionLabel({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ background: '#eef2f7', color: BLUE_DARK, fontSize: 10, fontWeight: 700, padding: '4px 11px', borderTop: '1px solid #dde1e7', borderBottom: '1px solid #dde1e7', textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
      <span>{title}</span>
      {action && <span style={{ fontWeight: 400, color: '#5c6bc0', cursor: 'pointer' }} onClick={onAction}>{action}</span>}
    </div>
  );
}

function LogActivityPanel() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('Meeting');
  const [saving, setSaving] = useState(false);

  const handleLog = async () => {
    if (!subject.trim()) return;
    setSaving(true);
    setTimeout(() => { setSaving(false); setSubject(''); setOpen(false); }, 800);
  };

  return (
    <div style={{ padding: '6px 11px 8px' }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '5px', border: `1px solid ${BLUE}`, color: BLUE, background: '#fff', cursor: 'pointer', fontSize: 11, borderRadius: 6, fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = BLUE; }}>
          + Log Activity
        </button>
      ) : (
        <div style={{ border: `1px solid ${BLUE}`, borderRadius: 8, padding: 8, background: '#f8fbff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BLUE_DARK, marginBottom: 6 }}>Log to PCI</div>
          <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: '4px 6px', border: '1px solid #dde1e7', borderRadius: 5, fontSize: 11, marginBottom: 6, fontFamily: 'inherit' }}>
            {['Meeting', 'Call', 'Email', 'Task', 'Note'].map(t => <option key={t}>{t}</option>)}
          </select>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject..."
            style={{ width: '100%', padding: '4px 6px', border: '1px solid #dde1e7', borderRadius: 5, fontSize: 11, marginBottom: 6, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={handleLog} disabled={!subject.trim() || saving}
              style={{ flex: 1, padding: '4px', background: BLUE, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving...' : 'Log'}
            </button>
            <button onClick={() => setOpen(false)} style={{ padding: '4px 8px', background: '#fff', border: '1px solid #dde1e7', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PCIContextPanel() {
  const { context, loading } = usePCIStore();
  const { rightPanelTab } = useUIStore();
  const { activeChannel } = useChatStore();

  if (rightPanelTab !== 'pci') return null;

  // If we have real PCI context loaded, use it.
  // Otherwise synthesise a context from the active channel so the panel
  // always reflects who you're actually talking to.
  let data = context && context.person ? context : null;

  if (!data && activeChannel) {
    if (activeChannel.type === 'dm' && activeChannel.other_user) {
      const u = activeChannel.other_user;
      data = {
        person: {
          id: u.id,
          name: u.name,
          role: u.role || 'Team Member',
          email: u.email || `${u.name.toLowerCase().replace(/\s+/g, '.')}@planetsg.com`,
          company: 'PLANet Systems Group',
          status: u.status === 'online' ? 'Active' : u.status === 'away' ? 'Away' : 'Offline',
          avatar_url: u.avatar_url,
        },
        recent_activities: MOCK_CONTEXT.recent_activities,
        open_tasks: MOCK_CONTEXT.open_tasks,
        entities: MOCK_CONTEXT.entities,
      };
    } else {
      // Group / public channel: use channel name as the "person" stand-in
      data = {
        person: {
          id: activeChannel.id,
          name: activeChannel.name,
          role: activeChannel.type === 'group' ? 'Private Group' : 'Public Channel',
          email: '',
          company: 'PLANet Systems Group',
          status: 'Active',
          avatar_url: undefined,
        },
        recent_activities: MOCK_CONTEXT.recent_activities,
        open_tasks: MOCK_CONTEXT.open_tasks,
        entities: MOCK_CONTEXT.entities,
      };
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: 12 }}>Loading...</div>;

  if (!data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 12 }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>👤</div>
        Select a conversation to see PCI context
      </div>
    );
  }

  const { person, recent_activities, open_tasks, entities } = data;
  const pciUrl = import.meta.env.VITE_PCI_URL || 'https://ias-app.planetsg.com';

  return (
    <div style={{ overflowY: 'auto', flex: 1, fontSize: 12, fontFamily: 'Segoe UI, Arial, sans-serif' }}>

      {/* Person header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px', borderBottom: '1px solid #dde1e7' }}>
        {person.avatar_url ? (
          <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <img src={person.avatar_url} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
            {person.name.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: BLUE_DARK }}>{person.name}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{person.role}</div>
          <span style={{ display: 'inline-block', padding: '1px 7px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 10, fontSize: 9, fontWeight: 700, border: '1px solid #a5d6a7', marginTop: 3 }}>● {person.status}</span>
        </div>
        <span title="Demo data — PCI not connected" style={{ fontSize: 10, color: '#bbb' }}>🔌</span>
      </div>

      {/* Fields */}
      <div style={{ padding: '4px 11px 0' }}>
        {[
          person.email ? { label: 'Email',      value: person.email, href: `mailto:${person.email}` } : null,
          { label: 'Company',    value: person.company },
          { label: 'Schedule',   value: `${open_tasks.length} upcoming` },
          { label: 'Activities', value: recent_activities.length.toString() },
        ].filter(Boolean).map((row: any) => (
          <div key={row.label} style={{ display: 'flex', padding: '3px 0', borderBottom: '1px solid #f5f5f5' }}>
            <span style={{ color: '#aaa', width: 72, flexShrink: 0, fontSize: 11 }}>{row.label}</span>
            {row.href
              ? <a href={row.href} style={{ fontSize: 11, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>{row.value}</a>
              : <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e' }}>{row.value}</span>}
          </div>
        ))}
      </div>

      {/* Entity tags */}
      <div style={{ padding: '6px 11px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {entities.map(e => (
          <span key={e.id} style={{ background: '#e3f2fd', color: BLUE_DARK, border: '1px solid #90caf9', borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
            {e.type === 'Project' ? '📁' : '🏢'} {e.name}
          </span>
        ))}
      </div>

      {/* Open in PCI */}
      <div style={{ padding: '0 11px 4px' }}>
        <button onClick={() => window.open(`${pciUrl}/people/${person.id}`, '_blank')}
          style={{ width: '100%', padding: '5px', border: `1px solid ${BLUE}`, color: BLUE, background: '#fff', cursor: 'pointer', fontSize: 11, borderRadius: 6, fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = BLUE; }}>
          ↗ Open in PCI
        </button>
      </div>

      <LogActivityPanel />

      {/* My Schedule / Open Tasks */}
      <SectionLabel title={`My Schedule (${open_tasks.length})`} />
      {open_tasks.map(t => <ActivityRow key={t.id} act={t} />)}

      {/* Recent Activities */}
      <SectionLabel title="Recent Activities" action="View All" onAction={() => window.open(`${pciUrl}/activity-list`, '_blank')} />
      {recent_activities.slice(0, 5).map(act => <ActivityRow key={act.id} act={act} />)}
    </div>
  );
}
