import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLyricsSettings } from '../../lyrics/settings';
import { sourceById } from '../../lyrics/sources';
import { forgetLyricsCache } from '../../lyrics/repository';
import { bridgeClient } from '../../api/bridgeClient';
import { usePlayerStore } from '../../store/playerStore';

interface LyricsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LyricsSettingsModal: React.FC<LyricsSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    order,
    disabled,
    preferSyllables,
    paxsenixKey,
    setEnabled,
    move,
    setPreferSyllables,
    setPaxsenixKey,
    reset
  } = useLyricsSettings();

  const reloadCurrentLyrics = usePlayerStore((s) => s.reloadCurrentLyrics);
  const [keyDraft, setKeyDraft] = useState(paxsenixKey);
  const [extConnected, setExtConnected] = useState(bridgeClient.getIsAvailable());

  useEffect(() => {
    setKeyDraft(paxsenixKey);
  }, [paxsenixKey]);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = bridgeClient.onAvailabilityChange(setExtConnected);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      unsub();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCloseAndRefresh = () => {
    if (keyDraft.trim() !== paxsenixKey) {
      setPaxsenixKey(keyDraft.trim());
    }
    forgetLyricsCache();
    void reloadCurrentLyrics();
    onClose();
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseAndRefresh();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.62)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        animation: 'm3DialogFadeIn 200ms cubic-bezier(0.2, 0, 0, 1)'
      }}
    >
      <style>{`
        @keyframes m3DialogFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes m3DialogScaleIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lyric sources and settings"
        style={{
          width: 'min(540px, calc(100vw - 32px))',
          maxHeight: 'min(760px, calc(100vh - 40px))',
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          color: 'var(--md-sys-color-on-surface)',
          borderRadius: '28px',
          border: '1px solid var(--md-sys-color-outline-variant)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'm3DialogScaleIn 240ms cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
      >
        {/* M3 Dialog Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 24px 14px 24px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '14px',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                lyrics
              </span>
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Lyric Sources & Sync
              </h2>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '12px',
                  color: 'var(--md-sys-color-on-surface-variant)'
                }}
              >
                15 providers raced in parallel • Priority order wins
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseAndRefresh}
            aria-label="Close lyric settings"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '1px solid var(--md-sys-color-outline-variant)',
              backgroundColor: 'var(--md-sys-color-surface-container-highest)',
              color: 'var(--md-sys-color-on-surface)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </header>

        {/* Scrollable M3 Body */}
        <div
          style={{
            overflowY: 'auto',
            padding: '18px 24px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Prefer Syllable Timing Card */}
          <div
            onClick={() => setPreferSyllables(!preferSyllables)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '14px 16px',
              borderRadius: '18px',
              backgroundColor: preferSyllables
                ? 'var(--md-sys-color-secondary-container)'
                : 'var(--md-sys-color-surface-container)',
              color: preferSyllables
                ? 'var(--md-sys-color-on-secondary-container)'
                : 'var(--md-sys-color-on-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              cursor: 'pointer',
              transition: 'all 180ms ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                auto_awesome
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>
                  Prefer word & syllable timing
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    opacity: 0.82,
                    marginTop: '2px'
                  }}
                >
                  Keep searching past line-timed results for Apple/QQ word-by-word sync
                </div>
              </div>
            </div>

            {/* M3 Switch */}
            <div
              role="switch"
              aria-checked={preferSyllables}
              style={{
                width: '52px',
                height: '32px',
                borderRadius: '9999px',
                backgroundColor: preferSyllables
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-surface-container-highest)',
                border: preferSyllables
                  ? '2px solid var(--md-sys-color-primary)'
                  : '2px solid var(--md-sys-color-outline)',
                position: 'relative',
                flexShrink: 0,
                transition: 'all 180ms cubic-bezier(0.2, 0.9, 0.3, 1)'
              }}
            >
              <div
                style={{
                  width: preferSyllables ? '24px' : '16px',
                  height: preferSyllables ? '24px' : '16px',
                  borderRadius: '50%',
                  backgroundColor: preferSyllables
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-outline)',
                  position: 'absolute',
                  top: '50%',
                  left: preferSyllables ? '24px' : '6px',
                  transform: 'translateY(-50%)',
                  transition: 'all 180ms cubic-bezier(0.2, 0.9, 0.3, 1)',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                {preferSyllables && (
                  <span
                    className="material-symbols-rounded"
                    style={{
                      fontSize: '14px',
                      color: 'var(--md-sys-color-primary)',
                      fontWeight: 800
                    }}
                  >
                    check
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Extension Status Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '14px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              fontSize: '12px',
              color: 'var(--md-sys-color-on-surface-variant)'
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '18px',
                color: extConnected
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-error, #ffb4ab)'
              }}
            >
              {extConnected ? 'verified' : 'extension_off'}
            </span>
            <span>
              {extConnected
                ? 'Companion Extension connected — KuGou, Musixmatch, Genius & PaxSenix are unlocked.'
                : 'Companion Extension not detected — KuGou, Musixmatch, Genius & PaxSenix require the extension.'}
            </span>
          </div>

          {/* Provider Priority List */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--md-sys-color-on-surface-variant)',
                marginBottom: '8px',
                paddingLeft: '4px'
              }}
            >
              Providers (Priority Order)
            </div>

            <div
              style={{
                borderRadius: '20px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                overflow: 'hidden'
              }}
            >
              {order.map((id, index) => {
                const source = sourceById(id);
                if (!source) return null;
                const enabled = !disabled.includes(id);

                return (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px 10px 14px',
                      borderTop:
                        index > 0
                          ? '1px solid var(--md-sys-color-outline-variant)'
                          : 'none',
                      opacity: enabled ? 1 : 0.58,
                      transition: 'opacity 150ms ease'
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flex: 1,
                        minWidth: 0,
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(id, e.currentTarget.checked)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: 'var(--md-sys-color-primary)',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13.5px',
                            fontWeight: 700,
                            color: 'var(--md-sys-color-on-surface)'
                          }}
                        >
                          <span>
                            {index + 1}. {source.label}
                          </span>
                          {source.requiresExtension && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '9999px',
                                backgroundColor:
                                  'var(--md-sys-color-surface-container-highest)',
                                color: 'var(--md-sys-color-on-surface-variant)'
                              }}
                            >
                              EXT
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--md-sys-color-on-surface-variant)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {source.detail}
                        </div>
                      </div>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => move(id, -1)}
                        aria-label={`Move ${source.label} up`}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: 'var(--md-sys-color-surface-container-high)',
                          color: 'var(--md-sys-color-on-surface)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: index === 0 ? 'default' : 'pointer',
                          opacity: index === 0 ? 0.3 : 1
                        }}
                      >
                        <span
                          className="material-symbols-rounded"
                          style={{ fontSize: '18px' }}
                        >
                          keyboard_arrow_up
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={index === order.length - 1}
                        onClick={() => move(id, 1)}
                        aria-label={`Move ${source.label} down`}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: 'var(--md-sys-color-surface-container-high)',
                          color: 'var(--md-sys-color-on-surface)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: index === order.length - 1 ? 'default' : 'pointer',
                          opacity: index === order.length - 1 ? 0.3 : 1
                        }}
                      >
                        <span
                          className="material-symbols-rounded"
                          style={{ fontSize: '18px' }}
                        >
                          keyboard_arrow_down
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PaxSenix Key Input */}
          <div>
            <label
              htmlFor="ourtube-paxsenix-key"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--md-sys-color-on-surface-variant)',
                marginBottom: '6px',
                paddingLeft: '4px'
              }}
            >
              PaxSenix API Key (Optional)
            </label>
            <input
              id="ourtube-paxsenix-key"
              type="password"
              placeholder="Bearer key for PaxSenix: Spotify & Musixmatch"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.currentTarget.value)}
              onBlur={() => setPaxsenixKey(keyDraft)}
              autoComplete="off"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 14px',
                borderRadius: '14px',
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                color: 'var(--md-sys-color-on-surface)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* M3 Dialog Footer Actions */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => {
              reset();
              setKeyDraft('');
              forgetLyricsCache();
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '9999px',
              border: '1px solid var(--md-sys-color-outline-variant)',
              backgroundColor: 'transparent',
              color: 'var(--md-sys-color-on-surface-variant)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Restore defaults
          </button>

          <button
            type="button"
            onClick={handleCloseAndRefresh}
            style={{
              padding: '9px 22px',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};
