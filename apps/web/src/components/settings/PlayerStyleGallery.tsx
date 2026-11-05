import React from 'react';
import { PlayerStyle } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlayerStore } from '../../store/playerStore';

interface StyleItem {
  id: PlayerStyle;
  name: string;
  desc: string;
}

const PLAYER_STYLES: StyleItem[] = [
  { id: 'EDITORIAL', name: 'Editorial', desc: 'Two-tone magazine layout with dynamic typography' },
  { id: 'CLASSIC', name: 'Classic', desc: 'Button controls for playback with large centered artwork' },
  { id: 'BENTO', name: 'Bento', desc: 'Squishy modular grid of flat interactive tiles' },
  { id: 'CANVAS', name: 'Canvas', desc: 'Full-bleed cinematic album art backdrop' },
  { id: 'GESTURE', name: 'Gesture', desc: 'Minimal interface with swipe navigation over artwork' },
  { id: 'STICKER', name: 'Sticker', desc: 'Die-cut dynamic art with tactile toy physics' },
  { id: 'HERO', name: 'Hero', desc: 'Full-bleed cover over tonal deck with morphing disc' }
];

export const PlayerStyleGallery: React.FC = () => {
  const { playerStyle, setPlayerStyle } = useSettingsStore();
  const playerStore = usePlayerStore();

  const handleSelect = (style: PlayerStyle) => {
    setPlayerStyle(style);
    playerStore.setPlayerStyle(style);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '13px', color: 'var(--md-sys-color-outline)', margin: '0 0 4px 0' }}>
        Every style plays the same music — they differ in layout geometry, gesture ergonomics, and how you control it.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '14px'
        }}
      >
        {PLAYER_STYLES.map((style) => {
          const isSelected = playerStyle === style.id;

          return (
            <div
              key={style.id}
              onClick={() => handleSelect(style.id)}
              style={{
                backgroundColor: isSelected
                  ? 'var(--md-sys-color-primary-container)'
                  : 'var(--md-sys-color-surface-container)',
                border: isSelected
                  ? '2px solid var(--md-sys-color-primary)'
                  : '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '20px',
                padding: '14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                position: 'relative',
                transition: 'all 0.2s cubic-bezier(0.2, 0.0, 0, 1)',
                boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)';
                }
              }}
            >
              {/* Mini Blueprint Visual Illustration */}
              <div
                style={{
                  height: '110px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '8px'
                }}
              >
                {style.id === 'EDITORIAL' && (
                  <div style={{ width: '85%', height: '85%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ flex: 1, backgroundColor: 'var(--md-sys-color-primary)', borderRadius: '8px' }} />
                    <div style={{ height: '6px', width: '70%', backgroundColor: 'var(--md-sys-color-on-surface-variant)', borderRadius: '3px' }} />
                    <div style={{ height: '4px', width: '45%', backgroundColor: 'var(--md-sys-color-outline)', borderRadius: '2px' }} />
                  </div>
                )}

                {style.id === 'CLASSIC' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '80%' }}>
                    <div style={{ width: '56px', height: '56px', backgroundColor: 'var(--md-sys-color-primary)', borderRadius: '10px' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-primary)' }} />
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-outline)' }} />
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-outline)' }} />
                    </div>
                  </div>
                )}

                {style.id === 'BENTO' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px', width: '90%', height: '80%' }}>
                    <div style={{ backgroundColor: 'var(--md-sys-color-primary)', borderRadius: '8px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ flex: 1, backgroundColor: 'var(--md-sys-color-secondary)', borderRadius: '6px' }} />
                      <div style={{ flex: 1, backgroundColor: 'var(--md-sys-color-tertiary)', borderRadius: '6px' }} />
                    </div>
                  </div>
                )}

                {style.id === 'CANVAS' && (
                  <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--md-sys-color-primary)', borderRadius: '10px', position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px', height: '6px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '3px' }} />
                  </div>
                )}

                {style.id === 'GESTURE' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '90%' }}>
                    <div style={{ width: '8px', height: '50px', borderRadius: '4px', backgroundColor: 'var(--md-sys-color-outline-variant)' }} />
                    <div style={{ width: '64px', height: '64px', borderRadius: '10px', backgroundColor: 'var(--md-sys-color-primary)' }} />
                    <div style={{ width: '8px', height: '50px', borderRadius: '4px', backgroundColor: 'var(--md-sys-color-outline-variant)' }} />
                  </div>
                )}

                {style.id === 'STICKER' && (
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '35% 65% 55% 45% / 40% 45% 55% 60%',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      transform: 'rotate(10deg)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  />
                )}

                {/* Selection Checkmark Badge */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '14px', fontWeight: 900 }}>
                      check
                    </span>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: isSelected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)'
                  }}
                >
                  {style.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: isSelected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-outline)',
                    lineHeight: 1.3
                  }}
                >
                  {style.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
