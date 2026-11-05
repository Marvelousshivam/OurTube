import React, { useState, useEffect, useRef } from 'react';
import { HomePage } from '../../pages/HomePage';
import { SearchPage } from '../../pages/SearchPage';
import { LibraryPage } from '../../pages/LibraryPage';
import { PlaylistPage } from '../../pages/PlaylistPage';
import { ArtistPage } from '../../pages/ArtistPage';
import { MiniPlayer } from '../player/MiniPlayer';
import { ExpandedPlayer } from '../player/ExpandedPlayer';
import { AudioMediaElement } from '../player/AudioMediaElement';
import { AccountSwitcher } from './AccountSwitcher';
import { PaletteStudio } from '../theme/PaletteStudio';
import { FloatingNavigationDock, NavTab } from './FloatingNavigationDock';
import { SettingsPage } from '../../pages/SettingsPage';
import { bridgeClient, ExtensionConnectionState } from '../../api/bridgeClient';
import { ExtensionRequiredGate } from '../extension/ExtensionRequiredGate';
import { discordPresenceManager } from '../../api/discordPresence';
import { useTasteStore } from '../../store/tasteStore';

export const AppLayout: React.FC = () => {
  const [bridgeState, setBridgeState] = useState<ExtensionConnectionState>(bridgeClient.getConnectionState());
  const [isBridgeConnected, setIsBridgeConnected] = useState(bridgeClient.getIsAvailable());
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as NavTab;
      if (['home', 'search', 'library', 'settings'].includes(hash)) return hash;
    }
    return 'home';
  });
  const [previousTab, setPreviousTab] = useState<NavTab>('home');

  const [viewingPlaylist, setViewingPlaylist] = useState<{
    id: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    author?: string;
  } | null>(null);

  const [viewingArtist, setViewingArtist] = useState<{
    id?: string;
    name: string;
    imageUrl?: string;
  } | null>(null);

  const [isPaletteStudioOpen, setIsPaletteStudioOpen] = useState(false);
  const [isDockHidden, setIsDockHidden] = useState(false);

  const mainScrollRef = useRef<HTMLElement>(null);
  const { loadInitialData } = useTasteStore();

  useEffect(() => {
    const unsubState = bridgeClient.onStateChange((state) => {
      setBridgeState(state);
      if (state === 'connected') {
        loadInitialData();
        discordPresenceManager.init();
      }
    });

    const unsubAvail = bridgeClient.onAvailabilityChange((available) => {
      setIsBridgeConnected(available);
      if (available) {
        setBridgeState('connected');
        loadInitialData();
        discordPresenceManager.init();
      }
    });

    if (bridgeClient.getIsAvailable()) {
      loadInitialData();
      discordPresenceManager.init();
    }

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavTab;
      if (['home', 'search', 'library', 'settings'].includes(hash)) {
        setCurrentTab(hash);
        setViewingPlaylist(null);
        setViewingArtist(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      unsubState();
      unsubAvail();
      discordPresenceManager.destroy();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleSelectTab = (tab: NavTab) => {
    if (currentTab !== 'settings') {
      setPreviousTab(currentTab);
    }
    setCurrentTab(tab);
    setViewingPlaylist(null);
    setViewingArtist(null);
    window.location.hash = `#${tab}`;
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Scroll listener to toggle isDockHidden and coordinate MiniPlayer translation
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    let lastScrollTop = el.scrollTop;
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const current = el.scrollTop;
          const delta = current - lastScrollTop;

          if (delta > 10 && current > 80) {
            setIsDockHidden(true);
          } else if (delta < -10 || current <= 30) {
            setIsDockHidden(false);
          }

          lastScrollTop = Math.max(0, current);
          ticking = false;
        });
        ticking = true;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const isSubView = Boolean(viewingArtist || viewingPlaylist || currentTab === 'settings');

  const handleBack = () => {
    if (viewingArtist) {
      setViewingArtist(null);
    } else if (viewingPlaylist) {
      setViewingPlaylist(null);
    } else if (currentTab === 'settings') {
      handleSelectTab(previousTab || 'home');
    }
  };

  if (bridgeState === 'checking') {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          backgroundColor: 'var(--md-sys-color-surface, #121316)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          fontFamily: "'Roboto Flex', system-ui, sans-serif"
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.08)',
            borderTopColor: '#e53935',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#91909a', letterSpacing: '0.02em' }}>
          Connecting to OurTube Bridge...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (bridgeState === 'missing' || !isBridgeConnected) {
    return <ExtensionRequiredGate />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--md-sys-color-background)',
        color: 'var(--md-sys-color-on-background)',
        position: 'relative'
      }}
    >
      <AudioMediaElement />

      {/* Main Scrollable Viewport (Full Width, Edge-to-Edge) */}
      <main
        ref={mainScrollRef}
        id="main-viewport"
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: '24px 36px 140px 36px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Header Bar: Clean single unified app bar (Material 3 style) */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            zIndex: 30,
            gap: '16px'
          }}
        >
          {/* Left: Either Root Time Greeting/Account Switcher OR Subview Back Navigation */}
          {!isSubView ? (
            <AccountSwitcher variant="headerGreeting" onAccountChanged={() => {}} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <button
                onClick={handleBack}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--md-sys-color-on-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms cubic-bezier(0.2, 0, 0, 1)'
                }}
                title="Go Back"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  arrow_back
                </span>
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: 'var(--md-sys-color-on-surface)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {viewingArtist
                    ? viewingArtist.name
                    : viewingPlaylist
                    ? viewingPlaylist.title
                    : 'Settings'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--md-sys-color-on-surface-variant)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em'
                  }}
                >
                  {viewingArtist
                    ? 'Artist Profile'
                    : viewingPlaylist
                    ? 'Playlist'
                    : 'Preferences'}
                </span>
              </div>
            </div>
          )}

          {/* Right Header Actions: Minimal tactile buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Theme / Palette Button */}
            <button
              onClick={() => setIsPaletteStudioOpen(true)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'var(--md-sys-color-on-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title="Theme & Accent Palette"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                palette
              </span>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => {
                if (currentTab !== 'settings') {
                  setPreviousTab(currentTab);
                  handleSelectTab('settings');
                } else {
                  handleSelectTab(previousTab || 'home');
                }
              }}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor:
                  currentTab === 'settings'
                    ? 'var(--md-sys-color-primary)'
                    : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color:
                  currentTab === 'settings'
                    ? 'var(--md-sys-color-on-primary)'
                    : 'var(--md-sys-color-on-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              title="Settings"
              onMouseEnter={(e) => {
                if (currentTab !== 'settings') {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentTab !== 'settings') {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                }
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                settings
              </span>
            </button>
          </div>
        </header>

        {/* Viewport Dynamic Content */}
        <div style={{ flex: 1, width: '100%', maxWidth: '1440px', margin: '0 auto' }}>
          {currentTab === 'settings' ? (
            <SettingsPage onBack={() => handleSelectTab(previousTab || 'home')} />
          ) : viewingArtist ? (
            <ArtistPage
              artist={viewingArtist}
              onBack={() => setViewingArtist(null)}
              onOpenPlaylist={(pl) => {
                setViewingArtist(null);
                setViewingPlaylist(pl);
              }}
              onOpenArtist={(a) => {
                setViewingArtist(a);
              }}
            />
          ) : viewingPlaylist ? (
            <PlaylistPage
              playlist={viewingPlaylist}
              onBack={() => setViewingPlaylist(null)}
              onOpenArtist={(a) => {
                setViewingPlaylist(null);
                setViewingArtist(a);
              }}
            />
          ) : (
            <>
              {currentTab === 'home' && (
                <HomePage onOpenPlaylist={setViewingPlaylist} onOpenArtist={setViewingArtist} />
              )}
              {currentTab === 'search' && (
                <SearchPage onOpenPlaylist={setViewingPlaylist} onOpenArtist={setViewingArtist} />
              )}
              {currentTab === 'library' && (
                <LibraryPage onOpenPlaylist={setViewingPlaylist} onOpenArtist={setViewingArtist} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Persistent Mini Player (Parked Directly Above Floating Dock) */}
      <MiniPlayer isDockHidden={isDockHidden} onOpenArtist={setViewingArtist} />

      {/* Floating Material 3 Expressive Dock */}
      <FloatingNavigationDock
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isDockHidden={isDockHidden}
      />

      {/* Fullscreen Expanded Player */}
      <ExpandedPlayer />

      {/* Headless Native HTML5 Audio Media Element */}
      <AudioMediaElement />

      {/* Palette Studio Modal */}
      {isPaletteStudioOpen && (
        <PaletteStudio onClose={() => setIsPaletteStudioOpen(false)} />
      )}
    </div>
  );
};
