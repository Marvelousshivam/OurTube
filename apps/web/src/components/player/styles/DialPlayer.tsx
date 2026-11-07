import React, { useRef, useMemo, useState, useEffect, useId } from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';
import { BottomEqualizerWave } from '../BottomEqualizerWave';

interface DialPlayerProps {
  track: TrackMetadata;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  repeatMode?: RepeatMode;
  isShuffled?: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleLike: () => void;
  onToggleRepeat?: () => void;
  onToggleShuffle?: () => void;
  onOpenLyrics: () => void;
  onOpenQueue: () => void;
}

export const DialPlayer: React.FC<DialPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  isLiked,
  repeatMode = 'off',
  isShuffled = false,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onToggleLike,
  onToggleRepeat,
  onToggleShuffle,
  onOpenLyrics,
  onOpenQueue
}) => {
  const dialSvgRef = useRef<SVGSVGElement | null>(null);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const currentAngleDeg = progress * 360;

  // 60 Precision Chronograph Radial Ticks (Matching Photo 4)
  const ticks = useMemo(() => {
    const list = [];
    const count = 60;
    const cx = 150;
    const cy = 150;
    const outerR = 138;

    for (let i = 0; i < count; i++) {
      const angleDeg = i * 6 - 90; // Start at 12 o'clock (-90 deg)
      const rad = (angleDeg * Math.PI) / 180;
      const isMajor = i % 5 === 0;
      const innerR = isMajor ? outerR - 14 : outerR - 9;

      const x1 = cx + innerR * Math.cos(rad);
      const y1 = cy + innerR * Math.sin(rad);
      const x2 = cx + outerR * Math.cos(rad);
      const y2 = cy + outerR * Math.sin(rad);

      list.push({
        index: i,
        angleDeg: (i * 6), // 0 to 354
        x1,
        y1,
        x2,
        y2,
        isMajor
      });
    }
    return list;
  }, []);

  // Handle interactive radial polar scrubbing
  const handleDialPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = dialSvgRef.current;
    if (!svg || duration <= 0) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Angle clockwise from 12 o'clock (-90 deg in Cartesian)
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    const pct = Math.max(0, Math.min(1, deg / 360));
    onSeek(pct * duration);
  };

  const puckClipId = `dial-puck-clip-${useId().replace(/:/g, '')}`;

  // 48-point spline for dial puck centered at (150, 150) inside the 300x300 dial SVG
  const puckPointsRef = useRef<number[]>(new Array(48).fill(64));
  const [puckPathD, setPuckPathD] = useState<string>('');

  useEffect(() => {
    let animId: number;
    const start = performance.now();
    const duration = 650;
    const fromRadii = [...puckPointsRef.current];
    const targetRadii = new Array(48);

    for (let i = 0; i < 48; i++) {
      const theta = (i * 2 * Math.PI) / 48;
      targetRadii[i] = isPlaying
        ? 61 + 8.5 * Math.cos(12 * theta) + 1.8 * Math.cos(24 * theta)
        : 63;
    }

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // FastOutSlowIn Easing
      const p1 = 0.4, p2 = 0.2, u = 1 - progress;
      const eased = 3 * u * u * progress * p1 + 3 * u * progress * progress * (1 - p2) + progress * progress * progress;

      const current = puckPointsRef.current;
      for (let i = 0; i < 48; i++) {
        current[i] = fromRadii[i] + (targetRadii[i] - fromRadii[i]) * eased;
      }

      // Generate SVG path centered at (150, 150)
      const cx = 150, cy = 150;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 48; i++) {
        const theta = (i * 2 * Math.PI) / 48 - Math.PI / 2;
        const r = current[i];
        pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
      }

      let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
      for (let i = 0; i < 48; i++) {
        const pPrev = pts[(i - 1 + 48) % 48];
        const pCurr = pts[i];
        const pNext = pts[(i + 1) % 48];
        const pNextNext = pts[(i + 2) % 48];
        const cp1x = pCurr.x + (pNext.x - pPrev.x) / 6;
        const cp1y = pCurr.y + (pNext.y - pPrev.y) / 6;
        const cp2x = pNext.x - (pNextNext.x - pCurr.x) / 6;
        const cp2y = pNext.y - (pNextNext.y - pCurr.y) / 6;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pNext.x.toFixed(2)} ${pNext.y.toFixed(2)}`;
      }
      d += ' Z';
      setPuckPathD(d);

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        maxWidth: '540px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'clamp(12px, 2.5vh, 24px) clamp(16px, 3vw, 28px)',
        height: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 5,
        color: 'var(--md-sys-color-on-surface)'
      }}
    >
      <style>{`
        @keyframes dialPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        @keyframes dialPuckBreathLive {
          0%, 100% { transform: scale(0.985) rotate(-2deg); }
          50% { transform: scale(1.025) rotate(2deg); }
        }
      `}</style>

      {/* 360° Precision Radial Chronograph Gauge (Matching Photo 4) */}
      <div
        style={{
          position: 'relative',
          width: 'clamp(220px, 38vh, 320px)',
          height: 'clamp(220px, 38vh, 320px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 'auto 0'
        }}
      >
        <svg
          ref={dialSvgRef}
          viewBox="0 0 300 300"
          onPointerDown={(e) => {
            (e.currentTarget as any).setPointerCapture(e.pointerId);
            handleDialPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0) handleDialPointer(e);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none'
          }}
        >
          {/* Radial Ticks */}
          {ticks.map((t) => {
            const isActive = t.angleDeg <= currentAngleDeg;
            const strokeColor = isActive
              ? 'var(--md-sys-color-primary, #3b82f6)'
              : 'var(--md-sys-color-surface-container-highest, rgba(255, 255, 255, 0.22))';
            const strokeWidth = t.isMajor ? (isActive ? 3.5 : 2.5) : (isActive ? 2.5 : 1.5);

            return (
              <line
                key={t.index}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{
                  transition: 'stroke 120ms ease, stroke-width 120ms ease'
                }}
              />
            );
          })}

          {/* Defs for Die-Cut Puck ClipPath & Drop Shadow */}
          <defs>
            <clipPath id={puckClipId}>
              <path d={puckPathD} />
            </clipPath>
            <filter id={`${puckClipId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#000000" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* 12 o'clock Reference Notch */}
          <line
            x1="150"
            y1="12"
            x2="150"
            y2="26"
            stroke="var(--md-sys-color-on-surface)"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Center Die-Cut Scallop Puck (Direct SVG - 100% Repaint Safe & Never Cropped) */}
          <g
            style={{
              transformOrigin: '150px 150px',
              cursor: 'pointer',
              filter: `url(#${puckClipId}-shadow)`
            }}
            onClick={onTogglePlay}
          >
            <g
              style={{
                transformOrigin: '150px 150px',
                animation: isPlaying ? 'dialPuckBreathLive 3.6s ease-in-out infinite' : 'none',
                transition: 'transform 400ms ease'
              }}
            >
              {/* Clipped Image */}
              <g clipPath={`url(#${puckClipId})`}>
                <image
                  href={sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 600)}
                  x="75"
                  y="75"
                  width="150"
                  height="150"
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>

              {/* Scallop Silhouette Outline */}
              <path
                d={puckPathD}
                fill="none"
                stroke="var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.3))"
                strokeWidth="1.5"
                opacity="0.45"
                style={{ pointerEvents: 'none' }}
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Centered Digital Timestamp (Matching Photo 4: 0:55 / 4:27) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--md-sys-color-on-surface-variant)',
          fontVariantNumeric: 'tabular-nums',
          margin: '0 0 10px 0'
        }}
      >
        <span style={{ color: 'var(--md-sys-color-on-surface)', fontWeight: 800 }}>
          {formatTime(currentTime)}
        </span>
        <span style={{ opacity: 0.4 }}>/</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Info & Bottom Controls (Photo 4) */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(10px, 1.8vh, 16px)',
          textAlign: 'center',
          marginTop: 'auto'
        }}
      >
        {/* Track Title & Artist */}
        <div>
          <h2
            style={{
              fontSize: 'clamp(20px, 2.6vh, 26px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 4px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {track.title}
          </h2>
          <p
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--md-sys-color-outline)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {track.artist}
          </p>
        </div>

        {/* Bottom Controls Row (Matching Photo 4) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(14px, 3vw, 24px)'
          }}
        >
          {/* Previous Track */}
          <button
            onClick={onPrev}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--md-sys-color-on-surface)',
              padding: '6px'
            }}
            title="Previous track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
              skip_previous
            </span>
          </button>

          {/* Favorite Button */}
          <button
            onClick={onToggleLike}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isLiked ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
              padding: '6px'
            }}
            title={isLiked ? 'Liked' : 'Like'}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '22px',
                fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0"
              }}
            >
              favorite
            </span>
          </button>

          {/* Center Play / Pause Button (Filled Circle with Elevation) */}
          <button
            onClick={onTogglePlay}
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
              transition: 'transform 100ms ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '30px',
                fontVariationSettings: "'FILL' 1"
              }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isShuffled ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
              padding: '6px'
            }}
            title="Shuffle"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              shuffle
            </span>
          </button>

          {/* Repeat */}
          <button
            onClick={onToggleRepeat}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: repeatMode !== 'off' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
              padding: '6px'
            }}
            title={`Repeat: ${repeatMode}`}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
          </button>

          {/* Next Track */}
          <button
            onClick={onNext}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--md-sys-color-on-surface)',
              padding: '6px'
            }}
            title="Next track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
              skip_next
            </span>
          </button>

          {/* Lyrics Button */}
          <button
            onClick={onOpenLyrics}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--md-sys-color-outline)',
              padding: '6px'
            }}
            title="Lyrics"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              lyrics
            </span>
          </button>

          {/* Queue Button */}
          <button
            onClick={onOpenQueue}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--md-sys-color-outline)',
              padding: '6px'
            }}
            title="Up Next Queue"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              queue_music
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Soundwave Equalizer (Matching Koda Photo 6 & Settings toggleable) */}
      <BottomEqualizerWave isPlaying={isPlaying} />
    </div>
  );
};
