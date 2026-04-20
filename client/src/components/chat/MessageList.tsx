import React, { useEffect, useRef, useCallback, useState } from 'react';
import axios from 'axios';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useLastRead } from '../../hooks/useLastRead';
import UserProfileModal from '../modals/UserProfileModal';
import TranscriptionModal from '../modals/TranscriptionModal';
import LogActivityModal from '../modals/LogActivityModal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Avatar with optional status dot ──────────────────────
function Avatar({ name, avatarUrl, size = 32, status, showStatus = false, onClick }: {
  name: string; avatarUrl?: string; size?: number;
  status?: string; showStatus?: boolean; onClick?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const bg = stringToColor(name);
  const dotColor = status === 'online' ? '#4caf50' : status === 'away' ? '#ff9800' : '#bbb';
  const dotSize = Math.max(8, Math.round(size * 0.28));

  const inner = avatarUrl && !imgError ? (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
      <img src={avatarUrl} alt={name} onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
    </div>
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff' }}>
      {initials}
    </div>
  );

  return (
    <div onClick={onClick} style={{ position: 'relative', flexShrink: 0, cursor: onClick ? 'pointer' : 'default', width: size, height: size }}>
      {inner}
      {showStatus && (
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: dotSize, height: dotSize, borderRadius: '50%',
          background: dotColor, border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,.06)',
        }} />
      )}
    </div>
  );
}

// ── Emoji reaction bar ────────────────────────────────────
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🙏', '🎉', '🔥'];

function EmojiReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: '#fff', border: '1px solid #eee', borderRadius: 20, padding: '2px 6px', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
      {QUICK_EMOJIS.map(e => (
        <span key={e} onClick={() => onReact(e)} style={{ fontSize: 16, cursor: 'pointer', padding: '2px 3px', borderRadius: 6, transition: 'transform .1s' }}
          onMouseEnter={el => (el.currentTarget.style.transform = 'scale(1.3)')}
          onMouseLeave={el => (el.currentTarget.style.transform = 'scale(1)')}
        >{e}</span>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', marginBottom: 2 }}>
      <span style={{ color: '#888', width: 80, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{children}</span>
    </div>
  );
}

function CardBtn({ children, primary, danger, purple, onClick }: {
  children: React.ReactNode; primary?: boolean; danger?: boolean; purple?: boolean; onClick?: () => void;
}) {
  const bg = danger ? '#c62828' : purple ? '#6a1b9a' : primary ? BLUE : '#fff';
  const color = (danger || primary || purple) ? '#fff' : '#555';
  return <button onClick={onClick} style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: bg, color, border: (danger || primary || purple) ? 'none' : '1px solid #dde1e7' }}>{children}</button>;
}

function MeetingCard({ p }: { p: any }) {
  return (
    <div style={{ border: '1px solid #90caf9', borderRadius: 8, overflow: 'hidden', maxWidth: 420 }}>
      <div style={{ background: BLUE, color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>📅 Scheduled Meeting</div>
      <div style={{ padding: '8px 12px', fontSize: 12 }}>
        <Row label="Subject">{p.subject}</Row>
        <Row label="Date">{new Date(p.meeting_date).toLocaleString()}</Row>
        <Row label="Duration">{p.duration_minutes} min</Row>
        <Row label="Attendees">{(p.participants || []).join(', ')}</Row>
        {p.entities?.length > 0 && <Row label="Entities">{p.entities.join(', ')}</Row>}
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid #dde1e7', display: 'flex', gap: 8 }}>
        <CardBtn primary>📹 Join Call</CardBtn>
        <CardBtn>↗ Open in PCI</CardBtn>
      </div>
    </div>
  );
}

function DWMCard({ p }: { p: any; messageId: number }) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'processing'>('pending');
  const handleAction = useCallback(async (action: 'approve' | 'reject') => {
    setStatus('processing');
    try {
      await axios.post(`${API}/automation/dwm-action`, { workflow_step_id: p.pci_workflow_step_id, action });
      setStatus(action === 'approve' ? 'approved' : 'rejected');
    } catch { setStatus('pending'); }
  }, [p.pci_workflow_step_id]);
  return (
    <div style={{ border: '1px solid #ce93d8', borderRadius: 8, overflow: 'hidden', background: '#f3e5f5', maxWidth: 420 }}>
      <div style={{ background: '#6a1b9a', color: '#fff', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>🔄 DWM Workflow Trigger</div>
      <div style={{ padding: '8px 12px', fontSize: 12 }}>
        <Row label="Workflow">{p.workflow_name}</Row>
        <Row label="Document">{p.document}</Row>
        <Row label="Step">{p.step}</Row>
        <Row label="Status">
          {status === 'pending' && <span style={{ color: '#e65100', fontWeight: 600 }}>⏳ Awaiting</span>}
          {status === 'processing' && <span style={{ color: '#888' }}>Processing...</span>}
          {status === 'approved' && <span style={{ color: '#2e7d32', fontWeight: 600 }}>✅ Approved</span>}
          {status === 'rejected' && <span style={{ color: '#c62828', fontWeight: 600 }}>✕ Rejected</span>}
        </Row>
      </div>
      {status === 'pending' && (
        <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', gap: 8 }}>
          <CardBtn primary purple onClick={() => handleAction('approve')}>✅ Approve</CardBtn>
          <CardBtn danger onClick={() => handleAction('reject')}>✕ Reject</CardBtn>
        </div>
      )}
    </div>
  );
}

function FileCard({ file, fileName }: { file?: Message['file']; fileName: string }) {
  const ext = (file?.name || fileName).split('.').pop()?.toLowerCase() || '';
  const mime = file?.mime_type || '';
  const isAudio = mime.startsWith('audio/') || /^(webm|ogg|mp3|wav|m4a|oga)$/i.test(ext);
  const isImage = mime.startsWith('image/') || /^(png|jpe?g|gif|webp)$/i.test(ext);
  const isVideo = mime.startsWith('video/') || /^(mp4|mov|mkv)$/i.test(ext);

  // Build URLs when we have a real file record from the backend
  const API_ROOT = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
  const streamUrl  = file?.basename ? `${API_ROOT}/uploads/${file.basename}` : null;
  const downloadUrl = file?.id ? `${API_ROOT}/api/files/${file.id}/download` : null;

  const [showTranscription, setShowTranscription] = useState(false);
  const [showLogToPCI, setShowLogToPCI] = useState(false);

  const icons: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
    sql: '🗄️', md: '📋', txt: '📋', fig: '🎨',
    webm: '🎙️', ogg: '🎙️', mp3: '🎙️', wav: '🎙️', m4a: '🎙️',
    mp4: '🎬', mov: '🎬',
  };
  const fmtBytes = (b?: number) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Small action button style for the Transcribe / Log to PCI row
  const actionBtnStyle: React.CSSProperties = {
    padding: '4px 9px', fontSize: 11, fontFamily: 'inherit',
    border: '1px solid #dde1e7', borderRadius: 6, background: '#fff', cursor: 'pointer',
    color: '#555', display: 'inline-flex', alignItems: 'center', gap: 4,
  };

  const renderModals = () => (
    <>
      {showTranscription && file && streamUrl && (
        <TranscriptionModal
          fileId={file.id}
          fileName={file.name}
          mimeType={file.mime_type}
          streamUrl={streamUrl}
          onClose={() => setShowTranscription(false)}
        />
      )}
      {showLogToPCI && file && (
        <LogActivityModal
          initialSubject={`${isVideo ? 'Video' : isAudio ? 'Audio' : 'File'} — ${file.name}`}
          initialActivityType={isVideo ? 'Video' : isAudio ? 'Audio' : 'Note'}
          initialNote={`Attached file: ${file.name}`}
          onClose={() => setShowLogToPCI(false)}
        />
      )}
    </>
  );

  // ── Audio player card ──────────────────────────────────
  if (isAudio && streamUrl && file) {
    const isVoiceNote = /^voice-note-/i.test(file.name);
    return (
      <>
        {renderModals()}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', border: '1px solid #dde1e7', borderRadius: 10, background: isVoiceNote ? '#f0f7ff' : '#f8f9fa', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{isVoiceNote ? '🎙️' : '🔊'}</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: BLUE_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {isVoiceNote ? 'Voice note' : file.name}
                </div>
                {downloadUrl && (
                  <a href={downloadUrl} download={file.name} title="Download"
                    style={{ color: '#888', textDecoration: 'none', fontSize: 14, padding: '0 4px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
                    onMouseLeave={e => (e.currentTarget.style.color = '#888')}>
                    ⬇
                  </a>
                )}
              </div>
              <audio controls src={streamUrl} preload="metadata" style={{ width: '100%', height: 32 }} />
              <div style={{ fontSize: 10, color: '#888' }}>{fmtBytes(file.size)}</div>
            </div>
          </div>
          {/* Action row */}
          <div style={{ display: 'flex', gap: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,.05)' }}>
            <button onClick={() => setShowTranscription(true)} style={actionBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.color = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#555'; }}>
              <span>📝</span> Transcribe
            </button>
            <button onClick={() => setShowLogToPCI(true)} style={actionBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.color = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#555'; }}>
              <span>🔗</span> Log to PCI
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Image thumbnail card ─────────────────────────────────
  if (isImage && streamUrl && file) {
    return (
      <>
        {renderModals()}
        <div style={{ display: 'inline-block', borderRadius: 10, overflow: 'hidden', border: '1px solid #dde1e7', maxWidth: 320 }}>
          <a href={streamUrl} target="_blank" rel="noreferrer">
            <img src={streamUrl} alt={file.name} style={{ maxWidth: '100%', maxHeight: 240, display: 'block' }} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#fff' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: BLUE_DARK, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
            <span style={{ fontSize: 10, color: '#888' }}>{fmtBytes(file.size)}</span>
            {downloadUrl && (
              <a href={downloadUrl} download={file.name} title="Download"
                style={{ color: '#888', textDecoration: 'none', fontSize: 13, padding: '0 2px' }}
                onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
                onMouseLeave={e => (e.currentTarget.style.color = '#888')}>⬇</a>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '4px 10px 8px', background: '#fff', borderTop: '1px solid rgba(0,0,0,.04)' }}>
            <button onClick={() => setShowLogToPCI(true)} style={actionBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.color = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#555'; }}>
              <span>🔗</span> Log to PCI
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Video player card ──────────────────────────────────
  if (isVideo && streamUrl && file) {
    return (
      <>
        {renderModals()}
        <div style={{ display: 'inline-block', borderRadius: 10, overflow: 'hidden', border: '1px solid #dde1e7', maxWidth: 380, background: '#000' }}>
          <video controls src={streamUrl} preload="metadata" style={{ width: '100%', maxHeight: 240, display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#fff' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: BLUE_DARK, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
            <span style={{ fontSize: 10, color: '#888' }}>{fmtBytes(file.size)}</span>
            {downloadUrl && (
              <a href={downloadUrl} download={file.name} title="Download"
                style={{ color: '#888', textDecoration: 'none', fontSize: 13, padding: '0 2px' }}
                onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
                onMouseLeave={e => (e.currentTarget.style.color = '#888')}>⬇</a>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '4px 10px 8px', background: '#fff', borderTop: '1px solid rgba(0,0,0,.04)' }}>
            <button onClick={() => setShowTranscription(true)} style={actionBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.color = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#555'; }}>
              <span>📝</span> Transcribe
            </button>
            <button onClick={() => setShowLogToPCI(true)} style={actionBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.color = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#555'; }}>
              <span>🔗</span> Log to PCI
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Generic file card (fallback) ───────────────────────────
  const displayName = file?.name || fileName;
  return (
    <>
      {renderModals()}
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, maxWidth: 340 }}>
        <a href={downloadUrl || '#'} download={displayName} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', border: '1px solid #dde1e7', borderRadius: 8, background: '#f8f9fa', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e3f2fd')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f8f9fa')}>
          <span style={{ fontSize: 22 }}>{icons[ext] || '📎'}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: BLUE_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>
              {ext.toUpperCase()}{file?.size ? ` · ${fmtBytes(file.size)}` : ''} · Click to download
            </div>
          </div>
        </a>
        {file && (
          <button onClick={() => setShowLogToPCI(true)} style={{ ...actionBtnStyle, alignSelf: 'flex-start' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.color = BLUE; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#555'; }}>
            <span>🔗</span> Log to PCI
          </button>
        )}
      </div>
    </>
  );
}

// ── Highlight matched text in search results ─────────────────────
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.trim();
  const escaped = q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('(' + escaped + ')', 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ background: '#fff59d', padding: '0 1px', borderRadius: 2, color: '#1a1a2e' }}>{part}</mark>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

interface MessageRowProps {
  msg: Message; prevMsg?: Message; isGroup: boolean;
  onReply: (msg: Message) => void; onPin: (msgId: number) => void;
  onProfileClick: (sender: Message['sender']) => void;
  pinnedIds: Set<number>; localReactions: Record<number, string[]>;
  onReact: (msgId: number, emoji: string) => void;
  searchQuery?: string;
}

function MessageRow({ msg, prevMsg, isGroup, onReply, onPin, onProfileClick, pinnedIds, localReactions, onReact, searchQuery }: MessageRowProps) {
  const { user } = useAuthStore();
  const editMessageAction = useChatStore(s => s.editMessage);
  const deleteMessageAction = useChatStore(s => s.deleteMessage);
  const togglePinMessageAction = useChatStore(s => s.togglePinMessage);

  const [hovered, setHovered] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close actions menu on outside click
  useEffect(() => {
    if (!showActions) return;
    const h = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showActions]);

  const isMine = msg.sender?.id === user?.id;
  const isContinuation = prevMsg?.sender?.id === msg.sender?.id &&
    prevMsg?.message_type === msg.message_type &&
    (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 5 * 60 * 1000;

  const isPinned = msg.pinned || pinnedIds.has(msg.id);
  const reactions = localReactions[msg.id] || [];
  const showStatusDot = isGroup && !isMine;

  const startEdit = () => {
    setEditText(msg.body || '');
    setEditing(true);
    setShowActions(false);
  };
  const saveEdit = async () => {
    if (!editText.trim()) { cancelEdit(); return; }
    await editMessageAction(msg.id, editText);
    setEditing(false);
    setEditText('');
  };
  const cancelEdit = () => { setEditing(false); setEditText(''); };

  if (msg.message_type === 'meeting_card' && msg.automation_payload) {
    return <div style={{ padding: '4px 12px' }}><MeetingCard p={msg.automation_payload} /></div>;
  }
  if (msg.message_type === 'dwm_card' && msg.automation_payload) {
    return <div style={{ padding: '4px 12px' }}><DWMCard p={msg.automation_payload} messageId={msg.id} /></div>;
  }
  if (msg.deleted_at) {
    return <div style={{ padding: '2px 12px 2px 52px', color: '#aaa', fontSize: 11, fontStyle: 'italic' }}>Message deleted</div>;
  }

  const senderName = msg.sender?.name || 'System';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowEmoji(false); }}
      style={{
        display: 'flex', gap: 10, padding: isContinuation ? '1px 12px' : '6px 12px 2px',
        alignItems: 'flex-start', position: 'relative',
        background: hovered ? 'rgba(25,118,210,.04)' : isPinned ? 'rgba(249,168,37,.04)' : isMine ? 'rgba(25,118,210,.02)' : 'transparent',
        borderLeft: isPinned ? '3px solid #f9a825' : '3px solid transparent',
        transition: 'background .1s',
      }}
    >
      <div style={{ width: 34, flexShrink: 0, marginTop: isContinuation ? 0 : 2 }}>
        {!isContinuation ? (
          <Avatar name={senderName} avatarUrl={msg.sender?.avatar_url} size={32}
            status={msg.sender?.status} showStatus={showStatusDot}
            onClick={() => msg.sender && onProfileClick(msg.sender)} />
        ) : <div style={{ width: 32 }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!isContinuation && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 2 }}>
            <span onClick={() => msg.sender && onProfileClick(msg.sender)}
              style={{ fontSize: 13, fontWeight: 700, color: isMine ? BLUE_DARK : '#1a1a2e', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
              {isMine ? 'You' : senderName}
            </span>
            <span style={{ fontSize: 10, color: '#bbb' }}>{formatTime(msg.created_at)}</span>
            {isPinned && <span style={{ fontSize: 9, color: '#f9a825', fontWeight: 700 }}>📌 PINNED</span>}
          </div>
        )}

        {msg.message_type === 'file' ? (
          <FileCard file={msg.file} fileName={msg.body || 'file'} />
        ) : editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              }}
              autoFocus
              rows={Math.max(1, Math.min(6, (editText.match(/\n/g) || []).length + 1))}
              style={{
                width: '100%', maxWidth: 560,
                border: '1px solid #90caf9', borderRadius: 8,
                padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                background: '#fff', resize: 'vertical', boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={saveEdit}
                style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Save
              </button>
              <button onClick={cancelEdit}
                style={{ background: '#fff', color: '#555', border: '1px solid #dde1e7', borderRadius: 5, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4 }}>
                Enter to save · Esc to cancel
              </span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#1a1a2e', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {searchQuery ? highlightText(msg.body || '', searchQuery) : msg.body}
            {msg.edited && <span style={{ fontSize: 10, color: '#bbb', marginLeft: 5, fontStyle: 'italic' }}>(edited)</span>}
          </div>
        )}

        {reactions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {reactions.map((emoji, i) => (
              <span key={i} onClick={() => onReact(msg.id, emoji)}
                style={{ background: '#f0f7ff', border: '1px solid #90caf9', borderRadius: 12, padding: '2px 7px', fontSize: 13, cursor: 'pointer' }}>
                {emoji}
              </span>
            ))}
          </div>
        )}

        {/* Thread indicator — shows reply count and last-reply time */}
        {(msg.thread_count || 0) > 0 && (
          <div onClick={() => useUIStore.getState().openThread(msg.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
              padding: '3px 9px', borderRadius: 14, cursor: 'pointer',
              background: '#f0f7ff', border: '1px solid #c5def9',
              fontSize: 11, color: BLUE_DARK, fontWeight: 600,
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = BLUE; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f0f7ff'; e.currentTarget.style.borderColor = '#c5def9'; }}>
            <span style={{ fontSize: 12 }}>💬</span>
            <span>{msg.thread_count} {msg.thread_count === 1 ? 'reply' : 'replies'}</span>
            {msg.thread_last_reply_at && (
              <span style={{ color: '#888', fontWeight: 400, fontSize: 10 }}>
                · Last reply {formatTime(msg.thread_last_reply_at)}
              </span>
            )}
          </div>
        )}
      </div>

      {hovered && !editing && (
        <div style={{ position: 'absolute', top: -14, right: 12, display: 'flex', gap: 4, background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,.1)', zIndex: 10 }}>
          <span onClick={() => setShowEmoji(s => !s)} style={{ fontSize: 16, cursor: 'pointer', padding: '1px 3px' }} title="React">😊</span>
          <span onClick={() => useUIStore.getState().openThread(msg.id)} style={{ fontSize: 14, cursor: 'pointer', padding: '1px 3px', color: '#888' }} title="Reply in thread">↩</span>
          <span onClick={() => togglePinMessageAction(msg.id, !isPinned)} style={{ fontSize: 14, cursor: 'pointer', padding: '1px 3px', color: isPinned ? '#f9a825' : '#888' }} title={isPinned ? 'Unpin' : 'Pin'}>📌</span>
          <div ref={actionsRef} style={{ position: 'relative' }}>
            <span
              onClick={() => setShowActions(s => !s)}
              style={{ fontSize: 18, cursor: 'pointer', padding: '0 4px', color: '#555', lineHeight: 1, fontWeight: 700, userSelect: 'none' }}
              title="More"
            >⋮</span>
            {showActions && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                background: '#fff', border: '1px solid #dde1e7', borderRadius: 8,
                boxShadow: '0 6px 20px rgba(0,0,0,.16)', minWidth: 170, overflow: 'hidden',
              }}>
                {/* Copy — available for all non-deleted, non-file text messages */}
                {msg.body && !msg.deleted_at && msg.message_type !== 'file' && (
                  <div
                    onClick={() => {
                      if (msg.body) navigator.clipboard?.writeText(msg.body).catch(() => {});
                      setShowActions(false);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#1a1a2e' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📋</span>
                    <span>Copy text</span>
                  </div>
                )}

                {/* Edit — own text messages only */}
                {isMine && !msg.deleted_at && msg.message_type !== 'file' && (
                  <div
                    onClick={startEdit}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#1a1a2e' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>✏️</span>
                    <span>Edit</span>
                  </div>
                )}

                {/* Pin */}
                <div
                  onClick={() => {
                    togglePinMessageAction(msg.id, !isPinned);
                    setShowActions(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#1a1a2e' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📌</span>
                  <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                </div>

                {/* Delete — own messages only, with inline confirmation */}
                {isMine && !msg.deleted_at && (
                  <>
                    {!confirmDelete ? (
                      <div
                        onClick={() => setConfirmDelete(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#c62828', borderTop: '1px solid #f0f0f0' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>🗑️</span>
                        <span>Delete</span>
                      </div>
                    ) : (
                      <div style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0', background: '#fff5f5' }}>
                        <div style={{ fontSize: 11, color: '#c62828', fontWeight: 600, marginBottom: 6 }}>Delete this message?</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              deleteMessageAction(msg.id);
                              setShowActions(false);
                              setConfirmDelete(false);
                            }}
                            style={{ flex: 1, padding: '5px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            style={{ padding: '5px 10px', background: '#fff', color: '#555', border: '1px solid #dde1e7', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showEmoji && hovered && (
        <div style={{ position: 'absolute', top: -48, right: 12, zIndex: 20 }}>
          <EmojiReactionBar onReact={emoji => { onReact(msg.id, emoji); setShowEmoji(false); }} />
        </div>
      )}
    </div>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const text = names.length === 1 ? `${names[0]} is typing...`
    : names.length === 2 ? `${names[0]} and ${names[1]} are typing...`
    : 'Several people are typing...';
  return (
    <div style={{ padding: '4px 12px 4px 54px', display: 'flex', alignItems: 'center', gap: 7, height: 24 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#aaa', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{text}</span>
      <style>{`@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }`}</style>
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 6px', userSelect: 'none' }}>
      <div style={{ flex: 1, height: 1, background: '#eee' }} />
      <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#eee' }} />
    </div>
  );
}

// ── Unread divider ────────────────────────────────────
function UnreadDivider({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px 4px', userSelect: 'none' }}>
      <div style={{ flex: 1, height: 1, background: '#ef5350' }} />
      <span style={{ fontSize: 10, color: '#ef5350', fontWeight: 700, whiteSpace: 'nowrap', background: '#fff', padding: '2px 8px', border: '1px solid #ef5350', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        New {count > 0 ? `(${count})` : ''}
      </span>
      <div style={{ flex: 1, height: 1, background: '#ef5350' }} />
    </div>
  );
}

// ── Jump-to-latest chip ──────────────────────────────────
function JumpToLatestChip({ newCount, onClick }: { newCount: number; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{
        position: 'absolute', bottom: 12, right: 16, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        background: newCount > 0 ? BLUE : '#fff',
        color: newCount > 0 ? '#fff' : '#555',
        border: `1px solid ${newCount > 0 ? BLUE : '#dde1e7'}`,
        borderRadius: 18,
        boxShadow: '0 3px 12px rgba(0,0,0,.15)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        transition: 'all .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <span style={{ fontSize: 14 }}>↓</span>
      <span>{newCount > 0 ? `${newCount} new message${newCount === 1 ? '' : 's'}` : 'Jump to latest'}</span>
    </div>
  );
}

export interface ReplyContext {
  messageId: number;
  senderName: string;
  body: string;
}

interface MessageListProps {
  onReply?: (ctx: ReplyContext) => void;
  searchQuery?: string;
}

export default function MessageList({ onReply, searchQuery = '' }: MessageListProps) {
  const { messages, activeChannelId, activeChannel, loadingMessages, hasMoreMessages, fetchMessages, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const { channelSearchQuery, inlineSearchOpen, toggleInlineSearch, jumpToMessageId, clearJumpToMessage } = useUIStore();
  const { getLastRead, markRead } = useLastRead();

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);

  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set());
  const [localReactions, setLocalReactions] = useState<Record<number, string[]>>({});
  const [profileUser, setProfileUser] = useState<Message['sender'] | null>(null);

  // Scroll/unread tracking
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [newMsgCountWhileAway, setNewMsgCountWhileAway] = useState(0);
  const lastSeenMsgIdRef = useRef<number | null>(null);

  // ── Unread anchor for divider ───────────────────────────
  // When a channel is opened, snapshot the last-read timestamp. The divider
  // appears above the first message newer than this snapshot. Snapshot is
  // frozen until the user switches channels, so it doesn't jump around while
  // reading.
  const [unreadAnchor, setUnreadAnchor] = useState<string | null>(null);

  useEffect(() => {
    if (!activeChannelId) { setUnreadAnchor(null); return; }
    const anchor = getLastRead(activeChannelId) || null;
    setUnreadAnchor(anchor);
    setAwayFromBottom(false);
    setNewMsgCountWhileAway(0);
  }, [activeChannelId]);

  const isGroup = activeChannel?.type === 'group' || activeChannel?.type === 'public' || activeChannel?.type === 'private';

  const activeSearch = inlineSearchOpen ? channelSearchQuery : searchQuery;

  // ── Scroll position tracking ─────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAway = distanceFromBottom > 200;
    setAwayFromBottom(prev => {
      if (prev && !isAway) setNewMsgCountWhileAway(0);
      return isAway;
    });
    if (!isAway && messages.length > 0 && activeChannelId) {
      const newest = messages[messages.length - 1];
      markRead(activeChannelId, newest.created_at);
      lastSeenMsgIdRef.current = newest.id;
    }
  }, [messages, activeChannelId, markRead]);

  // Auto-scroll on new messages (only if near bottom)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || messages.length === 0) return;
    const newest = messages[messages.length - 1];
    const wasLastSeen = lastSeenMsgIdRef.current === newest.id;

    if (awayFromBottom) {
      if (!wasLastSeen) setNewMsgCountWhileAway(c => c + 1);
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    lastSeenMsgIdRef.current = newest.id;
    if (activeChannelId) markRead(activeChannelId, newest.created_at);
  }, [messages]);

  // When channel opens, jump to bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [activeChannelId]);

  // ── Jump to a specific message when requested (from pinned panel, search, etc.) ──
  useEffect(() => {
    if (!jumpToMessageId || messages.length === 0) return;
    const target = messages.find(m => m.id === jumpToMessageId);
    if (!target) return;

    // Wait a frame so message refs are populated
    requestAnimationFrame(() => {
      const el = messageRefs.current[jumpToMessageId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMsgId(jumpToMessageId);
        // Clear highlight after a moment
        setTimeout(() => setHighlightedMsgId(null), 2500);
      }
      clearJumpToMessage();
    });
  }, [jumpToMessageId, messages, clearJumpToMessage]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMsgCountWhileAway(0);
  };

  const handlePin = useCallback((msgId: number) => {
    setPinnedIds(prev => { const next = new Set(prev); if (next.has(msgId)) next.delete(msgId); else next.add(msgId); return next; });
  }, []);

  const handleReact = useCallback((msgId: number, emoji: string) => {
    setLocalReactions(prev => {
      const existing = prev[msgId] || [];
      const next = existing.includes(emoji) ? existing.filter(e => e !== emoji) : [...existing, emoji];
      return { ...prev, [msgId]: next };
    });
  }, []);

  const handleReply = useCallback((msg: Message) => {
    if (onReply && msg.sender) onReply({ messageId: msg.id, senderName: msg.sender.name, body: msg.body || '' });
  }, [onReply]);

  const typingNames = Object.entries(typingUsers)
    .filter(([uid, typing]) => typing && parseInt(uid) !== user?.id)
    .map(([uid]) => messages.find(m => m.sender?.id === parseInt(uid))?.sender?.name || 'Someone')
    .filter((n, i, arr) => arr.indexOf(n) === i);

  if (!activeChannelId) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#bbb', gap: 8 }}>
        <div style={{ fontSize: 36 }}>💬</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>Select a conversation</div>
        <div style={{ fontSize: 12 }}>Choose a channel or DM from the sidebar</div>
      </div>
    );
  }

  const filteredMessages = activeSearch
    ? messages.filter(m => m.body?.toLowerCase().includes(activeSearch.toLowerCase()) || m.sender?.name.toLowerCase().includes(activeSearch.toLowerCase()))
    : messages;

  // ── Compute first-unread index for divider ───────────────────────
  let firstUnreadIdx = -1;
  let unreadCount = 0;
  if (unreadAnchor && !activeSearch) {
    for (let i = 0; i < filteredMessages.length; i++) {
      const m = filteredMessages[i];
      if (m.sender?.id !== user?.id && new Date(m.created_at) > new Date(unreadAnchor)) {
        if (firstUnreadIdx === -1) firstUnreadIdx = i;
        unreadCount++;
      }
    }
  }

  const grouped = filteredMessages.reduce<{ date: string; msgs: Array<{ msg: Message; globalIdx: number }> }[]>((acc, msg, globalIdx) => {
    const date = formatDate(msg.created_at);
    const last = acc[acc.length - 1];
    const item = { msg, globalIdx };
    if (!last || last.date !== date) acc.push({ date, msgs: [item] });
    else last.msgs.push(item);
    return acc;
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {profileUser && (
        <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} onMessage={() => setProfileUser(null)} />
      )}

      <div ref={scrollContainerRef} onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', paddingBottom: 4, background: '#fff' }}>
        {activeSearch && (
          <div style={{ padding: '8px 14px', background: '#fff3e0', borderBottom: '1px solid #ffe0b2', fontSize: 12, color: '#e65100', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔍</span>
            <span>{filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} for "<strong>{activeSearch}</strong>"</span>
            {inlineSearchOpen && (
              <span onClick={toggleInlineSearch} style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 14 }} title="Close search">✕</span>
            )}
          </div>
        )}

        {hasMoreMessages && (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <button onClick={() => fetchMessages(activeChannelId, messages[0]?.created_at)} disabled={loadingMessages}
              style={{ border: '1px solid #dde1e7', background: '#fff', borderRadius: 6, padding: '4px 14px', fontSize: 11, cursor: 'pointer', color: '#555' }}>
              {loadingMessages ? 'Loading...' : '↑ Load older messages'}
            </button>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <React.Fragment key={date}>
            <DateSeparator label={date} />
            {msgs.map(({ msg, globalIdx }, i) => (
              <React.Fragment key={msg.id}>
                {globalIdx === firstUnreadIdx && <UnreadDivider count={unreadCount} />}
                <div ref={el => { messageRefs.current[msg.id] = el; }}
                  style={{
                    transition: 'background .4s',
                    background: highlightedMsgId === msg.id ? 'rgba(249,168,37,.25)' : 'transparent',
                  }}
                >
                  <MessageRow msg={msg} prevMsg={msgs[i - 1]?.msg} isGroup={!!isGroup}
                    onReply={handleReply} onPin={handlePin} onProfileClick={setProfileUser}
                    pinnedIds={pinnedIds} localReactions={localReactions} onReact={handleReact}
                    searchQuery={activeSearch} />
                </div>
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}

        <div ref={bottomRef} />
      </div>

      {awayFromBottom && (
        <JumpToLatestChip newCount={newMsgCountWhileAway} onClick={scrollToBottom} />
      )}

      <TypingIndicator names={typingNames} />
    </div>
  );
}
