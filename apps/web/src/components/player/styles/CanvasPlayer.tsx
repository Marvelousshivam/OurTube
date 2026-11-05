import React from 'react';
import { TrackMetadata } from '../../../types';
import { ExpressiveScrubber } from '../ExpressiveScrubber';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';

interface CanvasPlayerProps {
  track: TrackMetadata;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleLike: () => void;
  onOpenLyrics: () => void;
  onOpenQueue: () => void;
}

export const CanvasPlayer: React.FC<CanvasPlayerProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  isLiked,
  onTogglePlay,
  onSeek,
  onNext,
  onPrev,
  onToggleLike,
  onOpenLyrics,
  onOpenQueue
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        zIndex: 5
      }}
    >
      {/* Full Bleed Artwork with continuous gradient fade */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '75%',
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
            transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
            transition: 'transform 8s ease-out'
          }}
        />
        {/* Continuous gradient fade at foot of artwork */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(17,19,24,0.1) 0%, rgba(17,19,24,0.4) 60%, var(--md-sys-color-background) 100%)'
          }}
        />
      </div>

      {/* Floating Canvas Controls Deck */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '28px 32px 36px 32px',
          maxWidth: '640px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Track Info + Like */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 800,
                margin: '0 0 6px 0',
                color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
              }}
            >
              {track.title}
            </h1>
            <p
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--md-sys-color-primary)',
                margin: 0,
                textShadow: '0 1px 6px rgba(0,0,0,0.4)'
              }}
            >
              {track.artist}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onToggleLike}
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                color: isLiked ? 'var(--md-sys-color-primary)' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className={`material-symbols-rounded ${isLiked ? 'filled' : ''}`}>
                favorite
              </span>
            </button>
            <button
              onClick={onOpenLyrics}
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-rounded">lyrics</span>
            </button>
            <button
              onClick={onOpenQueue}
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-rounded">queue_music</span>
            </button>
          </div>
        </div>

        {/* Scrubber */}
        <ExpressiveScrubber
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={onSeek}
          accentColor="var(--md-sys-color-primary)"
        />

        {/* Transport Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '36px'
          }}
        >
          <button
            onClick={onPrev}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              padding: '12px'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>skip_previous</span>
          </button>

          <button
            onClick={onTogglePlay}
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={onNext}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              padding: '12px'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '36px' }}>skip_next</span>
          </button>
        </div>
      </div>
    </div>
  );
};
