import React from 'react';
import { COLOR_TOKENS, SHAPES } from '../tokens';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';

export interface MediaCardProps {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  isPlaylist?: boolean;
  onPlay?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  badge?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  title,
  subtitle,
  imageUrl,
  isPlaylist = false,
  onPlay,
  onClick,
  badge,
  style
}) => {
  const highResUrl = React.useMemo(() => sizedArtwork(imageUrl, 300), [imageUrl]);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        borderRadius: '24px',
        backgroundColor: COLOR_TOKENS.surfaceContainer,
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform 180ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms ease, box-shadow 150ms ease',
        userSelect: 'none',
        ...style
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {/* Artwork Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: COLOR_TOKENS.surfaceContainerHigh,
          marginBottom: '12px'
        }}
      >
        <img
          src={highResUrl}
          alt={title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => handleArtworkError(e, imageUrl)}
        />

        {/* Badge */}
        {badge && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              padding: '3px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              fontSize: '10px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.04em'
            }}
          >
            {badge}
          </div>
        )}

        {/* Floating Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay?.(e);
          }}
          style={{
            position: 'absolute',
            right: '8px',
            bottom: '8px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: COLOR_TOKENS.primary,
            color: COLOR_TOKENS.onPrimary,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            transition: 'transform 120ms ease'
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title={isPlaylist ? 'Play Playlist' : 'Play Song'}
        >
          <span className="material-symbols-rounded filled" style={{ fontSize: '24px' }}>
            {isPlaylist ? 'playlist_play' : 'play_arrow'}
          </span>
        </button>
      </div>

      {/* Title & Subtitle */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: COLOR_TOKENS.onSurface,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={title}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: COLOR_TOKENS.onSurfaceVariant,
          marginTop: '3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={subtitle}
      >
        {subtitle}
      </div>
    </div>
  );
};

export interface LikedSongsTileProps {
  count: number;
  onClick: () => void;
  style?: React.CSSProperties;
}

export const LikedSongsTile: React.FC<LikedSongsTileProps> = ({ count, onClick, style }) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        borderRadius: '24px',
        backgroundColor: COLOR_TOKENS.primaryContainer,
        color: COLOR_TOKENS.onPrimaryContainer,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 150ms cubic-bezier(0.2, 0, 0, 1), box-shadow 150ms ease',
        userSelect: 'none',
        ...style
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {/* Softburst 8-star badge with Heart */}
      <div
        style={{
          width: '56px',
          height: '56px',
          backgroundColor: COLOR_TOKENS.primary,
          color: COLOR_TOKENS.onPrimary,
          clipPath: SHAPES.softBurst,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <span className="material-symbols-rounded filled" style={{ fontSize: '26px' }}>
          favorite
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 800 }}>Liked Songs</div>
        <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.85, marginTop: '2px' }}>
          {count} {count === 1 ? 'song' : 'songs'}
        </div>
      </div>

      <span className="material-symbols-rounded" style={{ fontSize: '24px', opacity: 0.7 }}>
        arrow_forward
      </span>
    </div>
  );
};

export interface ShortcutTileProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  icon?: string;
  onClick: () => void;
  onPlay?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export const ShortcutTile: React.FC<ShortcutTileProps> = ({
  title,
  subtitle,
  imageUrl,
  icon,
  onClick,
  onPlay,
  style
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px 8px 8px',
        borderRadius: '16px',
        backgroundColor: COLOR_TOKENS.surfaceContainer,
        cursor: 'pointer',
        transition: 'transform 150ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms ease',
        userSelect: 'none',
        ...style
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: COLOR_TOKENS.surfaceContainerHigh,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {imageUrl ? (
          <img
            src={sizedArtwork(imageUrl, 96)}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            referrerPolicy="no-referrer"
            onError={(e) => handleArtworkError(e, imageUrl)}
          />
        ) : (
          <span className="material-symbols-rounded" style={{ color: COLOR_TOKENS.primary, fontSize: '24px' }}>
            {icon || 'music_note'}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: COLOR_TOKENS.onSurface,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '11px',
              color: COLOR_TOKENS.onSurfaceVariant,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {onPlay && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(e);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLOR_TOKENS.primary,
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span className="material-symbols-rounded filled" style={{ fontSize: '24px' }}>
            play_circle
          </span>
        </button>
      )}
    </div>
  );
};
