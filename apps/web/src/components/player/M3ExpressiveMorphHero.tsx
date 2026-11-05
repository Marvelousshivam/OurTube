import React, { useEffect, useRef, useState, useId } from 'react';
import { sizedArtwork } from '../../api/artworkService';

interface M3ExpressiveMorphHeroProps {
  artworkUrl: string | null | undefined;
  title: string;
  isPlaying: boolean;
  progress: number; // 0 to 1
  onPlayPause: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const POINT_COUNT = 72; // Evenly divisible by 12, 10, 8, 6

// Plush, rounded Google Material 3 Expressive shapes with softened lobe crowns
function getShapeRadius(shapeIndex: number, theta: number): number {
  switch (shapeIndex) {
    case 0: // Cookie12Sided (12 plush rounded scallops - Koda Photo 5)
      return 105 + 13 * Math.cos(12 * theta) + 2.5 * Math.cos(24 * theta);
    case 1: // SoftBurst (10 rounded star lobes)
      return 104 + 14 * Math.cos(10 * theta) + 2.2 * Math.cos(20 * theta);
    case 2: // Sunny (8 rounded flower petals)
      return 103 + 15 * Math.cos(8 * theta) + 2.5 * Math.cos(16 * theta);
    case 3: // Puffy (6 cloud clover lobes)
      return 104 + 15 * Math.cos(6 * theta) + 2.8 * Math.cos(12 * theta);
    case 4: // Cookie9Sided (9 plush scallops)
      return 105 + 13 * Math.cos(9 * theta) + 2.2 * Math.cos(18 * theta);
    case 99: // Pure Circle (Paused baseline)
    default:
      return 110;
  }
}

// Pre-computed radii sets for the 5 shapes + circle
const SHAPE_SETS: number[][] = [0, 1, 2, 3, 4].map((shapeIdx) => {
  const arr = new Array(POINT_COUNT);
  for (let i = 0; i < POINT_COUNT; i++) {
    const theta = (i * 2 * Math.PI) / POINT_COUNT;
    arr[i] = getShapeRadius(shapeIdx, theta);
  }
  return arr;
});

const CIRCLE_SET: number[] = new Array(POINT_COUNT).fill(110);

// Generate smooth cubic bezier SVG path from radial distances
function buildCubicSvgPath(radii: number[], cx = 150, cy = 150): string {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    const angle = (i * 2 * Math.PI) / POINT_COUNT - Math.PI / 2;
    const r = radii[i];
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < POINT_COUNT; i++) {
    const pPrev = pts[(i - 1 + POINT_COUNT) % POINT_COUNT];
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % POINT_COUNT];
    const pNextNext = pts[(i + 2) % POINT_COUNT];

    const cp1x = pCurr.x + (pNext.x - pPrev.x) / 6;
    const cp1y = pCurr.y + (pNext.y - pPrev.y) / 6;
    const cp2x = pNext.x - (pNextNext.x - pCurr.x) / 6;
    const cp2y = pNext.y - (pNextNext.y - pCurr.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pNext.x.toFixed(2)} ${pNext.y.toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

// M3 FastOutSlowIn Easing (cubic-bezier(0.4, 0.0, 0.2, 1.0))
function fastOutSlowIn(t: number): number {
  const p1 = 0.4;
  const p2 = 0.2;
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * (1 - p2) + t * t * t;
}

export const M3ExpressiveMorphHero: React.FC<M3ExpressiveMorphHeroProps> = ({
  artworkUrl,
  title,
  isPlaying,
  progress,
  onPlayPause,
  className = '',
  style
}) => {
  const clipId = `m3-morph-clip-${useId().replace(/:/g, '')}`;

  // Radii states for smooth continuous morphing
  const currentRadiiRef = useRef<number[]>([...(isPlaying ? SHAPE_SETS[0] : CIRCLE_SET)]);
  const [morphPathD, setMorphPathD] = useState<string>(() =>
    buildCubicSvgPath(isPlaying ? SHAPE_SETS[0] : CIRCLE_SET)
  );

  const shapeIndexRef = useRef(0);
  const transitionStartRef = useRef<number>(performance.now());
  const fromRadiiRef = useRef<number[]>([...(isPlaying ? SHAPE_SETS[0] : CIRCLE_SET)]);
  const targetRadiiRef = useRef<number[]>(isPlaying ? SHAPE_SETS[1] : CIRCLE_SET);
  const isHoldingRef = useRef<boolean>(false);
  const holdStartRef = useRef<number>(0);

  // Wavy progress ring parameters
  const baseR = 138;
  const waveFreq = 26; // 26 gentle rolling ripples around circle
  const totalLength = 2 * Math.PI * baseR;
  const [waveAmp, setWaveAmp] = useState(isPlaying ? 4.5 : 0);

  // Build wavy progress ring SVG path
  const wavyPathD = React.useMemo(() => {
    const cx = 150;
    const cy = 150;
    const steps = 260;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const angle = (i * 2 * Math.PI) / steps - Math.PI / 2;
      const ripple = Math.sin(i * (waveFreq / steps) * 2 * Math.PI) * waveAmp;
      const r = baseR + ripple;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  }, [waveAmp]);

  // Synchronize playing state changes
  useEffect(() => {
    fromRadiiRef.current = [...currentRadiiRef.current];
    transitionStartRef.current = performance.now();
    isHoldingRef.current = false;

    if (isPlaying) {
      setWaveAmp(4.5);
      const nextIdx = (shapeIndexRef.current + 1) % SHAPE_SETS.length;
      shapeIndexRef.current = nextIdx;
      targetRadiiRef.current = SHAPE_SETS[nextIdx];
    } else {
      setWaveAmp(0);
      targetRadiiRef.current = CIRCLE_SET;
    }
  }, [isPlaying]);

  // High-performance animation frame loop: 2.2s morph + 1.2s showcase hold
  useEffect(() => {
    let animId: number;
    const morphDuration = 2200; // 2.2s morph
    const holdDuration = 1200;  // 1.2s showcase hold

    const tick = (now: number) => {
      if (isHoldingRef.current) {
        if (now - holdStartRef.current >= holdDuration) {
          if (isPlaying) {
            isHoldingRef.current = false;
            shapeIndexRef.current = (shapeIndexRef.current + 1) % SHAPE_SETS.length;
            fromRadiiRef.current = [...targetRadiiRef.current];
            targetRadiiRef.current = SHAPE_SETS[shapeIndexRef.current];
            transitionStartRef.current = now;
          }
        }
        animId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - transitionStartRef.current;
      const rawProgress = Math.min(1, elapsed / morphDuration);
      const eased = fastOutSlowIn(rawProgress);

      const from = fromRadiiRef.current;
      const to = targetRadiiRef.current;
      const current = currentRadiiRef.current;

      for (let i = 0; i < POINT_COUNT; i++) {
        current[i] = from[i] + (to[i] - from[i]) * eased;
      }

      setMorphPathD(buildCubicSvgPath(current));

      if (rawProgress >= 1) {
        if (isPlaying) {
          isHoldingRef.current = true;
          holdStartRef.current = now;
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  return (
    <div
      className={`m3-expressive-morph-hero ${className}`}
      style={{
        position: 'relative',
        width: 'clamp(220px, 38vh, 320px)',
        height: 'clamp(220px, 38vh, 320px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 'auto 0',
        ...style
      }}
    >
      <style>{`
        @keyframes m3HeroBreathLive {
          0%, 100% { transform: scale(0.978) rotate(-3deg); }
          50% { transform: scale(1.022) rotate(3deg); }
        }
        @keyframes m3RestingPulseLive {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.008); }
        }
      `}</style>

      {/* Unified SVG Stage: Progress Ring + Animated ClipPath + Hero Image */}
      <svg
        viewBox="0 0 300 300"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          display: 'block'
        }}
      >
        <defs>
          {/* Dynamic Morphing ClipPath */}
          <clipPath id={clipId}>
            <path d={morphPathD} />
          </clipPath>

          {/* Elevation Drop Shadow */}
          <filter id={`${clipId}-drop`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#000000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* 1. Inactive Orbital Guide Track */}
        <circle
          cx="150"
          cy="150"
          r={baseR}
          fill="none"
          stroke="var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.18))"
          strokeWidth="2"
          opacity="0.4"
        />

        {/* 2. Active Serpentine Wavy Progress Stroke */}
        <path
          d={wavyPathD}
          fill="none"
          stroke="var(--md-sys-color-primary, #4dabf7)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={totalLength}
          strokeDashoffset={totalLength * (1 - Math.max(0, Math.min(1, progress)))}
          style={{
            transition: isPlaying ? 'stroke-dashoffset 200ms linear' : 'stroke-dashoffset 400ms ease',
            filter: 'drop-shadow(0 0 5px var(--md-sys-color-primary))'
          }}
        />

        {/* 3. Living Center Morphing Artwork Hero */}
        <g
          onClick={onPlayPause}
          style={{
            cursor: 'pointer',
            transformOrigin: '150px 150px',
            filter: `url(#${clipId}-drop)`
          }}
        >
          {/* Kinetic Breath & Tilt Spring Layer */}
          <g
            style={{
              transformOrigin: '150px 150px',
              animation: isPlaying
                ? 'm3HeroBreathLive 3.6s ease-in-out infinite'
                : 'm3RestingPulseLive 4s ease-in-out infinite',
              transition: 'transform 600ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            {/* Directly Clipped Image in SVG - 100% Repaint Safe & Never Cropped */}
            <g clipPath={`url(#${clipId})`}>
              <image
                href={sizedArtwork(artworkUrl || undefined, 800)}
                x="20"
                y="20"
                width="260"
                height="260"
                preserveAspectRatio="xMidYMid slice"
              />
            </g>

            {/* Subtle Expressive Scallop Border */}
            <path
              d={morphPathD}
              fill="none"
              stroke="var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.3))"
              strokeWidth="1.5"
              opacity="0.4"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
