import React from 'react';
import { COLOR_TOKENS } from '../tokens';

export interface DSSectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
  style?: React.CSSProperties;
}

export const DSSectionHeader: React.FC<DSSectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon,
  style
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        ...style
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && (
            <span className="material-symbols-rounded" style={{ color: COLOR_TOKENS.primary, fontSize: '24px' }}>
              {icon}
            </span>
          )}
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: COLOR_TOKENS.onSurface,
              margin: 0,
              letterSpacing: '-0.01em'
            }}
          >
            {title}
          </h2>
        </div>
        {subtitle && (
          <p
            style={{
              fontSize: '13px',
              color: COLOR_TOKENS.onSurfaceVariant,
              margin: 0,
              fontWeight: 500
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            background: 'transparent',
            border: 'none',
            color: COLOR_TOKENS.primary,
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderRadius: '9999px',
            transition: 'background-color 150ms ease'
          }}
        >
          <span>{actionLabel}</span>
          <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
            arrow_forward
          </span>
        </button>
      )}
    </div>
  );
};
