import React, { useEffect, useRef, useState, useCallback } from 'react';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';
const WAVE_BAR_COUNT = 42;      // static waveform bar count
const WAVE_BAR_GAP = 2;          // px between bars
const WAVE_MIN_BAR_HEIGHT = 3;   // px, so silent samples still render

// ── VoiceNotePlayer ────────────────────────────────────────────
// Custom audio player for voice notes. Replaces the browser's default
// <audio controls> with:
//  - a waveform derived from the audio data (samples rendered as bars)
//  - a large play/pause button
//  - a progress line that fills the waveform as playback proceeds
//  - click-to-seek anywhere on the waveform
//  - a playback-speed toggle (1x, 1.5x, 2x)
//  - a duration + elapsed-time readout
//
// The waveform is decoded once on mount via Web Audio API's decodeAudioData,
// then sampled down to WAVE_BAR_COUNT equal-width buckets. Each bucket's peak
// amplitude is the bar height (0..1).

interface Props {
  src: string;              // streaming URL for the audio
  variant?: 'voice' | 'file';
}

export default function VoiceNotePlayer({ src, variant = 'voice' }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);

  const [waveform, setWaveform] = useState<number[]>([]);
  const [waveLoading, setWaveLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  // ── Decode audio to peaks ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setWaveLoading(true);
    setWaveform([]);

    // Decoding via Web Audio: fetch bytes, decode to AudioBuffer, then
    // bucket the channel into WAVE_BAR_COUNT peaks. Errors are swallowed
    // — we fall back to a flat waveform instead of breaking the player.
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      setWaveLoading(false);
      return;
    }

    const ctx = new AudioCtx();
    (async () => {
      try {
        const response = await fetch(src);
        const arrayBuf = await response.arrayBuffer();
        if (cancelled) return;

        const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        if (cancelled) return;

        const raw = audioBuf.getChannelData(0);
        const bucketSize = Math.floor(raw.length / WAVE_BAR_COUNT);
        if (bucketSize === 0) {
          setWaveform(Array(WAVE_BAR_COUNT).fill(0.1));
          setWaveLoading(false);
          return;
        }

        const peaks: number[] = [];
        for (let i = 0; i < WAVE_BAR_COUNT; i++) {
          let peak = 0;
          const start = i * bucketSize;
          const end = Math.min(start + bucketSize, raw.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(raw[j]);
            if (abs > peak) peak = abs;
          }
          peaks.push(peak);
        }

        // Normalize so the loudest bar fills the canvas
        const max = Math.max(...peaks, 0.01);
        const normalized = peaks.map(p => p / max);
        setWaveform(normalized);
      } catch {
        // Decode failed (CORS, unsupported format, etc.). Show a flat
        // placeholder waveform so the player still functions.
        if (!cancelled) setWaveform(Array(WAVE_BAR_COUNT).fill(0.15));
      } finally {
        if (!cancelled) {
          setWaveLoading(false);
          try { ctx.close(); } catch { /* ignore */ }
        }
      }
    })();

    return () => { cancelled = true; try { ctx.close(); } catch { /* ignore */ } };
  }, [src]);

  // ── Canvas paint ────────────────────────────────────────────
  // Re-draws whenever the waveform, current progress, or size changes.
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const container = waveContainerRef.current;
    if (!canvas || !container || waveform.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const barWidth = (width - WAVE_BAR_GAP * (waveform.length - 1)) / waveform.length;
    const mid = height / 2;
    const progress = duration > 0 ? currentTime / duration : 0;
    const playedBars = Math.floor(progress * waveform.length);

    for (let i = 0; i < waveform.length; i++) {
      const amp = waveform[i];
      const barH = Math.max(WAVE_MIN_BAR_HEIGHT, amp * height);
      const x = i * (barWidth + WAVE_BAR_GAP);
      const y = mid - barH / 2;

      // Played portion: solid blue. Unplayed: light blue.
      ctx.fillStyle = i <= playedBars ? BLUE : '#bbdefb';
      ctx.fillRect(x, y, barWidth, barH);
    }
  }, [waveform, duration, currentTime]);

  useEffect(() => { paint(); }, [paint]);

  // Re-paint on window resize (container may flex)
  useEffect(() => {
    const handler = () => paint();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [paint]);

  // ── Audio element hooks ─────────────────────────────────────
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => { /* autoplay blocked */ }); }
    else { a.pause(); }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    const container = waveContainerRef.current;
    if (!a || !container || !duration) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = ratio * duration;
    setCurrentTime(a.currentTime);
  };

  // Cycle 1 → 1.5 → 2 → 1
  const cycleSpeed = () => {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const fmtTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const accent = variant === 'voice' ? '#f0f7ff' : '#f8f9fa';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: accent, borderRadius: 10, border: '1px solid #dde1e7', minWidth: 0 }}>
      {/* Hidden audio element — drives playback */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Play / pause */}
      <button
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
        style={{
          width: 36, height: 36, flexShrink: 0,
          borderRadius: '50%', border: 'none',
          background: BLUE, color: '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, boxShadow: '0 2px 6px rgba(25,118,210,.3)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = BLUE_DARK)}
        onMouseLeave={e => (e.currentTarget.style.background = BLUE)}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      {/* Waveform + time */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          ref={waveContainerRef}
          onClick={handleSeek}
          style={{ width: '100%', height: 36, cursor: duration ? 'pointer' : 'default', position: 'relative' }}
          title={duration ? 'Click to seek' : undefined}
        >
          {waveLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: '#aaa', fontStyle: 'italic' }}>
              Loading waveform…
            </div>
          ) : (
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
          <span>{fmtTime(currentTime)}</span>
          <span>{fmtTime(duration)}</span>
        </div>
      </div>

      {/* Speed toggle */}
      <button
        onClick={cycleSpeed}
        title={`Playback speed (${speed}x) — click to change`}
        style={{
          flexShrink: 0, minWidth: 36, height: 24,
          padding: '0 8px',
          background: speed === 1 ? '#fff' : '#fff3e0',
          color: speed === 1 ? '#555' : '#e65100',
          border: `1px solid ${speed === 1 ? '#dde1e7' : '#ffcc80'}`,
          borderRadius: 12, cursor: 'pointer',
          fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {speed}×
      </button>
    </div>
  );
}
