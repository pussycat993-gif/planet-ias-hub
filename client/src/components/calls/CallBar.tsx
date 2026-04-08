import React from 'react';
import { useCallStore } from '../../store/callStore';
import { useUIStore } from '../../store/uiStore';

function fmt(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const cbBtn = (active = false): React.CSSProperties => ({
  border: `1px solid ${active ? 'rgba(255,80,80,.6)' : 'rgba(255,255,255,.4)'}`,
  background: active ? 'rgba(255,80,80,.4)' : 'transparent',
  color: '#fff', padding: '3px 9px', cursor: 'pointer',
  fontSize: 11, borderRadius: 6, fontFamily: 'inherit', transition: 'background .15s',
});

export default function CallBar() {
  const { active, callType, elapsedSeconds, isMuted, isCameraOff, isSharing, toggleMute, toggleCamera, toggleShare, endCall } = useCallStore();
  const { openModal } = useUIStore();

  if (!active) return null;

  const handleEnd = async () => {
    const result = await endCall();
    if (result) openModal('endCall');
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg,#1b5e20,#2e7d32)',
      color: '#fff', padding: '6px 12px',
      display: 'flex', alignItems: 'center', gap: 7,
      fontSize: 12, flexShrink: 0,
    }}>
      <span>{callType === 'video' ? '📹' : '📞'}</span>
      <span>{callType === 'video' ? 'Video' : 'Audio'} call in progress</span>

      <button style={cbBtn(isMuted)} onClick={toggleMute}>
        {isMuted ? '🔇 Unmute' : '🎤 Mute'}
      </button>

      {callType === 'video' && (
        <button style={cbBtn(isCameraOff)} onClick={toggleCamera}>
          {isCameraOff ? '📷 Off' : '📷 Camera'}
        </button>
      )}

      <button
        style={{ ...cbBtn(isSharing), background: isSharing ? 'rgba(100,200,255,.25)' : 'transparent', borderColor: isSharing ? 'rgba(100,200,255,.5)' : 'rgba(255,255,255,.4)' }}
        onClick={toggleShare}
      >
        {isSharing ? '🖥 Stop Share' : '🖥 Share Screen'}
      </button>

      <button
        style={{ ...cbBtn(), background: '#c62828', borderColor: '#c62828', fontWeight: 700 }}
        onClick={handleEnd}
      >
        End Call
      </button>

      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 14, fontFamily: 'monospace', letterSpacing: 1 }}>
        {fmt(elapsedSeconds)}
      </span>
    </div>
  );
}
