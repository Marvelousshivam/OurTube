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
import { playbackReportingManager } from '../../api/playbackReporting';
import { useTasteStore } from '../../store/tasteStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { M3LoadingIndicator } from '../common/M3LoadingIndicator';
import { KeyboardShortcutsModal } from '../settings/KeyboardShortcutsModal';
import { ModeMorphButton } from './ModeMorphButton';
import { NotificationBellButton } from './NotificationBellButton';
import { NotificationsSheet } from './NotificationsSheet';
import { VideoHomePage } from '../../pages/VideoHomePage';
import { SubscriptionsPage } from '../../pages/SubscriptionsPage';
import { VideoSearchPage } from '../../pages/VideoSearchPage';
import { VideoWatchOverlay } from '../video/VideoWatchOverlay';
import { MiniVideoPlayer } from '../video/MiniVideoPlayer';
import { ChannelSheet } from '../video/ChannelSheet';
import { usePlayerStore, loadActiveVideoSnapshot } from '../../store/playerStore';
import { VideoItem } from '../../types';

const VALID_NAV_TABS: NavTab[] = ['home', 'search', 'subscriptions', 'library', 'settings'];

function parseRouteFromWindow(): {
  tab: NavTab | null;
  videoId: string | null;
  startTimeSec: number | null;
} {
  if (typeof window === 'undefined') {
    return { tab: 'home', videoId: null, startTimeSec: null };
  }

  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const [hashPath, hashQuery = ''] = rawHash.split('?');
  const hashParams = new URLSearchParams(hashQuery);
  const searchParams = new URLSearchParams(window.location.search);

  const rawVideoId =
    hashParams.get('v') ||
    searchParams.get('v') ||
    (hashPath.startsWith('watch/') ? hashPath.slice('watch/'.length) : null);
  const trimmedId = rawVideoId ? rawVideoId.trim() : null;
  const videoId = trimmedId && /^[A-Za-z0-9_-]{11}$/.test(trimmedId) ? trimmedId : null;

  const rawTime = hashParams.get('t') || searchParams.get('t');
  let startTimeSec: number | null = null;
  if (rawTime) {
    const numeric = parseInt(rawTime.replace(/s$/i, ''), 10);
    if (!Number.isNaN(numeric) && numeric >= 0) {
      startTimeSec = numeric;
    }
  }

  const cleanTab = hashPath as NavTab;
  const tab = VALID_NAV_TABS.includes(cleanTab) ? cleanTab : null;

  return {
    tab,
    videoId: videoId ? videoId.trim() : null,
    startTimeSec
  };
}

function resolveVideoItemForId(videoId: string): VideoItem {
  const fromSnapshot = loadActiveVideoSnapshot(videoId);
  if (fromSnapshot) return fromSnapshot;

  const fromHistory = useTasteStore
    .getState()
    .videoHistory.find((v) => v.id === videoId);
  if (fromHistory) {
    return {
      id: fromHistory.id,
      title: fromHistory.title,
      channelName: fromHistory.channelName,
      channelId: fromHistory.channelId,
      channelIconUrl: fromHistory.channelIconUrl,
      duration: fromHistory.duration || 180,
      durationFormatted: '',
      thumbnailUrl:
        fromHistory.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      viewCount: fromHistory.viewCountText || ''
    };
  }

  return {
    id: videoId,
    title: 'Loading video...',
    channelName: '',
    duration: 180,
    durationFormatted: '',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    viewCount: ''
  };
}

export const AppLayout: React.FC = () => {
  const { playVideo } = usePlayerStore();
  const hasRestoredInitialUrlRef = useRef(false);
  const [videoMode, setVideoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('koda_home_mode') === 'video';
    }
    return false;
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  const handleToggleVideoMode = (mode: boolean) => {
    setVideoMode(mode);
    try {
      localStorage.setItem('koda_home_mode', mode ? 'video' : 'music');
    } catch {}
  };

  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  useKeyboardShortcuts({ onOpenShortcuts: () => setIsShortcutsModalOpen(true) });
  const [bridgeState, setBridgeState] = useState<ExtensionConnectionState>(bridgeClient.getConnectionState());
  const [isBridgeConnected, setIsBridgeConnected] = useState(bridgeClient.getIsAvailable());
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    const parsed = parseRouteFromWindow();
    return parsed.tab || 'home';
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
  const { loadInitialData } = useTasteStore();
  const [accountKey, setAccountKey] = useState<string>(() => {
    return bridgeClient.getAuthState().selectedChannelId || 'default';
  });

  useEffect(() => {
    const unsub = bridgeClient.onAccountChange((auth) => {
      const channelId = auth.selectedChannelId || 'default';
      setAccountKey(channelId);
      loadInitialData(channelId);
    });
    return () => unsub();
  }, [loadInitialData]);
  const [isDockHidden, setIsDockHidden] = useState(false);

  const mainScrollRef = useRef<HTMLElement>(null);
  const lastScrollTopRef = useRef(0);
  const accumulatedDeltaRef = useRef(0);

  useEffect(() => {
    const unsubState = bridgeClient.onStateChange((state) => {
      setBridgeState(state);
      if (state === 'connected') {
        loadInitialData();
        discordPresenceManager.init();
        playbackReportingManager.init();
      }
    });

    const unsubAvail = bridgeClient.onAvailabilityChange((available) => {
      setIsBridgeConnected(available);
      if (available) {
        setBridgeState('connected');
        loadInitialData();
        discordPresenceManager.init();
        playbackReportingManager.init();
      }
    });

    if (bridgeClient.getIsAvailable()) {
      setBridgeState('connected');
      setIsBridgeConnected(true);
      loadInitialData();
      discordPresenceManager.init();
      playbackReportingManager.init();
    }

    const handleUrlRouteSync = () => {
      const { tab, videoId, startTimeSec } = parseRouteFromWindow();
      if (videoId) {
        const playerState = usePlayerStore.getState();
        if (playerState.currentVideo?.id !== videoId || !playerState.isVideoWatchOpen) {
          const item = resolveVideoItemForId(videoId);
          playerState.playVideo(item);
          if (startTimeSec !== null && startTimeSec > 0) {
            playerState.seek(startTimeSec);
          }
        }
        return;
      }

      // Navigated back from #watch?v=... to a normal tab (#home, #subscriptions, etc.)
      const playerState = usePlayerStore.getState();
      if (playerState.isVideoWatchOpen) {
        usePlayerStore.setState({
          isVideoWatchOpen: false,
          isMiniVideoPlayerOpen: Boolean(playerState.currentVideo)
        });
      }

      if (tab) {
        setCurrentTab(tab);
        setViewingPlaylist(null);
        setViewingArtist(null);
      }
    };

    window.addEventListener('hashchange', handleUrlRouteSync);
    window.addEventListener('popstate', handleUrlRouteSync);

    return () => {
      unsubState();
      unsubAvail();
      discordPresenceManager.destroy();
      window.removeEventListener('hashchange', handleUrlRouteSync);
      window.removeEventListener('popstate', handleUrlRouteSync);
    };
  }, []);

  // Restore active video from URL (#watch?v=<videoId>) on initial page load / refresh once bridge is connected
  useEffect(() => {
    if (!isBridgeConnected || hasRestoredInitialUrlRef.current) return;
    hasRestoredInitialUrlRef.current = true;

    const { videoId, startTimeSec } = parseRouteFromWindow();
    if (videoId) {
      const item = resolveVideoItemForId(videoId);
      playVideo(item);
      if (startTimeSec !== null && startTimeSec > 0) {
        usePlayerStore.getState().seek(startTimeSec);
      }
    }
  }, [isBridgeConnected, playVideo]);

  const handleViewportScroll = (e: React.UIEvent<HTMLElement>) => {
    const current = e.currentTarget.scrollTop;
    const delta = current - lastScrollTopRef.current;

    // Reset dock to visible when near the top of the page
    if (current <= 40) {
      setIsDockHidden(false);
      accumulatedDeltaRef.current = 0;
      lastScrollTopRef.current = current;
      return;
    }

    // Reset accumulated delta if direction changed
    if ((delta > 0 && accumulatedDeltaRef.current < 0) || (delta < 0 && accumulatedDeltaRef.current > 0)) {
      accumulatedDeltaRef.current = 0;
    }
    accumulatedDeltaRef.current += delta;

    // Scrolling down: hide dock after moving 30px downwards
    if (accumulatedDeltaRef.current > 30) {
      setIsDockHidden(true);
    }
    // Scrolling up: show dock after moving 20px upwards
    else if (accumulatedDeltaRef.current < -20) {
      setIsDockHidden(false);
    }

    lastScrollTopRef.current = current;
  };

  const handleSelectTab = (tab: NavTab) => {
    if (currentTab !== 'settings') {
      setPreviousTab(currentTab);
    }
    setCurrentTab(tab);
    setViewingPlaylist(null);
    setViewingArtist(null);
    window.location.hash = `#${tab}`;
    setIsDockHidden(false);
    accumulatedDeltaRef.current = 0;
    lastScrollTopRef.current = 0;
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
          backgroundColor: 'var(--md-sys-color-background, #121316)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <M3LoadingIndicator
          size="xl"
          contained
          message="Connecting to OurTube Bridge..."
        />
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
        onScroll={handleViewportScroll}
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: '18px 36px 160px 36px',
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
            marginBottom: '14px',
            zIndex: 30,
            gap: '16px'
          }}
        >
          {/* Left: Either Root Time Greeting/Account Switcher OR Subview Back Navigation */}
          {!isSubView ? (
            <AccountSwitcher
              variant="headerGreeting"
              onAccountChanged={() => {
                const currentAuth = bridgeClient.getAuthState();
                const channelId = currentAuth.selectedChannelId || `${Date.now()}`;
                setAccountKey(channelId);
                loadInitialData(channelId);
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <button
                onClick={handleBack}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  color: 'var(--md-sys-color-on-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease'
                }}
                title="Go Back"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
                  e.currentTarget.style.transform = 'scale(1.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.92)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1.06)';
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
                  arrow_back
                </span>
              </button>

              <div
                key={(viewingArtist ? viewingArtist.name : viewingPlaylist ? viewingPlaylist.id : currentTab) + '-title'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  animation: 'm3TextSlideUp 260ms var(--m3-ease-emphasized-decelerate) both'
                }}
              >
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
            {/* Koda Mode Morph Button (Music ⟷ Video) */}
            <ModeMorphButton
              videoMode={videoMode}
              onToggle={handleToggleVideoMode}
            />

            {/* Notification Bell Button (Matching Koda) */}
            <NotificationBellButton
              onClick={() => setIsNotificationsOpen(true)}
              hasUnread={hasUnreadNotifications}
            />

            {/* Settings Button: shown when not on settings */}
            {currentTab !== 'settings' && (
              <button
                onClick={() => {
                  setPreviousTab(currentTab);
                  handleSelectTab('settings');
                }}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  color: 'var(--md-sys-color-on-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                title="Settings"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)';
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                  settings
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Viewport Dynamic Content with Material 3 Expressive View Transitions */}
        <div
          key={
            viewingArtist
              ? `artist-${viewingArtist.name}`
              : viewingPlaylist
              ? `playlist-${viewingPlaylist.id}`
              : currentTab
          }
          style={{
            flex: 1,
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            animation: isSubView
              ? 'm3SubViewEnter 340ms var(--m3-ease-emphasized-decelerate) both'
              : 'm3PageViewEnter 280ms var(--m3-ease-emphasized-decelerate) both'
          }}
        >
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
                videoMode ? (
                  <VideoHomePage
                    key={`home_video_${accountKey}`}
                    onPlayVideo={(video) => playVideo(video)}
                    mode="home"
                  />
                ) : (
                  <HomePage
                    key={`home_music_${accountKey}`}
                    onOpenPlaylist={setViewingPlaylist}
                    onOpenArtist={setViewingArtist}
                  />
                )
              )}
              {currentTab === 'subscriptions' && (
                <SubscriptionsPage
                  key={`subs_${accountKey}`}
                  onPlayVideo={(video) => playVideo(video)}
                />
              )}
              {currentTab === 'search' && (
                videoMode ? (
                  <VideoSearchPage
                    key={`search_video_${accountKey}`}
                    onPlayVideo={(video) => playVideo(video)}
                    onOpenPlaylist={setViewingPlaylist}
                  />
                ) : (
                  <SearchPage
                    key={`search_music_${accountKey}`}
                    onOpenPlaylist={setViewingPlaylist}
                    onOpenArtist={setViewingArtist}
                  />
                )
              )}
              {currentTab === 'library' && (
                <LibraryPage
                  key={`library_${accountKey}_${videoMode ? 'video' : 'music'}`}
                  videoMode={videoMode}
                  onPlayVideo={(video) => playVideo(video)}
                  onOpenPlaylist={setViewingPlaylist}
                  onOpenArtist={setViewingArtist}
                />
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
        videoMode={videoMode}
      />

      {/* Fullscreen Expanded Audio Player */}
      <ExpandedPlayer />

      {/* Full Video Watch Overlay (No Iframe) */}
      <VideoWatchOverlay />

      {/* Floating Mini Video Player */}
      <MiniVideoPlayer />
      <ChannelSheet />

      {/* Notifications Bottom Sheet (Matching Koda) */}
      <NotificationsSheet
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadChange={setHasUnreadNotifications}
        onSelectVideo={(v) => {
          if (v.id && v.title) {
            playVideo({
              id: v.id,
              title: v.title,
              channelName: v.channelName || 'YouTube Creator',
              thumbnailUrl: v.thumbnailUrl || '',
              duration: 240,
              durationFormatted: '4:00',
              viewCount: 'Recommended'
            });
          }
        }}
      />

      {/* Palette Studio Modal */}
      {isPaletteStudioOpen && (
        <PaletteStudio onClose={() => setIsPaletteStudioOpen(false)} />
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      {isShortcutsModalOpen && (
        <KeyboardShortcutsModal onClose={() => setIsShortcutsModalOpen(false)} />
      )}
    </div>
  );
};
