import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';
import { SHAPES } from '../../design-system/tokens';
import { M3LoadingIndicator } from '../common/M3LoadingIndicator';

export interface MiniPlayerProps {
  isDockHidden?: boolean;
  onOpenArtist?: (artist: { name: string }) => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ isDockHidden = false, onOpenArtist }) => {
  const {
    currentTrack,
    playbackMode,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    lyricsData,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setExpanded,
    setLyricsOpen,
    setVolume,
    toggleMute,
    loadLyricsForTrack
  } = usePlayerStore();

  const { isLiked, toggleLikeTrack } = useTasteStore();
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isArtworkHovered, setIsArtworkHovered] = useState(false);
  const [isPlayPopping, setIsPlayPopping] = useState(false);
  const [showSoundwaveRing, setShowSoundwaveRing] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isSkippingPrev, setIsSkippingPrev] = useState(false);
  const [isPressingCard, setIsPressingCard] = useState(false);
  const [hoverSeekFrac, setHoverSeekFrac] = useState<number | null>(null);
  const [waveTick, setWaveTick] = useState(0);
  const [isWideMini, setIsWideMini] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 720 : true
  );

  useEffect(() => {
    const onResize = () => setIsWideMini(window.innerWidth >= 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Ensure lyrics are loaded so the live synced lyric ticker works in MiniPlayer too
  useEffect(() => {
    if (currentTrack) {
      loadLyricsForTrack(currentTrack);
    }
  }, [currentTrack?.id, loadLyricsForTrack]);

  // Subtle harmonic animation tick for the center micro-waveform while playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setWaveTick((t) => (t + 1) % 360);
    }, 90);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  // Deterministic 26-bar acoustic profile per track
  const bars = useMemo(() => {
    const seedStr = currentTrack?.id || 'default';
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) & 0x7fffffff;
    }
    return Array.from({ length: 26 }, (_, idx) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const rand = (seed % 100) / 100;
      const env = Math.sin((idx / 25) * Math.PI);
      return Math.max(0.24, Math.min(1, 0.25 + rand * 0.55 + env * 0.2));
    });
  }, [currentTrack?.id]);

  // Compute current active synced lyric line for live micro-pill
  const currentLyricLine = useMemo(() => {
    if (!lyricsData?.lines || lyricsData.lines.length === 0 || !lyricsData.synced) return null;
    let activeText: string | null = null;
    for (let i = 0; i < lyricsData.lines.length; i++) {
      const line = lyricsData.lines[i];
      if (currentTime + 0.25 >= line.time) {
        if (line.text && line.text.trim().length > 0) {
          activeText = line.text.trim();
        }
      } else {
        break;
      }
    }
    return activeText;
  }, [lyricsData, currentTime]);

  if (!currentTrack || playbackMode === 'video') return null;

  const progressFrac = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const progressPercent = progressFrac * 100;
  const highResThumb = sizedArtwork(currentTrack.highResThumbnailUrl || currentTrack.thumbnailUrl, 160);
  const liked = isLiked(currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayPopping(true);
    if (!isPlaying) {
      setShowSoundwaveRing(true);
      setTimeout(() => setShowSoundwaveRing(false), 600);
    }
    setTimeout(() => setIsPlayPopping(false), 280);
    togglePlay();
  };

  const handleLikeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!liked) {
      setIsLiking(true);
      setTimeout(() => setIsLiking(false), 650);
    }
    toggleLikeTrack(currentTrack);
  };

  const handleNextTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSkipping(true);
    setTimeout(() => setIsSkipping(false), 280);
    nextTrack();
  };

  const handlePrevTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSkippingPrev(true);
    setTimeout(() => setIsSkippingPrev(false), 280);
    prevTrack();
  };

  const handleScrubPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(frac * duration);
  };

  const handleScrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubberRef.current || duration <= 0) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverSeekFrac(frac);
    if (e.buttons === 1) {
      seek(frac * duration);
    }
  };

  const handleVolumeWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const nextVol = Math.max(0, Math.min(1, (isMuted ? 0 : volume) + delta));
    setVolume(nextVol);
  };

  return (
    <div
      onClick={() => setExpanded(true)}
      onMouseDown={() => setIsPressingCard(true)}
      onMouseUp={() => setIsPressingCard(false)}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => {
        setIsCardHovered(false);
        setIsPressingCard(false);
        setHoverSeekFrac(null);
      }}
      style={{
        position: 'fixed',
        bottom: isDockHidden ? '16px' : '82px',
        left: '50%',
        transform: isPressingCard
          ? 'translateX(-50%) scale(0.985)'
          : isCardHovered
          ? 'translateX(-50%) translateY(-2px)'
          : 'translateX(-50%) translateY(0)',
        width: 'calc(100% - 32px)',
        maxWidth: '820px',
        borderRadius: '9999px',
        overflow: 'visible',
        cursor: 'pointer',
        zIndex: 80,
        backgroundColor: 'var(--md-sys-color-surface-container-high)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: isCardHovered
          ? '1px solid color-mix(in srgb, var(--md-sys-color-primary) 38%, var(--md-sys-color-outline-variant))'
          : '1px solid var(--md-sys-color-outline-variant)',
        boxShadow: isCardHovered
          ? '0 14px 40px rgba(0, 0, 0, 0.36), 0 4px 14px rgba(0, 0, 0, 0.18)'
          : '0 8px 32px rgba(0, 0, 0, 0.24), 0 2px 8px rgba(0, 0, 0, 0.12)',
        transition:
          'bottom 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 220ms ease, border-color 220ms ease'
      }}
    >
      {/* Clipped Rounded Capsule for Soft Ambient Tonal Progress Fill */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '9999px',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        {/* Soft Tonal Pill Fill (No harsh vertical line) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progressPercent}%`,
            borderRadius: '9999px',
            background:
              'linear-gradient(90deg, color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent) 0%, color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent) 85%, transparent 100%)',
            pointerEvents: 'none',
            transition: 'width 250ms linear'
          }}
        />
      </div>

      {/* Main Content Layout */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px 7px 10px',
          gap: '12px'
        }}
      >
          {/* 1. Left: Scalloped Cookie Artwork & Track / Live Lyric Info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: 0,
              flex: isWideMini ? '0 1 250px' : 1
            }}
          >
            <div
              onMouseEnter={() => setIsArtworkHovered(true)}
              onMouseLeave={() => setIsArtworkHovered(false)}
              style={{
                position: 'relative',
                width: '48px',
                height: '48px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Rotating M3 Tonal Halo Ring when Playing */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-2px',
                  borderRadius: '50%',
                  background: isPlaying
                    ? 'conic-gradient(from 0deg, var(--md-sys-color-primary), transparent 60%, var(--md-sys-color-primary))'
                    : 'rgba(255, 255, 255, 0.06)',
                  opacity: isPlaying ? 0.35 : 0.2,
                  animation: isPlaying ? 'm3OrbitSpin 8s linear infinite' : 'none',
                  pointerEvents: 'none'
                }}
              />

              {/* Scalloped Die-Cut Cookie Artwork Mask */}
              <img
                src={highResThumb}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => handleArtworkError(e, currentTrack.thumbnailUrl)}
                style={{
                  width: '44px',
                  height: '44px',
                  objectFit: 'cover',
                  clipPath: isPlaying ? SHAPES.scallop12 : SHAPES.cookie9Sided,
                  filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))',
                  animation:
                    isPlaying && !isBuffering
                      ? 'm3ArtworkBreathe 3600ms ease-in-out infinite'
                      : 'none',
                  transition: 'clip-path 400ms ease, transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: isArtworkHovered ? 'scale(1.06)' : 'scale(1)'
                }}
              />

              {/* Hover Expand Hint Overlay */}
              {isArtworkHovered && !isBuffering && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '2px',
                    clipPath: isPlaying ? SHAPES.scallop12 : SHAPES.cookie9Sided,
                    backgroundColor: 'rgba(0, 0, 0, 0.48)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(2px)',
                    pointerEvents: 'none'
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '20px', color: '#fff' }}
                  >
                    keyboard_arrow_up
                  </span>
                </div>
              )}

              {/* Buffering Overlay */}
              {isBuffering && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.45)',
                    borderRadius: '50%',
                    backdropFilter: 'blur(3px)',
                    zIndex: 2
                  }}
                >
                  <M3LoadingIndicator size="sm" />
                </div>
              )}
            </div>

            {/* Track Title + Artist / Live Synced Lyric Line */}
            <div
              key={currentTrack.id}
              style={{
                minWidth: 0,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                animation: 'm3TextSlideUp 260ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: 'var(--md-sys-color-on-surface)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {currentTrack.title}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: 0
                }}
              >
                {currentLyricLine ? (
                  <span
                    key={currentLyricLine}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLyricsOpen(true);
                      setExpanded(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      fontStyle: 'italic',
                      color: 'var(--md-sys-color-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      animation: 'm3TextSlideUp 220ms ease'
                    }}
                  >
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: '13px', flexShrink: 0 }}
                    >
                      lyrics
                    </span>
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {currentLyricLine}
                    </span>
                  </span>
                ) : (
                  <span
                    onClick={(e) => {
                      if (onOpenArtist) {
                        e.stopPropagation();
                        onOpenArtist({ name: currentTrack.artist });
                      }
                    }}
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--md-sys-color-on-surface-variant)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: onOpenArtist ? 'pointer' : 'inherit',
                      transition: 'color 150ms ease'
                    }}
                    onMouseEnter={(e) => {
                      if (onOpenArtist) e.currentTarget.style.color = 'var(--md-sys-color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (onOpenArtist)
                        e.currentTarget.style.color = 'var(--md-sys-color-on-surface-variant)';
                    }}
                  >
                    {currentTrack.artist}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Center (Desktop/Widescreen): Interactive M3 Expressive Micro-Waveform Pill Scrubber */}
          {isWideMini && duration > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                maxWidth: '280px',
                minWidth: '150px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                position: 'relative'
              }}
            >
              {/* Floating Hover Timestamp Pill above Scrubber */}
              {hoverSeekFrac !== null && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.max(14, Math.min(86, hoverSeekFrac * 100))}%`,
                    top: '-26px',
                    transform: 'translateX(-50%)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    fontSize: '10px',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
                    pointerEvents: 'none',
                    zIndex: 40,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {formatTime(hoverSeekFrac * duration)}
                </div>
              )}

              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--md-sys-color-primary)',
                  minWidth: '28px'
                }}
              >
                {formatTime(currentTime)}
              </span>

              {/* Interactive Micro-Waveform Bars */}
              <div
                ref={scrubberRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  handleScrubPointer(e);
                }}
                onPointerMove={handleScrubMove}
                onMouseLeave={() => setHoverSeekFrac(null)}
                style={{
                  flex: 1,
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '2px',
                  position: 'relative',
                  cursor: 'pointer',
                  touchAction: 'none'
                }}
              >
                {bars.map((amp, idx) => {
                  const barFrac = idx / (bars.length - 1);
                  const isPlayed = barFrac <= progressFrac;
                  const isHoveredPreview =
                    hoverSeekFrac !== null &&
                    barFrac > progressFrac &&
                    barFrac <= hoverSeekFrac;
                  const distFromPlayhead = Math.abs(barFrac - progressFrac);
                  const liveBounce =
                    isPlaying && distFromPlayhead < 0.16
                      ? Math.sin(waveTick * 0.45 + idx * 1.1) * 4.5
                      : 0;
                  const h = Math.max(
                    4,
                    Math.min(22, Math.round(amp * 17 + liveBounce))
                  );

                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        maxWidth: '3px',
                        height: `${h}px`,
                        borderRadius: '9999px',
                        backgroundColor: isPlayed
                          ? 'var(--md-sys-color-primary)'
                          : isHoveredPreview
                          ? 'color-mix(in srgb, var(--md-sys-color-primary) 50%, transparent)'
                          : 'rgba(255, 255, 255, 0.2)',
                        transition: 'height 110ms ease, background-color 120ms ease'
                      }}
                    />
                  );
                })}

                {/* Crisp Playhead Pill Indicator */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${progressFrac * 100}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: hoverSeekFrac !== null ? '5px' : '3.5px',
                    height: hoverSeekFrac !== null ? '24px' : '20px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    boxShadow: '0 0 8px var(--md-sys-color-primary)',
                    pointerEvents: 'none',
                    transition: 'width 150ms ease, height 150ms ease'
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  opacity: 0.78,
                  minWidth: '28px',
                  textAlign: 'right'
                }}
              >
                {formatTime(duration)}
              </span>
            </div>
          )}

          {/* 3. Right: Tactile M3 Controls Deck */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Quick Like Heart Button with Spring Burst & Particle Halo */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <button
                onClick={handleLikeToggle}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: liked ? '12px' : '50%',
                  border: 'none',
                  backgroundColor: liked
                    ? 'color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)'
                    : 'transparent',
                  color: liked
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-on-surface-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  animation: isLiking
                    ? 'm3HeartBurst 500ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'none',
                  transition: 'all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--md-sys-color-surface-container-highest)';
                  if (!isLiking) e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = liked
                    ? 'color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)'
                    : 'transparent';
                  if (!isLiking) e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span
                  className={`material-symbols-rounded ${liked ? 'filled' : ''}`}
                  style={{ fontSize: '20px' }}
                >
                  favorite
                </span>
              </button>
              {isLiking && (
                <>
                  {[
                    { tx: '14px', ty: '-14px' },
                    { tx: '-14px', ty: '-14px' },
                    { tx: '14px', ty: '14px' },
                    { tx: '-14px', ty: '14px' }
                  ].map((p, idx) => (
                    <span
                      key={idx}
                      style={{
                        position: 'absolute',
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        ['--tx' as any]: p.tx,
                        ['--ty' as any]: p.ty,
                        animation: 'm3ParticleBurst 480ms ease-out forwards',
                        pointerEvents: 'none'
                      }}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Connected M3 Transport Pod (Prev + Morphing Play/Pause + Next) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              {/* Skip Previous Button */}
              <button
                onClick={handlePrevTrack}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--md-sys-color-on-surface)',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transform: isSkippingPrev ? 'translateX(-4px) scale(0.92)' : 'scale(1)',
                  transition:
                    'background-color 150ms ease, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--md-sys-color-surface-container-highest)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '21px' }}>
                  skip_previous
                </span>
              </button>

              {/* Tactile Play / Pause Disc (Morphs Circle <-> Squircle + Soundwave Ring) */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <button
                  onClick={handlePlayToggle}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: isPlaying ? '13px' : '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                    animation: isPlayPopping
                      ? 'm3PlayPop 280ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      : 'none',
                    transition:
                      'border-radius 320ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.92)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseEnter={(e) => {
                    if (!isPlayPopping) e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isPlayPopping) e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <span className="material-symbols-rounded filled" style={{ fontSize: '23px' }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                {showSoundwaveRing && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-4px',
                      borderRadius: isPlaying ? '17px' : '50%',
                      border: '2px solid var(--md-sys-color-primary)',
                      pointerEvents: 'none',
                      animation: 'm3SoundwaveRing 580ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
                    }}
                  />
                )}
              </div>

              {/* Skip Next Button with Tactile Forward Spring Nudge */}
              <button
                onClick={handleNextTrack}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--md-sys-color-on-surface)',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  animation: isSkipping
                    ? 'm3SkipNudge 280ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'none',
                  transition:
                    'background-color 150ms ease, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--md-sys-color-surface-container-highest)';
                  if (!isSkipping) e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  if (!isSkipping) e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '21px' }}>
                  skip_next
                </span>
              </button>
            </div>

            {/* Desktop Sleek Volume Pod (Smooth spring expansion + Mouse wheel support) */}
            <div
              onClick={(e) => e.stopPropagation()}
              onWheel={handleVolumeWheel}
              onMouseEnter={() => setIsVolumeHovered(true)}
              onMouseLeave={() => setIsVolumeHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isVolumeHovered
                  ? 'var(--md-sys-color-surface-container-highest)'
                  : 'transparent',
                borderRadius: '9999px',
                padding: isVolumeHovered ? '2px 10px 2px 4px' : '2px 4px',
                transition: 'background-color 200ms ease, padding 200ms ease'
              }}
            >
              <button
                onClick={toggleMute}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isMuted
                    ? 'var(--md-sys-color-error)'
                    : 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'transform 150ms ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                  {isMuted || volume === 0
                    ? 'volume_off'
                    : volume > 0.5
                    ? 'volume_up'
                    : 'volume_down'}
                </span>
              </button>

              <div
                style={{
                  width: isVolumeHovered ? '88px' : '0px',
                  opacity: isVolumeHovered ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'width 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  style={{
                    width: '58px',
                    accentColor: 'var(--md-sys-color-primary)',
                    cursor: 'pointer'
                  }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--md-sys-color-primary)',
                    minWidth: '24px'
                  }}
                >
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};
