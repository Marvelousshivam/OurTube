import React, { useState, useEffect } from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { SonicWaveformScrubber } from '../SonicWaveformScrubber';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';

interface EditorialPlayerProps {
  track: TrackMetadata;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  repeatMode?: RepeatMode;
  isShuffled?: boolean;
  stageMode?: boolean;
  isWideScreen?: boolean;
  showLyrics?: boolean;
  currentLyricLine?: string | null;
  queueCount?: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleLike: () => void;
  onToggleRepeat?: () => void;
  onToggleShuffle?: () => void;
  onToggleLyrics: () => void;
  onOpenQueue: () => void;
  onOpenSpecs?: () => void;
}

const SHAPE_NAMES = ['Cookie', 'Arch', 'Gem', 'Octagon', 'Squircle'];

// 5 Material 3 organic shapes for die-cut artwork morphing
const SHAPES = [
  // 12-lobed scalloped cookie / flower
  'polygon(50% 0%, 63% 4%, 75% 0%, 84% 9%, 93% 6%, 98% 18%, 100% 30%, 96% 41%, 100% 50%, 96% 59%, 100% 70%, 98% 82%, 93% 94%, 84% 91%, 75% 100%, 63% 96%, 50% 100%, 37% 96%, 25% 100%, 16% 91%, 7% 94%, 2% 82%, 0% 70%, 4% 59%, 0% 50%, 4% 41%, 0% 30%, 2% 18%, 7% 6%, 16% 9%, 25% 0%, 37% 4%)',
  // Arch
  'polygon(0% 25%, 25% 5%, 50% 0%, 75% 5%, 100% 25%, 100% 100%, 0% 100%)',
  // Soft diamond gem
  'polygon(50% 3%, 97% 50%, 50% 97%, 3% 50%)',
  // Rounded octagon
  'polygon(28% 0%, 72% 0%, 100% 28%, 100% 72%, 72% 100%, 28% 100%, 0% 72%, 0% 28%)',
  // Cookie / 12-sided squircle
  'polygon(18% 0%, 82% 0%, 100% 18%, 100% 82%, 82% 100%, 18% 100%, 0% 82%, 0% 18%)'
];

export const EditorialPlayer: React.FC<EditorialPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  isLiked,
  repeatMode = 'off',
  isShuffled = false,
  stageMode = false,
  isWideScreen,
  showLyrics = false,
  currentLyricLine = null,
  queueCount = 0,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onToggleLike,
  onToggleRepeat,
  onToggleShuffle,
  onToggleLyrics,
  onOpenQueue,
  onOpenSpecs
}) => {
  const [shapeIndex, setShapeIndex] = useState(0);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLiking, setIsLiking] = useState(false);
  const [isSkippingNext, setIsSkippingNext] = useState(false);
  const [isSkippingPrev, setIsSkippingPrev] = useState(false);
  const [showPlayWave, setShowPlayWave] = useState(false);

  useEffect(() => {
    const code = track.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    setShapeIndex(code % SHAPES.length);
  }, [track.id]);

  const handleArtworkMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: -ny * 7, y: nx * 7 });
  };

  const handleArtworkMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const handlePlayButton = () => {
    setShowPlayWave(true);
    setTimeout(() => setShowPlayWave(false), 580);
    onTogglePlay();
  };

  const handleNextButton = () => {
    setIsSkippingNext(true);
    setTimeout(() => setIsSkippingNext(false), 280);
    onNext();
  };

  const handlePrevButton = () => {
    setIsSkippingPrev(true);
    setTimeout(() => setIsSkippingPrev(false), 280);
    onPrev();
  };

  const handleLikeButton = () => {
    if (!isLiked) {
      setIsLiking(true);
      setTimeout(() => setIsLiking(false), 620);
    }
    onToggleLike();
  };

  const cycleArtworkShape = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShapeIndex((prev) => (prev + 1) % SHAPES.length);
  };

  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

  /* ================= REUSABLE LIVE LYRIC PREVIEW PILL ================= */
  const LiveLyricPill =
    currentLyricLine && !showLyrics ? (
      <button
        onClick={onToggleLyrics}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '100%',
          padding: '8px 14px',
          borderRadius: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          color: 'var(--md-sys-color-on-surface)',
          cursor: 'pointer',
          textAlign: 'left',
          backdropFilter: 'blur(12px)',
          transition: 'all 220ms cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
        title="Click to open full synced lyrics"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <span
          className="material-symbols-rounded"
          style={{
            fontSize: '16px',
            color: 'var(--md-sys-color-primary)',
            flexShrink: 0
          }}
        >
          lyrics
        </span>
        <span
          key={currentLyricLine}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            fontStyle: 'italic',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            animation: 'm3TextSlideUp 260ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          “{currentLyricLine}”
        </span>
      </button>
    ) : null;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        maxWidth: isFullWidescreenSpread ? '1440px' : '460px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: isFullWidescreenSpread ? '16px 32px' : '8px 16px',
        color: 'var(--md-sys-color-on-surface)',
        zIndex: 5,
        overflow: 'hidden'
      }}
    >
      {isFullWidescreenSpread ? (
        /* ================= EXPANSIVE WIDESCREEN EDITORIAL SPREAD ================= */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 460px) minmax(420px, 1fr)',
            gap: 'clamp(36px, 5vw, 76px)',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '1360px',
            margin: '0 auto'
          }}
        >
          {/* Left Column: Hero Die-Cut Organic Artwork with 3D Tilt & Rotating Halo */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              width: '100%'
            }}
          >
            {track.album && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)',
                  opacity: 0.85,
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                {track.album}
              </span>
            )}

            <div
              onMouseMove={handleArtworkMouseMove}
              onMouseLeave={handleArtworkMouseLeave}
              onClick={cycleArtworkShape}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 'min(440px, 50vh)',
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition:
                  tilt.x === 0 && tilt.y === 0
                    ? 'transform 500ms cubic-bezier(0.2, 0.9, 0.3, 1)'
                    : 'transform 80ms linear'
              }}
              title="Click to morph die-cut frame shape"
            >
              {/* Rotating Ambient M3 Tonal Orbit Ring */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-10px',
                  borderRadius: '50%',
                  border: '1.5px dashed var(--md-sys-color-primary)',
                  opacity: isPlaying ? 0.28 : 0.08,
                  animation: isPlaying ? 'm3HaloRotate 28s linear infinite' : 'none',
                  pointerEvents: 'none',
                  transition: 'opacity 400ms ease'
                }}
              />

              {/* Die-Cut Polygon Artwork Stage */}
              <div
                key={track.id}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  clipPath: SHAPES[shapeIndex],
                  boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.8)',
                  overflow: 'hidden',
                  transition: 'clip-path 700ms cubic-bezier(0.2, 0.9, 0.3, 1)',
                  animation: 'm3FadeScaleIn 380ms cubic-bezier(0.2, 0.9, 0.3, 1)'
                }}
              >
                <img
                  src={sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 1200)}
                  alt={track.title}
                  onError={(e) => handleArtworkError(e, track.thumbnailUrl)}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: isPlaying ? 'scale(1.04)' : 'scale(1)',
                    transition: 'transform 800ms cubic-bezier(0.2, 0.9, 0.3, 1)'
                  }}
                />
              </div>

              {/* Floating Die-Cut Shape Switcher Pill */}
              <button
                onClick={cycleArtworkShape}
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  padding: '5px 11px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  color: 'var(--md-sys-color-on-surface)',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                  opacity: 0.85,
                  transition: 'all 180ms ease'
                }}
                title="Cycle M3 Die-Cut Frame Shape"
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: '13px', color: 'var(--md-sys-color-primary)' }}
                >
                  shapes
                </span>
                {SHAPE_NAMES[shapeIndex]}
              </button>
            </div>
          </div>

          {/* Right Column: Dramatic Typography + Asymmetric Bento Deck + Utility Chips */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              justifyContent: 'center',
              maxWidth: '640px',
              width: '100%'
            }}
          >
            {/* Title & Artist Headline Stack */}
            <div key={track.id} style={{ animation: 'm3TextSlideUp 320ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <h1
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: 'italic',
                  fontWeight: 800,
                  fontSize: 'clamp(36px, 4.2vw, 60px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.025em',
                  margin: '0 0 10px 0',
                  color: 'var(--md-sys-color-on-surface)',
                  textWrap: 'balance'
                }}
              >
                {track.title}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--md-sys-color-primary)',
                    opacity: 0.92,
                    margin: 0
                  }}
                >
                  {track.artist}
                </p>

                {/* Interactive Audio Quality / Nerd Specs Badge with Live Equalizer */}
                <button
                  onClick={onOpenSpecs}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    cursor: onOpenSpecs ? 'pointer' : 'default',
                    transition: 'all 150ms ease'
                  }}
                  title="Open Audio Stream Specs"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '1.5px', height: '10px' }}>
                    <span
                      style={{
                        width: '2px',
                        height: isPlaying ? '9px' : '4px',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        borderRadius: '1px',
                        animation: isPlaying ? 'm3EqBar1 600ms ease-in-out infinite alternate' : 'none'
                      }}
                    />
                    <span
                      style={{
                        width: '2px',
                        height: isPlaying ? '10px' : '6px',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        borderRadius: '1px',
                        animation: isPlaying ? 'm3EqBar2 480ms ease-in-out infinite alternate' : 'none'
                      }}
                    />
                    <span
                      style={{
                        width: '2px',
                        height: isPlaying ? '7px' : '3px',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        borderRadius: '1px',
                        animation: isPlaying ? 'm3EqBar3 540ms ease-in-out infinite alternate' : 'none'
                      }}
                    />
                  </span>
                  256k AAC • STUDIO
                </button>
              </div>
            </div>

            {/* Live Synced Lyrics Peek Pill (when companion lyrics sheet is closed) */}
            {LiveLyricPill && <div>{LiveLyricPill}</div>}

            {/* Asymmetric Bento Control Cluster */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
              {/* Row 1: Morphing PAUSE / PLAY Word Pill + Circular Skip Next Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  <button
                    onClick={handlePlayButton}
                    style={{
                      flex: 1,
                      height: '68px',
                      borderRadius: isPlaying ? '22px' : '9999px',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      fontWeight: 800,
                      fontSize: '17px',
                      letterSpacing: '0.18em',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                      transition:
                        'border-radius 380ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease'
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <span
                      className="material-symbols-rounded filled"
                      style={{
                        fontSize: '26px',
                        fontVariationSettings: "'FILL' 1",
                        transition: 'transform 200ms ease'
                      }}
                    >
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                    <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
                  </button>

                  {showPlayWave && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: '-4px',
                        borderRadius: isPlaying ? '26px' : '9999px',
                        border: '2px solid var(--md-sys-color-primary)',
                        pointerEvents: 'none',
                        animation: 'm3SoundwaveRing 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
                      }}
                    />
                  )}
                </div>

                <button
                  onClick={handleNextButton}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: isSkippingNext ? '20px' : '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.24)',
                    transform: isSkippingNext ? 'translateX(5px) scale(0.94)' : 'scale(1)',
                    transition:
                      'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 240ms ease'
                  }}
                  title="Next track"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
                    skip_next
                  </span>
                </button>
              </div>

              {/* Row 2: Circular Skip Previous Button + Waveform Sonic Bar Scrubber */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                <button
                  onClick={handlePrevButton}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: isSkippingPrev ? '20px' : '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.24)',
                    transform: isSkippingPrev ? 'translateX(-5px) scale(0.94)' : 'scale(1)',
                    transition:
                      'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 240ms ease'
                  }}
                  title="Previous track"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
                    skip_previous
                  </span>
                </button>

                {/* Sonic Bar Waveform Scrubber */}
                <div
                  style={{
                    flex: 1,
                    height: '68px',
                    padding: '0 18px',
                    borderRadius: '24px',
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative'
                  }}
                >
                  <SonicWaveformScrubber
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onSeek={onSeek}
                    trackId={track.id}
                    accentColor="var(--md-sys-color-primary)"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Utility Chips Row (M3 Morphing Circle <-> Squircle) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginTop: '4px'
              }}
            >
              {/* Heart / Favorite Chip with Particle Burst */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={handleLikeButton}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: isLiked ? '16px' : '50%',
                    backgroundColor: isLiked
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-surface-container)',
                    color: isLiked
                      ? 'var(--md-sys-color-on-primary)'
                      : 'var(--md-sys-color-on-surface)',
                    border: isLiked
                      ? '1px solid transparent'
                      : '1px solid var(--md-sys-color-outline-variant)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    animation: isLiking
                      ? 'm3HeartBurst 500ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      : 'none',
                    transition: 'all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                {isLiking && (
                  <>
                    {[
                      { tx: '18px', ty: '-18px' },
                      { tx: '-18px', ty: '-18px' },
                      { tx: '18px', ty: '18px' },
                      { tx: '-18px', ty: '18px' }
                    ].map((p, idx) => (
                      <span
                        key={idx}
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--md-sys-color-primary)',
                          ['--tx' as any]: p.tx,
                          ['--ty' as any]: p.ty,
                          animation: 'm3ParticleBurst 500ms ease-out forwards',
                          pointerEvents: 'none'
                        }}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* Playlist / Queue Chip with Count Badge */}
              <button
                onClick={onOpenQueue}
                style={{
                  position: 'relative',
                  height: '48px',
                  padding: queueCount > 0 ? '0 16px' : '0',
                  width: queueCount > 0 ? 'auto' : '48px',
                  borderRadius: '24px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  color: 'var(--md-sys-color-on-surface)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 200ms cubic-bezier(0.2, 0.9, 0.3, 1)'
                }}
                title="Playback Queue"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  playlist_play
                </span>
                {queueCount > 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--md-sys-color-primary)'
                    }}
                  >
                    {queueCount}
                  </span>
                )}
              </button>

              {/* Shuffle Chip */}
              <button
                onClick={onToggleShuffle}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: isShuffled ? '16px' : '50%',
                  backgroundColor: isShuffled
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-surface-container)',
                  color: isShuffled
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-on-surface)',
                  border: isShuffled
                    ? '1px solid transparent'
                    : '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  shuffle
                </span>
              </button>

              {/* Repeat Chip */}
              <button
                onClick={onToggleRepeat}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: repeatMode !== 'off' ? '16px' : '50%',
                  backgroundColor:
                    repeatMode !== 'off'
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-surface-container)',
                  color:
                    repeatMode !== 'off'
                      ? 'var(--md-sys-color-on-primary)'
                      : 'var(--md-sys-color-on-surface)',
                  border:
                    repeatMode !== 'off'
                      ? '1px solid transparent'
                      : '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                title={`Repeat: ${repeatMode}`}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
                </span>
              </button>

              {/* Morphing Lyrics Toggle Chip */}
              <button
                onClick={onToggleLyrics}
                style={{
                  height: '48px',
                  padding: '0 16px',
                  borderRadius: showLyrics ? '16px' : '9999px',
                  backgroundColor: showLyrics
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-surface-container)',
                  color: showLyrics
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-on-surface)',
                  border: showLyrics
                    ? '1px solid transparent'
                    : '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: showLyrics ? '0 4px 14px rgba(0,0,0,0.3)' : 'none',
                  fontSize: '12px',
                  fontWeight: 800
                }}
                title={showLyrics ? 'Hide synced lyrics' : 'Show synced lyrics'}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                  lyrics
                </span>
                <span>Lyrics</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= COMPACT / STAGE MODE VERTICAL LAYOUT ================= */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '12px',
            width: '100%',
            maxWidth: '420px',
            margin: '0 auto'
          }}
        >
          {/* Subtle Album / Soundtrack Header Subtitle */}
          {track.album && (
            <div style={{ textAlign: 'center', opacity: 0.75, margin: '0 auto -4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)'
                }}
              >
                {track.album}
              </span>
            </div>
          )}

          {/* Centered Die-Cut Scalloped Organic Artwork */}
          <div
            onClick={cycleArtworkShape}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'clamp(140px, 24vh, 230px)',
              aspectRatio: '1 / 1',
              margin: '0 auto',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              clipPath: SHAPES[shapeIndex],
              boxShadow: '0 20px 54px -10px rgba(0, 0, 0, 0.65)',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'clip-path 700ms cubic-bezier(0.2, 0.9, 0.3, 1)'
            }}
            title="Click to morph die-cut frame shape"
          >
            <img
              src={sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 1200)}
              alt={track.title}
              onError={(e) => handleArtworkError(e, track.thumbnailUrl)}
              referrerPolicy="no-referrer"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: isPlaying ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 800ms ease'
              }}
            />
          </div>

          {/* Title & Artist Headline Stack */}
          <div style={{ textAlign: 'center', width: '100%', padding: '0 8px' }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 'clamp(20px, 2.4vh, 28px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                margin: '0 0 3px 0',
                color: 'var(--md-sys-color-on-surface)',
                textWrap: 'balance',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {track.title}
            </h1>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--md-sys-color-primary)',
                opacity: 0.85,
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {track.artist}
            </p>
          </div>

          {LiveLyricPill && <div style={{ display: 'flex', justifyContent: 'center' }}>{LiveLyricPill}</div>}

          {/* Control Cluster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 1.2vh, 10px)', width: '100%' }}>
            {/* Row 1: Large PAUSE / PLAY Word Pill + Circular Skip Next Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.2vh, 10px)', width: '100%' }}>
              <button
                onClick={handlePlayButton}
                style={{
                  flex: 1,
                  height: 'clamp(46px, 5.6vh, 56px)',
                  borderRadius: isPlaying ? '18px' : '9999px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '15px',
                  letterSpacing: '0.18em',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  transition: 'border-radius 320ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 100ms ease'
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '22px' }}>
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                onClick={handleNextButton}
                style={{
                  width: 'clamp(46px, 5.6vh, 56px)',
                  height: 'clamp(46px, 5.6vh, 56px)',
                  borderRadius: isSkippingNext ? '16px' : '50%',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  transform: isSkippingNext ? 'translateX(4px) scale(0.92)' : 'scale(1)',
                  transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                title="Next track"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
                  skip_next
                </span>
              </button>
            </div>

            {/* Row 2: Circular Skip Previous Button + Waveform Sonic Bar Scrubber */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.2vh, 10px)', width: '100%' }}>
              <button
                onClick={handlePrevButton}
                style={{
                  width: 'clamp(46px, 5.6vh, 56px)',
                  height: 'clamp(46px, 5.6vh, 56px)',
                  borderRadius: isSkippingPrev ? '16px' : '50%',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  transform: isSkippingPrev ? 'translateX(-4px) scale(0.92)' : 'scale(1)',
                  transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                title="Previous track"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
                  skip_previous
                </span>
              </button>

              <div
                style={{
                  flex: 1,
                  height: 'clamp(46px, 5.6vh, 56px)',
                  padding: '0 14px',
                  borderRadius: '18px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SonicWaveformScrubber
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  onSeek={onSeek}
                  trackId={track.id}
                  accentColor="var(--md-sys-color-primary)"
                />
              </div>
            </div>
          </div>

          {/* Bottom Utility Chips Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '4px'
            }}
          >
            <button
              onClick={handleLikeButton}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: isLiked ? '14px' : '50%',
                backgroundColor: isLiked
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-surface-container)',
                color: isLiked
                  ? 'var(--md-sys-color-on-primary)'
                  : 'var(--md-sys-color-on-surface)',
                border: isLiked ? '1px solid transparent' : '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
              title={isLiked ? 'Liked' : 'Like'}
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: '20px',
                  fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0"
                }}
              >
                favorite
              </span>
            </button>

            <button
              onClick={onOpenQueue}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                color: 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title="Playback Queue"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                playlist_play
              </span>
            </button>

            <button
              onClick={onToggleShuffle}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: isShuffled ? '14px' : '50%',
                backgroundColor: isShuffled
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-surface-container)',
                color: isShuffled
                  ? 'var(--md-sys-color-on-primary)'
                  : 'var(--md-sys-color-on-surface)',
                border: isShuffled
                  ? '1px solid transparent'
                  : '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
              title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                shuffle
              </span>
            </button>

            <button
              onClick={onToggleRepeat}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: repeatMode !== 'off' ? '14px' : '50%',
                backgroundColor:
                  repeatMode !== 'off'
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-surface-container)',
                color:
                  repeatMode !== 'off'
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-on-surface)',
                border:
                  repeatMode !== 'off'
                    ? '1px solid transparent'
                    : '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
              title={`Repeat: ${repeatMode}`}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
              </span>
            </button>

            <button
              onClick={onToggleLyrics}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: showLyrics ? '14px' : '50%',
                backgroundColor: showLyrics
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-surface-container)',
                color: showLyrics
                  ? 'var(--md-sys-color-on-primary)'
                  : 'var(--md-sys-color-on-surface)',
                border: showLyrics
                  ? '1px solid transparent'
                  : '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
                boxShadow: showLyrics ? '0 4px 14px rgba(0,0,0,0.3)' : 'none'
              }}
              title={showLyrics ? 'Hide synced lyrics' : 'Show synced lyrics'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                lyrics
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
