import React from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';
import { SonicWaveformScrubber } from '../SonicWaveformScrubber';

interface HeroPlayerProps {
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
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleLike: () => void;
  onToggleRepeat?: () => void;
  onToggleShuffle?: () => void;
  onToggleLyrics?: () => void;
  onOpenLyrics?: () => void;
  onOpenQueue?: () => void;
}

export const HeroPlayer: React.FC<HeroPlayerProps> = ({
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
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onToggleLike,
  onToggleRepeat,
  onToggleShuffle,
  onToggleLyrics,
  onOpenQueue
}) => {
  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

  const ControlsDeck = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        maxWidth: isFullWidescreenSpread ? '620px' : '100%'
      }}
    >
      {/* 1. Track Title & Artist Metadata + Circular Like Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h1
            style={{
              fontSize: isFullWidescreenSpread ? 'clamp(28px, 3.2vw, 42px)' : 'clamp(22px, 2.8vw, 32px)',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              margin: 0,
              color: 'var(--md-sys-color-on-surface)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {track.title}
          </h1>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--md-sys-color-outline)',
              marginTop: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {track.artist}
          </span>
        </div>

        <button
          onClick={onToggleLike}
          style={{
            background: isLiked ? 'rgba(255, 64, 129, 0.16)' : 'transparent',
            border: '1.5px solid rgba(255, 255, 255, 0.22)',
            color: isLiked ? '#ff4081' : 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 200ms ease'
          }}
          title={isLiked ? 'Remove from liked' : 'Like track'}
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
      </div>

      {/* 2. Sonic Acoustic Waveform Scrubber with Micro Timestamps */}
      <SonicWaveformScrubber
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={onSeek}
        trackId={track.id}
        accentColor="var(--md-sys-color-primary)"
      />

      {/* 3. Subtle Organic Topographical Ridge (Matching Koda Screenshot) */}
      <div style={{ width: '100%', height: '20px', opacity: 0.55, margin: '-4px 0 2px 0' }}>
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <path
            d="M 0 14 Q 25 6, 45 12 T 85 8 T 100 14 L 100 20 L 0 20 Z"
            fill="rgba(255, 255, 255, 0.08)"
          />
          <path
            d="M 0 14 Q 25 6, 45 12 T 85 8 T 100 14"
            fill="none"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="1.2"
          />
        </svg>
      </div>

      {/* 4. Signature Asymmetric Hero Transport Deck (Exact Koda Layout) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(120px, 1.15fr) 1.35fr',
          gap: '12px',
          width: '100%'
        }}
      >
        {/* Left: Giant Morphing Squircle Play/Pause Disc */}
        <button
          onClick={onTogglePlay}
          style={{
            height: '100%',
            minHeight: isFullWidescreenSpread ? '142px' : '124px',
            borderRadius: '34px',
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 28px -4px rgba(0, 0, 0, 0.45)',
            transition: 'transform 120ms ease'
          }}
          title={isPlaying ? 'Pause' : 'Play'}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '46px', fontVariationSettings: "'FILL' 1" }}
          >
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        {/* Right Sub-Deck: Circular Skips + Utility Chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Row of 2 Circular Skip Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={onPrev}
              style={{
                flex: 1,
                aspectRatio: '1 / 1',
                maxHeight: '74px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--md-sys-color-on-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 100ms ease'
              }}
              title="Previous"
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
                skip_previous
              </span>
            </button>

            <button
              onClick={onNext}
              style={{
                flex: 1,
                aspectRatio: '1 / 1',
                maxHeight: '74px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--md-sys-color-on-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 100ms ease'
              }}
              title="Next"
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
                skip_next
              </span>
            </button>
          </div>

          {/* Bottom Utility Chips Row (Shuffle, Repeat, Queue / Lyrics) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={onToggleShuffle}
              style={{
                flex: 1,
                height: '42px',
                borderRadius: '16px',
                backgroundColor: isShuffled ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: isShuffled ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title="Shuffle"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                shuffle
              </span>
            </button>

            <button
              onClick={onToggleRepeat}
              style={{
                flex: 1,
                height: '42px',
                borderRadius: '16px',
                backgroundColor: repeatMode !== 'off' ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: repeatMode !== 'off' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title={`Repeat: ${repeatMode}`}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
              </span>
            </button>

            <button
              onClick={onToggleLyrics}
              style={{
                flex: 1,
                height: '42px',
                borderRadius: '16px',
                backgroundColor: showLyrics ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: showLyrics ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                lyrics
              </span>
            </button>

            <button
              onClick={onOpenQueue}
              style={{
                flex: 1,
                height: '42px',
                borderRadius: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title="Queue"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                playlist_play
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

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
        /* ================= EXPANSIVE WIDESCREEN HERO SPREAD ================= */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 460px) minmax(400px, 1fr)',
            gap: 'clamp(36px, 5vw, 76px)',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '1360px',
            margin: '0 auto'
          }}
        >
          {/* Left Column: Full-Bleed Artwork Card */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(460px, 52vh)',
              aspectRatio: '1 / 1',
              borderRadius: '28px',
              overflow: 'hidden',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.75)',
              margin: '0 auto'
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
                transform: isPlaying ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 800ms ease'
              }}
            />
          </div>

          {/* Right Column: Hero Controls */}
          {ControlsDeck}
        </div>
      ) : (
        /* ================= COMPACT / STAGE MODE VERTICAL LAYOUT (Matching Koda Screenshot) ================= */
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
          {/* Top Artwork with Subtle Gradient Mask */}
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              maxWidth: 'min(100%, 280px)',
              margin: '0 auto',
              borderRadius: '24px',
              overflow: 'hidden',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              boxShadow: '0 20px 54px -10px rgba(0, 0, 0, 0.65)',
              position: 'relative'
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
                transform: isPlaying ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 800ms ease'
              }}
            />
          </div>

          {ControlsDeck}
        </div>
      )}
    </div>
  );
};
