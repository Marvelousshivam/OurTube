import React, { useMemo, useRef, useState, useCallback } from 'react';

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

  const progressFrac = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  // Deterministically generate smooth hill/wave terrain points based on trackId
  const { topPoints, bottomPoints } = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < trackId.length; i++) {
      seed = (seed * 31 + trackId.charCodeAt(i)) & 0xffffff;
    }
    const pseudoRandom = () => {
      seed = (seed * 16807 + 7) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };

    const numPoints = 28;
    const tops: { x: number; y: number }[] = [];
    const bottoms: { x: number; y: number }[] = [];

    // Generate undulating waves with smooth rolling peaks
    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * 100;
      // Combine low frequency sines with deterministic jitter
      const angle = (i / numPoints) * Math.PI * 3;
      const baseTop = 22 + Math.sin(angle * 1.2) * 10 + Math.cos(angle * 2.1) * 6;
      const noise = (pseudoRandom() - 0.5) * 8;
      const topY = Math.max(6, Math.min(38, baseTop + noise));

      // Mirror bottom contour (softer baseline)
      const baseBottom = 42 + Math.sin(angle * 1.5) * 8 + Math.cos(angle * 2.8) * 4;
      const bottomY = Math.max(34, Math.min(56, baseBottom + noise * 0.6));

      tops.push({ x, y: topY });
      bottoms.push({ x, y: bottomY });
    }

    return { topPoints: tops, bottomPoints: bottoms };
  }, [trackId]);

  // Convert points to smooth SVG cubic path
  const svgPathData = useMemo(() => {
    const buildSmoothPath = (pts: { x: number; y: number }[]) => {
      let d = `M ${pts[0].x} ${pts[0].y}`;
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

    const topPath = buildSmoothPath(topPoints);
    const bottomPathReversed = buildSmoothPath([...bottomPoints].reverse());

    // Full closed landscape polygon: Top forward -> Bottom backward -> Close
    const fullArea = `${topPath} L 100 ${bottomPoints[bottomPoints.length - 1].y} ${bottomPathReversed} Z`;

    return { topPath, fullArea };
  }, [topPoints, bottomPoints]);

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
        height: '48px',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px'
      }}
      title="Click or drag to seek across acoustic landscape"
    >
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
            <stop offset="0%" stopColor="var(--md-sys-color-primary)" stopOpacity="0.45" />
            <stop offset="60%" stopColor="var(--md-sys-color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--md-sys-color-primary)" stopOpacity="0.04" />
          </linearGradient>

          {/* Clip path for elapsed playhead */}
          <clipPath id={`topoClip-${trackId}`}>
            <rect x="0" y="0" width={`${progressFrac * 100}%`} height="60" />
          </clipPath>
        </defs>

        {/* 1. Background Inactive Acoustic Landscape Body */}
        <path
          d={svgPathData.fullArea}
          fill="rgba(255, 255, 255, 0.08)"
          style={{ transition: 'fill 300ms ease' }}
        />

        {/* Inactive Top Contour Line */}
        <path
          d={svgPathData.topPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.22)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 2. Active Played Portion (Clipped to Current Progress) */}
        <g clipPath={`url(#topoClip-${trackId})`}>
          <path d={svgPathData.fullArea} fill={`url(#topoGrad-${trackId})`} />
          <path
            d={svgPathData.topPath}
            fill="none"
            stroke="var(--md-sys-color-primary)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* 3. Playhead Marker Line */}
        <line
          x1={`${progressFrac * 100}%`}
          y1="4"
          x2={`${progressFrac * 100}%`}
          y2="56"
          stroke="var(--md-sys-color-primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ opacity: 0.85 }}
        />

        {/* Hover Indicator */}
        {isHovering && hoverFrac !== null && (
          <line
            x1={`${hoverFrac * 100}%`}
            y1="6"
            x2={`${hoverFrac * 100}%`}
            y2="54"
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}
      </svg>
    </div>
  );
};
