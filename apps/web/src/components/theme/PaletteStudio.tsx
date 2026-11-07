import React, { useState } from 'react';
import {
  APP_PALETTES,
  PALETTE_CATEGORIES,
  AppPalette,
  PaletteStyle
} from '../../theme/ColorPalettes';
import { useSettingsStore } from '../../store/settingsStore';

interface PaletteStudioProps {
  onClose: () => void;
}

const PALETTE_STYLES: { id: PaletteStyle; label: string; desc: string }[] = [
  { id: 'TONAL_SPOT', label: 'Tonal Spot', desc: 'Balanced default Material You tone' },
  { id: 'EXPRESSIVE', label: 'Expressive', desc: 'Higher chroma accents & complementary warmth' },
  { id: 'VIBRANT', label: 'Vibrant', desc: 'Maximum saturation for high-energy contrast' },
  { id: 'FRUIT_SALAD', label: 'Fruit Salad', desc: 'Playful multi-hue tonal variation' },
  { id: 'MONOCHROME', label: 'Monochrome', desc: 'Pure grayscale minimalism with deep black' }
];

export const PaletteStudio: React.FC<PaletteStudioProps> = ({ onClose }) => {
  const {
    selectedPaletteId,
    paletteStyle: selectedStyle,
    setSelectedPaletteId,
    setPaletteStyle
  } = useSettingsStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const handleSelectPalette = (palette: AppPalette) => {
    setSelectedPaletteId(palette.id);
  };

  const handleSelectStyle = (style: PaletteStyle) => {
    setPaletteStyle(style);
  };

  const displayedPalettes =
    selectedCategory === 'All'
      ? APP_PALETTES
      : APP_PALETTES.filter((p) => p.category === selectedCategory);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(16px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'm3BackdropFade 200ms ease both'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          borderRadius: '32px',
          padding: '28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: 'var(--md-sys-color-on-surface)',
          overflow: 'hidden',
          animation: 'm3ModalSpringIn 340ms cubic-bezier(0.16, 1, 0.3, 1) both'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Color Palette Studio</h2>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
              26 curated Material 3 Expressive palettes powered by HCT color science
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '6px'
            }}
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingRight: '4px' }}>
          {/* 1. Palette Style Segmented Picker */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--md-sys-color-primary)' }}>
              Generation Style
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {PALETTE_STYLES.map((st) => (
                <button
                  key={st.id}
                  onClick={() => handleSelectStyle(st.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    backgroundColor:
                      selectedStyle === st.id
                        ? 'var(--md-sys-color-primary)'
                        : 'var(--md-sys-color-surface-container)',
                    color:
                      selectedStyle === st.id
                        ? 'var(--md-sys-color-on-primary)'
                        : 'var(--md-sys-color-on-surface)'
                  }}
                  title={st.desc}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Category Filters */}
          <div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {['All', ...PALETTE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor:
                      selectedCategory === cat
                        ? 'var(--md-sys-color-primary-container)'
                        : 'transparent',
                    color:
                      selectedCategory === cat
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Palettes Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px'
            }}
          >
            {displayedPalettes.map((pal) => {
              const isSelected = pal.id === selectedPaletteId;
              return (
                <div
                  key={pal.id}
                  onClick={() => handleSelectPalette(pal)}
                  style={{
                    padding: '14px',
                    borderRadius: '18px',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--md-sys-color-primary-container)'
                      : 'var(--md-sys-color-surface-container)',
                    color: isSelected
                      ? 'var(--md-sys-color-on-primary-container)'
                      : 'var(--md-sys-color-on-surface)',
                    border: isSelected
                      ? '2px solid var(--md-sys-color-primary)'
                      : '2px solid transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 150ms ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{pal.name}</span>
                    <span style={{ fontSize: '10px', opacity: 0.7, textTransform: 'uppercase' }}>
                      {pal.category}
                    </span>
                  </div>

                  {/* 3 Seed Color Swatches */}
                  <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ flex: 1, backgroundColor: pal.seedPrimary }} title={`Primary: ${pal.seedPrimary}`} />
                    <div style={{ flex: 1, backgroundColor: pal.seedSecondary }} title={`Secondary: ${pal.seedSecondary}`} />
                    <div style={{ flex: 1, backgroundColor: pal.seedTertiary }} title={`Tertiary: ${pal.seedTertiary}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
