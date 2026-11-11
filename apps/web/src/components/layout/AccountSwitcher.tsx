import React, { useState, useEffect } from 'react';
import { bridgeClient } from '../../api/bridgeClient';
import { isDesktopApp } from '../../api/desktop';
import { openDesktopLogin, signOutDesktop } from '../../api/desktopAuth';
import { AuthState, YtChannel } from '../../types';

interface AccountSwitcherProps {
  onAccountChanged?: () => void;
  variant?: 'pill' | 'headerGreeting';
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ onAccountChanged, variant = 'pill' }) => {
  const [authState, setAuthState] = useState<AuthState>(bridgeClient.getAuthState());
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) return 'Up late';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const unsubAvail = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        bridgeClient.refreshAuth().then(setAuthState);
      }
    });
    const unsubAcct = bridgeClient.onAccountChange((auth) => {
      setAuthState(auth);
      onAccountChanged?.();
    });
    return () => {
      unsubAvail();
      unsubAcct();
    };
  }, []);

  const handleSelectChannel = async (channel: YtChannel) => {
    setSwitching(true);
    try {
      const newAuth = await bridgeClient.selectAccount(channel.id);
      setAuthState(newAuth);
      setIsOpen(false);
      onAccountChanged?.();
    } finally {
      setSwitching(false);
    }
  };

  const selectedChannel = authState.selectedChannel || null;
  const accounts = authState.accounts && authState.accounts.length > 0 ? authState.accounts : [];
  const isSignedIn = Boolean(authState.isAuthenticated && accounts.length > 0);

  return (
    <div style={{ position: 'relative' }}>
      {variant === 'headerGreeting' ? (
        /* Contextual Header Greeting with Profile Avatar (Matching Koda) */
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'none',
            border: 'none',
            padding: '4px 8px 4px 0',
            cursor: 'pointer',
            color: 'var(--md-sys-color-on-surface)',
            borderRadius: '9999px',
            transition: 'opacity 150ms ease'
          }}
          title="Switch Account"
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {selectedChannel?.avatarUrl ? (
              <img
                src={selectedChannel.avatarUrl}
                alt={selectedChannel.name}
                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '16px'
                }}
              >
                {selectedChannel?.name ? selectedChannel.name[0].toUpperCase() : (
                  <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>person</span>
                )}
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isSignedIn ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                border: '2px solid var(--md-sys-color-background)'
              }}
            />
          </div>

          <span
            style={{
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--md-sys-color-on-surface)'
            }}
          >
            {getTimeGreeting()}
          </span>

          <span
            className="material-symbols-rounded"
            style={{ fontSize: '20px', color: 'var(--md-sys-color-outline)' }}
          >
            expand_more
          </span>
        </button>
      ) : (
        /* Current Account Avatar Pill */
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="glass-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px 4px 4px',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--md-sys-color-on-surface)'
          }}
          title="Switch Google Account"
        >
          {selectedChannel?.avatarUrl ? (
            <img
              src={selectedChannel.avatarUrl}
              alt={selectedChannel.name}
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px'
              }}
            >
              {selectedChannel?.name ? selectedChannel.name[0].toUpperCase() : 'U'}
            </div>
          )}
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              maxWidth: '120px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {selectedChannel?.name || 'Guest Session'}
          </span>
          <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--md-sys-color-outline)' }}>
            arrow_drop_down
          </span>
        </button>
      )}

      {/* Account Switcher Dropdown Modal */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: variant === 'headerGreeting' ? '48px' : '42px',
            left: variant === 'headerGreeting' ? 0 : 'auto',
            right: variant === 'headerGreeting' ? 'auto' : 0,
            width: '320px',
            borderRadius: '24px',
            padding: '16px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Switch Account</h3>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--md-sys-color-outline)', cursor: 'pointer' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                close
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
            {accounts.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  alignItems: 'center'
                }}
              >
                {isDesktopApp() ? (
                  <>
                    <span>
                      Sign in with your Google account to sync your YouTube Music playlists, Liked songs, history, and recommendations.
                    </span>
                    <button
                      onClick={() => {
                        openDesktopLogin(false);
                        setIsOpen(false);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>login</span>
                      Sign in with Google
                    </button>
                  </>
                ) : (
                  <span>
                    No signed-in YouTube account detected yet. Sign in to YouTube Music in your browser and click <strong>Sync Google Accounts</strong> below.
                  </span>
                )}
              </div>
            ) : (
              accounts.map((account, aIdx) => (
                <div key={aIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {account.email && (
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--md-sys-color-outline)', padding: '4px 8px' }}>
                      {account.email}
                    </div>
                  )}
                  {account.channels.map((channel) => {
                    const isSelected = selectedChannel?.id === channel.id;
                    return (
                      <div
                        key={channel.id}
                        onClick={() => !switching && handleSelectChannel(channel)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '12px',
                          backgroundColor: isSelected ? 'var(--md-sys-color-primary-container)' : 'transparent',
                          color: isSelected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                          cursor: switching ? 'wait' : 'pointer',
                          transition: 'background-color 150ms ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          {channel.avatarUrl ? (
                            <img
                              src={channel.avatarUrl}
                              alt={channel.name}
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px'
                              }}
                            >
                              {channel.name[0]}
                            </div>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {channel.name}
                            </div>
                            {channel.handle && (
                              <div style={{ fontSize: '11px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {channel.handle}
                              </div>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <span className="material-symbols-rounded filled" style={{ fontSize: '18px', color: 'var(--md-sys-color-primary)' }}>
                            check_circle
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => {
                if (isDesktopApp()) {
                  openDesktopLogin(isSignedIn);
                  setIsOpen(false);
                } else {
                  window.open('https://accounts.google.com/AddSession?service=youtube&continue=https://music.youtube.com/', '_blank');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--md-sys-color-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                {isDesktopApp() && !isSignedIn ? 'login' : 'add'}
              </span>
              {isDesktopApp() && !isSignedIn ? 'Sign in with Google' : 'Add Another Google Account'}
            </button>
            <button
              onClick={async () => {
                setSwitching(true);
                const fresh = await bridgeClient.refreshAuth(true);
                setAuthState(fresh);
                setSwitching(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--md-sys-color-outline)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>refresh</span>
              Sync Google Accounts
            </button>
            {isDesktopApp() && isSignedIn && (
              <button
                onClick={async () => {
                  setSwitching(true);
                  await signOutDesktop();
                  const fresh = await bridgeClient.refreshAuth(true);
                  setAuthState(fresh);
                  setSwitching(false);
                  setIsOpen(false);
                  onAccountChanged?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--md-sys-color-error)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>logout</span>
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
