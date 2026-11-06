import React, { useState } from 'react';
import { APP_PALETTES, buildPaletteTokens, AppPalette } from '../../theme/ColorPalettes';

const FEATURED_PALETTES: AppPalette[] = [
  APP_PALETTES.find((p) => p.id === 'mint') || APP_PALETTES[0],
  APP_PALETTES.find((p) => p.id === 'lavender') || APP_PALETTES[1],
  APP_PALETTES.find((p) => p.id === 'electric') || APP_PALETTES[2],
  APP_PALETTES.find((p) => p.id === 'peach') || APP_PALETTES[3],
  APP_PALETTES.find((p) => p.id === 'sagesand') || APP_PALETTES[4],
  APP_PALETTES.find((p) => p.id === 'crimson') || APP_PALETTES[5]
];

interface MaterialYouPaletteBarProps {
  onPaletteChange?: (palette: AppPalette) => void;
}

export const MaterialYouPaletteBar: React.FC<MaterialYouPaletteBarProps> = ({ onPaletteChange }) => {
  const [selectedId, setSelectedId] = useState<string>('mint');

  const handleSelect = (palette: AppPalette) => {
    setSelectedId(palette.id);
    const tokens = buildPaletteTokens(palette, true, 'EXPRESSIVE');
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    onPaletteChange?.(palette);
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 6px',
        backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
        borderRadius: '9999px',
        border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
        gap: '4px',
        maxWidth: '100%',
        overflowX: 'auto'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '0 8px 0 4px',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--md-sys-color-primary, #a8c7fa)',
          whiteSpace: 'nowrap'
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
          palette
        </span>
        <span>Material You:</span>
      </div>

      {FEATURED_PALETTES.map((palette) => {
        const isSelected = selectedId === palette.id;
        return (
          <button
            key={palette.id}
            type="button"
            onClick={() => handleSelect(palette)}
            title={`Apply ${palette.name} dynamic theme`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              border: isSelected
                ? '1px solid var(--md-sys-color-primary, #a8c7fa)'
                : '1px solid transparent',
              backgroundColor: isSelected
                ? 'var(--md-sys-color-primary-container, rgba(168, 199, 250, 0.2))'
                : 'transparent',
              color: isSelected
                ? 'var(--md-sys-color-on-primary-container, #ffffff)'
                : 'var(--md-sys-color-on-surface-variant, #91909a)',
              fontSize: '11px',
              fontWeight: isSelected ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Seed Color Bubble */}
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: palette.seedPrimary,
                boxShadow: isSelected ? `0 0 8px ${palette.seedPrimary}` : 'none',
                flexShrink: 0
              }}
            />
            <span>{palette.name}</span>
          </button>
        );
      })}
    </div>
  );
};
