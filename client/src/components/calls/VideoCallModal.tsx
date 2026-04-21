import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { useMediasoup } from '../../hooks/useMediasoup';
import { useChatStore } from '../../store/chatStore';
import { getSocket } from '../../hooks/useSocket';

function fmt(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stringToColor(str: string) {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const cbBtn = (active = false, danger = false): React.CSSProperties => ({
  border: `1px solid ${danger ? 'rgba(255,80,80,.7)' : active ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.35)'}`,
  background: danger ? 'rgba(198,40,40,.85)' : active ? 'rgba(255,255,255,.2)' : 'transparent',
  color: '#fff', padding: '8px 12px', cursor: 'pointer', fontSize: 11,
  borderRadius: 8, fontFamily: 'inherit', display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 3, minWidth: 56, transition: 'all .15s',
});

interface TranscriptLine { speaker: string; text: string; time: string; }

const SIMULATED_LINES = [
  { delay: 4000,  speaker: 'me',     text: 'Hi! Can you hear me clearly?' },
  { delay: 7000,  speaker: 'remote', text: 'Yes, perfectly! Good to see you.' },
  { delay: 12000, speaker: 'me',     text: "Let's go through the sprint items quickly." },
  { delay: 16000, speaker: 'remote', text: 'Sure. I finished the IAS-533 Role Management modal yesterday.' },
  { delay: 20000, speaker: 'me',     text: 'Great! Has Fedor reviewed it yet?' },
  { delay: 24000, speaker: 'remote', text: 'He ran QA this morning — looks solid, no blockers.' },
  { delay: 29000, speaker: 'me',     text: 'Perfect. What about the DWM workflow engine?' },
  { delay: 33000, speaker: 'remote', text: 'Still in progress. I expect to push by Thursday EOD.' },
  { delay: 38000, speaker: 'me',     text: 'That works. Dean wants the demo on Friday for the Adriatic Holdings client.' },
  { delay: 42000, speaker: 'remote', text: 'Understood. I will make sure IAS Hub is stable before then.' },
];

export default function VideoCallModal() {
  const {
    active, callId, callType, elapsedSeconds,
    isMuted, isCameraOff, isSharing, isRaisingHand,
    localStream, remoteStreams,
    toggleMute, toggleCamera, toggleRaiseHand,
    endCall, setPostCallInfo,
  } = useCallStore();

  const { user } = useAuthStore();
  const { activeChannel } = useChatStore();
  const { joinCall, leaveCall, muteAudio, toggleVideo, startScreenShare, stopScreenShare } = useMediasoup(callId);

  const [phase, setPhase] = useState<'pre' | 'active'>('pre');
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const simTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Drag (floating mode)
  const [pos, setPos] = useState({ x: window.innerWidth - 420, y: 80 });
  const dragState = useRef<{ dragging: boolean; ox: number; oy: number }>({ dragging: false, ox: 0, oy: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    dragState.current = { dragging: true, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      setPos({ x: e.clientX - dragState.current.ox, y: e.clientY - dragState.current.oy });
    };
    const onUp = () => { dragState.current.dragging = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Reset when new call starts
  useEffect(() => {
    if (active) {
      setPhase('pre');
      setTranscript([]);
      setTranscriptionEnabled(false);
      simTimers.current.forEach(clearTimeout);
      simTimers.current = [];
    }
  }, [active, callId]);

  useEffect(() => { muteAudio(isMuted); }, [isMuted]);
  useEffect(() => { toggleVideo(isCameraOff); }, [isCameraOff]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const remoteName = activeChannel?.type === 'dm'
    ? activeChannel.other_user?.name || 'Participant'
    : activeChannel?.name || 'Participant';

  const handleJoin = useCallback(async () => {
    setPhase('active');
    if (callId && callType) {
      joinCall(callType).catch(err => console.error('Failed to join call:', err));
    }

    if (transcriptionEnabled) {
      SIMULATED_LINES.forEach(({ delay, speaker, text }) => {
        const t = setTimeout(() => {
          const now = new Date();
          const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          setTranscript(prev => [...prev, {
            speaker: speaker === 'me' ? (user?.name || 'You') : remoteName,
            text,
            time: timeStr,
          }]);
        }, delay);
        simTimers.current.push(t);
      });
    }
  }, [callId, callType, joinCall, transcriptionEnabled, user, remoteName]);

  const handleEnd = useCallback(async () => {
    simTimers.current.forEach(clearTimeout);
    simTimers.current = [];

    const duration = elapsedSeconds;
    const currentTranscript = [...transcript];
    const currentCallType = callType || 'audio';

    leaveCall();

    // ✅ Set post-call info in store BEFORE endCall clears active
    //    App.tsx reads postCallInfo independently and keeps showing the modal
    setPostCallInfo({
      callType: currentCallType,
      duration,
      participants: [user?.name || 'You', remoteName],
      transcript: currentTranscript,
    });

    await endCall();
  }, [elapsedSeconds, transcript, callType, leaveCall, endCall, setPostCallInfo, user, remoteName]);

  const handleShareToggle = useCallback(async () => {
    if (isSharing) stopScreenShare(); else await startScreenShare();
    useCallStore.getState().toggleShare();
  }, [isSharing, startScreenShare, stopScreenShare]);

  const handleRaiseHand = useCallback(() => {
    toggleRaiseHand();
    getSocket()?.emit('ms:raiseHand', { callId, raised: !isRaisingHand });
  }, [callId, isRaisingHand, toggleRaiseHand]);

  if (!active) return null;

  const isVideo = callType === 'video';
  const totalParticipants = 1 + remoteStreams.size;
  const isTranscriptionLayout = transcriptionEnabled && isVideo && phase === 'active';

  // ── PRE-CALL DIALOG ───────────────────────────────────
  if (phase === 'pre') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
        <div style={{ background: '#0d0d1a', borderRadius: 16, width: 400, boxShadow: '0 16px 60px rgba(0,0,0,.7)', border: '1px solid rgba(255,255,255,.12)', overflow: 'hidden' }}>

          <div style={{ background: 'rgba(255,255,255,.05)', padding: '24px 24px 18px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>{isVideo ? '📹' : '📞'}</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{isVideo ? 'Video Call' : 'Audio Call'}</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, marginTop: 4 }}>
              with {remoteName}
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* Transcription toggle */}
            <div onClick={() => setTranscriptionEnabled(t => !t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 16, background: transcriptionEnabled ? 'rgba(33,150,243,.15)' : 'rgba(255,255,255,.06)', border: `1px solid ${transcriptionEnabled ? 'rgba(33,150,243,.4)' : 'rgba(255,255,255,.1)'}`, transition: 'all .2s' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>🎙️</span> Enable Transcription
                </div>
                <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginTop: 3 }}>
                  Whisper AI · Auto-detect speakers · Log to PCI
                </div>
              </div>
              {/* Toggle */}
              <div style={{ width: 44, height: 24, borderRadius: 12, background: transcriptionEnabled ? '#1976d2' : 'rgba(255,255,255,.2)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: transcriptionEnabled ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
              </div>
            </div>

            {transcriptionEnabled && (
              <div style={{ background: 'rgba(33,150,243,.1)', border: '1px solid rgba(33,150,243,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: 'rgba(255,255,255,.55)' }}>
                {isVideo
                  ? '📋 Screen splits into 3 panels: your camera, participant, and live transcript'
                  : '📋 Live transcript will appear during the call'}
              </div>
            )}

            <button onClick={handleJoin} style={{ width: '100%', padding: '14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', marginBottom: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1b5e20')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2e7d32')}>
              {isVideo ? '📹' : '📞'} Join Call
            </button>

            <button onClick={async () => { await endCall(); }}
              style={{ width: '100%', padding: '10px', background: 'transparent', color: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FULLSCREEN 3-PANEL (transcription + video) ────────
  if (isTranscriptionLayout) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a14', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, Arial, sans-serif' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>📹 Video Call</span>
            <span style={{ background: '#2e7d32', color: '#fff', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>● LIVE</span>
            <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 11 }}>{totalParticipants} participants</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#81c784', letterSpacing: 2 }}>{fmt(elapsedSeconds)}</div>
          <span style={{ background: 'rgba(33,150,243,.2)', color: '#90caf9', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: '1px solid rgba(33,150,243,.35)' }}>
            🎙️ Transcription ON
          </span>
        </div>

        {/* 3 columns */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Col 1: You */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', borderRight: '1px solid rgba(255,255,255,.06)', position: 'relative' }}>
            {localStream && !isCameraOff ? (
              <video autoPlay muted playsInline ref={el => { if (el && localStream) el.srcObject = localStream; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: stringToColor(user?.name || 'You'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 auto 12px', border: '3px solid rgba(255,255,255,.2)' }}>
                  {(user?.name || 'Y').charAt(0)}
                </div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{user?.name || 'You'}</div>
                {isCameraOff && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, marginTop: 4 }}>Camera off</div>}
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
              {user?.name || 'You'} {isMuted ? '🔇' : ''}
            </div>
          </div>

          {/* Col 2: Remote */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1520', borderRight: '1px solid rgba(255,255,255,.06)', position: 'relative' }}>
            {remoteStreams.size > 0
              ? Array.from(remoteStreams.entries()).slice(0, 1).map(([uid, stream]) => (
                <video key={uid} autoPlay playsInline ref={el => { if (el) el.srcObject = stream; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ))
              : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: stringToColor(remoteName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 auto 12px', border: '3px solid rgba(255,255,255,.2)', animation: 'pulse 2s infinite' }}>
                    {remoteName.charAt(0)}
                  </div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{remoteName}</div>
                  <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, marginTop: 4 }}>Connecting...</div>
                </div>
              )}
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{remoteName}</div>
          </div>

          {/* Col 3: Live transcript */}
          <div style={{ width: 320, background: '#111827', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ color: '#90caf9', fontSize: 14 }}>🎙️</span>
              <span style={{ color: '#90caf9', fontWeight: 700, fontSize: 13 }}>Live Transcript</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: transcript.length > 0 ? '#4caf50' : '#444', animation: transcript.length > 0 ? `bounce 1.2s ${i * 0.2}s infinite` : 'none' }} />
                ))}
              </div>
            </div>

            <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {transcript.length === 0 ? (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🎤</div>
                  Listening for speech...
                </div>
              ) : transcript.map((line, i) => {
                const isMe = line.speaker === (user?.name || 'You');
                return (
                  <div key={i} style={{ padding: '6px 14px', marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: stringToColor(line.speaker), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {line.speaker.charAt(0)}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isMe ? '#90caf9' : '#a5d6a7' }}>{line.speaker}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,.2)', fontFamily: 'monospace' }}>{line.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', lineHeight: 1.5, paddingLeft: 24 }}>{line.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', background: 'rgba(255,255,255,.04)', borderTop: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
          <button style={cbBtn(isMuted)} onClick={toggleMute}><span style={{ fontSize: 18 }}>{isMuted ? '🔇' : '🎤'}</span><span style={{ fontSize: 9 }}>{isMuted ? 'Unmute' : 'Mute'}</span></button>
          <button style={cbBtn(isCameraOff)} onClick={toggleCamera}><span style={{ fontSize: 18 }}>{isCameraOff ? '📷' : '📹'}</span><span style={{ fontSize: 9 }}>Camera</span></button>
          <button style={cbBtn(isSharing)} onClick={handleShareToggle}><span style={{ fontSize: 18 }}>🖥</span><span style={{ fontSize: 9 }}>{isSharing ? 'Stop' : 'Share'}</span></button>
          <button style={cbBtn(isRaisingHand)} onClick={handleRaiseHand}><span style={{ fontSize: 18 }}>✋</span><span style={{ fontSize: 9 }}>Hand</span></button>
          <button style={{ ...cbBtn(false, true), padding: '8px 28px', fontWeight: 700, minWidth: 110 }} onClick={handleEnd}>
            <span style={{ fontSize: 18 }}>📵</span><span style={{ fontSize: 9 }}>End Call</span>
          </button>
        </div>

        <style>{`
          @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(76,175,80,.4); } 50% { box-shadow: 0 0 0 12px rgba(76,175,80,0); } }
          @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        `}</style>
      </div>
    );
  }

  // ── FLOATING WINDOW (no transcription / audio call) ───
  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, width: 380, zIndex: 1000, background: '#0d0d1a', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.12)', fontFamily: 'Segoe UI, Arial, sans-serif', overflow: 'hidden', userSelect: 'none' }}>

      <div onMouseDown={onMouseDown} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.08)', cursor: 'grab' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{isVideo ? '📹' : '📞'} {isVideo ? 'Video Call' : 'Audio Call'}</span>
          <span style={{ background: '#2e7d32', color: '#fff', padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>● LIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#81c784', letterSpacing: 1 }}>{fmt(elapsedSeconds)}</span>
          <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 10 }}>{totalParticipants} 👤</span>
        </div>
      </div>

      <div style={{ height: isVideo ? 200 : 140, overflow: 'hidden', background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isVideo && localStream ? (
          <video autoPlay muted playsInline ref={el => { if (el && localStream) el.srcObject = localStream; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
            {[{ name: user?.name || 'You', isLocal: true }, { name: remoteName, isLocal: false }].map(p => (
              <div key={p.name} style={{ textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: stringToColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', border: '2px solid rgba(255,255,255,.15)', margin: '0 auto 6px', animation: !p.isLocal ? 'pulse 2s infinite' : 'none' }}>
                  {p.name.charAt(0)}
                </div>
                <div style={{ color: '#fff', fontSize: 11 }}>{p.isLocal ? 'You' : p.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', background: 'rgba(255,255,255,.04)', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <button style={cbBtn(isMuted)} onClick={toggleMute}><span style={{ fontSize: 16 }}>{isMuted ? '🔇' : '🎤'}</span><span style={{ fontSize: 9 }}>{isMuted ? 'Unmute' : 'Mute'}</span></button>
        {isVideo && <button style={cbBtn(isCameraOff)} onClick={toggleCamera}><span style={{ fontSize: 16 }}>{isCameraOff ? '📷' : '📹'}</span><span style={{ fontSize: 9 }}>Camera</span></button>}
        <button style={cbBtn(isSharing)} onClick={handleShareToggle}><span style={{ fontSize: 16 }}>🖥</span><span style={{ fontSize: 9 }}>{isSharing ? 'Stop' : 'Share'}</span></button>
        <button style={cbBtn(isRaisingHand)} onClick={handleRaiseHand}><span style={{ fontSize: 16 }}>✋</span><span style={{ fontSize: 9 }}>Hand</span></button>
        <button style={{ ...cbBtn(false, true), minWidth: 64, fontWeight: 700 }} onClick={handleEnd}><span style={{ fontSize: 16 }}>📵</span><span style={{ fontSize: 9 }}>End</span></button>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(76,175,80,.4); } 50% { box-shadow: 0 0 0 10px rgba(76,175,80,0); } }`}</style>
    </div>
  );
}
