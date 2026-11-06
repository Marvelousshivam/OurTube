import React, { useState } from 'react';
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
    togglePlay,
    nextTrack,
    setExpanded,
    setVolume,
    toggleMute
  } = usePlayerStore();

  const { isLiked, toggleLikeTrack } = useTasteStore();
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isPlayPopping, setIsPlayPopping] = useState(false);
  const [showSoundwaveRing, setShowSoundwaveRing] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isPressingCard, setIsPressingCard] = useState(false);

  if (!currentTrack || playbackMode === 'video') return null;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const highResThumb = sizedArtwork(currentTrack.highResThumbnailUrl || currentTrack.thumbnailUrl, 160);
  const liked = isLiked(currentTrack.id);

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

  return (
    <div
      onClick={() => setExpanded(true)}
      onMouseDown={() => setIsPressingCard(true)}
      onMouseUp={() => setIsPressingCard(false)}
      style={{
        position: 'fixed',
        bottom: isDockHidden ? '16px' : '82px',
        left: '50%',
        transform: isPressingCard ? 'translateX(-50%) scale(0.985)' : 'translateX(-50%) scale(1)',
        width: 'calc(100% - 32px)',
        maxWidth: '760px',
        borderRadius: '28px',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 80,
        backgroundColor: 'var(--md-sys-color-surface-container-high)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        boxShadow:
          '0 8px 32px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.15)), 0 2px 8px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.08))',
        transition:
          'bottom 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 150ms ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          '0 12px 36px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2)), 0 4px 12px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.1))';
      }}
      onMouseLeave={(e) => {
        setIsPressingCard(false);
        e.currentTarget.style.boxShadow =
          '0 8px 32px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.15)), 0 2px 8px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.08))';
      }}
    >
      {/* Liquid Ambient Background Progress Fill with Feathered Gradient Edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progressPercent}%`,
          background:
            'linear-gradient(to right, var(--md-sys-color-primary) 0%, var(--md-sys-color-primary) calc(100% - 14px), transparent 100%)',
          opacity: 0.2,
          pointerEvents: 'none',
          transition: 'width 250ms linear'
        }}
      />
      {progressPercent > 1 && progressPercent < 99 && (
        <div
          style={{
            position: 'absolute',
            left: `calc(${progressPercent}% - 2px)`,
            top: 0,
            bottom: 0,
            width: '3px',
            backgroundColor: 'var(--md-sys-color-primary)',
            opacity: 0.45,
            filter: 'blur(1px)',
            pointerEvents: 'none',
            transition: 'left 250ms linear'
          }}
        />
      )}

      {/* Main Content Layout */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          gap: '12px'
        }}
      >
        {/* Left: 12-Lobed Scalloped Cookie Artwork & Track Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              position: 'relative',
              width: '46px',
              height: '46px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Ambient disc backdrop */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}
            />
            {/* Scalloped Die-Cut Cookie Artwork Mask with Organic Breathing */}
            <img
              src={highResThumb}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              onError={(e) => handleArtworkError(e, currentTrack.thumbnailUrl)}
              style={{
                width: '44px',
                height: '44px',
                objectFit: 'cover',
                clipPath: SHAPES.scallop12,
                filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))',
                animation:
                  isPlaying && !isBuffering
                    ? 'm3ArtworkBreathe 3600ms ease-in-out infinite'
                    : 'none',
                transition: 'transform 300ms cubic-bezier(0.2, 0, 0, 1)'
              }}
            />

            {/* Real-time Material 3 Expressive Buffering Overlay */}
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

          {/* Typography Metadata with Smooth Slide-Up Transition on Track Change */}
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
            <div
              style={{
                fontSize: '14px',
                fontWeight: 650,
                letterSpacing: '-0.01em',
                color: 'var(--md-sys-color-on-surface)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentTrack.title}
            </div>
            <div
              onClick={(e) => {
                if (onOpenArtist) {
                  e.stopPropagation();
                  onOpenArtist({ name: currentTrack.artist });
                }
              }}
              style={{
                fontSize: '12px',
                fontWeight: 450,
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
                if (onOpenArtist) e.currentTarget.style.color = 'var(--md-sys-color-on-surface-variant)';
              }}
            >
              {currentTrack.artist}
            </div>
          </div>
        </div>

        {/* Right: Tactile Controls Deck */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Quick Like Heart Button with Spring Burst & Particle Halo */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={handleLikeToggle}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: liked ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                animation: isLiking ? 'm3HeartBurst 500ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                transition: 'background-color 150ms ease, color 150ms ease, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              title={liked ? 'Remove from Liked' : 'Save to Liked'}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest)';
                if (!isLiking) e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
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
            {/* 4 Micro Particles on Like Burst */}
            {isLiking && (
              <>
                <span
                  style={{
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    ['--tx' as any]: '14px',
                    ['--ty' as any]: '-14px',
                    animation: 'm3ParticleBurst 480ms ease-out forwards',
                    pointerEvents: 'none'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    ['--tx' as any]: '-14px',
                    ['--ty' as any]: '-14px',
                    animation: 'm3ParticleBurst 480ms ease-out forwards',
                    pointerEvents: 'none'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    ['--tx' as any]: '14px',
                    ['--ty' as any]: '14px',
                    animation: 'm3ParticleBurst 480ms ease-out forwards',
                    pointerEvents: 'none'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    ['--tx' as any]: '-14px',
                    ['--ty' as any]: '14px',
                    animation: 'm3ParticleBurst 480ms ease-out forwards',
                    pointerEvents: 'none'
                  }}
                />
              </>
            )}
          </div>

          {/* Tactile Play / Pause Disc (Spring Pop & Soundwave Ring) */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={handlePlayToggle}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                animation: isPlayPopping ? 'm3PlayPop 280ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
                transition: 'transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
              title={isPlaying ? 'Pause' : 'Play'}
            >
              <span className="material-symbols-rounded filled" style={{ fontSize: '24px' }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            {/* Soundwave expanding ring on playback start */}
            {showSoundwaveRing && (
              <div
                style={{
                  position: 'absolute',
                  inset: '-4px',
                  borderRadius: '50%',
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
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              animation: isSkipping ? 'm3SkipNudge 280ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
              transition: 'background-color 150ms ease, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest)';
              if (!isSkipping) e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              if (!isSkipping) e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Next Track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              skip_next
            </span>
          </button>

          {/* Desktop Sleek Volume Pod (Smooth spring expansion) */}
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setIsVolumeHovered(true)}
            onMouseLeave={() => setIsVolumeHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isVolumeHovered ? 'var(--md-sys-color-surface-container-highest)' : 'transparent',
              borderRadius: '9999px',
              padding: '2px 4px',
              transition: 'background-color 200ms ease'
            }}
          >
            <button
              onClick={toggleMute}
              style={{
                background: 'transparent',
                border: 'none',
                color: isMuted ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface-variant)',
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
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                {isMuted || volume === 0 ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}
              </span>
            </button>

            <div
              style={{
                width: isVolumeHovered ? '76px' : '0px',
                opacity: isVolumeHovered ? 1 : 0,
                overflow: 'hidden',
                transition: 'width 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
                display: 'flex',
                alignItems: 'center'
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
                  width: '72px',
                  accentColor: 'var(--md-sys-color-primary)',
                  cursor: 'pointer'
                }}
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
