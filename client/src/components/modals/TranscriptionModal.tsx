import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LogActivityModal from './LogActivityModal';
import Icon from '@/components/ui/Icon';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = 'var(--blue-primary)';
const BLUE_DARK = 'var(--blue-dark)';

// ── Types ──────────────────────────────────────────────────────
interface Props {
  fileId: number;
  fileName: string;
  mimeType: string;
  streamUrl: string;
  onClose: () => void;
}

interface TranscriptData {
  text: string;
  duration: number;
  language: string;
  file_name: string;
  kind: 'audio' | 'video' | 'voice-note';
  provider: string;
}

// ── Component ──────────────────────────────────────────────────
export default function TranscriptionModal({ fileId, fileName, mimeType, streamUrl, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TranscriptData | null>(null);
  const [editedText, setEditedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const isVideo = mimeType.startsWith('video/');

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.post(`${API}/transcribe/${fileId}`)
      .then(r => {
        const d = r.data.data as TranscriptData;
        setData(d);
        setEditedText(d.text);
      })
      .catch(err => {
        console.error('Transcribe error:', err);
        setError(err.response?.data?.error || 'Transcription failed');
      })
      .finally(() => setLoading(false));
  }, [fileId]);

  const fmtDur = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {/* ignore */}
  };

  const downloadAsText = () => {
    const blob = new Blob([editedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.[^.]+$/, '') + '-transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {showLogModal && (
        <LogActivityModal
          initialSubject={isVideo ? `Video — ${fileName.replace(/\.[^.]+$/, '')}` : `Audio — ${fileName.replace(/\.[^.]+$/, '')}`}
          initialActivityType={isVideo ? 'Video' : 'Audio'}
          initialNote={editedText}
          onClose={() => setShowLogModal(false)}
          onSaved={() => onClose()}
        />
      )}

      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: 'var(--surface)', borderRadius: 12, width: 720, maxWidth: '96vw', maxHeight: '85vh', boxShadow: '0 12px 50px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: BLUE_DARK, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name={isVideo ? 'clapperboard' : 'mic'} size={15} />
                <span>Transcription</span>
                {data?.provider === 'mock' && (
                  <span style={{ fontSize: 10, background: 'rgba(230,81,0,.18)', color: 'var(--orange)', padding: '2px 7px', borderRadius: 10, fontWeight: 600, letterSpacing: '.04em' }}>
                    DEMO
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>
                {fileName}
                {data && ` · ${fmtDur(data.duration)} · ${data.language.toUpperCase()}`}
              </div>
            </div>
            <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--text3)', display: 'inline-flex' }}><Icon name="close" size={20} /></span>
          </div>

          {/* Media player */}
          <div style={{ padding: '10px 18px 0', flexShrink: 0 }}>
            {isVideo ? (
              <video controls src={streamUrl} style={{ width: '100%', maxHeight: 240, borderRadius: 8, background: '#000', display: 'block' }} />
            ) : (
              <audio controls src={streamUrl} style={{ width: '100%', height: 38 }} />
            )}
          </div>

          {/* Transcript area */}
          <div style={{ flex: 1, padding: '12px 18px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="file-text" size={11} /> Transcript
            </div>

            {loading ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text3)' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: BLUE, animation: `ias-bounce 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <style>{`@keyframes ias-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-8px); opacity: 1; } }`}</style>
                <div style={{ fontSize: 13 }}>Transcribing…</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>This may take a few seconds</div>
              </div>
            ) : error ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#c62828' }}>
                <Icon name="alert" size={32} color="#c62828" />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{error}</div>
                <button onClick={onClose} style={{ marginTop: 8, padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  Close
                </button>
              </div>
            ) : (
              <textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                style={{ flex: 1, width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.6, color: 'var(--text)', boxSizing: 'border-box', minHeight: 0, background: 'var(--surface)' }}
              />
            )}
          </div>

          {/* Footer actions */}
          {!loading && !error && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0, flexWrap: 'wrap' }}>
              <button onClick={copyToClipboard}
                style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-light-active)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                {copied ? <><Icon name="check" size={12} /> Copied!</> : <><Icon name="clipboard" size={12} /> Copy</>}
              </button>
              <button onClick={downloadAsText}
                style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--neutral-light-active)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                <Icon name="download" size={12} /> Download .txt
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowLogModal(true)}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 7, background: BLUE, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="link" size={12} color="#fff" /> Log to PCI →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
