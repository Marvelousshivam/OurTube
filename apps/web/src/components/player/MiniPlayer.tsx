import React, { useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';
import { SHAPES } from '../../design-system/tokens';

export interface MiniPlayerProps {
  isDockHidden?: boolean;
  onOpenArtist?: (artist: { name: string }) => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ isDockHidden = false, onOpenArtist }) => {
  const {
    currentTrack,
    isPlaying,
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

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const highResThumb = sizedArtwork(currentTrack.highResThumbnailUrl || currentTrack.thumbnailUrl, 160);
  const liked = isLiked(currentTrack.id);

  return (
    <div
      onClick={() => setExpanded(true)}
      style={{
        position: 'fixed',
        bottom: isDockHidden ? '16px' : '82px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '760px',
        borderRadius: '28px',
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: 80,
        backgroundColor: 'rgba(28, 27, 31, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.25)',
        transition: 'bottom 280ms cubic-bezier(0.2, 0, 0, 1), transform 150ms ease, box-shadow 150ms ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.25)';
      }}
    >
      {/* Koda Two-Tone Ambient Background Progress Fill */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progressPercent}%`,
          backgroundColor: 'var(--md-sys-color-primary)',
          opacity: 0.18,
          pointerEvents: 'none',
          transition: 'width 250ms linear'
        }}
      />

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
                clipPath: SHAPES.scallop12,
                filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))',
                transition: 'transform 200ms ease'
              }}
            />
          </div>

          {/* Typography Metadata */}
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
          {/* Quick Like Heart Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLikeTrack(currentTrack);
            }}
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
              transition: 'all 150ms ease'
            }}
            title={liked ? 'Remove from Liked' : 'Save to Liked'}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span
              className={`material-symbols-rounded ${liked ? 'filled' : ''}`}
              style={{ fontSize: '20px' }}
            >
              favorite
            </span>
          </button>

          {/* Tactile Play / Pause Disc (Koda signature accent disc) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
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
              transition: 'transform 120ms cubic-bezier(0.2, 0, 0, 1)'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.92)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="material-symbols-rounded filled" style={{ fontSize: '24px' }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Skip Next Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
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
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Next Track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              skip_next
            </span>
          </button>

          {/* Desktop Sleek Volume Pod (Expand on hover, no clunky divider) */}
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setIsVolumeHovered(true)}
            onMouseLeave={() => setIsVolumeHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isVolumeHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
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
                borderRadius: '50%'
              }}
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
                transition: 'all 220ms cubic-bezier(0.2, 0, 0, 1)',
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
