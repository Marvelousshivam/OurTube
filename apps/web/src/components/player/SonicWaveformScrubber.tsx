import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';

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
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);
  const [beatPhase, setBeatPhase] = useState(0);

  const progress =
    duration > 0
      ? isDragging && dragFraction !== null
        ? dragFraction
        : Math.min(1, currentTime / duration)
      : 0;
  const activeFraction = isDragging && dragFraction !== null ? dragFraction : hoverFraction;

  // Live harmonic pulse for bars near the playhead while playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const start = performance.now();
    const tick = (now: number) => {
      setBeatPhase((now - start) * 0.008);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Generate pseudo-deterministic, organic waveform bar heights for the track
  const barHeights = useMemo(() => {
    const barsCount = 42;
    const heights: number[] = [];
    const seed = trackId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) || 42;

    for (let i = 0; i < barsCount; i++) {
      const normalizedX = i / (barsCount - 1);
      const envelope = Math.sin(normalizedX * Math.PI);
      const noise = (((Math.sin(i * 1.7 + seed) * 10000) % 1) + 1) / 2;
      const h = Math.max(0.18, Math.min(1, envelope * 0.72 + noise * 0.36));
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

  const displayTime = isDragging && dragFraction !== null ? dragFraction * duration : currentTime;
  const previewTime = activeFraction !== null && duration > 0 ? activeFraction * duration : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        userSelect: 'none',
        position: 'relative'
      }}
    >
      {/* Current Elapsed Time */}
      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: accentColor,
          opacity: 0.9,
          minWidth: '34px'
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
        onPointerLeave={() => {
          if (!isDragging) setHoverFraction(null);
        }}
        style={{
          flex: 1,
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
          padding: '4px 0',
          touchAction: 'none'
        }}
      >
        {/* Floating M3 Hover / Scrub Timestamp Pill */}
        {activeFraction !== null && previewTime !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.max(6, Math.min(94, activeFraction * 100))}%`,
              top: '-28px',
              transform: 'translateX(-50%)',
              padding: '3px 9px',
              borderRadius: '9999px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontSize: '11px',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.03em',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
              animation: 'm3FadeScaleIn 120ms cubic-bezier(0.2, 0.9, 0.3, 1)'
            }}
          >
            {formatTime(previewTime)}
          </div>
        )}

        {/* Vertical Waveform Bars with Liquid Proximity Wave + Playhead Harmonic Pulse */}
        {barHeights.map((h, i) => {
          const barFraction = i / (barHeights.length - 1);
          const isPlayed = barFraction <= progress;

          // Liquid magnetic proximity wave under the finger/cursor
          const dist = activeFraction !== null ? Math.abs(barFraction - activeFraction) : 1;
          const proximityBoost = activeFraction !== null && dist < 0.13 ? (1 - dist / 0.13) * 0.46 : 0;

          // Live acoustic breathing near the active playhead when playing
          const playheadDist = Math.abs(barFraction - progress);
          const harmonicBoost =
            isPlaying && !isDragging && playheadDist < 0.08
              ? Math.sin(beatPhase + i * 0.9) * 0.18 * (1 - playheadDist / 0.08)
              : 0;

          const computedHeight = Math.max(
            6,
            Math.min(48, Math.round(h * 38 * (1 + proximityBoost + harmonicBoost)))
          );

          return (
            <div
              key={i}
              style={{
                width: '3.5px',
                height: `${computedHeight}px`,
                borderRadius: '9999px',
                backgroundColor: accentColor,
                opacity: isPlayed ? 1 : proximityBoost > 0 ? 0.68 : 0.26,
                transition: isDragging
                  ? 'none'
                  : 'opacity 150ms ease, height 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                transform: proximityBoost > 0 ? 'scaleX(1.2)' : 'scaleX(1)'
              }}
            />
          );
        })}

        {/* Hover Ghost Guide Line */}
        {hoverFraction !== null && !isDragging && (
          <div
            style={{
              position: 'absolute',
              left: `${hoverFraction * 100}%`,
              top: '6px',
              bottom: '6px',
              width: '1.5px',
              backgroundColor: accentColor,
              opacity: 0.38,
              borderRadius: '9999px',
              transform: 'translateX(-50%)',
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Playhead Vertical Cursor Pill with Spring Glow */}
        <div
          style={{
            position: 'absolute',
            left: `${progress * 100}%`,
            top: isDragging ? '0px' : '2px',
            bottom: isDragging ? '0px' : '2px',
            width: isDragging ? '4px' : '2.5px',
            backgroundColor: accentColor,
            borderRadius: '9999px',
            boxShadow: isDragging
              ? '0 0 16px currentColor, 0 0 6px #ffffff'
              : '0 0 10px currentColor',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            transition: 'width 150ms ease, top 150ms ease, bottom 150ms ease, box-shadow 150ms ease'
          }}
        />
      </div>

      {/* Total Duration */}
      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: accentColor,
          opacity: 0.78,
          minWidth: '34px',
          textAlign: 'right'
        }}
      >
        {formatTime(duration)}
      </span>
    </div>
  );
};
