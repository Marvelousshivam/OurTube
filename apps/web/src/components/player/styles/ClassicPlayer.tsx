import React, { useState } from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { ExpressiveScrubber } from '../ExpressiveScrubber';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';

interface ClassicPlayerProps {
  track: TrackMetadata;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  stageMode?: boolean;
  isWideScreen?: boolean;
  currentLyricLine?: string | null;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleLike: () => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onOpenLyrics: () => void;
  onOpenQueue: () => void;
}

export const ClassicPlayer: React.FC<ClassicPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  isLiked,
  repeatMode,
  isShuffled,
  stageMode = false,
  isWideScreen,
  currentLyricLine = null,
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
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
        gap: '18px',
        width: '100%',
        maxWidth: isFullWidescreenSpread ? '620px' : '100%'
      }}
    >
      {/* Title & Artist */}
      <div
        key={track.id}
        style={{
          textAlign: isFullWidescreenSpread ? 'left' : 'center',
          animation: 'm3TextSlideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <h2
          style={{
            fontSize: isFullWidescreenSpread ? 'clamp(28px, 3.2vw, 40px)' : '24px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 6px 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {track.title}
        </h2>
        <p
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--md-sys-color-primary)',
            opacity: 0.9,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {track.artist}
        </p>

        {/* Live Synced Lyrics Peek Pill */}
        {currentLyricLine && (
          <button
            onClick={onOpenLyrics}
            style={{
              marginTop: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              maxWidth: '100%',
              padding: '6px 12px',
              borderRadius: '14px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: '12px',
              fontWeight: 600,
              fontStyle: 'italic',
              cursor: 'pointer'
            }}
            title="Open synced lyrics"
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
                animation: 'm3TextSlideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              “{currentLyricLine}”
            </span>
          </button>
        )}
      </div>

      {/* Progress Scrubber */}
      <ExpressiveScrubber
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={onSeek}
        accentColor="var(--md-sys-color-primary)"
      />

      {/* Primary Transport Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        <button
          onClick={onToggleShuffle}
          style={{
            background: isShuffled ? 'var(--md-sys-color-primary-container)' : 'transparent',
            border: 'none',
            borderRadius: isShuffled ? '14px' : '50%',
            cursor: 'pointer',
            color: isShuffled
              ? 'var(--md-sys-color-on-primary-container)'
              : 'var(--md-sys-color-on-surface-variant)',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          title="Shuffle"
        >
          <span className="material-symbols-rounded">shuffle</span>
        </button>

        <button
          onClick={onPrev}
          style={{
            background: 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '50%',
            cursor: 'pointer',
            color: 'inherit',
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          onClick={onTogglePlay}
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            border: 'none',
            borderRadius: isPlaying ? '22px' : '50%',
            width: '68px',
            height: '68px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            transition:
              'border-radius 360ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          title={isPlaying ? 'Pause' : 'Play'}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.93)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '36px', fontVariationSettings: "'FILL' 1" }}
          >
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        <button
          onClick={onNext}
          style={{
            background: 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '50%',
            cursor: 'pointer',
            color: 'inherit',
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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

        <button
          onClick={onToggleRepeat}
          style={{
            background: repeatMode !== 'off' ? 'var(--md-sys-color-primary-container)' : 'transparent',
            border: 'none',
            borderRadius: repeatMode !== 'off' ? '14px' : '50%',
            cursor: 'pointer',
            color:
              repeatMode !== 'off'
                ? 'var(--md-sys-color-on-primary-container)'
                : 'var(--md-sys-color-on-surface-variant)',
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          title={`Repeat: ${repeatMode}`}
        >
          <span className="material-symbols-rounded">
            {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
          </span>
        </button>
      </div>

      {/* Bottom Bar: Like, Lyrics, Queue */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <button
          onClick={onToggleLike}
          className="glass-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: isLiked ? '14px' : '9999px',
            backgroundColor: isLiked
              ? 'var(--md-sys-color-primary)'
              : 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            cursor: 'pointer',
            color: isLiked ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
            fontSize: '12px',
            fontWeight: 700,
            transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '18px', fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}
          >
            favorite
          </span>
          <span>{isLiked ? 'Liked' : 'Like'}</span>
        </button>

        <button
          onClick={onOpenLyrics}
          className="glass-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            cursor: 'pointer',
            color: 'var(--md-sys-color-on-surface)',
            fontSize: '12px',
            fontWeight: 700
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            lyrics
          </span>
          <span>Lyrics</span>
        </button>

        <button
          onClick={onOpenQueue}
          className="glass-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            cursor: 'pointer',
            color: 'var(--md-sys-color-on-surface)',
            fontSize: '12px',
            fontWeight: 700
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
            queue_music
          </span>
          <span>Queue</span>
        </button>
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
        /* ================= EXPANSIVE WIDESCREEN CLASSIC SPREAD ================= */
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
          {/* Left Column: 3D Tilt Artwork */}
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(440px, 50vh)',
              aspectRatio: '1 / 1',
              borderRadius: isPlaying ? '28px' : '38px',
              overflow: 'hidden',
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
                transition: 'transform 700ms ease'
              }}
            />
          </div>

          {/* Right Column: Controls */}
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
              position: 'relative',
              width: '100%',
              aspectRatio: '1 / 1',
              maxWidth: 'clamp(140px, 24vh, 240px)',
              margin: '0 auto',
              borderRadius: isPlaying ? '24px' : '30px',
              overflow: 'hidden',
              boxShadow: '0 20px 54px -10px rgba(0, 0, 0, 0.65)',
              transition: 'border-radius 600ms ease'
            }}
          >
            <img
              src={sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 1200)}
              alt={track.title}
              onError={(e) => handleArtworkError(e, track.thumbnailUrl)}
              referrerPolicy="no-referrer"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {ControlsDeck}
        </div>
      )}
    </div>
  );
};
