import React, { useState, useEffect, useMemo } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { useSettingsStore } from '../../store/settingsStore';
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

const SPEED_STEPS = [0.8, 1.0, 1.25, 1.5, 2.0];
const SLEEP_STEPS: (number | null)[] = [null, 15, 30, 60];

export const ExpandedPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackMode,
    repeatMode,
    isShuffled,
    isExpanded,
    isLyricsOpen,
    isQueueOpen,
    playerStyle,
    ambientBackground,
    queue,
    queueIndex,
    lyricsData,
    isLyricsLoading,
    playbackSpeed,
    sleepTimerMinutes,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    nextTrack,
    prevTrack,
    toggleRepeat,
    toggleShuffle,
    setExpanded,
    setLyricsOpen,
    setQueueOpen,
    setPlayerStyle,
    loadLyricsForTrack,
    setPlaybackSpeed,
    setSleepTimer
  } = usePlayerStore();

  const { isLiked, toggleLikeTrack } = useTasteStore();
  const { ambientIntensity, reduceMotion } = useSettingsStore();
  const [isStylePickerOpen, setIsStylePickerOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
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

  // Auto-load synced lyrics when ExpandedPlayer opens or track changes
  useEffect(() => {
    if (isExpanded && currentTrack && !lyricsData && !isLyricsLoading) {
      loadLyricsForTrack(currentTrack);
    }
  }, [isExpanded, currentTrack?.id, lyricsData, isLyricsLoading, loadLyricsForTrack]);

  // Synchronize playerStore sheet open state with desktop companion state
  useEffect(() => {
    if (isWideScreen && isExpanded) {
      if (isLyricsOpen) {
        setShowCompanion(true);
        setDesktopSideTab('lyrics');
      } else if (isQueueOpen) {
        setShowCompanion(true);
        setDesktopSideTab('queue');
      } else if (desktopSideTab !== 'stats') {
        setShowCompanion(false);
      }
    }
  }, [isLyricsOpen, isQueueOpen, isWideScreen, isExpanded]);

  // Global keyboard shortcuts while ExpandedPlayer is open
  useEffect(() => {
    if (!isExpanded || !currentTrack) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(Math.min(duration, currentTime + 5));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, currentTime - 5));
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'Escape') {
        if (isStylePickerOpen) {
          setIsStylePickerOpen(false);
        } else {
          setExpanded(false);
          setLyricsOpen(false);
          setQueueOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isExpanded,
    currentTrack,
    duration,
    currentTime,
    isStylePickerOpen,
    togglePlay,
    seek,
    toggleMute,
    setExpanded,
    setLyricsOpen,
    setQueueOpen
  ]);

  // Compute current active synced lyric line for inline preview pill
  const currentLyricLine = useMemo(() => {
    if (!lyricsData?.lines || lyricsData.lines.length === 0) return null;
    if (!lyricsData.synced) {
      return lyricsData.lines[0]?.text || null;
    }
    let activeText: string | null = null;
    for (let i = 0; i < lyricsData.lines.length; i++) {
      const line = lyricsData.lines[i];
      if (currentTime + 0.25 >= line.time) {
        if (line.text && line.text.trim().length > 0) {
          activeText = line.text.trim();
        }
      } else {
        break;
      }
    }
    return activeText;
  }, [lyricsData, currentTime]);

  if (!isExpanded || !currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const currentQueueEntry = queue[queueIndex];
  const playingSourceTitle =
    currentQueueEntry?.sourceTitle || currentTrack.album || 'Studio Session';

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

  const openSpecsTab = () => {
    if (isWideScreen) {
      if (showCompanion && desktopSideTab === 'stats') {
        setShowCompanion(false);
      } else {
        setShowCompanion(true);
        setDesktopSideTab('stats');
        setLyricsOpen(false);
        setQueueOpen(false);
      }
    }
  };

  const cyclePlaybackSpeed = () => {
    const idx = SPEED_STEPS.indexOf(playbackSpeed);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    setPlaybackSpeed(next);
  };

  const cycleSleepTimer = () => {
    const idx = SLEEP_STEPS.indexOf(sleepTimerMinutes);
    const next = SLEEP_STEPS[(idx + 1) % SLEEP_STEPS.length];
    setSleepTimer(next);
  };

  // Dynamically renders the selected player style with responsive stage mode awareness
  const renderActivePlayerStyle = (stageMode: boolean = false) => {
    const isLyricsVisible = isWideScreen
      ? showCompanion && desktopSideTab === 'lyrics'
      : isLyricsOpen;

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
            showLyrics={isLyricsVisible}
            currentLyricLine={currentLyricLine}
            queueCount={queue.length}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onNext={nextTrack}
            onPrev={prevTrack}
            onToggleLike={() => toggleLikeTrack(currentTrack)}
            onToggleRepeat={toggleRepeat}
            onToggleShuffle={toggleShuffle}
            onToggleLyrics={openLyricsTab}
            onOpenQueue={openQueueTab}
            onOpenSpecs={openSpecsTab}
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
            currentLyricLine={isLyricsVisible ? null : currentLyricLine}
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
            showLyrics={isLyricsVisible}
            currentLyricPreview={currentLyricLine}
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
            showLyrics={isLyricsVisible}
            currentLyricLine={currentLyricLine}
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
            currentLyricLine={isLyricsVisible ? null : currentLyricLine}
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
        enabled={ambientBackground && !reduceMotion}
        opacity={Math.max(0.15, Math.min(0.95, ambientIntensity * 0.75))}
      />

      {/* Top Header Bar: M3 Expressive Chrome with Quick Style Switcher & Audio Pod */}
      <header
        style={{
          height: '68px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          gap: '12px',
          zIndex: 50,
          backdropFilter: 'blur(20px)',
          backgroundColor: 'transparent'
        }}
      >
        {/* Left: Collapse Button + Playing Context Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
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
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            title="Collapse player (Esc)"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--md-sys-color-surface-container-high)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--md-sys-color-surface-container)';
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
              expand_more
            </span>
          </button>

          {isWideScreen && (
            <div
              onClick={openQueueTab}
              style={{
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                maxWidth: '200px'
              }}
              title="Click to view playback queue"
            >
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-primary)'
                }}
              >
                PLAYING FROM
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-on-surface)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {playingSourceTitle}
              </span>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right Header Action Deck: Speed/Sleep, Volume Pod, Style Modal, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Playback Speed Cycle Chip */}
          {isWideScreen && (
            <button
              onClick={cyclePlaybackSpeed}
              style={{
                height: '38px',
                padding: '0 11px',
                borderRadius: playbackSpeed !== 1 ? '12px' : '9999px',
                backgroundColor:
                  playbackSpeed !== 1
                    ? 'var(--md-sys-color-secondary-container)'
                    : 'var(--md-sys-color-surface-container)',
                color:
                  playbackSpeed !== 1
                    ? 'var(--md-sys-color-on-secondary-container)'
                    : 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                fontSize: '11px',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
              title="Click to cycle playback speed"
            >
              {playbackSpeed}x
            </button>
          )}

          {/* Sleep Timer Cycle Chip */}
          {isWideScreen && (
            <button
              onClick={cycleSleepTimer}
              style={{
                height: '38px',
                padding: sleepTimerMinutes ? '0 12px' : '0',
                width: sleepTimerMinutes ? 'auto' : '38px',
                borderRadius: sleepTimerMinutes ? '12px' : '50%',
                backgroundColor: sleepTimerMinutes
                  ? 'var(--md-sys-color-tertiary-container, var(--md-sys-color-primary-container))'
                  : 'var(--md-sys-color-surface-container)',
                color: sleepTimerMinutes
                  ? 'var(--md-sys-color-on-tertiary-container, var(--md-sys-color-on-primary-container))'
                  : 'var(--md-sys-color-on-surface)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 200ms ease'
              }}
              title={
                sleepTimerMinutes
                  ? `Sleep timer: ${sleepTimerMinutes}m (Click to change)`
                  : 'Set sleep timer (15m / 30m / 60m)'
              }
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                bedtime
              </span>
              {sleepTimerMinutes && <span>{sleepTimerMinutes}m</span>}
            </button>
          )}

          {/* Desktop Expandable Volume Pod */}
          {isWideScreen && (
            <div
              onMouseEnter={() => setIsVolumeHovered(true)}
              onMouseLeave={() => setIsVolumeHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '38px',
                padding: isVolumeHovered ? '0 12px 0 6px' : '0 4px',
                borderRadius: '9999px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                transition: 'padding 200ms ease'
              }}
            >
              <button
                onClick={toggleMute}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isMuted
                    ? 'var(--md-sys-color-error)'
                    : 'var(--md-sys-color-on-surface)',
                  cursor: 'pointer',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                  {isMuted || volume === 0
                    ? 'volume_off'
                    : volume > 0.5
                    ? 'volume_up'
                    : 'volume_down'}
                </span>
              </button>
              <div
                style={{
                  width: isVolumeHovered ? '72px' : '0px',
                  opacity: isVolumeHovered ? 1 : 0,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'width 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease'
                }}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  style={{
                    width: '68px',
                    accentColor: 'var(--md-sys-color-primary)',
                    cursor: 'pointer'
                  }}
                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                />
              </div>
            </div>
          )}

          {/* Player Style Selector Modal Button */}
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
            title={`Player Style Gallery (${playerStyle})`}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--md-sys-color-surface-container-high)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--md-sys-color-surface-container)';
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
              (e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--md-sys-color-surface-container-high)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--md-sys-color-surface-container)';
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
            height: 'calc(100vh - 68px)',
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
          {/* Primary Stage: The Chosen Player Style */}
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

          {/* Secondary Stage: Companion Panel (Lyrics / Queue / Stats) */}
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
                      borderRadius: desktopSideTab === 'queue' ? '14px' : '9999px',
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
                      transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                      borderRadius: desktopSideTab === 'lyrics' ? '14px' : '9999px',
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
                      transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                      borderRadius: desktopSideTab === 'stats' ? '14px' : '9999px',
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
                      transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
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
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'var(--md-sys-color-surface-container-high)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'var(--md-sys-color-surface-container)';
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
