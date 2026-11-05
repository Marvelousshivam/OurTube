import React from 'react';
import { COLOR_TOKENS } from '../tokens';

export interface DSIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  filledIcon?: boolean;
  badge?: string | number;
}

export const DSIconButton: React.FC<DSIconButtonProps> = ({
  icon,
  variant = 'standard',
  size = 'md',
  filledIcon = false,
  badge,
  style,
  disabled,
  ...props
}) => {
  const getDimension = () => {
    switch (size) {
      case 'sm':
        return '32px';
      case 'lg':
        return '48px';
      case 'md':
      default:
        return '40px';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return '18px';
      case 'lg':
        return '26px';
      case 'md':
      default:
        return '22px';
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: COLOR_TOKENS.primary,
          color: COLOR_TOKENS.onPrimary,
          border: 'none',
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        };
      case 'tonal':
        return {
          backgroundColor: COLOR_TOKENS.secondaryContainer,
          color: COLOR_TOKENS.onSecondaryContainer,
          border: 'none',
          borderRadius: '50%'
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          color: COLOR_TOKENS.onSurface,
          border: `1.5px solid ${COLOR_TOKENS.outlineVariant}`,
          borderRadius: '50%'
        };
      case 'standard':
      default:
        return {
          backgroundColor: 'transparent',
          color: COLOR_TOKENS.onSurface,
          border: 'none',
          borderRadius: '50%'
        };
    }
  };

  const dim = getDimension();

  return (
    <button
      disabled={disabled}
      style={{
        width: dim,
        height: dim,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform 120ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms ease',
        userSelect: 'none',
        ...getVariantStyles(),
        ...style
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.92)';
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
      {...props}
    >
      <span
        className={`material-symbols-rounded ${filledIcon ? 'filled' : ''}`}
        style={{ fontSize: getIconSize() }}
      >
        {icon}
      </span>

      {badge !== undefined && (
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: COLOR_TOKENS.primary,
            color: COLOR_TOKENS.onPrimary,
            fontSize: '10px',
            fontWeight: 800,
            borderRadius: '9999px',
            padding: '2px 5px',
            lineHeight: 1
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
};
