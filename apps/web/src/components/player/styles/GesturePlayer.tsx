import React, { useState } from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { ExpressiveScrubber } from '../ExpressiveScrubber';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';

interface GesturePlayerProps {
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

export const GesturePlayer: React.FC<GesturePlayerProps> = ({
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
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    setTouchStartX(x);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartX === null) return;
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    setDragOffset(x - touchStartX);
  };

  const handleTouchEnd = () => {
    if (dragOffset > 75) {
      onPrev();
    } else if (dragOffset < -75) {
      onNext();
    }
    setTouchStartX(null);
    setDragOffset(0);
  };

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        maxWidth: '560px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 24px 32px 24px',
        color: 'var(--md-sys-color-on-surface)',
        zIndex: 5
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.7 }}>
          SWIPE TO SKIP
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onToggleLike}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isLiked ? 'var(--md-sys-color-primary)' : 'inherit',
              padding: '6px'
            }}
          >
            <span className={`material-symbols-rounded ${isLiked ? 'filled' : ''}`}>favorite</span>
          </button>
          <button
            onClick={onOpenLyrics}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '6px'
            }}
            title="Lyrics"
          >
            <span className="material-symbols-rounded">lyrics</span>
          </button>
          <button
            onClick={onOpenQueue}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '6px'
            }}
            title="Up Next Queue"
          >
            <span className="material-symbols-rounded">queue_music</span>
          </button>
        </div>
      </div>

      {/* Swipeable Card Area */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        style={{
          width: '100%',
          aspectRatio: '1/1',
          maxWidth: '380px',
          margin: '20px auto',
          position: 'relative',
          cursor: 'grab',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '36px',
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
            transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.04}deg)`,
            transition: touchStartX === null ? 'transform 300ms cubic-bezier(0.2, 0, 0, 1)' : 'none'
          }}
        >
          <img
            src={sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 1200)}
            alt={track.title}
            onError={(e) => handleArtworkError(e, track.thumbnailUrl)}
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          />
        </div>
      </div>

      {/* Track Details */}
      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0' }}>{track.title}</h2>
        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--md-sys-color-primary)', margin: 0 }}>
          {track.artist}
        </p>
      </div>

      {/* Scrubber & Minimal Transport */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ExpressiveScrubber
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={onSeek}
        />

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px' }}>
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
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>shuffle</span>
          </button>

          <button
            onClick={onPrev}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            title="Previous track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>skip_previous</span>
          </button>

          <button
            onClick={onTogglePlay}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={onNext}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            title="Next track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>skip_next</span>
          </button>

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
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
