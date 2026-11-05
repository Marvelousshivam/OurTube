import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { VideoPlayerView } from './VideoPlayerView';
import { LyricsSheet } from '../lyrics/LyricsSheet';
import { QueueSheet } from '../queue/QueueSheet';
import { ChromaticMistCanvas } from './ChromaticMistCanvas';
import { NerdStatsCard } from './NerdStatsCard';
import { PlayerStylePickerModal } from './styles/PlayerStylePickerModal';
import { EditorialPlayer } from './styles/EditorialPlayer';
import { ClassicPlayer } from './styles/ClassicPlayer';
import { BentoPlayer } from './styles/BentoPlayer';
import { CanvasPlayer } from './styles/CanvasPlayer';
import { GesturePlayer } from './styles/GesturePlayer';
import { HeroPlayer } from './styles/HeroPlayer';
import { MorphPlayer } from './styles/MorphPlayer';
import { DialPlayer } from './styles/DialPlayer';

export const ExpandedPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackMode,
    repeatMode,
    isShuffled,
    isExpanded,
    isLyricsOpen,
    isQueueOpen,
    playerStyle,
    ambientBackground,
    streamAudioUrl,
    queue,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    setPlaybackMode,
    toggleRepeat,
    toggleShuffle,
    setExpanded,
    setLyricsOpen,
    setQueueOpen,
    setPlayerStyle
  } = usePlayerStore();

  const { isLiked, toggleLikeTrack } = useTasteStore();
  const [isStylePickerOpen, setIsStylePickerOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [desktopSideTab, setDesktopSideTab] = useState<'lyrics' | 'queue' | 'stats'>('lyrics');
  const [isWideScreen, setIsWideScreen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  // Companion panel visibility on desktop/widescreen (persisted in localStorage)
  const [showCompanion, setShowCompanion] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ourtube_show_companion');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });

  const toggleCompanion = () => {
    setShowCompanion((prev) => {
      const next = !prev;
      localStorage.setItem('ourtube_show_companion', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Synchronize playerStore sheet open state with desktop companion state
  useEffect(() => {
    if (isWideScreen && isExpanded) {
      if (isLyricsOpen) {
        setShowCompanion(true);
        setDesktopSideTab('lyrics');
      } else if (isQueueOpen) {
        setShowCompanion(true);
        setDesktopSideTab('queue');
      } else {
        setShowCompanion(false);
      }
    }
  }, [isLyricsOpen, isQueueOpen, isWideScreen, isExpanded]);

  if (!isExpanded || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);

  const toggleBrowserFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const openLyricsTab = () => {
    if (isWideScreen) {
      if (showCompanion && desktopSideTab === 'lyrics') {
        setShowCompanion(false);
        setLyricsOpen(false);
      } else {
        setShowCompanion(true);
        setDesktopSideTab('lyrics');
        setLyricsOpen(true);
        setQueueOpen(false);
      }
    } else {
      setLyricsOpen(!isLyricsOpen);
    }
  };

  const openQueueTab = () => {
    if (isWideScreen) {
      if (showCompanion && desktopSideTab === 'queue') {
        setShowCompanion(false);
        setQueueOpen(false);
      } else {
        setShowCompanion(true);
        setDesktopSideTab('queue');
        setQueueOpen(true);
        setLyricsOpen(false);
      }
    } else {
      setQueueOpen(!isQueueOpen);
    }
  };

  // Dynamically renders the selected player style with responsive stage mode awareness
  const renderActivePlayerStyle = (stageMode: boolean = false) => {
    switch (playerStyle) {
      case 'EDITORIAL':
        return (
          <EditorialPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            repeatMode={repeatMode}
            isShuffled={isShuffled}
            stageMode={stageMode}
            isWideScreen={isWideScreen}
            showLyrics={isWideScreen ? (showCompanion && desktopSideTab === 'lyrics') : isLyricsOpen}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onToggleLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
          />
        );
      case 'CLASSIC':
        return (
          <ClassicPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            repeatMode={repeatMode}
            isShuffled={isShuffled}
            stageMode={stageMode}
            isWideScreen={isWideScreen}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onOpenLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
          />
        );
      case 'BENTO':
        return (
          <BentoPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            repeatMode={repeatMode}
            isShuffled={isShuffled}
            stageMode={stageMode}
            isWideScreen={isWideScreen}
            showLyrics={isWideScreen ? showCompanion : isLyricsOpen}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onToggleLyrics={isWideScreen ? toggleCompanion : () => setLyricsOpen(!isLyricsOpen)}
            onOpenQueue={openQueueTab}
          />
        );
      case 'HERO':
        return (
          <HeroPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            repeatMode={repeatMode}
            isShuffled={isShuffled}
            stageMode={stageMode}
            isWideScreen={isWideScreen}
            showLyrics={isWideScreen ? showCompanion : isLyricsOpen}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onToggleLyrics={isWideScreen ? toggleCompanion : () => setLyricsOpen(!isLyricsOpen)}
            onOpenLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
          />
        );
      case 'CANVAS':
        return (
          <CanvasPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            repeatMode={repeatMode}
            isShuffled={isShuffled}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onOpenLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
          />
        );
      case 'MORPH':
        return (
          <MorphPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            repeatMode={repeatMode}
            isShuffled={isShuffled}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onOpenLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
          />
        );
      case 'DIAL':
        return (
          <DialPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            repeatMode={repeatMode}
            isShuffled={isShuffled}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onOpenLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
          />
        );
      case 'GESTURE':
      default:
        return (
          <GesturePlayer
            track={currentTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isLiked={liked}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onOpenLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
          />
        );
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        zIndex: 100,
        backgroundColor: 'var(--md-sys-color-background)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'expressiveExpand 360ms cubic-bezier(0.2, 0.9, 0.3, 1)'
      }}
    >
      <style>{`
        @keyframes expressiveExpand {
          0% {
            opacity: 0;
            transform: scale(0.96) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes fadeInSlide {
          0% {
            opacity: 0;
            transform: translateX(24px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      {/* Chromatic Mist Ambient Background Engine */}
      <ChromaticMistCanvas
        artworkUrl={currentTrack.highResThumbnailUrl || currentTrack.thumbnailUrl}
        enabled={ambientBackground}
        opacity={0.55}
      />

      {/* Top Header Bar: Clean, minimalist Koda-inspired chrome; NO slop, NO redundant buttons */}
      <header
        style={{
          height: '64px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          zIndex: 50,
          backdropFilter: 'blur(20px)',
          backgroundColor: 'transparent'
        }}
      >
        {/* Collapse Button */}
        <button
          onClick={() => {
            setExpanded(false);
            setLyricsOpen(false);
            setQueueOpen(false);
          }}
          style={{
            background: 'var(--md-sys-color-surface-container)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            color: 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            width: '42px',
            height: '42px',
            transition: 'all 0.15s ease'
          }}
          title="Collapse player"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container)';
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
            expand_more
          </span>
        </button>

        {/* Center: Clean Empty Negative Space (All branding slop removed) */}
        <div style={{ flex: 1 }} />

        {/* Right Header Action Deck */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Player Style Selector Button */}
          <button
            onClick={() => setIsStylePickerOpen(true)}
            style={{
              background: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title={`Style: ${playerStyle}`}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container)';
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              palette
            </span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleBrowserFullScreen}
            style={{
              background: 'var(--md-sys-color-surface-container)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title={isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container)';
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              {isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      {isWideScreen ? (
        /* ================= WIDESCREEN ADAPTIVE DESKTOP LAYOUT ================= */
        <div
          style={{
            flex: 1,
            minHeight: 0,
            height: 'calc(100vh - 64px)',
            display: 'grid',
            gridTemplateColumns: showCompanion ? 'minmax(420px, 46vw) 1fr' : '1fr',
            maxWidth: showCompanion ? '1600px' : '1480px',
            width: '100%',
            margin: '0 auto',
            gap: showCompanion ? '48px' : '0px',
            padding: showCompanion ? '12px 40px 24px 40px' : '16px 48px 24px 48px',
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
            transition: 'all 400ms cubic-bezier(0.2, 0.9, 0.3, 1)'
          }}
        >
          {/* Primary Stage: The Chosen Player Style (Editorial / Classic / Bento / Hero / Canvas / Gesture / Morph / Dial) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              minHeight: 0,
              maxHeight: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              position: 'relative',
              width: '100%',
              margin: '0 auto'
            }}
          >
            {playbackMode === 'video' ? (
              <div style={{ width: '100%', margin: 'auto' }}>
                <VideoPlayerView />
              </div>
            ) : (
              renderActivePlayerStyle(showCompanion)
            )}
          </div>

          {/* Secondary Stage: Companion Panel (Lyrics / Queue / Stats) - Only rendered when showCompanion is true */}
          {showCompanion && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
                animation: 'fadeInSlide 320ms cubic-bezier(0.2, 0.9, 0.3, 1)'
              }}
            >
              {/* Connected Segmented Tab Selector Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '16px',
                  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setDesktopSideTab('queue');
                      setQueueOpen(true);
                      setLyricsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '9999px',
                      backgroundColor:
                        desktopSideTab === 'queue'
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container)',
                      color:
                        desktopSideTab === 'queue'
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                      queue_music
                    </span>
                    Up next ({queue.length})
                  </button>

                  <button
                    onClick={() => {
                      setDesktopSideTab('lyrics');
                      setLyricsOpen(true);
                      setQueueOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '9999px',
                      backgroundColor:
                        desktopSideTab === 'lyrics'
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container)',
                      color:
                        desktopSideTab === 'lyrics'
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                      lyrics
                    </span>
                    Lyrics
                  </button>

                  <button
                    onClick={() => {
                      setDesktopSideTab('stats');
                      setLyricsOpen(false);
                      setQueueOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 18px',
                      borderRadius: '9999px',
                      backgroundColor:
                        desktopSideTab === 'stats'
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container)',
                      color:
                        desktopSideTab === 'stats'
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                      query_stats
                    </span>
                    Specs
                  </button>
                </div>

                {/* Companion Close Button */}
                <button
                  onClick={() => {
                    setShowCompanion(false);
                    setLyricsOpen(false);
                    setQueueOpen(false);
                  }}
                  style={{
                    background: 'var(--md-sys-color-surface-container)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--md-sys-color-on-surface)',
                    transition: 'all 150ms ease'
                  }}
                  title="Hide companion panel"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container-high)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container)';
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                    close
                  </span>
                </button>
              </div>

              {/* Stage Body Viewport */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {desktopSideTab === 'lyrics' && <LyricsSheet isEmbedded />}
                {desktopSideTab === 'queue' && <QueueSheet isEmbedded />}
                {desktopSideTab === 'stats' && (
                  <div style={{ overflowY: 'auto', height: '100%', padding: '20px 8px 120px 8px' }}>
                    <NerdStatsCard track={currentTrack} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= COMPACT / MOBILE SINGLE-COLUMN VIEW ================= */
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 10
          }}
        >
          {isLyricsOpen ? (
            <LyricsSheet />
          ) : isQueueOpen ? (
            <QueueSheet />
          ) : playbackMode === 'video' ? (
            <div
              style={{
                width: '100%',
                maxWidth: '960px',
                margin: 'auto',
                padding: '16px'
              }}
            >
              <VideoPlayerView />
            </div>
          ) : (
            renderActivePlayerStyle(false)
          )}
        </div>
      )}

      {/* Style Picker Modal */}
      <PlayerStylePickerModal
        currentStyle={playerStyle}
        isOpen={isStylePickerOpen}
        onSelectStyle={setPlayerStyle}
        onClose={() => setIsStylePickerOpen(false)}
      />
    </div>
  );
};
