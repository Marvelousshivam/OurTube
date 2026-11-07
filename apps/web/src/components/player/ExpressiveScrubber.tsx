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
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const [waveOffset, setWaveOffset] = useState(0);

  const progress =
    duration > 0
      ? isDragging && dragFraction !== null
        ? dragFraction
        : Math.min(1, currentTime / duration)
      : 0;
  const activeFraction = isDragging && dragFraction !== null ? dragFraction : hoverFraction;

  // Animate sine wave traveling while playing and not dragging
  useEffect(() => {
    if (!isPlaying || isDragging) return;
    let animId: number;
    const start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) * 0.0065;
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
    const frac = calculateFraction(e.clientX);
    if (isDragging) {
      setDragFraction(frac);
    } else {
      setHoverFraction(frac);
    }
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

  const displayCurrentTime =
    isDragging && dragFraction !== null ? dragFraction * duration : currentTime;
  const previewTime = activeFraction !== null && duration > 0 ? activeFraction * duration : null;

  // SVG dimensions
  const width = 1000;
  const height = 28;
  const centerY = height / 2;
  const playheadX = progress * width;

  // Build SVG path for M3 Expressive wavy line
  const amplitude = isPlaying && !isDragging ? 3.8 : 0;
  const wavelength = 34;

  let wavePath = `M 0 ${centerY}`;
  if (amplitude > 0 && playheadX > 0) {
    const steps = Math.max(2, Math.floor(playheadX / 4));
    for (let i = 1; i <= steps; i++) {
      const x = (i / steps) * playheadX;
      // Taper amplitude near 0 and near playhead for organic join
      const edgeTaper = Math.min(1, Math.min(x / 24, (playheadX - x) / 18));
      const y =
        centerY +
        Math.sin((x / wavelength) * Math.PI * 2 - waveOffset) * amplitude * Math.max(0.25, edgeTaper);
      wavePath += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  } else {
    wavePath += ` L ${playheadX} ${centerY}`;
  }

  return (
    <div className={className} style={{ width: '100%', userSelect: 'none', position: 'relative' }}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (!isDragging) setHoverFraction(null);
        }}
        onPointerCancel={() => {
          setIsDragging(false);
          setDragFraction(null);
          setHoverFraction(null);
        }}
        style={{
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
          touchAction: 'none'
        }}
      >
        {/* Floating Hover / Drag Timestamp Preview Pill */}
        {activeFraction !== null && previewTime !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.max(5, Math.min(95, activeFraction * 100))}%`,
              top: '-24px',
              transform: 'translateX(-50%)',
              padding: '3px 9px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontSize: '11px',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap'
            }}
          >
            {formatTime(previewTime)}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '28px', overflow: 'visible' }}
        >
          {/* Unplayed flat track */}
          <line
            x1={Math.min(width, playheadX + 10)}
            y1={centerY}
            x2={width}
            y2={centerY}
            stroke="var(--md-sys-color-surface-container-highest)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {/* Hover ghost preview segment */}
          {hoverFraction !== null && hoverFraction > progress && (
            <line
              x1={playheadX}
              y1={centerY}
              x2={hoverFraction * width}
              y2={centerY}
              stroke={accentColor}
              strokeOpacity="0.32"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          )}

          {/* Played wavy/settled line */}
          <path
            d={wavePath}
            fill="none"
            stroke={accentColor}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* M3 Expressive Vertical Pill Thumb */}
          <rect
            x={Math.max(0, playheadX - (isDragging ? 5 : hoverFraction !== null ? 4 : 3.5))}
            y={isDragging ? centerY - 12 : hoverFraction !== null ? centerY - 10 : centerY - 8}
            width={isDragging ? 10 : hoverFraction !== null ? 8 : 7}
            height={isDragging ? 24 : hoverFraction !== null ? 20 : 16}
            rx={isDragging ? 5 : 3.5}
            fill={accentColor}
            style={{
              transition: isDragging ? 'none' : 'y 150ms ease, height 150ms ease, width 150ms ease',
              filter:
                isDragging || hoverFraction !== null
                  ? 'drop-shadow(0 2px 10px rgba(0,0,0,0.45))'
                  : 'none'
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
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--md-sys-color-on-surface-variant)',
          letterSpacing: '0.02em'
        }}
      >
        <span style={{ color: isDragging ? accentColor : 'inherit' }}>
          {formatTime(displayCurrentTime)}
        </span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};
