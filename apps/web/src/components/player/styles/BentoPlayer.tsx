import React, { useState } from 'react';
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
  currentLyricPreview?: string | null;
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
  onOpenQueue,
  currentLyricPreview = null
}) => {
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const progressPercent = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleArtworkMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: -ny * 6, y: nx * 6 });
  };

  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

  /* ================= SUB-COMPONENTS ================= */
  // 1. Metadata Bento Card
  const MetadataCard = (
    <div
      key={track.id}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '22px',
        padding: '14px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        animation: 'm3TextSlideUp 280ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
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
            fontSize: '10px',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: 'var(--md-sys-color-primary)',
            flexShrink: 0
          }}
        >
          256k AAC
        </span>
      </div>
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--md-sys-color-primary)',
          opacity: 0.85,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {track.artist}
      </span>

      {currentLyricPreview && !showLyrics && (
        <div
          onClick={onToggleLyrics}
          style={{
            marginTop: '4px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontStyle: 'italic',
            color: 'var(--md-sys-color-on-surface-variant)',
            cursor: 'pointer'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '14px', color: 'var(--md-sys-color-primary)' }}
          >
            lyrics
          </span>
          <span
            key={currentLyricPreview}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              animation: 'm3TextSlideUp 220ms ease'
            }}
          >
            “{currentLyricPreview}”
          </span>
        </div>
      )}
    </div>
  );

  // 2. Unified Topographical Acoustic Waveform Card with Animated M3 Pill Progress Fill & Timestamps
  const WaveformCard = (
    <div
      style={{
        position: 'relative',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '9999px',
        padding: '6px 20px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        overflow: 'visible'
      }}
    >
      {/* Clipped Background Layer for Animated Tonal Pill Progress Fill */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '9999px',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.max(12, progressPercent)}%`,
            borderRadius: '9999px',
            background:
              'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent) 100%)',
            boxShadow: isPlaying
              ? 'inset -1px 0 12px color-mix(in srgb, var(--md-sys-color-primary) 28%, transparent)'
              : 'none',
            transition: 'width 180ms linear, box-shadow 300ms ease'
          }}
        />
      </div>

      <span
        style={{
          position: 'relative',
          zIndex: 2,
          fontSize: '12px',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.04em',
          color: 'var(--md-sys-color-primary)',
          minWidth: '34px'
        }}
      >
        {formatTime(currentTime)}
      </span>

      <div style={{ position: 'relative', zIndex: 2, flex: 1, minWidth: 0 }}>
        <TopographicalWaveform
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          trackId={track.id}
          onSeek={onSeek}
        />
      </div>

      <span
        style={{
          position: 'relative',
          zIndex: 2,
          fontSize: '12px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.04em',
          color: 'var(--md-sys-color-on-surface)',
          opacity: 0.72,
          minWidth: '34px',
          textAlign: 'right'
        }}
      >
        {formatTime(duration)}
      </span>
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
          transition: 'all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        title="Previous track"
        onMouseDown={(e) => (e.currentTarget.style.transform = 'translateX(-3px) scale(0.94)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
          skip_previous
        </span>
      </button>

      {/* Play/Pause Bento Pill (Wider + Shape Morph) */}
      <button
        onClick={onTogglePlay}
        style={{
          flex: 1.4,
          height: isFullWidescreenSpread ? '66px' : '58px',
          borderRadius: isPlaying ? '20px' : '9999px',
          backgroundColor: 'var(--md-sys-color-primary)',
          color: 'var(--md-sys-color-on-primary)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
          transition: 'border-radius 340ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 150ms ease'
        }}
        title={isPlaying ? 'Pause' : 'Play'}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
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
          transition: 'all 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        title="Next track"
        onMouseDown={(e) => (e.currentTarget.style.transform = 'translateX(3px) scale(0.94)')}
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
          borderRadius: isLiked ? '16px' : '24px',
          backgroundColor: isLiked ? 'rgba(255, 64, 129, 0.22)' : 'rgba(255, 255, 255, 0.08)',
          color: isLiked ? '#ff4081' : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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

      {/* 2. Shuffle Button */}
      <button
        onClick={onToggleShuffle}
        style={{
          width: isFullWidescreenSpread ? '52px' : '46px',
          height: isFullWidescreenSpread ? '52px' : '46px',
          borderRadius: isShuffled ? '16px' : '24px',
          backgroundColor: isShuffled ? '#ffd54f' : 'rgba(255, 255, 255, 0.08)',
          color: isShuffled ? '#1c1b1f' : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
          borderRadius: repeatMode !== 'off' ? '16px' : '24px',
          backgroundColor:
            repeatMode !== 'off' ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
          color:
            repeatMode !== 'off'
              ? 'var(--md-sys-color-on-primary)'
              : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
          borderRadius: showLyrics ? '16px' : '24px',
          backgroundColor: showLyrics ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
          color: showLyrics ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
          {/* Left Column: Hero Squircle Artwork Tile with 3D Tilt */}
          <div
            onMouseMove={handleArtworkMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(460px, 52vh)',
              aspectRatio: '1 / 1',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              borderRadius: isPlaying ? '32px' : '44px',
              boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.75)',
              overflow: 'hidden',
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
            {WaveformCard}
            {TransportDeck}
            {UtilityBar}
          </div>
        </div>
      ) : (
        /* ================= COMPACT / STAGE MODE VERTICAL BENTO STACK ================= */
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

          {MetadataCard}
          {WaveformCard}
          {TransportDeck}
          {UtilityBar}
        </div>
      )}
    </div>
  );
};
