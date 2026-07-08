import React from 'react';
import { useCallStore } from '../../store/callStore';
import { useUIStore } from '../../store/uiStore';
import Icon from '@/components/ui/Icon';

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
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {callType === 'video'
          ? <Icon name="video" size={14} color="#fff" />
          : <Icon name="phone" size={14} color="#fff" />}
      </span>
      <span>{callType === 'video' ? 'Video' : 'Audio'} call in progress</span>

      <button style={{ ...cbBtn(isMuted), display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={toggleMute}>
        {isMuted
          ? <><Icon name="mic-off" size={14} color="#fff" /> Unmute</>
          : <><Icon name="mic" size={14} color="#fff" /> Mute</>}
      </button>

      {callType === 'video' && (
        <button style={{ ...cbBtn(isCameraOff), display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={toggleCamera}>
          {isCameraOff
            ? <><Icon name="video-off" size={14} color="#fff" /> Off</>
            : <><Icon name="video" size={14} color="#fff" /> Camera</>}
        </button>
      )}

      <button
        style={{ ...cbBtn(isSharing), display: 'inline-flex', alignItems: 'center', gap: 4, background: isSharing ? 'rgba(100,200,255,.25)' : 'transparent', borderColor: isSharing ? 'rgba(100,200,255,.5)' : 'rgba(255,255,255,.4)' }}
        onClick={toggleShare}
      >
        {isSharing
          ? <><Icon name="screen-share-off" size={14} color="#fff" /> Stop Share</>
          : <><Icon name="screen-share" size={14} color="#fff" /> Share Screen</>}
      </button>

      <button
        style={{ ...cbBtn(), display: 'inline-flex', alignItems: 'center', gap: 4, background: '#c62828', borderColor: '#c62828', fontWeight: 700 }}
        onClick={handleEnd}
      >
        <Icon name="phone-off" size={14} color="#fff" /> End Call
      </button>

      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 14, fontFamily: 'monospace', letterSpacing: 1 }}>
        {fmt(elapsedSeconds)}
      </span>
    </div>
  );
}
