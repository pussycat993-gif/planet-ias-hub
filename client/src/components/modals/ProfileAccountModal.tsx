import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { applyTheme } from '../../utils/theme';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const FONT = "'Merriweather Sans', 'Segoe UI', Arial, sans-serif";
const PREFS_KEY = 'ias_hub_profile_prefs';

type Section = 'profile' | 'account' | 'notif' | 'calls' | 'ai' | 'pci' | 'appearance';

// Client-side preferences. NOTE: persisted to localStorage for now. To move
// these server-side, register keys in server preferences/schemas.ts and swap
// the localStorage calls for GET/PUT /users/me/preferences (separate task).
const DEFAULT_PREFS = {
  language: 'en',
  notif_desktop: true, notif_sound: true, notif_scope: 'mentions', notif_quiet: false, notif_calls: true, notif_files: true,
  call_mic: 'default', call_camera: 'default', call_speaker: 'default', call_join_muted: true, call_camera_off: true, call_screen_quality: 'auto',
  ai_transcribe: true, ai_trans_lang: 'auto', ai_summary: true, ai_ask_inline: true, ai_save_pci: false,
  pci_auto_log: false, pci_sync_meetings: true, pci_default_activity: 'call',
  appearance_theme: 'light', appearance_density: 'comfortable',
};
type Prefs = typeof DEFAULT_PREFS;

interface AutoSettings {
  smart_logger: boolean; meeting_briefing: boolean; briefing_minutes_before: number;
  dwm_trigger: boolean; auto_channel: boolean; smart_notif: boolean;
}
const DEFAULT_AUTO: AutoSettings = {
  smart_logger: true, meeting_briefing: true, briefing_minutes_before: 15,
  dwm_trigger: true, auto_channel: false, smart_notif: true,
};

// ── Shared styles ─────────────────────────────────────────
const fr: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '0.5px solid var(--border)' };
const fl: React.CSSProperties = { fontSize: 13, color: 'var(--text)' };
const fsub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 };
const sel: React.CSSProperties = { padding: '7px 9px', border: '0.5px solid var(--border)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', maxWidth: 240 };
const inp: React.CSSProperties = { width: '100%', maxWidth: 300, padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' };
const btn: React.CSSProperties = { fontSize: 13, padding: '6px 12px', border: '0.5px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' };
const ptitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: '0 0 2px', color: 'var(--text)' };
const pdesc: React.CSSProperties = { fontSize: 13, color: 'var(--text2)', margin: '0 0 12px' };
const ffLabel: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 5 };
const sectionLabel: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', margin: '16px 0 6px' };

// ── Top-level helpers (kept outside the component to avoid remounts) ──
function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.3 3.1-5 7-5s7 1.7 7 5" /></>,
    shield: <><path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z" /><path d="M9.5 12l2 2 3.5-3.5" /></>,
    bell: <><path d="M10 5a2 2 0 1 1 4 0c3 1 4 3 4 6v3l1 2H5l1-2v-3c0-3 1-5 4-6" /><path d="M9 17a3 3 0 0 0 6 0" /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>,
    sparkles: <><path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z" /></>,
    plug: <><path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0z" /><path d="M12 16v5" /></>,
    palette: <><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none" /></>,
  };
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} aria-label={label} style={{ position: 'relative', width: 38, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? 'var(--blue-primary)' : '#ccd2da', flexShrink: 0, transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

function ToggleRow({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={fr}>
      <div><div style={fl}>{label}</div>{sub && <div style={fsub}>{sub}</div>}</div>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}

function SelectRow({ label, sub, value, onChange, options }: { label: string; sub?: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div style={fr}>
      <div><div style={fl}>{label}</div>{sub && <div style={fsub}>{sub}</div>}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={sel}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function FieldInput({ label, sub, value, disabled }: { label: string; sub?: string; value: string; disabled?: boolean }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
      <label style={ffLabel}>{label}</label>
      <input type="text" defaultValue={value} disabled={disabled} style={{ ...inp, opacity: disabled ? 0.7 : 1 }} />
      {sub && <div style={fsub}>{sub}</div>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────
export default function ProfileAccountModal({ onClose }: { onClose: () => void }) {
  const { user, setAvatar, setTimezone: saveTimezone } = useAuthStore();
  const u: any = user;
  const { openModal } = useUIStore();

  const [section, setSection] = useState<Section>('profile');
  const [timezone, setTimezone] = useState<string>(u?.timezone || 'Europe/Belgrade (CET)');
  const [twofa, setTwofa] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
  });
  const [auto, setAuto] = useState<AutoSettings>(DEFAULT_AUTO);
  const [saving, setSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [aiTest, setAiTest] = useState('');
  const [pciTest, setPciTest] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const PCI_URL = (import.meta.env.VITE_PCI_URL as string) || 'https://planetsg.com';

  type Dev = { id: string; label: string };
  const [devices, setDevices] = useState<{ mics: Dev[]; cams: Dev[]; spks: Dev[] }>({ mics: [], cams: [], spks: [] });
  const loadDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const pick = (kind: string, name: string): Dev[] => list.filter(d => d.kind === kind).map((d, i) => ({ id: d.deviceId, label: d.label || `${name} ${i + 1}` }));
      setDevices({ mics: pick('audioinput', 'Microphone'), cams: pick('videoinput', 'Camera'), spks: pick('audiooutput', 'Speaker') });
    } catch { /* ignore */ }
  };
  const detectDevices = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); s.getTracks().forEach(t => t.stop()); } catch { /* permission denied */ }
    loadDevices();
  };

  const onPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setAvatar(r.result as string);
    r.readAsDataURL(f);
    e.target.value = '';
  };
  const changePassword = async () => {
    setPwMsg('');
    try { await axios.post(`${API}/auth/reset-password`, { email: u?.email }); setPwMsg('If this email exists, a reset link has been sent.'); }
    catch { setPwMsg('Could not start password reset.'); }
  };
  const signOutOthers = async () => {
    if (!window.confirm('Sign out of all your other sessions?')) return;
    try {
      const { data } = await axios.post(`${API}/auth/logout-others`);
      window.alert(`Signed out ${data?.data?.signed_out ?? 0} other session(s).`);
    } catch {
      window.alert('Could not sign out other sessions.');
    }
  };

  const enableDesktop = async (v: boolean) => {
    if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPref('notif_desktop', false); window.alert('Desktop notifications are blocked at the OS / browser level.'); return; }
    }
    setPref('notif_desktop', v);
  };
  const testNotification = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('IAS Hub', { body: 'This is a test notification.' });
    } else {
      window.alert('Enable desktop notifications first.');
    }
  };
  const testAI = async () => {
    setAiTest('Testing…');
    try {
      const { data } = await axios.post(`${API}/ai/ask`, { question: 'Reply with a short hello to confirm you are working.' });
      setAiTest(data?.success ? 'AI responded ✓' : 'AI error');
    } catch (e: any) {
      setAiTest('AI error: ' + (e?.response?.data?.error || 'request failed'));
    }
  };
  const testPCI = async () => {
    setPciTest('Testing…');
    try {
      const { data } = await axios.get(`${API}/pci/users`);
      const arr = data?.data?.data ?? data?.data;
      const n = Array.isArray(arr) ? arr.length : '?';
      setPciTest(data?.success ? `Connected · ${n} PCI users` : 'PCI error');
    } catch (e: any) {
      setPciTest('PCI error: ' + (e?.response?.data?.error || 'unreachable'));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    axios.get(`${API}/automation/settings`).then(r => { if (r.data?.data) setAuto({ ...DEFAULT_AUTO, ...r.data.data }); }).catch(() => {});
  }, []);

  useEffect(() => { loadDevices(); }, []);

  const setPref = (k: keyof Prefs, v: any) => setPrefs(p => { const next = { ...p, [k]: v }; try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; });
  const setAutoK = (k: keyof AutoSettings, v: any) => setAuto(a => { const next = { ...a, [k]: v }; axios.put(`${API}/automation/settings`, next).catch(() => { /* ignore */ }); return next; });

  const save = async () => {
    setSaving(true);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    try { await saveTimezone(timezone); } catch { /* ignore */ }
    try { await axios.put(`${API}/automation/settings`, auto); } catch { /* ignore */ }
    setSaving(false);
    onClose();
  };

  const initials = (u?.name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const NAV: { id: Section; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'account', label: 'Account & security', icon: 'shield' },
    { id: 'notif', label: 'Notifications', icon: 'bell' },
    { id: 'calls', label: 'Calls & devices', icon: 'video' },
    { id: 'ai', label: 'AI & transcription', icon: 'sparkles' },
    { id: 'pci', label: 'PCI & automation', icon: 'plug' },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(6,25,43,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 12, width: 760, maxWidth: '95vw', height: 'min(540px, 88vh)', boxShadow: '0 16px 60px rgba(6,25,43,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--blue-primary)' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Profile &amp; account</span>
          <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, border: 'none', background: 'transparent', borderRadius: 6, cursor: 'pointer', color: 'rgba(255,255,255,.85)', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 190, borderRight: '0.5px solid var(--border)', padding: 10, flexShrink: 0, overflowY: 'auto' }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setSection(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', marginBottom: 2, background: section === n.id ? 'var(--bg)' : 'transparent', color: section === n.id ? 'var(--text)' : 'var(--text2)', fontWeight: section === n.id ? 600 : 400 }}>
                <Icon name={n.icon} />{n.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, padding: '18px 22px', overflowY: 'auto' }}>

            {section === 'profile' && (<>
              <p style={ptitle}>Profile</p>
              <p style={pdesc}>How you appear to your team across IAS Hub.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', background: u?.avatar_url ? 'transparent' : 'var(--blue-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600 }}>
                  {u?.avatar_url ? <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btn} onClick={() => fileRef.current?.click()}>Change photo</button>
                  <button style={{ ...btn, color: 'var(--red)' }} onClick={() => setAvatar(null)}>Remove</button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhotoFile} />
                </div>
              </div>
              <FieldInput label="Display name" value={u?.name || ''} disabled sub="Managed by your PLANet account (SSO)" />
              <FieldInput label="Title / role" value={u?.role || ''} disabled />
              <FieldInput label="Email" value={u?.email || ''} disabled />
              <div style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                <label style={ffLabel}>Time zone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...sel, maxWidth: 300 }}>
                  <option>Europe/Belgrade (CET)</option>
                  <option>Europe/London</option>
                  <option>America/New_York</option>
                  <option>America/Chicago</option>
                </select>
              </div>
              <div style={fr}>
                <div><div style={fl}>Custom status</div><div style={fsub}>{u?.status_emoji ? `${u.status_emoji} status set` : 'No status set'}</div></div>
                <button onClick={() => { onClose(); openModal('setStatus'); }} style={btn}>Edit</button>
              </div>
            </>)}

            {section === 'account' && (<>
              <p style={ptitle}>Account &amp; security</p>
              <p style={pdesc}>Sign-in, devices, and security for your IAS Hub account.</p>
              <div style={fr}><div><div style={fl}>PLANet Systems Group account</div><div style={fsub}>Connected via SSO · {u?.email}</div></div><button style={btn} onClick={() => window.open(PCI_URL, '_blank', 'noopener')}>Manage in PCI</button></div>
              <div style={fr}><div><div style={fl}>Password</div><div style={fsub}>{pwMsg || 'Changed via your PLANet account'}</div></div><button style={btn} onClick={changePassword}>Change</button></div>
              <ToggleRow label="Two-factor authentication" sub="Add an extra layer of security" on={twofa} onChange={setTwofa} />
              <div style={fr}><div><div style={fl}>Active sessions</div><div style={fsub}>This Mac · now &nbsp;·&nbsp; iPhone · 2h ago</div></div><button style={btn} onClick={signOutOthers}>Sign out others</button></div>
              <SelectRow label="Language" value={prefs.language} onChange={v => setPref('language', v)} options={[['en', 'English'], ['bhs', 'Bosanski / Hrvatski / Srpski']]} />
            </>)}

            {section === 'notif' && (<>
              <p style={ptitle}>Notifications</p>
              <p style={pdesc}>Control what reaches you and when.</p>
              <div style={fr}>
                <div><div style={fl}>Desktop notifications</div><div style={fsub}><span onClick={testNotification} style={{ color: 'var(--blue-primary)', cursor: 'pointer' }}>Send a test notification</span></div></div>
                <Toggle on={prefs.notif_desktop} onChange={enableDesktop} label="Desktop notifications" />
              </div>
              <ToggleRow label="Notification sound" on={prefs.notif_sound} onChange={v => setPref('notif_sound', v)} />
              <SelectRow label="Notify me about" value={prefs.notif_scope} onChange={v => setPref('notif_scope', v)} options={[['mentions', 'Mentions & DMs'], ['all', 'All messages'], ['none', 'Nothing']]} />
              <ToggleRow label="Quiet hours" sub="Pause notifications on a schedule" on={prefs.notif_quiet} onChange={v => setPref('notif_quiet', v)} />
              <ToggleRow label="Incoming calls" on={prefs.notif_calls} onChange={v => setPref('notif_calls', v)} />
              <ToggleRow label="Files shared with me" on={prefs.notif_files} onChange={v => setPref('notif_files', v)} />
            </>)}

            {section === 'calls' && (<>
              <p style={ptitle}>Calls &amp; devices</p>
              <p style={pdesc}>Defaults for audio, video, and screen share.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <button style={btn} onClick={detectDevices}>Detect devices</button>
              </div>
              <SelectRow label="Microphone" value={prefs.call_mic} onChange={v => setPref('call_mic', v)} options={[['default', 'System default'], ...devices.mics.map(d => [d.id, d.label] as [string, string])]} />
              <SelectRow label="Camera" value={prefs.call_camera} onChange={v => setPref('call_camera', v)} options={[['default', 'System default'], ...devices.cams.map(d => [d.id, d.label] as [string, string])]} />
              <SelectRow label="Speaker" value={prefs.call_speaker} onChange={v => setPref('call_speaker', v)} options={[['default', 'System default'], ...devices.spks.map(d => [d.id, d.label] as [string, string])]} />
              <ToggleRow label="Join calls with microphone muted" on={prefs.call_join_muted} onChange={v => setPref('call_join_muted', v)} />
              <ToggleRow label="Join calls with camera off" on={prefs.call_camera_off} onChange={v => setPref('call_camera_off', v)} />
              <SelectRow label="Screen share quality" value={prefs.call_screen_quality} onChange={v => setPref('call_screen_quality', v)} options={[['auto', 'Auto'], ['720', '720p'], ['1080', '1080p']]} />
            </>)}

            {section === 'ai' && (<>
              <p style={ptitle}>AI &amp; transcription</p>
              <p style={pdesc}>Whisper transcription and AI summaries for your calls.</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={fsub}>{aiTest}</span>
                <button style={btn} onClick={testAI}>Test Ask IAS</button>
              </div>
              <ToggleRow label="Auto-transcribe calls" sub="Whisper generates a transcript after each call" on={prefs.ai_transcribe} onChange={v => setPref('ai_transcribe', v)} />
              <SelectRow label="Transcription language" value={prefs.ai_trans_lang} onChange={v => setPref('ai_trans_lang', v)} options={[['auto', 'Auto-detect'], ['en', 'English'], ['bhs', 'BHS']]} />
              <ToggleRow label="Generate AI summary after calls" sub="Key points and action items" on={prefs.ai_summary} onChange={v => setPref('ai_summary', v)} />
              <ToggleRow label="Ask IAS suggestions in chat" sub="Inline AI assist while you type" on={prefs.ai_ask_inline} onChange={v => setPref('ai_ask_inline', v)} />
              <ToggleRow label="Save transcripts & summaries to PCI" on={prefs.ai_save_pci} onChange={v => setPref('ai_save_pci', v)} />
            </>)}

            {section === 'pci' && (<>
              <p style={ptitle}>PCI &amp; automation</p>
              <p style={pdesc}>How IAS Hub connects to PLANet Contact IAS.</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={fsub}>{pciTest}</span>
                <button style={btn} onClick={testPCI}>Test PCI connection</button>
              </div>
              <ToggleRow label="Auto-log conversations to PCI activity" sub="You choose which channels are logged" on={prefs.pci_auto_log} onChange={v => setPref('pci_auto_log', v)} />
              <ToggleRow label="Sync scheduled meetings from PCI" on={prefs.pci_sync_meetings} onChange={v => setPref('pci_sync_meetings', v)} />
              <SelectRow label="Default activity type for logged calls" value={prefs.pci_default_activity} onChange={v => setPref('pci_default_activity', v)} options={[['call', 'Call'], ['meeting', 'Meeting']]} />

              <div style={sectionLabel}>Automation modules</div>
              <ToggleRow label="Smart logger" on={auto.smart_logger} onChange={v => setAutoK('smart_logger', v)} />
              <ToggleRow label="Meeting briefing" sub={`Briefing ${auto.briefing_minutes_before} min before a meeting`} on={auto.meeting_briefing} onChange={v => setAutoK('meeting_briefing', v)} />
              <div style={fr}>
                <div style={fl}>Briefing lead time</div>
                <select value={String(auto.briefing_minutes_before)} onChange={e => setAutoK('briefing_minutes_before', parseInt(e.target.value, 10))} style={sel}>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                </select>
              </div>
              <ToggleRow label="DWM trigger" on={auto.dwm_trigger} onChange={v => setAutoK('dwm_trigger', v)} />
              <ToggleRow label="Auto channel creation" on={auto.auto_channel} onChange={v => setAutoK('auto_channel', v)} />
              <ToggleRow label="Smart notifications" on={auto.smart_notif} onChange={v => setAutoK('smart_notif', v)} />
            </>)}

            {section === 'appearance' && (<>
              <p style={ptitle}>Appearance</p>
              <p style={pdesc}>Theme and density for the IAS Hub window.</p>
              <SelectRow label="Theme" value={prefs.appearance_theme} onChange={v => { setPref('appearance_theme', v); applyTheme(v as any); }} options={[['light', 'Light'], ['system', 'System'], ['dark', 'Dark']]} />
              <div style={fr}><div><div style={fl}>Accent color</div><div style={fsub}>PLANet brand blue</div></div><span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--blue-primary)', border: '0.5px solid var(--border)' }} /></div>
              <SelectRow label="Message density" value={prefs.appearance_density} onChange={v => setPref('appearance_density', v)} options={[['comfortable', 'Comfortable'], ['compact', 'Compact']]} />
              <div style={fr}><div><div style={fl}>Interface font</div><div style={fsub}>Merriweather Sans (brand)</div></div></div>
            </>)}

          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '0.5px solid var(--border)' }}>
          <button onClick={onClose} style={{ fontSize: 14, fontWeight: 500, padding: '8px 16px', border: '0.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ fontSize: 14, fontWeight: 500, padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--blue-primary)', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
      </div>
    </div>
  );
}
