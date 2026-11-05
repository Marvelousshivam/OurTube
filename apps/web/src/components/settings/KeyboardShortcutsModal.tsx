import React, { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space / K', desc: 'Play / Pause playback' },
  { key: '← / →', desc: 'Seek 5s backward / forward' },
  { key: 'J / L', desc: 'Seek 10s backward / forward' },
  { key: '↑ / ↓', desc: 'Volume up / down (+5% / -5%)' },
  { key: 'M', desc: 'Toggle mute' },
  { key: 'C', desc: 'Toggle synced lyrics' },
  { key: 'Q', desc: 'Toggle up next queue' },
  { key: 'N / P', desc: 'Next / previous track' },
  { key: 'S / R', desc: 'Toggle shuffle / repeat' },
  { key: 'H', desc: 'Like / favorite track' },
  { key: 'F', desc: 'Toggle fullscreen stage mode' },
  { key: '?', desc: 'View keyboard shortcuts cheat sheet' },
  { key: 'Esc', desc: 'Collapse player / Close modal' }
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'm3BackdropFade 200ms ease both'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--md-sys-color-surface-container, #1e1e24)',
          borderRadius: '28px',
          border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.1))',
          padding: '24px 28px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          animation: 'm3ModalSpringIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className="material-symbols-rounded"
              style={{ color: 'var(--md-sys-color-primary)', fontSize: '24px' }}
            >
              keyboard
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--md-sys-color-on-surface)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '50%'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SHORTCUTS.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)'
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 500 }}>
                {s.desc}
              </span>
              <kbd
                style={{
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
