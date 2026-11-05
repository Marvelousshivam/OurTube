import React from 'react';
import { COLOR_TOKENS } from '../tokens';

export interface DSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'word-pill' | 'outlined' | 'text';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  trailingIcon?: string;
}

export const DSButton: React.FC<DSButtonProps> = ({
  children,
  variant = 'filled',
  size = 'md',
  icon,
  trailingIcon,
  style,
  disabled,
  ...props
}) => {
  const getPadding = () => {
    switch (size) {
      case 'sm':
        return '6px 14px';
      case 'lg':
        return '14px 28px';
      case 'md':
      default:
        return '10px 20px';
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return '12px';
      case 'lg':
        return '15px';
      case 'md':
      default:
        return '13px';
    }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'word-pill':
        return {
          backgroundColor: COLOR_TOKENS.primary,
          color: COLOR_TOKENS.onPrimary,
          border: 'none',
          borderRadius: '9999px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        };
      case 'tonal':
        return {
          backgroundColor: COLOR_TOKENS.secondaryContainer,
          color: COLOR_TOKENS.onSecondaryContainer,
          border: 'none',
          borderRadius: '9999px',
          fontWeight: 700
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          color: COLOR_TOKENS.onSurface,
          border: `1.5px solid ${COLOR_TOKENS.outlineVariant}`,
          borderRadius: '9999px',
          fontWeight: 600
        };
      case 'text':
        return {
          backgroundColor: 'transparent',
          color: COLOR_TOKENS.primary,
          border: 'none',
          borderRadius: '9999px',
          fontWeight: 700,
          padding: '6px 12px'
        };
      case 'filled':
      default:
        return {
          backgroundColor: COLOR_TOKENS.primary,
          color: COLOR_TOKENS.onPrimary,
          border: 'none',
          borderRadius: '9999px',
          fontWeight: 700,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        };
    }
  };

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: getPadding(),
        fontSize: getFontSize(),
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform 120ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms ease, box-shadow 150ms ease',
        userSelect: 'none',
        ...getVariantStyles(),
        ...style
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(0.95)';
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'scale(1)';
      }}
      {...props}
    >
      {icon && (
        <span className="material-symbols-rounded" style={{ fontSize: size === 'sm' ? '16px' : '19px' }}>
          {icon}
        </span>
      )}
      {children && <span>{children}</span>}
      {trailingIcon && (
        <span className="material-symbols-rounded" style={{ fontSize: size === 'sm' ? '16px' : '19px' }}>
          {trailingIcon}
        </span>
      )}
    </button>
  );
};
