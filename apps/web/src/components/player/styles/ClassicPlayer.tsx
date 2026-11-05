import React from 'react';
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
  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

  const ControlsDeck = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: isFullWidescreenSpread ? '620px' : '100%'
      }}
    >
      {/* Title & Artist */}
      <div style={{ textAlign: isFullWidescreenSpread ? 'left' : 'center' }}>
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
          gap: '24px'
        }}
      >
        <button
          onClick={onToggleShuffle}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: isShuffled ? 'var(--md-sys-color-primary)' : 'inherit',
            padding: '8px'
          }}
          title="Shuffle"
        >
          <span className="material-symbols-rounded">shuffle</span>
        </button>

        <button
          onClick={onPrev}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            padding: '8px'
          }}
          title="Previous"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
            skip_previous
          </span>
        </button>

        <button
          onClick={onTogglePlay}
          style={{
            backgroundColor: 'var(--md-sys-color-primary)',
            color: 'var(--md-sys-color-on-primary)',
            border: 'none',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            transition: 'transform 100ms ease'
          }}
          title={isPlaying ? 'Pause' : 'Play'}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
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
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            padding: '8px'
          }}
          title="Next"
        >
          <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
            skip_next
          </span>
        </button>

        <button
          onClick={onToggleRepeat}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: repeatMode !== 'off' ? 'var(--md-sys-color-primary)' : 'inherit',
            padding: '8px'
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
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            color: isLiked ? '#ff4081' : 'var(--md-sys-color-on-surface)',
            fontSize: '12px',
            fontWeight: 700
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
            border: 'none',
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
            border: 'none',
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
          {/* Left Column: Artwork */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(440px, 50vh)',
              aspectRatio: '1 / 1',
              borderRadius: '28px',
              overflow: 'hidden',
              boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.75)',
              margin: '0 auto'
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
              maxWidth: 'min(100%, 280px)',
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
