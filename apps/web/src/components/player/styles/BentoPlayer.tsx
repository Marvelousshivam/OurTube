import React from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';
import { TopographicalWaveform } from '../TopographicalWaveform';

interface BentoPlayerProps {
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
  onOpenQueue?: () => void;
  currentLyricPreview?: string;
}

export const BentoPlayer: React.FC<BentoPlayerProps> = ({
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
  const progressPercent = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(frac * duration);
  };

  // Full widescreen spread is used when companion is closed on desktop/widescreen
  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

  /* ================= SUB-COMPONENTS ================= */
  // 1. Metadata Bento Card
  const MetadataCard = (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '22px',
        padding: '14px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}
    >
      <h1
        style={{
          fontSize: isFullWidescreenSpread ? '24px' : '20px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
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
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--md-sys-color-outline)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {track.artist}
      </span>
    </div>
  );

  // 2. Pill Progress Scrubber Card
  const ProgressPillCard = (
    <div
      onClick={handleProgressSeek}
      style={{
        height: '46px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        userSelect: 'none'
      }}
      title="Click anywhere to seek"
    >
      {/* Filled Progress Block on Left containing elapsed time */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.max(16, progressPercent)}%`,
          backgroundColor: 'var(--md-sys-color-primary-container, rgba(255, 255, 255, 0.22))',
          borderRadius: '9999px',
          transition: 'width 100ms linear',
          pointerEvents: 'none'
        }}
      />

      <span
        style={{
          position: 'relative',
          zIndex: 2,
          paddingLeft: '18px',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.04em',
          color: 'var(--md-sys-color-on-primary-container, var(--md-sys-color-on-surface))'
        }}
      >
        {formatTime(currentTime)}
      </span>

      <span
        style={{
          position: 'relative',
          zIndex: 2,
          paddingRight: '18px',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--md-sys-color-on-surface)',
          opacity: 0.75
        }}
      >
        {formatTime(duration)}
      </span>
    </div>
  );

  // 3. Topographical Acoustic Waveform Card
  const WaveformCard = (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '20px',
        padding: '6px 12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}
    >
      <TopographicalWaveform
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        trackId={track.id}
        onSeek={onSeek}
      />
    </div>
  );

  // 4. Primary Transport Bento Cards (3 Pill Row)
  const TransportDeck = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
      {/* Prev Bento Pill */}
      <button
        onClick={onPrev}
        style={{
          flex: 1,
          height: isFullWidescreenSpread ? '66px' : '58px',
          borderRadius: '22px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--md-sys-color-on-surface)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 150ms ease'
        }}
        title="Previous track"
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
          skip_previous
        </span>
      </button>

      {/* Play/Pause Bento Pill (Wider) */}
      <button
        onClick={onTogglePlay}
        style={{
          flex: 1.4,
          height: isFullWidescreenSpread ? '66px' : '58px',
          borderRadius: '22px',
          backgroundColor: 'var(--md-sys-color-primary)',
          color: 'var(--md-sys-color-on-primary)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
          transition: 'all 150ms ease'
        }}
        title={isPlaying ? 'Pause' : 'Play'}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span
          className="material-symbols-rounded"
          style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
        >
          {isPlaying ? 'pause' : 'play_arrow'}
        </span>
      </button>

      {/* Next Bento Pill */}
      <button
        onClick={onNext}
        style={{
          flex: 1,
          height: isFullWidescreenSpread ? '66px' : '58px',
          borderRadius: '22px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--md-sys-color-on-surface)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 150ms ease'
        }}
        title="Next track"
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
          skip_next
        </span>
      </button>
    </div>
  );

  // 5. Bottom Utility Bento Bar (5 Buttons)
  const UtilityBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
      {/* 1. Heart / Like Button */}
      <button
        onClick={onToggleLike}
        style={{
          width: isFullWidescreenSpread ? '52px' : '46px',
          height: isFullWidescreenSpread ? '52px' : '46px',
          borderRadius: '18px',
          backgroundColor: isLiked ? 'rgba(255, 64, 129, 0.18)' : 'rgba(255, 255, 255, 0.08)',
          color: isLiked ? '#ff4081' : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 150ms ease'
        }}
        title={isLiked ? 'Unlike' : 'Like'}
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

      {/* 2. Shuffle Button (Highlight active yellow like screenshot) */}
      <button
        onClick={onToggleShuffle}
        style={{
          width: isFullWidescreenSpread ? '52px' : '46px',
          height: isFullWidescreenSpread ? '52px' : '46px',
          borderRadius: '18px',
          backgroundColor: isShuffled ? '#ffd54f' : 'rgba(255, 255, 255, 0.08)',
          color: isShuffled ? '#1c1b1f' : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 150ms ease'
        }}
        title={isShuffled ? 'Shuffle enabled' : 'Shuffle disabled'}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
          shuffle
        </span>
      </button>

      {/* 3. Repeat Button */}
      <button
        onClick={onToggleRepeat}
        style={{
          width: isFullWidescreenSpread ? '52px' : '46px',
          height: isFullWidescreenSpread ? '52px' : '46px',
          borderRadius: '18px',
          backgroundColor: repeatMode !== 'off' ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
          color: repeatMode !== 'off' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 150ms ease'
        }}
        title={`Repeat: ${repeatMode}`}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
          {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
        </span>
      </button>

      {/* 4. Lyrics Toggle Button */}
      <button
        onClick={onToggleLyrics}
        style={{
          width: isFullWidescreenSpread ? '52px' : '46px',
          height: isFullWidescreenSpread ? '52px' : '46px',
          borderRadius: '18px',
          backgroundColor: showLyrics ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
          color: showLyrics ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 150ms ease'
        }}
        title={showLyrics ? 'Hide synced lyrics' : 'Show synced lyrics'}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
          lyrics
        </span>
      </button>

      {/* 5. Source / Album Pill on Far Right */}
      <button
        onClick={onOpenQueue}
        style={{
          flex: 1,
          height: isFullWidescreenSpread ? '52px' : '46px',
          borderRadius: '18px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 14px',
          cursor: 'pointer',
          minWidth: 0,
          transition: 'all 150ms ease'
        }}
        title="Playback Queue"
      >
        <span
          className="material-symbols-rounded"
          style={{ fontSize: '20px', flexShrink: 0, color: 'var(--md-sys-color-primary)' }}
        >
          playlist_play
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {track.album || 'Up next'}
        </span>
      </button>
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
        /* ================= EXPANSIVE WIDESCREEN BENTO SPREAD ================= */
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
          {/* Left Column: Hero Squircle Artwork Tile */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(460px, 52vh)',
              aspectRatio: '1 / 1',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              borderRadius: '36px',
              boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.75)',
              overflow: 'hidden',
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

          {/* Right Column: Stacked Bento Tiles */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              justifyContent: 'center',
              maxWidth: '620px',
              width: '100%'
            }}
          >
            {MetadataCard}
            {ProgressPillCard}
            {WaveformCard}
            {TransportDeck}
            {UtilityBar}
          </div>
        </div>
      ) : (
        /* ================= COMPACT / STAGE MODE VERTICAL BENTO STACK (Matching Koda Screenshot) ================= */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            maxWidth: '420px',
            margin: '0 auto'
          }}
        >
          {/* Hero Squircle Artwork Tile */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(100%, 280px)',
              aspectRatio: '1 / 1',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              borderRadius: '30px',
              boxShadow: '0 20px 54px -10px rgba(0, 0, 0, 0.65)',
              overflow: 'hidden',
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

          {/* Stacked Bento Cards */}
          {MetadataCard}
          {ProgressPillCard}
          {WaveformCard}
          {TransportDeck}
          {UtilityBar}
        </div>
      )}
    </div>
  );
};
