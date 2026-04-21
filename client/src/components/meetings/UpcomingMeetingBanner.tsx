import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useChatStore } from '../../store/chatStore';
import { useCallStore } from '../../store/callStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface UpcomingMeeting {
  id: number;
  channel_id: number;
  subject: string;
  meeting_date: string;
  duration_minutes: number;
  participants: any;
  status: string | null;
  channel: { id: number; name: string; type: string; logo_color?: string; logo_abbr?: string };
}

const DISMISS_KEY = 'ias_meeting_banner_dismissed';

function getDismissed(): Set<number> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr: number[] = JSON.parse(raw);
    return new Set(arr);
  } catch { return new Set(); }
}
function addDismissed(id: number) {
  const s = getDismissed();
  s.add(id);
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(s))); } catch {}
}

// Shows a green banner above the chat whenever a meeting is imminent:
// 5 minutes before start until 2 minutes after. Dismissals live in
// sessionStorage so they clear when the window closes.
export default function UpcomingMeetingBanner() {
  const { selectChannel, activeChannelId } = useChatStore();
  const { startCall } = useCallStore();
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [, forceRefresh] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchMeetings = () => {
      axios.get(`${API}/meetings/upcoming?hours=24`)
        .then(r => setMeetings(r.data.data || []))
        .catch(err => console.error('Fetch upcoming meetings error:', err));
    };
    fetchMeetings();
    pollRef.current = setInterval(fetchMeetings, 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(tick);
  }, []);

  const dismissed = getDismissed();
  // Show a banner if a meeting is either starting soon (pre-start phase,
  // up to 5 min before) OR currently in progress (start <= now < start+duration).
  // Prefer in-progress over pre-start if both match at the same instant.
  const imminent = meetings.find(m => {
    if (dismissed.has(m.id)) return false;
    const startMs = new Date(m.meeting_date).getTime();
    const endMs = startMs + (m.duration_minutes || 30) * 60_000;
    const msUntilStart = startMs - now;
    const isPreStart   = msUntilStart <= 5 * 60_000 && msUntilStart > 0;
    const isInProgress = now >= startMs && now < endMs;
    return isPreStart || isInProgress;
  });

  if (!imminent) return null;

  const startMs = new Date(imminent.meeting_date).getTime();
  const endMs   = startMs + (imminent.duration_minutes || 30) * 60_000;
  const isInProgress = now >= startMs;

  let label: string;
  if (!isInProgress) {
    const minsUntil = Math.ceil((startMs - now) / 60_000);
    label = minsUntil <= 0
      ? 'Starting now'
      : minsUntil === 1
        ? 'Starting in 1 min'
        : `Starting in ${minsUntil} min`;
  } else {
    const minsElapsed   = Math.floor((now - startMs) / 60_000);
    const minsRemaining = Math.ceil((endMs - now) / 60_000);
    label = minsRemaining <= 1
      ? '🔴 In progress · ending soon'
      : minsElapsed === 0
        ? '🔴 In progress · just started'
        : `🔴 In progress · ${minsElapsed} min elapsed`;
  }

  const handleJoin = () => {
    selectChannel(imminent.channel_id);
    setTimeout(() => startCall(imminent.channel_id, 'video'), 300);
    addDismissed(imminent.id);
    forceRefresh(x => x + 1);
  };

  const handleView = () => {
    selectChannel(imminent.channel_id);
    addDismissed(imminent.id);
    forceRefresh(x => x + 1);
  };

  const handleDismiss = () => {
    addDismissed(imminent.id);
    forceRefresh(x => x + 1);
  };

  const channelLabel = imminent.channel.type === 'dm'
    ? imminent.channel.name
    : imminent.channel.type === 'group'
      ? imminent.channel.name
      : `#${imminent.channel.name}`;

  // Pre-start = green (calm, preparatory), in-progress = red (urgent, live)
  const background = isInProgress
    ? 'linear-gradient(135deg,#c62828,#8e1e1e)'
    : 'linear-gradient(135deg,#2e7d32,#1b5e20)';
  const joinBtnColor = isInProgress ? '#c62828' : '#2e7d32';

  // Pulse the icon when it's truly urgent: about to start or about to end
  const shouldPulse = !isInProgress
    ? Math.ceil((startMs - now) / 60_000) <= 1
    : Math.ceil((endMs - now) / 60_000) <= 1;

  return (
    <div style={{
      background,
      color: '#fff',
      padding: '8px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 13,
      flexShrink: 0,
      borderBottom: '1px solid rgba(255,255,255,.15)',
    }}>
      <span style={{ fontSize: 16, animation: shouldPulse ? 'ias-meet-pulse 1.2s infinite' : undefined }}>📅</span>
      <style>{`@keyframes ias-meet-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.2)} }`}</style>

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontWeight: 700, marginRight: 8 }}>{label}:</span>
        <span style={{ fontWeight: 600 }}>{imminent.subject}</span>
        <span style={{ opacity: 0.85, marginLeft: 6 }}>
          · {channelLabel} · {imminent.duration_minutes} min
        </span>
      </div>

      <button onClick={handleJoin} style={btn('#fff', joinBtnColor, true)}>
        📹 Join{isInProgress ? ' now' : ''}
      </button>
      {activeChannelId !== imminent.channel_id && (
        <button onClick={handleView} style={btn('transparent', '#fff')}>
          View
        </button>
      )}
      <button onClick={handleDismiss} style={btn('transparent', '#fff')} title="Dismiss">
        ✕
      </button>
    </div>
  );
}

function btn(bg: string, color: string, bold = false): React.CSSProperties {
  return {
    padding: '4px 12px',
    background: bg,
    color,
    border: `1px solid ${bg === 'transparent' ? 'rgba(255,255,255,.4)' : bg}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: bold ? 700 : 500,
    fontFamily: 'inherit',
    transition: 'filter .15s',
  };
}
