import React from 'react';
import { COLOR_TOKENS } from '../tokens';

export interface DSChipProps {
  label: string;
  selected?: boolean;
  icon?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const DSChip: React.FC<DSChipProps> = ({
  label,
  selected = false,
  icon,
  onClick,
  style
}) => {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '9999px',
        border: selected
          ? `1.5px solid ${COLOR_TOKENS.primary}`
          : `1px solid ${COLOR_TOKENS.outlineVariant}`,
        backgroundColor: selected
          ? COLOR_TOKENS.primaryContainer
          : COLOR_TOKENS.surfaceContainer,
        color: selected
          ? COLOR_TOKENS.onPrimaryContainer
          : COLOR_TOKENS.onSurface,
        fontSize: '13px',
        fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        transition: 'all 150ms ease',
        ...style
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {icon && (
        <span
          className="material-symbols-rounded"
          style={{ fontSize: '18px', color: selected ? COLOR_TOKENS.primary : 'inherit' }}
        >
          {icon}
        </span>
      )}
      <span>{label}</span>
      {selected && (
        <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
          check
        </span>
      )}
    </button>
  );
};

export interface DSSegmentedOption<T extends string = string> {
  id: T;
  label: string;
  icon?: string;
}

export interface DSSegmentedGroupProps<T extends string = string> {
  options: DSSegmentedOption<T>[];
  selectedId: T;
  onChange: (id: T) => void;
  style?: React.CSSProperties;
}

export function DSSegmentedGroup<T extends string = string>({
  options,
  selectedId,
  onChange,
  style
}: DSSegmentedGroupProps<T>) {
  return (
    <div
      style={{
        display: 'inline-flex',
        backgroundColor: COLOR_TOKENS.surfaceContainer,
        borderRadius: '9999px',
        padding: '4px',
        gap: '2px',
        border: `1px solid ${COLOR_TOKENS.outlineVariant}`,
        overflowX: 'auto',
        maxWidth: '100%',
        ...style
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: isSelected ? COLOR_TOKENS.primary : 'transparent',
              color: isSelected ? COLOR_TOKENS.onPrimary : COLOR_TOKENS.onSurfaceVariant,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 180ms ease, color 180ms ease'
            }}
          >
            {opt.icon && (
              <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
                {opt.icon}
              </span>
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
