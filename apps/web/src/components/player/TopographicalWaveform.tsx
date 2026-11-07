import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';

interface TopographicalWaveformProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  trackId: string;
  onSeek?: (time: number) => void;
  accentColor?: string;
}

export const TopographicalWaveform: React.FC<TopographicalWaveformProps> = ({
  currentTime,
  duration,
  isPlaying,
  trackId,
  onSeek,
  accentColor = 'var(--md-sys-color-primary)'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [phase, setPhase] = useState(0);

  const progressFrac = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  // Smooth organic wave animation while playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setPhase((prev) => (prev + dt * 2.4) % (Math.PI * 20));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Deterministically generate base terrain seeds from trackId
  const baseNoise = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < trackId.length; i++) {
      seed = (seed * 31 + trackId.charCodeAt(i)) & 0xffffff;
    }
    const pseudoRandom = () => {
      seed = (seed * 16807 + 7) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };

    const numPoints = 32;
    return Array.from({ length: numPoints }, () => (pseudoRandom() - 0.5) * 9);
  }, [trackId]);

  // Compute live animated points using baseNoise + live phase
  const svgPathData = useMemo(() => {
    const numPoints = baseNoise.length;
    const tops: { x: number; y: number }[] = [];
    const bottoms: { x: number; y: number }[] = [];
    const secondaryTops: { x: number; y: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
      const norm = i / (numPoints - 1);
      const x = norm * 100;
      const angle = norm * Math.PI * 3.2;
      const noise = baseNoise[i];

      // Taper edges slightly so the wave nestles cleanly inside the Bento pill
      const edgeEnvelope = Math.sin(norm * Math.PI);
      const liveMotion = isPlaying
        ? (Math.sin(angle * 2.2 - phase * 1.3) * 4.2 +
            Math.cos(angle * 3.5 + phase * 0.9) * 2.8) *
          (0.35 + 0.65 * edgeEnvelope)
        : 0;

      // Boost amplitude slightly near the active playhead for harmonic response
      const distFromPlayhead = Math.abs(norm - progressFrac);
      const playheadBoost =
        isPlaying && distFromPlayhead < 0.14
          ? Math.cos((distFromPlayhead / 0.14) * (Math.PI / 2)) *
            4.5 *
            Math.sin(phase * 2.2 + i)
          : 0;

      const baseTop = 24 + Math.sin(angle * 1.2) * 9 + Math.cos(angle * 2.1) * 5;
      const topY = Math.max(5, Math.min(42, baseTop + noise + liveMotion - playheadBoost));

      const baseBottom = 45 + Math.sin(angle * 1.5) * 6 + Math.cos(angle * 2.8) * 3;
      const bottomY = Math.max(36, Math.min(56, baseBottom + noise * 0.5 - liveMotion * 0.45));

      const secY = Math.max(
        10,
        Math.min(
          48,
          32 +
            Math.cos(angle * 1.8 + phase * 0.8) * 7 +
            Math.sin(angle * 2.9 - phase * 1.1) * 4 -
            noise * 0.6
        )
      );

      tops.push({ x, y: topY });
      bottoms.push({ x, y: bottomY });
      secondaryTops.push({ x, y: secY });
    }

    const buildSmoothPath = (pts: { x: number; y: number }[]) => {
      let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
      }
      return d;
    };

    const topPath = buildSmoothPath(tops);
    const secondaryPath = buildSmoothPath(secondaryTops);
    const bottomPathReversed = buildSmoothPath([...bottoms].reverse());
    const fullArea = `${topPath} L 100 ${bottoms[bottoms.length - 1].y.toFixed(2)} ${bottomPathReversed} Z`;

    return { topPath, secondaryPath, fullArea };
  }, [baseNoise, phase, isPlaying, progressFrac]);

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !onSeek || duration <= 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(frac * duration);
    },
    [onSeek, duration]
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverFrac(frac);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => {
        handlePointerMove(e);
        if (e.buttons === 1) handlePointer(e);
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setHoverFrac(null);
      }}
      style={{
        position: 'relative',
        width: '100%',
        height: '46px',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        touchAction: 'none'
      }}
      title="Click or drag to seek across acoustic landscape"
    >
      {/* Floating Hover Timestamp Pill */}
      {isHovering && hoverFrac !== null && duration > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.max(6, Math.min(94, hoverFrac * 100))}%`,
            top: '-24px',
            transform: 'translateX(-50%)',
            padding: '2px 9px',
            borderRadius: '9999px',
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            fontSize: '10px',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            boxShadow: '0 4px 12px rgba(0,0,0,0.38)',
            pointerEvents: 'none',
            zIndex: 15,
            whiteSpace: 'nowrap'
          }}
        >
          {formatTime(hoverFrac * duration)}
        </div>
      )}

      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          filter: isPlaying ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))' : 'none',
          transition: 'filter 300ms ease'
        }}
      >
        <defs>
          <linearGradient id={`topoGrad-${trackId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.52" />
            <stop offset="65%" stopColor={accentColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.04" />
          </linearGradient>

          <clipPath id={`topoClip-${trackId}`}>
            <rect x="0" y="0" width={`${progressFrac * 100}`} height="60" />
          </clipPath>
        </defs>

        {/* 1. Background Inactive Acoustic Landscape Body */}
        <path d={svgPathData.fullArea} fill="rgba(255, 255, 255, 0.08)" />

        {/* Secondary Harmonic Contour Line */}
        <path
          d={svgPathData.secondaryPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />

        {/* Inactive Top Contour Line */}
        <path
          d={svgPathData.topPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.24)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 2. Active Played Portion (Clipped to Current Progress) */}
        <g clipPath={`url(#topoClip-${trackId})`}>
          <path d={svgPathData.fullArea} fill={`url(#topoGrad-${trackId})`} />
          <path
            d={svgPathData.secondaryPath}
            fill="none"
            stroke={accentColor}
            strokeOpacity="0.45"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <path
            d={svgPathData.topPath}
            fill="none"
            stroke={accentColor}
            strokeWidth="2.4"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {/* 3. Hover Ghost Guide Line */}
      {isHovering && hoverFrac !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${hoverFrac * 100}%`,
            top: '8px',
            bottom: '8px',
            width: '1.5px',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.45)',
            borderRadius: '9999px',
            pointerEvents: 'none'
          }}
        />
      )}

      {/* 4. Crisp M3 Expressive Playhead Pill Thumb (Unstretched HTML Overlay) */}
      <div
        style={{
          position: 'absolute',
          left: `${progressFrac * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: isHovering ? '7px' : '5px',
          height: isHovering ? '36px' : isPlaying ? '32px' : '24px',
          borderRadius: '9999px',
          backgroundColor: accentColor,
          boxShadow: isPlaying
            ? `0 0 14px ${accentColor}, 0 2px 6px rgba(0, 0, 0, 0.45)`
            : '0 2px 6px rgba(0, 0, 0, 0.35)',
          transition:
            'width 180ms cubic-bezier(0.34, 1.56, 0.64, 1), height 220ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 250ms ease',
          pointerEvents: 'none',
          zIndex: 5
        }}
      >
        {/* Subtle breathing pulse halo on the playhead thumb while playing */}
        {isPlaying && (
          <div
            style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: '9999px',
              border: `1.5px solid ${accentColor}`,
              opacity: 0.45 + 0.35 * Math.sin(phase * 1.6),
              transform: `scaleY(${1 + 0.08 * Math.sin(phase * 1.6)})`,
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
    </div>
  );
};
