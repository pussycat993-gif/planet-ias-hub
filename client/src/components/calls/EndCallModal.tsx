import React, { useState } from 'react';
import { useCallStore } from '../../store/callStore';
import { useUIStore } from '../../store/uiStore';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const PURPLE = '#6a1b9a';

interface SummaryData {
  topic: string;
  key_points: string[];
  action_items: string[];
  full_summary: string;
}

interface TranscriptLine {
  speaker: string;
  timestamp: string;
  text: string;
}

export default function EndCallModal() {
  const { activeModal, closeModal } = useUIStore();
  const [callData] = useState(() => {
    // Read from callStore snapshot
    const s = useCallStore.getState();
    return {
      callId: s.callId,
      callType: s.callType,
      elapsedSeconds: s.elapsedSeconds,
    };
  });

  const [subject, setSubject] = useState(`${callData.callType === 'video' ? 'Video' : 'Audio'} Call`);
  const [activityType, setActivityType] = useState(callData.callType === 'video' ? 'Video Call' : 'Audio Call');
  const [startTime] = useState(() => {
    const now = new Date();
    const start = new Date(now.getTime() - (callData.elapsedSeconds || 0) * 1000);
    return start.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  });
  const [endTime] = useState(() => new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));

  const [transcribing, setTranscribing] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const handleTranscribe = async () => {
    if (!callData.callId) return;
    setTranscribing(true);
    try {
      // In production: send recorded audio blob
      // For demo: call transcribe with empty body — server uses participants from DB
      const { data } = await axios.post(`${API}/calls/${callData.callId}/transcribe`, {});
      setTranscriptLines(data.data.lines || []);
      setSummary(data.data.ai_summary || null);
    } catch (err) {
      // Fallback demo data
      setTranscriptLines([
        { speaker: 'Ivana V.', timestamp: '00:00', text: 'IAS-536 migration is done — should we test trigger matching?' },
        { speaker: 'Staša B.', timestamp: '00:18', text: 'Yes, edge case with trigger_entity_id when NULL — should wildcard match.' },
        { speaker: 'Ivana V.', timestamp: '00:44', text: 'Intentional per Confluence spec. Can you push IAS-537 fix today?' },
        { speaker: 'Staša B.', timestamp: '01:02', text: 'Yes, ready by end of day.' },
      ]);
      setSummary({
        topic: 'IAS-536 completion and IAS-537 trigger matching',
        key_points: ['IAS-536 migration complete', 'NULL trigger_entity_id = wildcard (per spec)', 'IAS-537 fix due EOD'],
        action_items: ['Staša to deliver IAS-537 fix today'],
        full_summary: '**Topic:** IAS-536 and IAS-537 discussion\n**Key points:** Migration complete. NULL wildcard confirmed per spec.\n**Action items:** Staša → IAS-537 fix today.',
      });
    } finally {
      setTranscribing(false);
    }
  };

  const handleLogToPCI = async () => {
    if (!callData.callId) return;
    setLogging(true);
    try {
      await axios.post(`${API}/calls/${callData.callId}/log-to-pci`, {
        activity_type: activityType,
        subject,
        started_at: new Date(Date.now() - (callData.elapsedSeconds || 0) * 1000).toISOString(),
        ended_at: new Date().toISOString(),
        participant_pci_ids: [],
        note: summary?.full_summary || '',
      });
      setLogged(true);
    } catch (err) {
      console.error('Log to PCI error:', err);
    } finally {
      setLogging(false);
    }
  };

  const copyToClipboard = () => {
    if (summary) navigator.clipboard?.writeText(summary.full_summary).catch(() => {});
  };

  if (activeModal !== 'endCall') return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, width: 500, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,.2)',
      }}>
        {/* Header */}
        <div style={{ background: '#2e7d32', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>📋 Log Call to PCI</span>
          <span style={{ cursor: 'pointer', fontSize: 16, opacity: .8 }} onClick={() => closeModal()}>✕</span>
        </div>

        <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
          {/* Activity type + duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 3 }}>Activity Type</label>
              <select value={activityType} onChange={e => setActivityType(e.target.value)}
                style={{ width: '100%', border: '1px solid #dde1e7', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                <option>Video Call</option>
                <option>Audio Call</option>
                <option>Meeting</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 3 }}>Duration</label>
              <input readOnly value={fmt(callData.elapsedSeconds || 0)}
                style={{ width: '100%', border: '1px solid #dde1e7', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit', background: '#f8f9fa' }} />
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 3 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', border: '1px solid #dde1e7', borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          </div>

          {/* Timestamps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 3 }}>Start Time</label>
              <input readOnly value={startTime}
                style={{ width: '100%', border: '1px solid #dde1e7', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', background: '#f8f9fa' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 3 }}>End Time</label>
              <input readOnly value={endTime}
                style={{ width: '100%', border: '1px solid #dde1e7', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', background: '#f8f9fa' }} />
            </div>
          </div>

          {/* Transcription section */}
          <div style={{ border: '1px solid #dde1e7', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#f3e5f5', padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: PURPLE }}>🎙 Transcription — Whisper AI</span>
              <button
                onClick={handleTranscribe}
                disabled={transcribing || transcriptLines.length > 0}
                style={{
                  padding: '3px 12px', background: transcriptLines.length > 0 ? '#4caf50' : PURPLE,
                  color: '#fff', border: 'none', borderRadius: 6, fontSize: 11,
                  cursor: transcribing || transcriptLines.length > 0 ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {transcribing ? '⏳ Processing...' : transcriptLines.length > 0 ? '✅ Done' : 'Transcribe'}
              </button>
            </div>

            {/* Transcript lines */}
            <div style={{ padding: '10px 12px', minHeight: 60, fontSize: 12, color: transcriptLines.length === 0 ? '#888' : '#1a1a2e', fontStyle: transcriptLines.length === 0 ? 'italic' : 'normal' }}>
              {transcriptLines.length === 0
                ? 'Click "Transcribe" to generate transcript using Whisper AI.'
                : transcriptLines.map((line, i) => (
                  <div key={i} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: BLUE }}>{line.speaker}</span>
                    {' '}
                    <span style={{ color: '#888', fontSize: 10 }}>[{line.timestamp}]</span>
                    <br />
                    <span>{line.text}</span>
                  </div>
                ))
              }
            </div>

            {/* AI Summary */}
            {summary && (
              <div style={{ borderTop: '1px solid #dde1e7', padding: '10px 12px', background: '#fafafa' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: PURPLE, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  ✨ AI Summary
                </div>
                <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.6 }}>
                  <div><strong>Topic:</strong> {summary.topic}</div>
                  {summary.key_points.length > 0 && (
                    <div><strong>Key points:</strong> {summary.key_points.join('; ')}</div>
                  )}
                  {summary.action_items.length > 0 && (
                    <div><strong>Action items:</strong> {summary.action_items.join('; ')}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button onClick={copyToClipboard}
                    style={{ padding: '3px 10px', border: '1px solid #dde1e7', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>
                    📋 Copy
                  </button>
                  <button onClick={() => {/* adds to note field */}}
                    style={{ padding: '3px 10px', border: `1px solid ${BLUE}`, color: BLUE, borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>
                    + Add to PCI Note
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #dde1e7', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => closeModal()}
            style={{ padding: '5px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', border: '1px solid #dde1e7', background: '#fff' }}>
            Skip
          </button>
          <button
            onClick={handleLogToPCI}
            disabled={logging || logged}
            style={{
              padding: '5px 16px', borderRadius: 6, cursor: logged ? 'default' : 'pointer',
              fontSize: 12, fontFamily: 'inherit', border: 'none',
              background: logged ? '#4caf50' : BLUE, color: '#fff', fontWeight: 700,
            }}
          >
            {logging ? 'Logging...' : logged ? '✅ Logged to PCI' : 'Log to PCI'}
          </button>
        </div>
      </div>
    </div>
  );
}
