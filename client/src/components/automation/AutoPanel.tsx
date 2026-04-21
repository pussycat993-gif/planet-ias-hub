import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const GRAY = '#607d8b';

interface AutoSettings {
  smart_logger: boolean;
  meeting_briefing: boolean;
  briefing_minutes_before: number;
  dwm_trigger: boolean;
  auto_channel: boolean;
  smart_notif: boolean;
  call_summary: boolean;
  task_due_reminder: boolean;
  task_due_hours_before: number;
}

interface AutoEvent {
  id: number;
  event_type: string;
  channel_id: number | null;
  triggered_by: string;
  status: 'success' | 'failed';
  created_at: string;
  payload: any;
}

const EVENT_ICONS: Record<string, string> = {
  meeting_briefing: '📅', dwm_trigger: '🔄', auto_channel: '⬡',
  smart_logger: '📝', smart_notif: '🔔', call_summary: '📋', task_due_reminder: '⏰',
};
const EVENT_LABELS: Record<string, string> = {
  meeting_briefing: 'Meeting Briefing', dwm_trigger: 'DWM Trigger', auto_channel: 'Auto Channel',
  smart_logger: 'Smart Logger', smart_notif: 'Smart Notification',
  call_summary: 'Call Summary', task_due_reminder: 'Task Due Reminder',
};

function Toggle({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', gap: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{label}</div>
        {description && <div style={{ fontSize: 10, color: '#888', marginTop: 1, lineHeight: 1.4 }}>{description}</div>}
      </div>
      <div onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, background: value ? BLUE : '#ccc', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ background: '#f0f2f5', color: '#546e7a', fontSize: 10, fontWeight: 700, padding: '4px 0 3px', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>
      {label}
    </div>
  );
}

function EventRow({ event }: { event: AutoEvent }) {
  const icon = EVENT_ICONS[event.event_type] || '⚙️';
  const label = EVENT_LABELS[event.event_type] || event.event_type;
  const time = new Date(event.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderBottom: '1px solid #f5f5f5', fontSize: 11 }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#888' }}>by {event.triggered_by} · {time}</div>
      </div>
      <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, background: event.status === 'success' ? '#e8f5e9' : '#ffebee', color: event.status === 'success' ? '#2e7d32' : '#c62828' }}>
        {event.status}
      </span>
    </div>
  );
}

const MODULE_LIST = [
  { key: 'smart_logger',      label: 'Smart Logger'        },
  { key: 'meeting_briefing',  label: 'Meeting Briefing'    },
  { key: 'dwm_trigger',       label: 'DWM Trigger'         },
  { key: 'auto_channel',      label: 'Auto Channel'        },
  { key: 'smart_notif',       label: 'Smart Notifications' },
  { key: 'call_summary',      label: 'Call Summary'        },
  { key: 'task_due_reminder', label: 'Task Due Reminder'   },
];

export default function AutoPanel() {
  const [settings, setSettings] = useState<AutoSettings>({
    smart_logger: true, meeting_briefing: true, briefing_minutes_before: 15,
    dwm_trigger: true, auto_channel: false, smart_notif: true,
    call_summary: true, task_due_reminder: true, task_due_hours_before: 24,
  });
  const [events, setEvents] = useState<AutoEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'events'>('settings');

  const fetchData = useCallback(async () => {
    try {
      const [sRes, eRes] = await Promise.all([
        axios.get(`${API}/automation/settings`),
        axios.get(`${API}/automation/events?limit=20`),
      ]);
      if (sRes.data.success) setSettings(prev => ({ ...prev, ...sRes.data.data }));
      if (eRes.data.success) setEvents(eRes.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveSettings = async (updated: AutoSettings) => {
    setSaving(true);
    try { await axios.put(`${API}/automation/settings`, updated); }
    catch { } finally { setSaving(false); }
  };

  const updateSetting = (key: keyof AutoSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const activeCount = MODULE_LIST.filter(m => (settings as any)[m.key]).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Segoe UI, Arial, sans-serif' }}>

      <div style={{ background: GRAY, color: '#fff', padding: '7px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 12 }}>⚡ Automations</span>
          <span style={{ background: 'rgba(255,255,255,.2)', padding: '1px 6px', borderRadius: 8, fontSize: 10 }}>{activeCount} active</span>
        </div>
        <button onClick={fetchData} title="Refresh" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 14 }}>↻</button>
      </div>

      <div style={{ display: 'flex', borderBottom: `2px solid ${GRAY}`, background: '#f8f9fa', flexShrink: 0 }}>
        {(['settings', 'events'] as const).map(tab => (
          <div key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, textAlign: 'center', padding: '6px 2px', fontSize: 11, cursor: 'pointer', fontWeight: 500, background: activeTab === tab ? GRAY : 'transparent', color: activeTab === tab ? '#fff' : '#555' }}>
            {tab === 'settings' ? '⚙️ Settings' : '📋 Events'}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'settings' && (
          <div style={{ padding: '4px 11px 14px' }}>
            {saving && <div style={{ fontSize: 10, color: BLUE, padding: '4px 0', textAlign: 'center' }}>Saving...</div>}

            <SectionLabel label="Core Modules" />
            <Toggle label="📝 Smart Activity Logger" description="After each call, suggests a PCI activity log with detected people, entities and action items from the transcript" value={settings.smart_logger} onChange={v => updateSetting('smart_logger', v)} />
            <Toggle label="📅 Meeting Prep Briefing" description="Posts a briefing card in the channel with PCI context before upcoming meetings" value={settings.meeting_briefing} onChange={v => updateSetting('meeting_briefing', v)} />
            <Toggle label="🔄 DWM Workflow Trigger" description="Approve or reject PCI document workflow steps directly from the chat" value={settings.dwm_trigger} onChange={v => updateSetting('dwm_trigger', v)} />
            <Toggle label="⬡ Auto-Channel from PCI" description="Creates a group channel when a new Client project or entity is added in PLANet Contact IAS" value={settings.auto_channel} onChange={v => updateSetting('auto_channel', v)} />
            <Toggle label="🔔 Smart Notifications" description="Suppresses muted channel noise, elevates @mentions and Jira task references" value={settings.smart_notif} onChange={v => updateSetting('smart_notif', v)} />

            <SectionLabel label="New Modules" />
            <Toggle
              label="📋 Call Summary to Channel"
              description="After a call ends, automatically posts a summary card in the channel — duration, participants, and key action items from the transcript"
              value={settings.call_summary}
              onChange={v => updateSetting('call_summary', v)}
            />
            <Toggle
              label="⏰ Task Due Reminder"
              description="Sends a notification and posts a reminder card in the relevant channel when a Jira task deadline is approaching"
              value={settings.task_due_reminder}
              onChange={v => updateSetting('task_due_reminder', v)}
            />

            {settings.meeting_briefing && (
              <>
                <SectionLabel label="Briefing Timing" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 0' }}>
                  <span style={{ color: '#555' }}>Send briefing</span>
                  <select value={settings.briefing_minutes_before} onChange={e => updateSetting('briefing_minutes_before', parseInt(e.target.value))} style={{ border: '1px solid #dde1e7', borderRadius: 5, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {[5, 10, 15, 20, 30].map(m => <option key={m} value={m}>{m} minutes before</option>)}
                  </select>
                </div>
              </>
            )}

            {settings.task_due_reminder && (
              <>
                <SectionLabel label="Task Reminder Timing" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 0' }}>
                  <span style={{ color: '#555' }}>Remind</span>
                  <select value={settings.task_due_hours_before} onChange={e => updateSetting('task_due_hours_before', parseInt(e.target.value))} style={{ border: '1px solid #dde1e7', borderRadius: 5, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>
                    <option value={2}>2 hours before</option>
                    <option value={4}>4 hours before</option>
                    <option value={24}>1 day before</option>
                    <option value={48}>2 days before</option>
                  </select>
                </div>
              </>
            )}

            {/* Status summary */}
            <div style={{ marginTop: 14, padding: '8px 10px', background: '#f0f2f5', borderRadius: 8, fontSize: 11, border: '1px solid #dde1e7' }}>
              <div style={{ fontWeight: 700, color: GRAY, marginBottom: 6 }}>Active modules</div>
              {MODULE_LIST.map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#555' }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 700, color: (settings as any)[key] ? '#2e7d32' : '#bbb' }}>
                    {(settings as any)[key] ? '● ON' : '○ OFF'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          events.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
              No automation events yet
            </div>
          ) : events.map(e => <EventRow key={e.id} event={e} />)
        )}
      </div>
    </div>
  );
}
