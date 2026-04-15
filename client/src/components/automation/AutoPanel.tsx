import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

interface AutoSettings {
  smart_logger: boolean;
  meeting_briefing: boolean;
  briefing_minutes_before: number;
  dwm_trigger: boolean;
  auto_channel: boolean;
  smart_notif: boolean;
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
  meeting_briefing: '📅',
  dwm_trigger: '🔄',
  auto_channel: '⬡',
  smart_logger: '📝',
  smart_notif: '🔔',
};

const EVENT_LABELS: Record<string, string> = {
  meeting_briefing: 'Meeting Briefing',
  dwm_trigger: 'DWM Trigger',
  auto_channel: 'Auto Channel',
  smart_logger: 'Smart Logger',
  smart_notif: 'Smart Notification',
};

function Toggle({ label, description, value, onChange }: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 0', borderBottom: '1px solid #f5f5f5', gap: 8,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{label}</div>
        {description && <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{description}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, flexShrink: 0,
          background: value ? BLUE : '#ccc',
          cursor: 'pointer', position: 'relative', transition: 'background .2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 18 : 3,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }} />
      </div>
    </div>
  );
}

function EventRow({ event }: { event: AutoEvent }) {
  const icon = EVENT_ICONS[event.event_type] || '⚙️';
  const label = EVENT_LABELS[event.event_type] || event.event_type;
  const time = new Date(event.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '5px 11px', borderBottom: '1px solid #f5f5f5', fontSize: 11,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: '#888' }}>
          by {event.triggered_by} · {time}
        </div>
      </div>
      <span style={{
        padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700,
        background: event.status === 'success' ? '#e8f5e9' : '#ffebee',
        color: event.status === 'success' ? '#2e7d32' : '#c62828',
      }}>
        {event.status}
      </span>
    </div>
  );
}

export default function AutoPanel() {
  const [settings, setSettings] = useState<AutoSettings>({
    smart_logger: true,
    meeting_briefing: true,
    briefing_minutes_before: 15,
    dwm_trigger: true,
    auto_channel: false,
    smart_notif: true,
  });
  const [events, setEvents] = useState<AutoEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'events'>('settings');

  // Fetch settings and events
  const fetchData = useCallback(async () => {
    try {
      const [sRes, eRes] = await Promise.all([
        axios.get(`${API}/automation/settings`),
        axios.get(`${API}/automation/events?limit=20`),
      ]);
      if (sRes.data.success) setSettings(sRes.data.data);
      if (eRes.data.success) setEvents(eRes.data.data);
    } catch { /* ignore — server may not be running */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveSettings = async (updated: AutoSettings) => {
    setSaving(true);
    try {
      await axios.put(`${API}/automation/settings`, updated);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof AutoSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: '#4a148c', color: '#fff', padding: '7px 11px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>⚡ Automations</span>
        <button
          onClick={fetchData}
          title="Refresh"
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 14 }}
        >
          ↻
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #7b1fa2', background: '#f8f9fa', flexShrink: 0 }}>
        {(['settings', 'events'] as const).map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, textAlign: 'center', padding: '6px 2px',
              fontSize: 11, cursor: 'pointer', fontWeight: 500,
              background: activeTab === tab ? '#7b1fa2' : 'transparent',
              color: activeTab === tab ? '#fff' : '#555',
            }}
          >
            {tab === 'settings' ? '⚙️ Settings' : '📋 Events'}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {activeTab === 'settings' && (
          <div style={{ padding: '8px 11px' }}>
            {saving && (
              <div style={{ fontSize: 10, color: BLUE, marginBottom: 6, textAlign: 'center' }}>
                Saving...
              </div>
            )}

            {/* Section: Core modules */}
            <div style={{
              background: '#eef2f7', color: BLUE_DARK, fontSize: 10, fontWeight: 700,
              padding: '3px 0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              Core Modules
            </div>

            <Toggle
              label="📝 Smart Activity Logger"
              description="Auto-scan call for Jira tickets, mentions, action items"
              value={settings.smart_logger}
              onChange={v => updateSetting('smart_logger', v)}
            />
            <Toggle
              label="📅 Meeting Prep Briefing"
              description="Post briefing card before upcoming meetings"
              value={settings.meeting_briefing}
              onChange={v => updateSetting('meeting_briefing', v)}
            />
            <Toggle
              label="🔄 DWM Workflow Trigger"
              description="Receive approve/reject actions from PCI workflows"
              value={settings.dwm_trigger}
              onChange={v => updateSetting('dwm_trigger', v)}
            />
            <Toggle
              label="⬡ Auto-Channel from PCI"
              description="Create channels when new Projects/Entities are added"
              value={settings.auto_channel}
              onChange={v => updateSetting('auto_channel', v)}
            />
            <Toggle
              label="🔔 Smart Notifications"
              description="Suppress muted, elevate @mentions and Jira references"
              value={settings.smart_notif}
              onChange={v => updateSetting('smart_notif', v)}
            />

            {/* Briefing timing */}
            {settings.meeting_briefing && (
              <div style={{ marginTop: 10 }}>
                <div style={{
                  background: '#eef2f7', color: BLUE_DARK, fontSize: 10, fontWeight: 700,
                  padding: '3px 0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em',
                }}>
                  Briefing Timing
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#555' }}>Send briefing</span>
                  <select
                    value={settings.briefing_minutes_before}
                    onChange={e => updateSetting('briefing_minutes_before', parseInt(e.target.value))}
                    style={{
                      border: '1px solid #dde1e7', borderRadius: 5, padding: '3px 6px',
                      fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {[5, 10, 15, 20, 30].map(m => (
                      <option key={m} value={m}>{m} minutes before</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Module status summary */}
            <div style={{ marginTop: 14, padding: '8px 10px', background: '#f3e5f5', borderRadius: 8, fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: '#4a148c', marginBottom: 4 }}>Active modules</div>
              {[
                { key: 'smart_logger', label: 'Smart Logger' },
                { key: 'meeting_briefing', label: 'Meeting Briefing' },
                { key: 'dwm_trigger', label: 'DWM Trigger' },
                { key: 'auto_channel', label: 'Auto Channel' },
                { key: 'smart_notif', label: 'Smart Notifications' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', color: '#555' }}>
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
          <>
            {events.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: 12 }}>
                No automation events yet
              </div>
            ) : (
              events.map(e => <EventRow key={e.id} event={e} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
