import React, { useRef, useEffect } from 'react';

interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  isLocal?: boolean;
  isCameraOff?: boolean;
  isRaisingHand?: boolean;
}

function VideoTile({ stream, label, muted = false, isLocal = false, isCameraOff = false, isRaisingHand = false }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = label
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{
      position: 'relative',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#1a1a2e',
      border: isLocal ? '2px solid #1976d2' : '1px solid #333',
      aspectRatio: '16/9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Video element */}
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        /* Avatar fallback when no video */
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#1976d2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#fff',
        }}>
          {initials}
        </div>
      )}

      {/* Name label */}
      <div style={{
        position: 'absolute', bottom: 8, left: 10,
        background: 'rgba(0,0,0,.55)', color: '#fff',
        fontSize: 11, padding: '2px 8px', borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {isLocal && <span style={{ color: '#90caf9' }}>You</span>}
        {label}
        {isRaisingHand && <span title="Raising hand">✋</span>}
      </div>

      {/* Muted indicator */}
      {muted && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(198,40,40,.7)', borderRadius: '50%',
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11,
        }}>
          🔇
        </div>
      )}

      {/* Local badge */}
      {isLocal && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'rgba(25,118,210,.7)', color: '#fff',
          fontSize: 9, padding: '2px 6px', borderRadius: 8, fontWeight: 700,
        }}>
          YOU
        </div>
      )}
    </div>
  );
}

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;
  localLabel: string;
  remoteLabels: Map<number, string>;
  isMuted: boolean;
  isCameraOff: boolean;
}

export default function VideoGrid({
  localStream,
  remoteStreams,
  localLabel,
  remoteLabels,
  isMuted,
  isCameraOff,
}: VideoGridProps) {
  const totalParticipants = 1 + remoteStreams.size;

  // Grid columns: 1 for solo, 2 for 2-4, 3 for 5-9, etc.
  const cols = totalParticipants === 1 ? 1
    : totalParticipants <= 4 ? 2
    : totalParticipants <= 9 ? 3
    : 4;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 8,
      padding: 12,
      flex: 1,
      alignContent: 'center',
    }}>
      {/* Local tile */}
      <VideoTile
        stream={localStream}
        label={localLabel}
        muted
        isLocal
        isCameraOff={isCameraOff}
      />

      {/* Remote tiles */}
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
        <VideoTile
          key={userId}
          stream={stream}
          label={remoteLabels.get(userId) || `User ${userId}`}
          muted={false}
          isCameraOff={false}
        />
      ))}
    </div>
  );
}
