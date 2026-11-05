import React from 'react';
import { COLOR_TOKENS } from '../tokens';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';

export interface DSTrackRowProps {
  rank?: number;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  imageUrl?: string;
  isPlaying?: boolean;
  isLiked?: boolean;
  onPlay?: () => void;
  onArtistClick?: (e: React.MouseEvent) => void;
  onToggleLike?: (e: React.MouseEvent) => void;
  onMore?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export const DSTrackRow: React.FC<DSTrackRowProps> = ({
  rank,
  title,
  artist,
  album,
  duration,
  imageUrl,
  isPlaying = false,
  isLiked = false,
  onPlay,
  onArtistClick,
  onToggleLike,
  onMore,
  style
}) => {
  const formatDuration = (secs?: number) => {
    if (!secs || isNaN(secs)) return '3:30';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={onPlay}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '10px 14px',
        borderRadius: '16px',
        cursor: 'pointer',
        backgroundColor: isPlaying ? COLOR_TOKENS.surfaceContainerHigh : 'transparent',
        transition: 'background-color 150ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        ...style
      }}
      onMouseEnter={(e) => {
        if (!isPlaying) {
          e.currentTarget.style.backgroundColor = COLOR_TOKENS.surfaceContainerLow;
          e.currentTarget.style.transform = 'translateX(3px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isPlaying) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.transform = 'translateX(0)';
        }
      }}
    >
      {/* Rank or Visualizer */}
      {rank !== undefined && (
        <div
          style={{
            width: '24px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 700,
            color: isPlaying ? COLOR_TOKENS.primary : COLOR_TOKENS.onSurfaceVariant,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0
          }}
        >
          {isPlaying ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: '2px',
                width: '16px',
                height: '14px',
                margin: '0 auto'
              }}
              title="Playing"
            >
              <span
                style={{
                  width: '2.5px',
                  height: '100%',
                  backgroundColor: COLOR_TOKENS.primary,
                  borderRadius: '9999px',
                  animation: 'm3EqualizerBar1 0.75s ease-in-out infinite'
                }}
              />
              <span
                style={{
                  width: '2.5px',
                  height: '100%',
                  backgroundColor: COLOR_TOKENS.primary,
                  borderRadius: '9999px',
                  animation: 'm3EqualizerBar2 0.55s ease-in-out infinite 0.1s'
                }}
              />
              <span
                style={{
                  width: '2.5px',
                  height: '100%',
                  backgroundColor: COLOR_TOKENS.primary,
                  borderRadius: '9999px',
                  animation: 'm3EqualizerBar3 0.85s ease-in-out infinite 0.2s'
                }}
              />
              <span
                style={{
                  width: '2.5px',
                  height: '100%',
                  backgroundColor: COLOR_TOKENS.primary,
                  borderRadius: '9999px',
                  animation: 'm3EqualizerBar4 0.65s ease-in-out infinite 0.05s'
                }}
              />
            </div>
          ) : (
            rank
          )}
        </div>
      )}

      {/* Artwork */}
      {imageUrl && (
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            overflow: 'hidden',
            backgroundColor: COLOR_TOKENS.surfaceContainerHigh,
            position: 'relative',
            flexShrink: 0
          }}
        >
          <img
            src={sizedArtwork(imageUrl, 88)}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => handleArtworkError(e, imageUrl)}
          />
          {isPlaying && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-rounded" style={{ color: COLOR_TOKENS.primary, fontSize: '20px' }}>
                play_arrow
              </span>
            </div>
          )}
        </div>
      )}

      {/* Title & Artist */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: isPlaying ? COLOR_TOKENS.primary : COLOR_TOKENS.onSurface,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={title}
        >
          {title}
        </div>
        <div
          onClick={(e) => {
            if (onArtistClick) {
              e.stopPropagation();
              onArtistClick(e);
            }
          }}
          style={{
            fontSize: '12px',
            color: COLOR_TOKENS.onSurfaceVariant,
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: onArtistClick ? 'pointer' : 'inherit'
          }}
          onMouseEnter={(e) => {
            if (onArtistClick) (e.currentTarget.style.textDecoration = 'underline');
          }}
          onMouseLeave={(e) => {
            if (onArtistClick) (e.currentTarget.style.textDecoration = 'none');
          }}
          title={artist}
        >
          {artist}
        </div>
      </div>

      {/* Album (desktop only) */}
      {album && (
        <div
          style={{
            flex: 1,
            display: 'none',
            fontSize: '13px',
            color: COLOR_TOKENS.onSurfaceVariant,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          className="desktop-only"
          title={album}
        >
          {album}
        </div>
      )}

      {/* Actions: Like, Duration, More */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {onToggleLike && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(e);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isLiked ? COLOR_TOKENS.primary : COLOR_TOKENS.outline,
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1), color 150ms ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.82)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title={isLiked ? 'Unlike track' : 'Like track'}
          >
            <span
              className={`material-symbols-rounded ${isLiked ? 'filled' : ''}`}
              style={{
                fontSize: '18px',
                animation: isLiked ? 'm3HeartBurst 400ms var(--motion-spring-joyful)' : 'none'
              }}
            >
              favorite
            </span>
          </button>
        )}

        {duration !== undefined && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: COLOR_TOKENS.onSurfaceVariant,
              fontVariantNumeric: 'tabular-nums',
              width: '38px',
              textAlign: 'right'
            }}
          >
            {formatDuration(duration)}
          </span>
        )}

        {onMore && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMore(e);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: COLOR_TOKENS.onSurfaceVariant,
              padding: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              more_vert
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
