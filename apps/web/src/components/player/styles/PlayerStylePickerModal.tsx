import React from 'react';
import { PlayerStyle } from '../../../types';
import { PLAYER_STYLE_CATALOG } from './PlayerStyleCatalog';

interface PlayerStylePickerModalProps {
  currentStyle: PlayerStyle;
  isOpen: boolean;
  onSelectStyle: (style: PlayerStyle) => void;
  onClose: () => void;
}

export const PlayerStylePickerModal: React.FC<PlayerStylePickerModalProps> = ({
  currentStyle,
  isOpen,
  onSelectStyle,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
              Player Style
            </h3>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Choose your expressive now-playing layout
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--md-sys-color-on-surface)',
              padding: '6px'
            }}
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {PLAYER_STYLE_CATALOG.map((item) => {
            const isSelected = item.style === currentStyle;
            return (
              <div
                key={item.style}
                onClick={() => {
                  onSelectStyle(item.style);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 18px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  backgroundColor: isSelected
                    ? 'var(--md-sys-color-primary-container)'
                    : 'var(--md-sys-color-surface-container)',
                  color: isSelected
                    ? 'var(--md-sys-color-on-primary-container)'
                    : 'var(--md-sys-color-on-surface)',
                  transition: 'background-color 200ms ease',
                  border: isSelected
                    ? '1.5px solid var(--md-sys-color-primary)'
                    : '1.5px solid transparent'
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: isSelected
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-surface-container-high)',
                    color: isSelected
                      ? 'var(--md-sys-color-on-primary)'
                      : 'var(--md-sys-color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span className="material-symbols-rounded">{item.icon}</span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{item.label}</div>
                  <div
                    style={{
                      fontSize: '12px',
                      opacity: 0.8,
                      marginTop: '2px',
                      color: isSelected ? 'inherit' : 'var(--md-sys-color-on-surface-variant)'
                    }}
                  >
                    {item.subtitle}
                  </div>
                </div>

                {isSelected && (
                  <span className="material-symbols-rounded" style={{ color: 'var(--md-sys-color-primary)' }}>
                    check
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
