import React from 'react';
import { COLOR_TOKENS, SHAPES } from '../tokens';

export interface DSAvatarProps {
  name: string;
  imageUrl?: string | null;
  subtext?: string;
  variant?: 'cookie9' | 'circle' | 'squircle';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const DSAvatar: React.FC<DSAvatarProps> = ({
  name,
  imageUrl,
  subtext,
  variant = 'cookie9',
  size = 'md',
  onClick,
  style
}) => {
  const getDimension = () => {
    switch (size) {
      case 'sm':
        return 40;
      case 'lg':
        return 88;
      case 'xl':
        return 120;
      case 'md':
      default:
        return 64;
    }
  };

  const getClipPath = () => {
    switch (variant) {
      case 'cookie9':
        return SHAPES.cookie9Sided;
      case 'squircle':
        return SHAPES.cookie12Sided;
      case 'circle':
      default:
        return 'circle(50% at 50% 50%)';
    }
  };

  const dim = getDimension();
  const monogram = name ? name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'transform 150ms cubic-bezier(0.2, 0, 0, 1)',
        ...style
      }}
      onMouseDown={(e) => {
        if (onClick) e.currentTarget.style.transform = 'scale(0.95)';
      }}
      onMouseUp={(e) => {
        if (onClick) e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div
        style={{
          width: `${dim}px`,
          height: `${dim}px`,
          clipPath: getClipPath(),
          backgroundColor: COLOR_TOKENS.surfaceContainerHigh,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          marginBottom: size === 'sm' ? '4px' : '8px'
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <span
            style={{
              fontSize: `${dim * 0.45}px`,
              fontWeight: 800,
              color: COLOR_TOKENS.primary,
              textTransform: 'uppercase'
            }}
          >
            {monogram}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: size === 'sm' ? '11px' : size === 'lg' || size === 'xl' ? '14px' : '13px',
          fontWeight: 700,
          color: COLOR_TOKENS.onSurface,
          maxWidth: `${dim + 32}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={name}
      >
        {name}
      </div>

      {subtext && (
        <div
          style={{
            fontSize: '11px',
            color: COLOR_TOKENS.onSurfaceVariant,
            maxWidth: `${dim + 32}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: '2px'
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
};
