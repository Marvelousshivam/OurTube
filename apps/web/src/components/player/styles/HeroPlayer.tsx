import React, { useState } from 'react';
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
  currentLyricLine?: string | null;
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
  currentLyricLine = null,
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
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

  const handleArtworkMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: -ny * 6, y: nx * 6 });
  };

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
        key={track.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          animation: 'm3TextSlideUp 280ms cubic-bezier(0.16, 1, 0.3, 1)'
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
              fontWeight: 600,
              color: 'var(--md-sys-color-primary)',
              opacity: 0.9,
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
            background: isLiked ? 'rgba(255, 64, 129, 0.18)' : 'transparent',
            border: '1.5px solid rgba(255, 255, 255, 0.22)',
            color: isLiked ? '#ff4081' : 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            width: '46px',
            height: '46px',
            borderRadius: isLiked ? '16px' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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

      {/* Live Synced Lyric Peek */}
      {currentLyricLine && !showLyrics && (
        <button
          onClick={onToggleLyrics}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            color: 'var(--md-sys-color-on-surface)',
            fontSize: '12px',
            fontWeight: 600,
            fontStyle: 'italic',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '15px', color: 'var(--md-sys-color-primary)', flexShrink: 0 }}
          >
            lyrics
          </span>
          <span
            key={currentLyricLine}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              animation: 'm3TextSlideUp 240ms ease'
            }}
          >
            “{currentLyricLine}”
          </span>
        </button>
      )}

      {/* 2. Sonic Acoustic Waveform Scrubber with Micro Timestamps */}
      <SonicWaveformScrubber
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={onSeek}
        trackId={track.id}
        accentColor="var(--md-sys-color-primary)"
      />

      {/* 3. Signature Asymmetric Hero Transport Deck */}
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
            borderRadius: isPlaying ? '28px' : '48px',
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 28px -4px rgba(0, 0, 0, 0.45)',
            transition: 'border-radius 360ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 120ms ease'
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
                transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              title="Previous"
              onMouseDown={(e) => (e.currentTarget.style.transform = 'translateX(-3px) scale(0.92)')}
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
                transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              title="Next"
              onMouseDown={(e) => (e.currentTarget.style.transform = 'translateX(3px) scale(0.92)')}
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
                borderRadius: isShuffled ? '12px' : '21px',
                backgroundColor: isShuffled ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: isShuffled ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                borderRadius: repeatMode !== 'off' ? '12px' : '21px',
                backgroundColor: repeatMode !== 'off' ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: repeatMode !== 'off' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                borderRadius: showLyrics ? '12px' : '21px',
                backgroundColor: showLyrics ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: showLyrics ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                borderRadius: '21px',
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
          {/* Left Column: Full-Bleed Artwork Card with 3D Tilt */}
          <div
            onMouseMove={handleArtworkMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(460px, 52vh)',
              aspectRatio: '1 / 1',
              borderRadius: isPlaying ? '28px' : '40px',
              overflow: 'hidden',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.75)',
              margin: '0 auto',
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition:
                tilt.x === 0 && tilt.y === 0
                  ? 'transform 450ms cubic-bezier(0.2, 0.9, 0.3, 1), border-radius 500ms ease'
                  : 'transform 80ms linear, border-radius 500ms ease'
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
