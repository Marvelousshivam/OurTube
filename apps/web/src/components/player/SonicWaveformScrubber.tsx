import React, { useRef, useState, useCallback, useMemo } from 'react';

interface SonicWaveformScrubberProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  accentColor?: string;
  trackId?: string;
}

export const SonicWaveformScrubber: React.FC<SonicWaveformScrubberProps> = ({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  accentColor = 'currentColor',
  trackId = 'default'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const progress = duration > 0 ? (isDragging && dragFraction !== null ? dragFraction : Math.min(1, currentTime / duration)) : 0;

  // Generate pseudo-deterministic, organic waveform bar heights for the track
  const barHeights = useMemo(() => {
    const barsCount = 38;
    const heights: number[] = [];
    const seed = trackId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) || 42;

    for (let i = 0; i < barsCount; i++) {
      // Create natural acoustic contour (bell curve baseline + deterministic harmonic noise)
      const normalizedX = i / (barsCount - 1);
      const envelope = Math.sin(normalizedX * Math.PI); // 0 at edges, 1 at center
      const noise = ((Math.sin(i * 1.7 + seed) * 10000) % 1 + 1) / 2; // pseudo-random [0, 1]
      const h = Math.max(0.18, Math.min(1, envelope * 0.75 + noise * 0.35));
      heights.push(h);
    }
    return heights;
  }, [trackId]);

  const calculateFraction = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return rect.width > 0 ? x / rect.width : 0;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const frac = calculateFraction(e.clientX);
    setDragFraction(frac);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const frac = calculateFraction(e.clientX);
    setDragFraction(frac);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const frac = calculateFraction(e.clientX);
    setIsDragging(false);
    setDragFraction(null);
    onSeek(frac * duration);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayTime = isDragging && dragFraction !== null ? dragFraction * duration : currentTime;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        userSelect: 'none'
      }}
    >
      {/* Current Elapsed Time */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: accentColor,
          opacity: 0.85,
          minWidth: '32px'
        }}
      >
        {formatTime(displayTime)}
      </span>

      {/* Waveform Bar Track Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1,
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
          padding: '4px 0'
        }}
      >
        {/* Vertical Waveform Bars */}
        {barHeights.map((h, i) => {
          const barFraction = i / (barHeights.length - 1);
          const isPlayed = barFraction <= progress;

          return (
            <div
              key={i}
              style={{
                width: '3.5px',
                height: `${Math.round(h * 38)}px`,
                borderRadius: '9999px',
                backgroundColor: accentColor,
                opacity: isPlayed ? 1 : 0.28,
                transition: isDragging ? 'none' : 'opacity 150ms ease, height 300ms ease'
              }}
            />
          );
        })}

        {/* Playhead Vertical Cursor Line */}
        <div
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            top: '4px',
            bottom: '4px',
            width: '2px',
            backgroundColor: accentColor,
            borderRadius: '9999px',
            boxShadow: '0 0 8px currentColor',
            transform: 'translateX(-50%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Total Duration */}
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: accentColor,
          opacity: 0.85,
          minWidth: '32px',
          textAlign: 'right'
        }}
      >
        {formatTime(duration)}
      </span>
    </div>
  );
};
