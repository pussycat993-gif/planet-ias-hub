import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useChatStore } from '../../store/chatStore';
import { getSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { useUIStore } from '../../store/uiStore';
import { Avatar } from '../layout/Layout';
import { ReplyContext } from './MessageList';
import EmojiPicker from './EmojiPicker';
import ChatAutocomplete, { AutocompleteItem, AutocompleteKind } from './ChatAutocomplete';
import ScheduleMeetModal from './ScheduleMeetModal';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';

interface AttachedFile {
  id: string;
  file: File;
  preview?: string;
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
    sql: '🗄️', md: '📋', txt: '📋', fig: '🎨', zip: '🗜️', mp4: '🎬',
    webm: '🎙️', ogg: '🎙️', wav: '🎙️', mp3: '🎙️',
  };
  return map[ext] || '📎';
}
function isImage(name: string): boolean { return /\.(png|jpg|jpeg|gif|webp)$/i.test(name); }
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Slash commands catalog ─────────────────────────────────────
interface CommandDef {
  command: string;
  label: string;
  sublabel: string;
  icon: string;
  hotkey?: string;
  action: (args: string, ctx: CommandContext) => string | null;
}

interface CommandContext {
  channelId: number;
  startCall: (id: number, type: 'audio' | 'video') => void;
  openScheduleModal: () => void;
  openMembersPanel: () => void;
  openAIPanel: () => void;
}

const COMMANDS: CommandDef[] = [
  {
    command: 'schedule', label: '/schedule [title]', sublabel: 'Open the Schedule Meeting dialog',
    icon: '📅', hotkey: '/sch',
    action: (_args, ctx) => { ctx.openScheduleModal(); return null; },
  },
  {
    command: 'audio', label: '/audio', sublabel: 'Start an audio call in this channel',
    icon: '📞', hotkey: '/au',
    action: (_args, ctx) => { ctx.startCall(ctx.channelId, 'audio'); return null; },
  },
  {
    command: 'video', label: '/video', sublabel: 'Start a video call in this channel',
    icon: '📹', hotkey: '/vi',
    action: (_args, ctx) => { ctx.startCall(ctx.channelId, 'video'); return null; },
  },
  {
    command: 'members', label: '/members', sublabel: 'Show channel members panel',
    icon: '👥', hotkey: '/mem',
    action: (_args, ctx) => { ctx.openMembersPanel(); return null; },
  },
  {
    command: 'ai', label: '/ai [question]', sublabel: 'Ask IAS AI assistant',
    icon: '🤖', hotkey: '/ai',
    action: (args, ctx) => { ctx.openAIPanel(); return args ? `🤖 Ask IAS: ${args}` : null; },
  },
  {
    command: 'shrug', label: '/shrug', sublabel: 'Send ¯\\_(ツ)_/¯',
    icon: '🤷', hotkey: '',
    action: (_args) => `¯\\_(ツ)_/¯`,
  },
  {
    command: 'me', label: '/me [action]', sublabel: 'Send an action in third person',
    icon: '✨', hotkey: '',
    action: (args) => args ? `_${args}_` : null,
  },
];

// ── Props ──────────────────────────────────────────────────────
interface MessageInputProps {
  replyContext: ReplyContext | null;
  onClearReply: () => void;
}

// ── Component ──────────────────────────────────────────────────
export default function MessageInput({ replyContext, onClearReply }: MessageInputProps) {
  const [text, setText] = useState('');
  const [logEnabled, setLogEnabled] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  // Voice / video recording state
  const [recording, setRecording] = useState(false);
  const [recordKind, setRecordKind] = useState<'audio' | 'video'>('audio');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Autocomplete state (@ mention or / command)
  const [autocomplete, setAutocomplete] = useState<{
    kind: AutocompleteKind;
    query: string;
    tokenStart: number;
    highlightedIndex: number;
  } | null>(null);
  const [members, setMembers] = useState<any[]>([]);

  const { activeChannelId, activeChannel, sendMessage } = useChatStore();
  const { user } = useAuthStore();
  const { startCall } = useCallStore();
  const { toggleAIPanel, aiPanelOpen } = useUIStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch channel members for @ autocomplete
  useEffect(() => {
    if (!activeChannelId) { setMembers([]); return; }
    axios.get(`${API}/channels/${activeChannelId}/members`)
      .then(r => setMembers(r.data.data || []))
      .catch(() => setMembers([]));
  }, [activeChannelId]);

  // Build autocomplete items based on current token
  const autocompleteItems: AutocompleteItem[] = useMemo(() => {
    if (!autocomplete) return [];
    const q = autocomplete.query.toLowerCase();
    if (autocomplete.kind === 'mention') {
      return members
        .filter(m => m.id !== user?.id)
        .filter(m => !q || m.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map(m => ({
          id: String(m.id),
          label: m.name,
          sublabel: m.role || m.email,
          avatarUrl: m.avatar_url,
          avatarInitials: m.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
          avatarColor: stringToColor(m.name),
        }));
    }
    return COMMANDS
      .filter(c => !q || c.command.includes(q))
      .map(c => ({
        id: c.command,
        label: c.label,
        sublabel: c.sublabel,
        icon: c.icon,
        hotkey: c.hotkey,
      }));
  }, [autocomplete, members, user?.id]);

  // ── Autocomplete token detection ────────────────────────────
  const checkAutocomplete = (value: string, cursorPos: number) => {
    let tokenStart = cursorPos;
    while (tokenStart > 0 && !/\s/.test(value[tokenStart - 1])) tokenStart--;
    const token = value.slice(tokenStart, cursorPos);

    if (token.startsWith('@') && token.length >= 1) {
      setAutocomplete(prev => ({
        kind: 'mention',
        query: token.slice(1),
        tokenStart,
        highlightedIndex: prev?.kind === 'mention' ? prev.highlightedIndex : 0,
      }));
      return;
    }

    if (tokenStart === 0 && token.startsWith('/') && token.length >= 1) {
      setAutocomplete(prev => ({
        kind: 'command',
        query: token.slice(1),
        tokenStart: 0,
        highlightedIndex: prev?.kind === 'command' ? prev.highlightedIndex : 0,
      }));
      return;
    }

    setAutocomplete(null);
  };

  useEffect(() => {
    if (autocomplete && autocomplete.highlightedIndex >= autocompleteItems.length) {
      setAutocomplete({ ...autocomplete, highlightedIndex: 0 });
    }
  }, [autocompleteItems.length]);

  // ── Autocomplete selection ──────────────────────────────────
  const applyAutocomplete = (item: AutocompleteItem) => {
    if (!autocomplete || !inputRef.current) return;
    const input = inputRef.current;
    const cursor = input.selectionStart || text.length;

    if (autocomplete.kind === 'command') {
      const def = COMMANDS.find(c => c.command === item.id);
      if (!def || !activeChannelId) return;

      const argStart = autocomplete.tokenStart + 1 + def.command.length;
      const args = text.slice(argStart).trim();

      const body = def.action(args, {
        channelId: activeChannelId,
        startCall,
        openScheduleModal: () => setShowSchedule(true),
        openMembersPanel: () => {},
        openAIPanel: () => { if (!aiPanelOpen) toggleAIPanel(); },
      });

      setText('');
      setAutocomplete(null);

      if (body) {
        sendMessage(body);
      }
      return;
    }

    const before = text.slice(0, autocomplete.tokenStart);
    const after = text.slice(cursor);
    const insertion = `@${item.label} `;
    const newText = before + insertion + after;
    setText(newText);
    setAutocomplete(null);
    requestAnimationFrame(() => {
      const pos = (before + insertion).length;
      input.setSelectionRange(pos, pos);
      input.focus();
    });
  };

  // ── Keyboard handling ───────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (autocomplete && autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocomplete({ ...autocomplete, highlightedIndex: (autocomplete.highlightedIndex + 1) % autocompleteItems.length });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocomplete({ ...autocomplete, highlightedIndex: (autocomplete.highlightedIndex - 1 + autocompleteItems.length) % autocompleteItems.length });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(autocompleteItems[autocomplete.highlightedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape' && replyContext) { onClearReply(); }
    if (e.key === 'Escape' && showEmoji) { setShowEmoji(false); }
  };

  // ── Voice / video recording ─────────────────────────────────
  // Shared start for audio and video. For video kind we also attach the
  // stream to the <video> preview so the user can see themselves while recording.
  const startRecording = async (kind: 'audio' | 'video' = 'audio') => {
    try {
      const constraints: MediaStreamConstraints = kind === 'video'
        ? { audio: true, video: { width: 640, height: 480 } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeOptions = kind === 'video'
        ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
      const mimeType = mimeOptions.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      setRecordKind(kind);

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        // Cancelled recording has its chunks pre-emptied — don't upload
        if (chunksRef.current.length === 0) {
          streamRef.current?.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          recorderRef.current = null;
          return;
        }
        const defaultMime = kind === 'video' ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || defaultMime });
        const ext = (recorder.mimeType || defaultMime).split('/')[1].split(';')[0] || 'webm';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const prefix = kind === 'video' ? 'video-note' : 'voice-note';
        const file = new File([blob], `${prefix}-${timestamp}.${ext}`, { type: blob.type });

        if (activeChannelId) {
          setUploading(true);
          try {
            const fd = new FormData();
            fd.append('file', file);
            await axios.post(`${API}/channels/${activeChannelId}/files`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (err) {
            console.error(`${kind} note upload error:`, err);
          }
          setUploading(false);
        }

        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
        chunksRef.current = [];
      };

      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);

      // Wire the stream to the <video> preview element on the next frame,
      // after React mounts it inside the recording bar.
      if (kind === 'video') {
        requestAnimationFrame(() => {
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
            previewVideoRef.current.play().catch(() => {/* autoplay blocked, no-op */});
          }
        });
      }
    } catch (err) {
      console.error(`${kind} device access denied:`, err);
      alert(kind === 'video'
        ? 'Camera + microphone access is required to record a video note.'
        : 'Microphone access is required to record a voice note.');
    }
  };

  const stopRecording = (send: boolean) => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecording(false);
    setRecordSeconds(0);

    // Detach the preview stream so the video element blanks on next open
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }

    if (send) {
      recorderRef.current?.stop();
    } else {
      // Cancel: clear chunks before stopping so onstop short-circuits
      chunksRef.current = [];
      try { recorderRef.current?.stop(); } catch {/* ignore */}
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Send message ────────────────────────────────────────────
  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return;
    if (!activeChannelId) return;

    if (attachments.length > 0) {
      setUploading(true);
      try {
        for (const att of attachments) {
          const formData = new FormData();
          formData.append('file', att.file);
          await axios.post(`${API}/channels/${activeChannelId}/files`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
      setUploading(false);
      setAttachments([]);
    }

    if (text.trim()) {
      if (text.trim().startsWith('/')) {
        const trimmed = text.trim();
        const spaceIdx = trimmed.indexOf(' ');
        const cmd = (spaceIdx >= 0 ? trimmed.slice(1, spaceIdx) : trimmed.slice(1)).toLowerCase();
        const args = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1) : '';
        const def = COMMANDS.find(c => c.command === cmd);
        if (def) {
          const body = def.action(args, {
            channelId: activeChannelId,
            startCall,
            openScheduleModal: () => setShowSchedule(true),
            openMembersPanel: () => {},
            openAIPanel: () => { if (!aiPanelOpen) toggleAIPanel(); },
          });
          setText('');
          if (body) sendMessage(body);
          onClearReply();
          stopTyping();
          return;
        }
      }
      sendMessage(text);
      setText('');
    }

    onClearReply();
    stopTyping();
  };

  // ── Typing indicator ────────────────────────────────────────
  const handleInput = (val: string, cursor: number) => {
    setText(val);
    checkAutocomplete(val, cursor);

    const socket = getSocket();
    if (!activeChannelId) return;
    socket?.emit('typing:start', String(activeChannelId));
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(stopTyping, 2000);
  };

  const stopTyping = () => {
    const socket = getSocket();
    if (activeChannelId) socket?.emit('typing:stop', String(activeChannelId));
  };

  // ── Emoji insertion at cursor ───────────────────────────────
  const insertAtCursor = (emoji: string) => {
    const input = inputRef.current;
    if (!input) { setText(t => t + emoji); return; }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
      input.focus();
    });
  };

  // ── File attach ─────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      const id = `${Date.now()}-${Math.random()}`;
      if (isImage(file.name)) {
        const reader = new FileReader();
        reader.onload = ev => {
          setAttachments(prev => [...prev, { id, file, preview: ev.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments(prev => [...prev, { id, file }]);
      }
    });

    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    const syntheticEvent = { target: { files, value: '' } } as any;
    handleFileSelect(syntheticEvent);
  };

  const canSend = (text.trim() || attachments.length > 0) && !!activeChannelId && !uploading && !recording;

  const channelName = activeChannel?.type === 'dm'
    ? activeChannel.other_user?.name || activeChannel.name
    : activeChannel?.name || '';

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      {showSchedule && activeChannelId && (
        <ScheduleMeetModal
          channelId={activeChannelId}
          channelName={channelName}
          onClose={() => setShowSchedule(false)}
        />
      )}

      <div
        style={{ borderTop: '1px solid #eee', background: '#fff', flexShrink: 0, position: 'relative' }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Reply context bar */}
        {replyContext && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f0f7ff', borderBottom: '1px solid #dde1e7', fontSize: 12 }}>
            <span style={{ color: BLUE, fontSize: 14 }}>↩</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, color: '#1565c0' }}>Replying to {replyContext.senderName}</span>
              <span style={{ color: '#888', marginLeft: 6 }}>
                {replyContext.body.slice(0, 60)}{replyContext.body.length > 60 ? '...' : ''}
              </span>
            </div>
            <span onClick={onClearReply} style={{ cursor: 'pointer', color: '#888', fontSize: 16 }}>✕</span>
          </div>
        )}

        {/* Recording bar — audio and video variants */}
        {recording && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 14px', background: '#fff5f5', borderBottom: '1px solid #ffcdd2' }}>
            <style>{`@keyframes ias-rec-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

            {recordKind === 'video' && (
              <video ref={previewVideoRef} muted playsInline
                style={{ width: '100%', maxHeight: 200, borderRadius: 8, background: '#000', objectFit: 'cover' }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e53935', animation: 'ias-rec-pulse 1s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#c62828', fontWeight: 600 }}>
                Recording {recordKind === 'video' ? 'video note' : 'voice note'} — {fmtDuration(recordSeconds)}
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={() => stopRecording(false)}
                style={{ padding: '5px 12px', border: '1px solid #dde1e7', background: '#fff', cursor: 'pointer', fontSize: 12, borderRadius: 6, fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={() => stopRecording(true)}
                style={{ padding: '5px 14px', background: '#c62828', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, borderRadius: 6, fontFamily: 'inherit', fontWeight: 600 }}>
                ⏹ Send
              </button>
            </div>
          </div>
        )}

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 12px 4px', borderBottom: '1px solid #f0f0f0' }}>
            {attachments.map(att => (
              <div key={att.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #dde1e7', background: '#f8f9fa' }}>
                {att.preview ? (
                  <div style={{ width: 72, height: 72 }}>
                    <img src={att.preview} alt={att.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', maxWidth: 180 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{fileIcon(att.file.name)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{att.file.name}</div>
                      <div style={{ fontSize: 10, color: '#888' }}>{fmtSize(att.file.size)}</div>
                    </div>
                  </div>
                )}
                <div onClick={() => removeAttachment(att.id)}
                  style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 700, lineHeight: 1 }}
                >✕</div>
                {att.preview && (
                  <div style={{ padding: '2px 6px', fontSize: 9, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72, background: '#fff' }}>
                    {att.file.name}
                  </div>
                )}
              </div>
            ))}
            <div onClick={() => fileRef.current?.click()}
              style={{ width: 72, height: 72, borderRadius: 8, border: '2px dashed #dde1e7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#bbb', fontSize: 22, gap: 3, transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#bbb'; }}>
              <span>+</span>
              <span style={{ fontSize: 9 }}>Add more</span>
            </div>
          </div>
        )}

        {/* Input row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px 10px', position: 'relative' }}>
          {user && <Avatar name={user.name} avatarUrl={user.avatar_url} size={30} />}

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid #dde1e7', borderRadius: 10, padding: '5px 10px', gap: 6, background: '#f8f9fa', position: 'relative' }}>
            {autocomplete && autocompleteItems.length > 0 && (
              <ChatAutocomplete
                kind={autocomplete.kind}
                items={autocompleteItems}
                highlightedIndex={autocomplete.highlightedIndex}
                onHighlight={i => setAutocomplete({ ...autocomplete, highlightedIndex: i })}
                onSelect={applyAutocomplete}
                onClose={() => setAutocomplete(null)}
              />
            )}

            {showEmoji && (
              <EmojiPicker
                onSelect={emoji => { insertAtCursor(emoji); }}
                onClose={() => setShowEmoji(false)}
              />
            )}

            {/* Attach */}
            <span
              style={{ cursor: 'pointer', color: '#aaa', fontSize: 16, position: 'relative' }}
              onClick={() => fileRef.current?.click()}
              title="Attach files"
              onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
              onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}
            >
              📎
              {attachments.length > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: BLUE, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {attachments.length}
                </span>
              )}
            </span>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.sql,.fig,.zip,.mp4" />

            {/* Emoji toggle */}
            <span
              onClick={() => setShowEmoji(s => !s)}
              title="Emoji picker"
              style={{ cursor: 'pointer', color: showEmoji ? '#f9a825' : '#aaa', fontSize: 16, transition: 'color .15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f9a825')}
              onMouseLeave={e => (e.currentTarget.style.color = showEmoji ? '#f9a825' : '#aaa')}
            >
              😊
            </span>

            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => handleInput(e.target.value, e.target.selectionStart || 0)}
              onKeyDown={handleKeyDown}
              onKeyUp={e => checkAutocomplete(text, (e.target as HTMLInputElement).selectionStart || 0)}
              onClick={e => checkAutocomplete(text, (e.target as HTMLInputElement).selectionStart || 0)}
              placeholder={
                recording ? `Recording ${recordKind === 'video' ? 'video' : 'voice'} note…`
                : attachments.length > 0 ? 'Add a message or press Send…'
                : replyContext ? `Reply to ${replyContext.senderName}…`
                : activeChannelId ? 'Write a message…  (try / for commands or @ to mention)'
                : 'Select a channel first'
              }
              disabled={!activeChannelId || recording}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#1a1a2e', fontFamily: 'inherit' }}
            />

            {/* Mention shortcut */}
            <span style={{ cursor: 'pointer', color: '#aaa', fontSize: 13 }}
              onClick={() => {
                const cur = inputRef.current?.selectionStart || text.length;
                const newText = text.slice(0, cur) + '@' + text.slice(cur);
                setText(newText);
                requestAnimationFrame(() => {
                  inputRef.current?.setSelectionRange(cur + 1, cur + 1);
                  inputRef.current?.focus();
                  checkAutocomplete(newText, cur + 1);
                });
              }}
              title="Mention someone"
              onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
              onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}>@</span>
          </div>

          {/* Log to PCI toggle */}
          <button onClick={() => setLogEnabled(l => !l)} title="Log to PCI" style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
            color: logEnabled ? BLUE : '#aaa', cursor: 'pointer', padding: '4px 7px',
            borderRadius: 6, border: `1px solid ${logEnabled ? '#90caf9' : '#eee'}`,
            background: logEnabled ? '#e3f2fd' : '#fff', fontFamily: 'inherit',
          }}>🔗 Log</button>

          {/* Send button, OR voice + video record buttons when there's no text */}
          {text.trim() || attachments.length > 0 ? (
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                padding: '7px 18px',
                background: canSend ? BLUE : '#e0e0e0',
                color: canSend ? '#fff' : '#aaa',
                border: 'none', borderRadius: 8,
                cursor: canSend ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              {uploading ? '⏳' : 'Send'}
            </button>
          ) : recording ? (
            <button
              onClick={() => stopRecording(true)}
              title="Stop recording and send"
              style={{
                width: 40, height: 34,
                background: '#c62828', color: '#fff',
                border: '1px solid #c62828',
                borderRadius: 8, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >⏹</button>
          ) : (
            <>
              <button
                onClick={() => startRecording('audio')}
                disabled={!activeChannelId || uploading}
                title="Record voice note"
                style={{
                  width: 36, height: 34,
                  background: '#fff', color: '#555',
                  border: '1px solid #dde1e7',
                  borderRadius: 8, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; e.currentTarget.style.borderColor = BLUE; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; }}
              >🎙️</button>
              <button
                onClick={() => startRecording('video')}
                disabled={!activeChannelId || uploading}
                title="Record video note"
                style={{
                  width: 36, height: 34,
                  background: '#fff', color: '#555',
                  border: '1px solid #dde1e7',
                  borderRadius: 8, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; e.currentTarget.style.borderColor = BLUE; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; }}
              >📹</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
