import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface BottomEqualizerWaveProps {
  isPlaying: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const BAND_COUNT = 24;
const RESTING_LEVEL = 0.06;
const ATTACK = 0.52;
const RELEASE = 0.16;

export const BottomEqualizerWave: React.FC<BottomEqualizerWaveProps> = ({
  isPlaying,
  className = '',
  style
}) => {
  const bottomEqualizer = useSettingsStore((s) => s.bottomEqualizer);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  const levelsRef = useRef<Float32Array>(new Float32Array(BAND_COUNT).fill(RESTING_LEVEL));
  const [svgPaths, setSvgPaths] = useState<{ silhouette: string; spine: string }>({
    silhouette: '',
    spine: ''
  });

  useEffect(() => {
    if (!bottomEqualizer) return;

    let animId: number;
    let lastTime = performance.now();

    const updateFrame = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const levels = levelsRef.current;
      const t = now / 1000;

      let isMoving = false;

      if (isPlaying && !reduceMotion) {
        isMoving = true;
        // Organic multi-harmonic spectrum simulation mimicking decoded PCM
        for (let i = 0; i < BAND_COUNT; i++) {
          const normIdx = i / (BAND_COUNT - 1);
          // Frequency weighting: punchier low-end/mids, rolling treble
          const weight = 0.85 - 0.35 * normIdx + 0.25 * Math.sin(normIdx * Math.PI);
          
          const h1 = Math.sin(t * 3.4 + i * 0.45);
          const h2 = Math.sin(t * 6.2 - i * 0.7 + 1.2);
          const h3 = Math.cos(t * 1.9 + i * 0.28);
          const pulse = Math.pow(Math.max(0, Math.sin(t * 2.1)), 4) * 0.35; // Beat pulse

          const raw = Math.abs(h1 * 0.45 + h2 * 0.3 + h3 * 0.25) + pulse;
          const target = Math.min(1, Math.max(RESTING_LEVEL, raw * weight * 0.95));

          const speed = target > levels[i] ? ATTACK : RELEASE;
          levels[i] += (target - levels[i]) * Math.min(1, speed * (dt / 0.016));
        }
      } else {
        // Paused or reduced motion: ease gently down to resting level
        for (let i = 0; i < BAND_COUNT; i++) {
          if (Math.abs(levels[i] - RESTING_LEVEL) > 0.002) {
            levels[i] += (RESTING_LEVEL - levels[i]) * Math.min(1, 0.12 * (dt / 0.016));
            isMoving = true;
          } else {
            levels[i] = RESTING_LEVEL;
          }
        }
      }

      // Generate mirrored silhouette and spine paths matching Koda
      const width = 600;
      const height = 44;
      const centerY = height * 0.62;
      const amplitude = height * 0.48;
      const stepX = width / (BAND_COUNT - 1);

      // 1. Upper curve points
      const upperPoints: { x: number; y: number }[] = [];
      for (let i = 0; i < BAND_COUNT; i++) {
        const x = i * stepX;
        const y = centerY - Math.max(0.02, Math.min(1, levels[i])) * amplitude;
        upperPoints.push({ x, y });
      }

      // Build upper spine with smooth quadratic beziers
      let spineD = `M ${upperPoints[0].x.toFixed(1)} ${upperPoints[0].y.toFixed(1)}`;
      for (let i = 1; i < BAND_COUNT; i++) {
        const prev = upperPoints[i - 1];
        const curr = upperPoints[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        spineD += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)}`;
      }
      spineD += ` T ${upperPoints[BAND_COUNT - 1].x.toFixed(1)} ${upperPoints[BAND_COUNT - 1].y.toFixed(1)}`;

      // Build mirrored silhouette (upper curve -> lower curve -> close)
      let silD = spineD;
      // Connect to bottom mirrored curve
      for (let i = BAND_COUNT - 1; i >= 0; i--) {
        const x = i * stepX;
        const y = centerY + Math.max(0.02, Math.min(1, levels[i])) * amplitude * 0.7;
        if (i === BAND_COUNT - 1) {
          silD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else {
          const next = upperPoints[i + 1];
          const prevY = centerY + Math.max(0.02, Math.min(1, levels[i + 1])) * amplitude * 0.7;
          const midX = (x + next.x) / 2;
          const midY = (y + prevY) / 2;
          silD += ` Q ${next.x.toFixed(1)} ${prevY.toFixed(1)}, ${midX.toFixed(1)} ${midY.toFixed(1)}`;
        }
      }
      silD += ` L ${upperPoints[0].x.toFixed(1)} ${upperPoints[0].y.toFixed(1)} Z`;

      setSvgPaths({ silhouette: silD, spine: spineD });

      if (isMoving || isPlaying) {
        animId = requestAnimationFrame(updateFrame);
      }
    };

    animId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(animId);
  }, [bottomEqualizer, isPlaying, reduceMotion]);

  if (!bottomEqualizer) {
    return null;
  }

  return (
    <div
      className={`bottom-equalizer-wave ${className}`}
      style={{
        width: '100%',
        height: 'clamp(26px, 3.8vh, 38px)',
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'relative',
        marginTop: 'auto',
        ...style
      }}
      aria-label="Soundwave equalizer visualizer"
    >
      <svg
        viewBox="0 0 600 44"
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      >
        <defs>
          <linearGradient id="eqWaveFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--md-sys-color-primary)" stopOpacity="0.45" />
            <stop offset="50%" stopColor="var(--md-sys-color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--md-sys-color-primary)" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Mirrored Silhouette Fill */}
        {svgPaths.silhouette && (
          <path
            d={svgPaths.silhouette}
            fill="url(#eqWaveFillGradient)"
            style={{
              transition: isPlaying ? 'none' : 'opacity 300ms ease'
            }}
          />
        )}

        {/* Luminous Top Crest Spine */}
        {svgPaths.spine && (
          <path
            d={svgPaths.spine}
            fill="none"
            stroke="var(--md-sys-color-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              opacity: isPlaying ? 0.95 : 0.65,
              filter: 'drop-shadow(0 0 3px var(--md-sys-color-primary))',
              transition: isPlaying ? 'none' : 'opacity 300ms ease'
            }}
          />
        )}
      </svg>
    </div>
  );
};
