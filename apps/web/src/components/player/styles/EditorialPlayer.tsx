import React, { useState, useEffect } from 'react';
import { TrackMetadata, RepeatMode } from '../../../types';
import { SonicWaveformScrubber } from '../SonicWaveformScrubber';
import { sizedArtwork, handleArtworkError } from '../../../api/artworkService';

interface EditorialPlayerProps {
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
  onToggleLyrics: () => void;
  onOpenQueue: () => void;
}

// 5 Material 3 organic shapes for die-cut artwork morphing (including 12-lobed cookie from Koda screenshot)
const SHAPES = [
  // 12-lobed scalloped cookie / flower (exact match to Koda screenshot)
  'polygon(50% 0%, 63% 4%, 75% 0%, 84% 9%, 93% 6%, 98% 18%, 100% 30%, 96% 41%, 100% 50%, 96% 59%, 100% 70%, 98% 82%, 93% 94%, 84% 91%, 75% 100%, 63% 96%, 50% 100%, 37% 96%, 25% 100%, 16% 91%, 7% 94%, 2% 82%, 0% 70%, 4% 59%, 0% 50%, 4% 41%, 0% 30%, 2% 18%, 7% 6%, 16% 9%, 25% 0%, 37% 4%)',
  // Arch
  'polygon(0% 25%, 25% 5%, 50% 0%, 75% 5%, 100% 25%, 100% 100%, 0% 100%)',
  // Soft diamond gem
  'polygon(50% 3%, 97% 50%, 50% 97%, 3% 50%)',
  // Rounded octagon
  'polygon(28% 0%, 72% 0%, 100% 28%, 100% 72%, 72% 100%, 28% 100%, 0% 72%, 0% 28%)',
  // Cookie / 12-sided squircle
  'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
];

export const EditorialPlayer: React.FC<EditorialPlayerProps> = ({
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
  const [shapeIndex, setShapeIndex] = useState(0);

  useEffect(() => {
    const code = track.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    setShapeIndex(code % SHAPES.length);
  }, [track.id]);

  // If on widescreen and companion is closed, use the expansive magazine spread!
  const isFullWidescreenSpread = (isWideScreen ?? true) && !stageMode;

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
        /* ================= EXPANSIVE WIDESCREEN EDITORIAL SPREAD ================= */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 460px) minmax(420px, 1fr)',
            gap: 'clamp(36px, 5vw, 76px)',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '1360px',
            margin: '0 auto'
          }}
        >
          {/* Left Column: Hero Die-Cut Organic Artwork */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              width: '100%'
            }}
          >
            {track.album && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)',
                  opacity: 0.8
                }}
              >
                {track.album}
              </span>
            )}

            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 'min(440px, 50vh)',
                aspectRatio: '1 / 1',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                clipPath: SHAPES[shapeIndex],
                boxShadow: '0 32px 80px -16px rgba(0, 0, 0, 0.8)',
                overflow: 'hidden',
                transition: 'clip-path 700ms cubic-bezier(0.2, 0.9, 0.3, 1)'
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
          </div>

          {/* Right Column: Dramatic Typography + Asymmetric Bento Deck + Utility Chips */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              justifyContent: 'center',
              maxWidth: '640px',
              width: '100%'
            }}
          >
            {/* Title & Artist Headline Stack */}
            <div>
              <h1
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontStyle: 'italic',
                  fontWeight: 800,
                  fontSize: 'clamp(38px, 4.4vw, 64px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.025em',
                  margin: '0 0 10px 0',
                  color: 'var(--md-sys-color-on-surface)',
                  textWrap: 'balance'
                }}
              >
                {track.title}
              </h1>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)',
                  opacity: 0.85,
                  margin: 0
                }}
              >
                {track.artist}
              </p>
            </div>

            {/* Asymmetric Bento Control Cluster (Matching Koda Image 2) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
              {/* Row 1: Large PAUSE / PLAY Word Pill + Circular Skip Next Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                <button
                  onClick={onTogglePlay}
                  style={{
                    flex: 1,
                    height: '68px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '18px',
                    letterSpacing: '0.18em',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    transition: 'transform 100ms ease'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
                </button>

                <button
                  onClick={onNext}
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
                    flexShrink: 0,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    transition: 'transform 100ms ease'
                  }}
                  title="Next track"
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
                    skip_next
                  </span>
                </button>
              </div>

              {/* Row 2: Circular Skip Previous Button + Waveform Sonic Bar Scrubber */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%' }}>
                <button
                  onClick={onPrev}
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
                    flexShrink: 0,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    transition: 'transform 100ms ease'
                  }}
                  title="Previous track"
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>
                    skip_previous
                  </span>
                </button>

                {/* Sonic Bar Waveform Scrubber */}
                <div
                  style={{
                    flex: 1,
                    height: '68px',
                    padding: '0 18px',
                    borderRadius: '24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <SonicWaveformScrubber
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onSeek={onSeek}
                    trackId={track.id}
                    accentColor="var(--md-sys-color-primary)"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Utility Chips Row (Matching Image 2) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginTop: '4px'
              }}
            >
              {/* Heart / Favorite Chip */}
              <button
                onClick={onToggleLike}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: isLiked ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                  color: isLiked ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
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

              {/* Playlist / Queue Chip */}
              <button
                onClick={onOpenQueue}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--md-sys-color-on-surface)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                title="Playback Queue"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  playlist_play
                </span>
              </button>

              {/* Shuffle Chip */}
              <button
                onClick={onToggleShuffle}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: isShuffled ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                  color: isShuffled ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  shuffle
                </span>
              </button>

              {/* Repeat Chip */}
              <button
                onClick={onToggleRepeat}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
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
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
                </span>
              </button>

              {/* Morphing Lyrics Toggle Chip */}
              <button
                onClick={onToggleLyrics}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: showLyrics ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                  color: showLyrics ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
                  boxShadow: showLyrics ? '0 4px 14px rgba(0,0,0,0.3)' : 'none'
                }}
                title={showLyrics ? 'Hide synced lyrics' : 'Show synced lyrics'}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  lyrics
                </span>
              </button>

              {/* Audio Spec Badge */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--md-sys-color-primary)',
                  textTransform: 'uppercase',
                  marginLeft: 'auto'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                  graphic_eq
                </span>
                256k AAC · HQ
              </span>
            </div>
          </div>
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
          {/* Subtle Album / Soundtrack Header Subtitle */}
          {track.album && (
            <div style={{ textAlign: 'center', opacity: 0.7, margin: '0 auto -4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)'
                }}
              >
                {track.album}
              </span>
            </div>
          )}

          {/* Centered Die-Cut Scalloped Organic Artwork */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 'min(100%, 260px)',
              aspectRatio: '1 / 1',
              margin: '0 auto',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              clipPath: SHAPES[shapeIndex],
              boxShadow: '0 20px 54px -10px rgba(0, 0, 0, 0.65)',
              overflow: 'hidden',
              transition: 'clip-path 700ms cubic-bezier(0.2, 0.9, 0.3, 1)'
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

          {/* Title & Artist Headline Stack */}
          <div style={{ textAlign: 'center', width: '100%', padding: '0 8px' }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 'clamp(22px, 2.6vw, 32px)',
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                margin: '0 0 4px 0',
                color: 'var(--md-sys-color-on-surface)',
                textWrap: 'balance'
              }}
            >
              {track.title}
            </h1>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--md-sys-color-primary)',
                opacity: 0.85,
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {track.artist}
            </p>
          </div>

          {/* Control Cluster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {/* Row 1: Large PAUSE / PLAY Word Pill + Circular Skip Next Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <button
                onClick={onTogglePlay}
                style={{
                  flex: 1,
                  height: '56px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '15px',
                  letterSpacing: '0.18em',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  transition: 'transform 100ms ease'
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                onClick={onNext}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  transition: 'transform 100ms ease'
                }}
                title="Next track"
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
                  skip_next
                </span>
              </button>
            </div>

            {/* Row 2: Circular Skip Previous Button + Waveform Sonic Bar Scrubber */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <button
                onClick={onPrev}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  transition: 'transform 100ms ease'
                }}
                title="Previous track"
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
                  skip_previous
                </span>
              </button>

              <div
                style={{
                  flex: 1,
                  height: '56px',
                  padding: '0 14px',
                  borderRadius: '18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SonicWaveformScrubber
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={isPlaying}
                  onSeek={onSeek}
                  trackId={track.id}
                  accentColor="var(--md-sys-color-primary)"
                />
              </div>
            </div>
          </div>

          {/* Bottom Utility Chips Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '4px'
            }}
          >
            <button
              onClick={onToggleLike}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: isLiked ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: isLiked ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title={isLiked ? 'Liked' : 'Like'}
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: '20px',
                  fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0"
                }}
              >
                favorite
              </span>
            </button>

            <button
              onClick={onOpenQueue}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title="Playback Queue"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                playlist_play
              </span>
            </button>

            <button
              onClick={onToggleShuffle}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: isShuffled ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: isShuffled ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                shuffle
              </span>
            </button>

            <button
              onClick={onToggleRepeat}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
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
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
              </span>
            </button>

            <button
              onClick={onToggleLyrics}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: showLyrics ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: showLyrics ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
                boxShadow: showLyrics ? '0 4px 14px rgba(0,0,0,0.3)' : 'none'
              }}
              title={showLyrics ? 'Hide synced lyrics' : 'Show synced lyrics'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                lyrics
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
