import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ExpressiveScrubberProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  accentColor?: string;
  className?: string;
}

export const ExpressiveScrubber: React.FC<ExpressiveScrubberProps> = ({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  accentColor = 'var(--md-sys-color-primary)',
  className
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const [waveOffset, setWaveOffset] = useState(0);

  const progress = duration > 0 ? (isDragging && dragFraction !== null ? dragFraction : Math.min(1, currentTime / duration)) : 0;

  // Animate sine wave traveling while playing and not dragging
  useEffect(() => {
    if (!isPlaying || isDragging) return;
    let animId: number;
    let start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) * 0.006;
      setWaveOffset(elapsed);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isDragging]);

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

  const displayCurrentTime = isDragging && dragFraction !== null ? dragFraction * duration : currentTime;

  // SVG dimensions
  const width = 1000;
  const height = 24;
  const centerY = height / 2;
  const playheadX = progress * width;

  // Build SVG path for wavy line
  const amplitude = isPlaying && !isDragging ? 3 : 0;
  const wavelength = 36;

  let wavePath = `M 0 ${centerY}`;
  if (amplitude > 0 && playheadX > 0) {
    const steps = Math.floor(playheadX / 4);
    for (let i = 1; i <= steps; i++) {
      const x = (i / steps) * playheadX;
      const y = centerY + Math.sin(x / wavelength * Math.PI * 2 - waveOffset) * amplitude;
      wavePath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  } else {
    wavePath += ` L ${playheadX} ${centerY}`;
  }

  return (
    <div className={className} style={{ width: '100%', userSelect: 'none' }}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          setIsDragging(false);
          setDragFraction(null);
        }}
        style={{
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
          touchAction: 'none'
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '24px', overflow: 'visible' }}
        >
          {/* Unplayed flat track */}
          <line
            x1="0"
            y1={centerY}
            x2={width}
            y2={centerY}
            stroke="var(--md-sys-color-surface-container-highest)"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Played wavy/settled line */}
          <path
            d={wavePath}
            fill="none"
            stroke={accentColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Scrubber thumb pill */}
          <rect
            x={Math.max(0, playheadX - (isDragging ? 4 : 3))}
            y={isDragging ? centerY - 10 : centerY - 7}
            width={isDragging ? 8 : 6}
            height={isDragging ? 20 : 14}
            rx={isDragging ? 4 : 3}
            fill={accentColor}
            style={{
              transition: isDragging ? 'none' : 'y 150ms ease, height 150ms ease, width 150ms ease',
              filter: isDragging ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' : 'none'
            }}
          />
        </svg>
      </div>

      {/* Time indicators */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '2px',
          fontSize: '12px',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--md-sys-color-on-surface-variant)',
          letterSpacing: '0.02em'
        }}
      >
        <span>{formatTime(displayCurrentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};
