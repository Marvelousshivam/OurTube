import React from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { M3ExpressiveMorphHero } from '../M3ExpressiveMorphHero';
import { BottomEqualizerWave } from '../BottomEqualizerWave';

interface MorphPlayerProps {
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

export const MorphPlayer: React.FC<MorphPlayerProps> = ({
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

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        maxWidth: '540px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'clamp(12px, 2.5vh, 24px) clamp(16px, 3vw, 28px)',
        height: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 5,
        color: 'var(--md-sys-color-on-surface)'
      }}
    >
      {/* Center Stage: Living Material 3 Expressive Scallop/Flower Morphing Hero (Koda Photo 5) */}
      <M3ExpressiveMorphHero
        artworkUrl={track.highResThumbnailUrl || track.thumbnailUrl}
        title={track.title}
        isPlaying={isPlaying}
        progress={progress}
        onPlayPause={onTogglePlay}
      />

      {/* Info & Controls Cluster */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(10px, 1.8vh, 18px)',
          textAlign: 'center',
          marginTop: 'auto'
        }}
      >
        {/* Track Title & Artist */}
        <div>
          <h2
            style={{
              fontSize: 'clamp(20px, 2.6vh, 26px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 4px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {track.title}
          </h2>
          <p
            style={{
              fontSize: '14px',
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

        {/* Waveform Scrubber & Timestamps (Matching Photo 3) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(pct * duration);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '28px',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            {/* Waveform Bars Representation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                height: '100%',
                gap: '2px'
              }}
            >
              {Array.from({ length: 48 }).map((_, i) => {
                const barPct = i / 48;
                const isPlayed = barPct <= progress;
                // Generate a pseudo-audio height pattern
                const h = 6 + Math.sin(i * 0.45) * 8 + Math.cos(i * 1.2) * 6;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.max(4, Math.min(24, h))}px`,
                      borderRadius: '2px',
                      backgroundColor: isPlayed
                        ? 'var(--md-sys-color-primary)'
                        : 'var(--md-sys-color-surface-container-highest, rgba(255,255,255,0.2))',
                      transition: 'background-color 80ms ease'
                    }}
                  />
                );
              })}
            </div>

            {/* Scrubber Playhead Line */}
            <div
              style={{
                position: 'absolute',
                left: `${progress * 100}%`,
                top: '0',
                bottom: '0',
                width: '2px',
                backgroundColor: 'var(--md-sys-color-primary)',
                boxShadow: '0 0 6px var(--md-sys-color-primary)',
                transform: 'translateX(-50%)'
              }}
            />
          </div>

          {/* Time Readout */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--md-sys-color-outline)'
            }}
          >
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Primary Controls Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(14px, 3vw, 24px)'
          }}
        >
          {/* Favorite Button */}
          <button
            onClick={onToggleLike}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isLiked ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
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

          {/* Shuffle */}
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
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
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
              color: 'var(--md-sys-color-on-surface)',
              padding: '6px'
            }}
            title="Previous track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '30px' }}>
              skip_previous
            </span>
          </button>

          {/* Center Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
              transition: 'transform 100ms ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '30px',
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
              color: 'var(--md-sys-color-on-surface)',
              padding: '6px'
            }}
            title="Next track"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '30px' }}>
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
              color: repeatMode !== 'off' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
              padding: '6px'
            }}
            title={`Repeat: ${repeatMode}`}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
          </button>

          {/* Lyrics */}
          <button
            onClick={onOpenLyrics}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--md-sys-color-outline)',
              padding: '6px'
            }}
            title="Lyrics"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              lyrics
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Soundwave Equalizer (Koda Photo 5 & Settings toggleable) */}
      <BottomEqualizerWave isPlaying={isPlaying} />
    </div>
  );
};
