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
  index?: number;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  title,
  subtitle,
  imageUrl,
  isPlaylist = false,
  onPlay,
  onClick,
  badge,
  style,
  index
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const highResUrl = React.useMemo(() => sizedArtwork(imageUrl, 300), [imageUrl]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        borderRadius: '24px',
        backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
        border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
        boxShadow: isHovered
          ? '0 12px 32px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.2)), 0 2px 8px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.08))'
          : '0 2px 6px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.05))',
        cursor: 'pointer',
        position: 'relative',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), background-color 150ms ease, box-shadow 220ms ease',
        userSelect: 'none',
        animation: typeof index === 'number'
          ? `m3CardCascade 340ms var(--m3-ease-emphasized-decelerate) ${Math.min(index * 35, 350)}ms both`
          : undefined,
        ...style
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97) translateY(-2px)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = isHovered ? 'translateY(-4px)' : 'translateY(0)')}
    >
      {/* Artwork Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high, #282a2f)',
          marginBottom: '12px'
        }}
      >
        <img
          src={highResUrl}
          alt={title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: isHovered ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 400ms cubic-bezier(0.2, 0, 0, 1)'
          }}
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

        {/* Floating Play Button (Hover-emergent M3 Expressive FAB) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay?.(e);
          }}
          style={{
            position: 'absolute',
            right: '10px',
            bottom: '10px',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
            color: 'var(--md-sys-color-on-primary, #083063)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'scale(1) translateY(0)' : 'scale(0.75) translateY(6px)',
            transition: 'opacity 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 150ms ease',
            pointerEvents: isHovered ? 'auto' : 'none',
            zIndex: 3
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          title={isPlaylist ? 'Play Playlist' : 'Play Song'}
        >
          <span className="material-symbols-rounded filled" style={{ fontSize: '22px' }}>
            {isPlaylist ? 'playlist_play' : 'play_arrow'}
          </span>
        </button>
      </div>

      {/* Title & Subtitle */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--md-sys-color-on-surface, #e2e2e9)',
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
          color: 'var(--md-sys-color-on-surface-variant, #8d9199)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: '2px'
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
