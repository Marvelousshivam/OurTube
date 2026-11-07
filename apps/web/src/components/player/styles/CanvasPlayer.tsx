import React from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';

interface CanvasPlayerProps {
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

export const CanvasPlayer: React.FC<CanvasPlayerProps> = ({
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
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        zIndex: 5
      }}
    >
      <style>{`
        @keyframes canvasZoom {
          0% { transform: scale(1.0); }
          50% { transform: scale(1.04); }
          100% { transform: scale(1.0); }
        }
      `}</style>

      {/* 100vh Full Bleed Immersive Artwork (Matching Photo 1) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          zIndex: 0
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
            objectPosition: 'center 25%',
            animation: isPlaying ? 'canvasZoom 20s ease-in-out infinite' : 'none',
            transition: 'transform 1.2s ease-out'
          }}
        />

        {/* Ambient Multi-Stop Gradient Overlay for Readable Text & Contrast */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 20%, transparent 45%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.92) 100%)'
          }}
        />
      </div>

      {/* Floating Canvas Controls Deck */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: 'clamp(16px, 3.5vh, 32px) clamp(20px, 4vw, 36px) clamp(24px, 4vh, 40px)',
          maxWidth: '560px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(14px, 2.2vh, 22px)'
        }}
      >
        {/* Track Info Row + Favorite & Lyrics Buttons (Matching Photo 1) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              style={{
                fontSize: 'clamp(22px, 3.2vw, 30px)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: '0 0 4px 0',
                color: '#ffffff',
                textShadow: '0 2px 14px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {track.title}
            </h1>
            <p
              style={{
                fontSize: 'clamp(14px, 1.8vw, 16px)',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.82)',
                margin: 0,
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {track.artist}
            </p>
          </div>

          {/* Quick Action Buttons (Favorite + Lyrics) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={onToggleLike}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                color: isLiked ? '#ff4081' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
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

            <button
              onClick={onOpenLyrics}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="View Lyrics"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                lyrics
              </span>
            </button>

            <button
              onClick={onOpenQueue}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Up Next Queue"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                queue_music
              </span>
            </button>
          </div>
        </div>

        {/* Sleek M3 Scrubber & Timestamps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(pct * duration);
            }}
            style={{
              position: 'relative',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            {/* Background Track */}
            <div
              style={{
                width: '100%',
                height: '5px',
                backgroundColor: 'rgba(255, 255, 255, 0.28)',
                borderRadius: '9999px',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* Active Fill */}
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: '#ffffff',
                  borderRadius: '9999px',
                  transition: 'width 100ms linear'
                }}
              />
            </div>

            {/* Pill Scrubber Head */}
            <div
              style={{
                position: 'absolute',
                left: `calc(${progressPercent}% - 3px)`,
                width: '6px',
                height: '16px',
                backgroundColor: '#ffffff',
                borderRadius: '9999px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                transition: 'left 100ms linear'
              }}
            />
          </div>

          {/* Timestamps */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'rgba(255, 255, 255, 0.72)',
              letterSpacing: '0.02em',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)'
            }}
          >
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Iconic Floating Frosted Pill Transport Container (Matching Photo 1) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 24px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(0, 0, 0, 0.42)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isShuffled ? 'var(--md-sys-color-primary, #ffffff)' : 'rgba(255, 255, 255, 0.72)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease, color 0.15s ease'
            }}
            title="Shuffle"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              shuffle
            </span>
          </button>

          {/* Previous Track */}
          <button
            onClick={onPrev}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease'
            }}
            title="Previous track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
              skip_previous
            </span>
          </button>

          {/* Center Circular Play / Pause Button (White Circle) */}
          <button
            onClick={onTogglePlay}
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
              transition: 'transform 100ms ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '32px',
                fontVariationSettings: "'FILL' 1"
              }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Next Track */}
          <button
            onClick={onNext}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease'
            }}
            title="Next track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
              skip_next
            </span>
          </button>

          {/* Repeat */}
          <button
            onClick={onToggleRepeat}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: repeatMode !== 'off' ? 'var(--md-sys-color-primary, #ffffff)' : 'rgba(255, 255, 255, 0.72)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease, color 0.15s ease'
            }}
            title={`Repeat: ${repeatMode}`}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
