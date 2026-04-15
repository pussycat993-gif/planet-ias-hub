import React, { useEffect, useCallback } from 'react';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useMediasoup } from '../../hooks/useMediasoup';
import VideoGrid from './VideoGrid';
import { getSocket } from '../../hooks/useSocket';

const cbBtn = (active = false, danger = false): React.CSSProperties => ({
  border: `1px solid ${danger ? 'rgba(255,80,80,.7)' : active ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.35)'}`,
  background: danger ? 'rgba(198,40,40,.85)' : active ? 'rgba(255,255,255,.2)' : 'transparent',
  color: '#fff',
  padding: '8px 14px',
  cursor: 'pointer',
  fontSize: 12,
  borderRadius: 8,
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  minWidth: 60,
  transition: 'all .15s',
});

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoCallModal() {
  const {
    active, callId, callType, elapsedSeconds,
    isMuted, isCameraOff, isSharing, isRaisingHand,
    localStream, remoteStreams,
    toggleMute, toggleCamera, toggleRaiseHand,
    endCall,
  } = useCallStore();

  const { user } = useAuthStore();
  const { openModal } = useUIStore();
  const { joinCall, leaveCall, muteAudio, toggleVideo, startScreenShare, stopScreenShare } = useMediasoup(callId);

  // Join mediasoup on call start
  useEffect(() => {
    if (active && callId && callType) {
      joinCall(callType).catch(err => {
        console.error('Failed to join mediasoup call:', err);
      });
    }
  }, [active, callId, callType]);

  // Sync mute/camera state to mediasoup producers
  useEffect(() => { muteAudio(isMuted); }, [isMuted]);
  useEffect(() => { toggleVideo(isCameraOff); }, [isCameraOff]);

  // Handle screen share toggle
  const handleShareToggle = useCallback(async () => {
    if (isSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
    useCallStore.getState().toggleShare();
  }, [isSharing, startScreenShare, stopScreenShare]);

  // Handle raise hand
  const handleRaiseHand = useCallback(() => {
    toggleRaiseHand();
    const socket = getSocket();
    socket?.emit('ms:raiseHand', { callId, raised: !isRaisingHand });
  }, [callId, isRaisingHand, toggleRaiseHand]);

  // Handle end call
  const handleEnd = useCallback(async () => {
    leaveCall();
    await endCall();
    openModal('endCall');
  }, [leaveCall, endCall, openModal]);

  if (!active) return null;

  const isVideoCall = callType === 'video';
  const remoteLabels = new Map<number, string>(); // In production: fetch names from user store

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0d0d1a',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Segoe UI, Arial, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 18px',
        background: 'rgba(255,255,255,.04)',
        borderBottom: '1px solid rgba(255,255,255,.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            {isVideoCall ? '📹' : '📞'} {isVideoCall ? 'Video Call' : 'Audio Call'}
          </span>
          <span style={{
            background: '#2e7d32', color: '#fff',
            padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
          }}>
            ● LIVE
          </span>
        </div>

        <div style={{
          fontFamily: 'monospace', fontSize: 16, fontWeight: 700,
          color: '#81c784', letterSpacing: 2,
        }}>
          {fmt(elapsedSeconds)}
        </div>

        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>
          {1 + remoteStreams.size} participant{remoteStreams.size !== 0 ? 's' : ''}
        </div>
      </div>

      {/* Video area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {isVideoCall ? (
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            localLabel={user?.name || 'You'}
            remoteLabels={remoteLabels}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
          />
        ) : (
          /* Audio call — avatar layout */
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 28, flexWrap: 'wrap',
          }}>
            {[{ id: user?.id, name: user?.name || 'You', isLocal: true },
              ...Array.from(remoteStreams.keys()).map(uid => ({ id: uid, name: `User ${uid}`, isLocal: false }))
            ].map(p => (
              <div key={p.id} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 90, height: 90, borderRadius: '50%',
                  background: p.isLocal ? '#1976d2' : '#37474f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, color: '#fff',
                  border: '3px solid rgba(255,255,255,.15)',
                  margin: '0 auto 8px',
                  animation: !p.isLocal ? 'pulse 2s infinite' : 'none',
                }}>
                  {(p.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ color: '#fff', fontSize: 12 }}>{p.name}</div>
                {p.isLocal && isMuted && (
                  <div style={{ color: '#ef5350', fontSize: 10, marginTop: 3 }}>🔇 Muted</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '14px 18px',
        background: 'rgba(255,255,255,.04)',
        borderTop: '1px solid rgba(255,255,255,.08)',
        flexShrink: 0,
      }}>
        {/* Mute */}
        <button style={cbBtn(isMuted)} onClick={toggleMute}>
          <span style={{ fontSize: 18 }}>{isMuted ? '🔇' : '🎤'}</span>
          <span style={{ fontSize: 10 }}>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Camera — only for video */}
        {isVideoCall && (
          <button style={cbBtn(isCameraOff)} onClick={toggleCamera}>
            <span style={{ fontSize: 18 }}>{isCameraOff ? '📷' : '📹'}</span>
            <span style={{ fontSize: 10 }}>{isCameraOff ? 'Start Cam' : 'Stop Cam'}</span>
          </button>
        )}

        {/* Screen share */}
        <button style={cbBtn(isSharing)} onClick={handleShareToggle}>
          <span style={{ fontSize: 18 }}>🖥</span>
          <span style={{ fontSize: 10 }}>{isSharing ? 'Stop Share' : 'Share'}</span>
        </button>

        {/* Raise hand */}
        <button style={cbBtn(isRaisingHand)} onClick={handleRaiseHand}>
          <span style={{ fontSize: 18 }}>✋</span>
          <span style={{ fontSize: 10 }}>{isRaisingHand ? 'Lower' : 'Raise Hand'}</span>
        </button>

        {/* End call */}
        <button style={{ ...cbBtn(false, true), padding: '8px 24px', fontSize: 13, fontWeight: 700, minWidth: 100 }}
          onClick={handleEnd}>
          <span style={{ fontSize: 18 }}>📵</span>
          <span style={{ fontSize: 10 }}>End Call</span>
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(76,175,80,.4); }
          50% { box-shadow: 0 0 0 12px rgba(76,175,80,0); }
        }
      `}</style>
    </div>
  );
}
