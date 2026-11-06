import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { NativeVideoPlayerEngine } from './NativeVideoPlayerEngine';
import { VideoCommentsSheet } from './VideoCommentsSheet';
import { KodaVideoTitleCard } from './KodaVideoTitleCard';
import { KodaPlaybackSettingsSheet } from './KodaPlaybackSettingsSheet';
import { VideoItem, VideoWatchDetails, VideoCommentItem } from '../../types';
import { innertubeService } from '../../api/innertubeService';
import { M3LoadingIndicator } from '../common/M3LoadingIndicator';

export const VideoWatchOverlay: React.FC = () => {
  const {
    currentVideo,
    isVideoWatchOpen,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isBuffering,
    videoPlaybackError,
    setVideoPlaybackError,
    togglePlay,
    seek,
    minimizeVideo,
    closeVideo,
    listenAsMusic,
    playVideo,
    videoQuality,
    setVideoQuality,
    setHoldTo2x,
    playbackSpeed,
    audioTracks,
    selectedAudioTrackId
  } = usePlayerStore();

  const [showControls, setShowControls] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [watchDetails, setWatchDetails] = useState<VideoWatchDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<VideoItem[]>([]);
  const [commentsList, setCommentsList] = useState<VideoCommentItem[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isCommentsSheetOpen, setIsCommentsSheetOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'quality' | 'speed' | 'audio'>('quality');
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [scrubberHoverRatio, setScrubberHoverRatio] = useState<number | null>(null);
  const [scrubberHoverTime, setScrubberHoverTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [useEmbedPlayer, setUseEmbedPlayer] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [clickPlayRipple, setClickPlayRipple] = useState<'play' | 'pause' | null>(null);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [isHolding2x, setIsHolding2x] = useState(false);
  const [seekRipple, setSeekRipple] = useState<{ side: 'left' | 'right'; amount: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const seekRippleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const openSettings = (tab: 'quality' | 'speed' | 'audio' = 'quality') => {
    setSettingsInitialTab(tab);
    setIsSettingsSheetOpen(true);
  };

  // Reset state on new video
  useEffect(() => {
    setUseEmbedPlayer(false);
    setIsDescriptionExpanded(false);
    setIsCommentsSheetOpen(false);
    setCommentsList([]);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentVideo?.id]);

  // Load authentic watch details from /youtubei/v1/next
  useEffect(() => {
    if (!currentVideo?.id) return;
    let isCancelled = false;
    setIsLoadingDetails(true);

    innertubeService
      .getVideoWatchDetails(currentVideo.id)
      .then((details) => {
        if (isCancelled) return;
        setWatchDetails(details);
        setIsLoadingDetails(false);

        if (details.relatedVideos && details.relatedVideos.length > 0) {
          setRelatedVideos(details.relatedVideos);
        } else {
          // Fallback to channel recommendations
          innertubeService
            .search(`${details.channel?.name || currentVideo.channelName} recommendations`, 'all')
            .then((tracks) => {
              if (isCancelled) return;
              setRelatedVideos(
                tracks.slice(0, 12).map((t) => ({
                  id: t.id,
                  title: t.title,
                  channelName: t.artist,
                  channelId: t.artistId,
                  thumbnailUrl: t.highResThumbnailUrl || t.thumbnailUrl,
                  duration: t.duration || 240,
                  durationFormatted: `${Math.floor((t.duration || 240) / 60)}:${String((t.duration || 240) % 60).padStart(2, '0')}`,
                  viewCount: `${Math.floor(Math.random() * 400 + 40)}K views`,
                  uploadedDate: 'Recommended'
                }))
              );
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn('[VideoWatchOverlay] Error loading watch details:', err);
        setIsLoadingDetails(false);
      });

    // Also fetch comments for inline desktop section
    setIsLoadingComments(true);
    innertubeService
      .getVideoComments(currentVideo.id)
      .then((comments) => {
        if (isCancelled) return;
        setCommentsList(comments);
        setIsLoadingComments(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setIsLoadingComments(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentVideo?.id]);

  // Auto-hide controls after 3s of inactivity
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setIsQualityMenuOpen(false);
      }, 3000);
    }
  };

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Fullscreen sync listener
  useEffect(() => {
    const onFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
      document.removeEventListener('MSFullscreenChange', onFsChange);
    };
  }, []);

  const handleFullscreenToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isCurrentlyFullscreen = Boolean(
      document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement ||
        isFullscreen
    );

    if (isCurrentlyFullscreen) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    } else {
      const target = videoViewportRef.current || containerRef.current;
      if (target?.requestFullscreen) {
        target.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else if ((target as any)?.webkitRequestFullscreen) {
        (target as any).webkitRequestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    }
  };

  // Hold-to-2x speed gesture handlers (Koda Signature Interaction)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isLongPressRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsHolding2x(true);
      setHoldTo2x(true);
    }, 280);
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      setIsHolding2x(false);
      setHoldTo2x(false);
    }
  };

  // Double-tap seek & single-tap play/pause handler
  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLongPressRef.current) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (now - lastTapTimeRef.current < 320) {
      // Double tap detected
      if (x < width * 0.38) {
        // Left side: seek -10s
        seek(Math.max(0, currentTime - 10));
        setSeekRipple({ side: 'left', amount: 10 });
      } else if (x > width * 0.62) {
        // Right side: seek +10s
        seek(Math.min(duration, currentTime + 10));
        setSeekRipple({ side: 'right', amount: 10 });
      } else {
        triggerPlayToggle();
      }
      if (seekRippleTimeoutRef.current) clearTimeout(seekRippleTimeoutRef.current);
      seekRippleTimeoutRef.current = setTimeout(() => setSeekRipple(null), 600);
    } else {
      // Single tap: toggle play/pause or controls
      triggerPlayToggle();
    }
    lastTapTimeRef.current = now;
  };

  // Keyboard Shortcuts (F: Fullscreen, Space/K: Play/Pause, J/L: Seek -10s/+10s, M: Mute, T: Theater)
  useEffect(() => {
    if (!isVideoWatchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFullscreenToggle();
      } else if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        triggerPlayToggle();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        seek(Math.max(0, currentTime - 10));
        resetControlsTimer();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        seek(Math.min(duration, currentTime + 10));
        resetControlsTimer();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setIsTheaterMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoWatchOpen, currentTime, duration, isPlaying, isMuted]);

  const triggerPlayToggle = () => {
    const nextState = isPlaying ? 'pause' : 'play';
    setClickPlayRipple(nextState);
    if (rippleTimeoutRef.current) clearTimeout(rippleTimeoutRef.current);
    rippleTimeoutRef.current = setTimeout(() => setClickPlayRipple(null), 450);
    togglePlay();
    resetControlsTimer();
  };

  if (!isVideoWatchOpen || !currentVideo) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Metadata with thorough fallbacks
  const channelName = watchDetails?.channel?.name || currentVideo.channelName;
  const channelAvatarUrl = watchDetails?.channel?.avatarUrl || currentVideo.channelIconUrl;
  const subscriberCount = watchDetails?.channel?.subscriberCount;
  const isVerified = Boolean(watchDetails?.channel?.isVerified ?? currentVideo.isVerified);
  const viewCountFormatted = watchDetails?.viewCount || currentVideo.viewCount;
  const uploadDateFormatted = watchDetails?.publishedDate || currentVideo.uploadedDate || 'Uploaded recently';
  const descriptionText = watchDetails?.description || currentVideo.description || '';

  // Parse links and hashtags in description
  const renderDescriptionWithLinks = (text: string) => {
    if (!text) return 'No description provided.';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: '#3ea6ff',
              textDecoration: 'none',
              wordBreak: 'break-all'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.textDecoration = 'none';
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        backgroundColor: 'var(--md-sys-color-surface, #111318)',
        color: 'var(--md-sys-color-on-surface, #e2e2e9)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'kodaWatchFadeIn 200ms ease'
      }}
    >
      {/* Top Navigation Bar: Back / Minimize button + Title indicator + Close */}
      <div
        style={{
          height: '56px',
          padding: '0 16px',
          display: isFullscreen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--md-sys-color-surface, #111318)',
          borderBottom: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
          flexShrink: 0,
          zIndex: 30
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={minimizeVideo}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--md-sys-color-on-surface, #e2e2e9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 150ms ease'
            }}
            title="Minimize video player"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              expand_more
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Theater Mode Toggle */}
          <button
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: isTheaterMode ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title={isTheaterMode ? 'Exit theater mode (T)' : 'Theater mode (T)'}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              {isTheaterMode ? 'crop_square' : 'crop_16_9'}
            </span>
          </button>

          {/* Close Video button */}
          <button
            onClick={closeVideo}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Close video"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Viewport (Authentic 2-Column Desktop Layout) */}
      <div
        ref={mainScrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          scrollBehavior: 'smooth'
        }}
      >
        {/* Theater Video Banner (when Theater Mode is enabled) */}
        {isTheaterMode && !isFullscreen && (
          <div
            style={{
              width: '100%',
              backgroundColor: '#000',
              display: 'flex',
              justifyContent: 'center',
              maxHeight: '75vh'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '1500px',
                aspectRatio: '16 / 9',
                maxHeight: '75vh',
                position: 'relative'
              }}
            >
              {renderVideoViewport(true)}
            </div>
          </div>
        )}

        {/* Responsive Content Grid: Left Main Deck (Video + Details + Comments) + Right Sidebar (Recommendations) */}
        <div
          style={{
            maxWidth: isTheaterMode ? '1400px' : '1680px',
            margin: '0 auto',
            padding: isTheaterMode ? '20px 24px 80px' : '16px 24px 80px',
            display: 'flex',
            flexDirection: 'row',
            gap: '24px',
            alignItems: 'flex-start'
          }}
          className="koda-watch-grid"
        >
          {/* PRIMARY LEFT COLUMN: Video Player (Normal mode) + Info + Actions + Description + Inline Comments */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            {/* Standard 16:9 Video Player Viewport (when NOT in Theater Mode) */}
            {!isTheaterMode && (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  borderRadius: isFullscreen ? 0 : '12px',
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                  marginBottom: '16px'
                }}
              >
                {renderVideoViewport(false)}
              </div>
            )}

            {/* 1. Koda Video Title Card: Title, Status, Stat Tiles, & In-Place Expandable Description */}
            <KodaVideoTitleCard
              video={currentVideo}
              details={watchDetails}
              onSeekTo={(seconds) => seek(seconds)}
              style={{ marginBottom: '14px' }}
            />

            {/* 2. Koda ActionDock: SurfaceContainerHigh card with Like/Dislike connected group, Save, Listen as Music, Share, Settings */}
            <div
              style={{
                borderRadius: '24px',
                backgroundColor: 'var(--md-sys-color-surface-container-high, #282a2f)',
                border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                marginBottom: '14px',
                overflowX: 'auto',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                {/* Expressive Connected Like / Dislike Group */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--md-sys-color-surface-container-highest, #33353a)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  {/* Like Button */}
                  <button
                    onClick={() => {
                      setIsLiked(!isLiked);
                      if (!isLiked) setIsDisliked(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      border: 'none',
                      backgroundColor: isLiked ? 'var(--md-sys-color-primary, #ffd8e4)' : 'transparent',
                      color: isLiked ? 'var(--md-sys-color-on-primary, #4a192c)' : 'var(--md-sys-color-on-surface, #e2e2e9)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                  >
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: '18px', fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      thumb_up
                    </span>
                    <span>{watchDetails?.likeCount || (isLiked ? '1' : 'Like')}</span>
                  </button>

                  <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

                  {/* Dislike Button */}
                  <button
                    onClick={() => {
                      setIsDisliked(!isDisliked);
                      if (!isDisliked) setIsLiked(false);
                    }}
                    title="Dislike"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 14px',
                      border: 'none',
                      backgroundColor: isDisliked ? 'var(--md-sys-color-primary, #ffd8e4)' : 'transparent',
                      color: isDisliked ? 'var(--md-sys-color-on-primary, #4a192c)' : 'var(--md-sys-color-on-surface, #e2e2e9)',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                  >
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: '18px', fontVariationSettings: isDisliked ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      thumb_down
                    </span>
                  </button>
                </div>

                {/* "Listen as Music" Button (Signature Koda Feature) */}
                <button
                  onClick={listenAsMusic}
                  title="Play track in Background Music Player"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 18px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--md-sys-color-tertiary-container, #ffd8e4)',
                    color: 'var(--md-sys-color-on-tertiary-container, #31111d)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    transition: 'transform 150ms ease, opacity 150ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>
                    headphones
                  </span>
                  <span>Listen as music</span>
                </button>

                {/* Save to Playlist Button */}
                <button
                  onClick={() => showToastNotification('Saved to your Library')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--md-sys-color-surface-container-highest, #33353a)',
                    color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 150ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest, #33353a)';
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    playlist_add
                  </span>
                  <span>Save</span>
                </button>

                {/* Share Button */}
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${currentVideo.id}`);
                      showToastNotification('Video link copied to clipboard!');
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--md-sys-color-surface-container-highest, #33353a)',
                    color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 150ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest, #33353a)';
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    share
                  </span>
                  <span>Share</span>
                </button>
              </div>

              {/* Settings Pill (Opens Koda Playback & Audio Track Sheet) */}
              <button
                onClick={() => setIsSettingsSheetOpen(true)}
                title="Playback, speed, quality, and audio track settings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--md-sys-color-surface-container-highest, #33353a)',
                  color: 'var(--md-sys-color-primary, #ffd8e4)',
                  border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background-color 150ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-highest, #33353a)';
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  tune
                </span>
                <span>Settings</span>
              </button>
            </div>

            {/* 3. Koda Channel Info Card: SurfaceContainer 20px card with 48px avatar, verified badge, subscriber count, and M3 Subscribe pill */}
            <div
              style={{
                borderRadius: '20px',
                backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
                border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginBottom: '14px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                {/* 48px Avatar */}
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-surface-container-highest, #33353a)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                    flexShrink: 0,
                    border: '1.5px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  {channelAvatarUrl ? (
                    <img
                      src={channelAvatarUrl}
                      alt={channelName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    channelName.slice(0, 2).toUpperCase()
                  )}
                </div>

                {/* Creator Name & Subscriber Count */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {channelName}
                    </h3>
                    {isVerified && (
                      <span
                        className="material-symbols-rounded"
                        style={{
                          fontSize: '16px',
                          color: 'var(--md-sys-color-primary, #ffd8e4)',
                          fontVariationSettings: "'FILL' 1"
                        }}
                        title="Verified creator"
                      >
                        check_circle
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                      fontWeight: 500
                    }}
                  >
                    {subscriberCount || 'YouTube Creator'}
                  </span>
                </div>
              </div>

              {/* Material 3 Expressive Subscribe Pill */}
              <button
                onClick={() => {
                  setIsSubscribed(!isSubscribed);
                  showToastNotification(
                    !isSubscribed ? `Subscribed to ${channelName}` : `Unsubscribed from ${channelName}`
                  );
                }}
                style={{
                  padding: '10px 22px',
                  borderRadius: '16px',
                  backgroundColor: isSubscribed
                    ? 'var(--md-sys-color-secondary-container, #4a4458)'
                    : 'var(--md-sys-color-primary, #ffd8e4)',
                  color: isSubscribed
                    ? 'var(--md-sys-color-on-secondary-container, #e8def8)'
                    : 'var(--md-sys-color-on-primary, #4a192c)',
                  border: isSubscribed
                    ? '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.15))'
                    : 'none',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)',
                  boxShadow: isSubscribed ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isSubscribed && (
                  <span className="material-symbols-rounded" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>
                    notifications_active
                  </span>
                )}
                <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
              </button>
            </div>

            {/* 4. Koda Comments Door Surface Card: SurfaceContainer 20px card leading to VideoCommentsSheet */}
            <div
              onClick={() => setIsCommentsSheetOpen(true)}
              role="button"
              tabIndex={0}
              style={{
                borderRadius: '20px',
                backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
                border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))',
                padding: '16px 18px',
                marginBottom: '28px',
                cursor: 'pointer',
                transition: 'background-color 150ms ease, transform 150ms ease',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, #282a2f)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container, #1d2024)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: commentsList.length > 0 ? '12px' : '0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="material-symbols-rounded"
                    style={{
                      fontSize: '22px',
                      color: 'var(--md-sys-color-primary, #ffd8e4)',
                      fontVariationSettings: "'FILL' 1"
                    }}
                  >
                    chat
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--md-sys-color-on-surface, #e2e2e9)'
                      }}
                    >
                      Comments
                    </h3>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--md-sys-color-on-surface-variant, #94a3b8)'
                      }}
                    >
                      {watchDetails?.comments?.countText || `${commentsList.length ? commentsList.length + ' loaded' : 'Tap to read discussion'}`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--md-sys-color-on-surface-variant, #94a3b8)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Open</span>
                  <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Top Comment Teaser Preview */}
              {commentsList.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.04)'
                  }}
                >
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: '#33353a',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#fff'
                    }}
                  >
                    {commentsList[0].authorAvatarUrl ? (
                      <img
                        src={commentsList[0].authorAvatarUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      commentsList[0].authorName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12.5px',
                      color: 'var(--md-sys-color-on-surface-variant, #c4c6d0)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}
                  >
                    <strong style={{ color: 'var(--md-sys-color-on-surface, #e2e2e9)', marginRight: '6px' }}>
                      {commentsList[0].authorName}:
                    </strong>
                    {commentsList[0].text}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECONDARY RIGHT COLUMN: Authentic Up Next & Related Sidebar */}
          <div
            style={{
              width: '402px',
              flexShrink: 0
            }}
            className="koda-watch-sidebar"
          >
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 800,
                color: '#fff',
                margin: '0 0 16px',
                letterSpacing: '-0.01em'
              }}
            >
              Up Next & Related
            </h2>

            {isLoadingDetails && relatedVideos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '168px',
                        height: '94px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        animation: 'kodaPulse 1.5s infinite ease-in-out',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{
                          width: '90%',
                          height: '14px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          animation: 'kodaPulse 1.5s infinite ease-in-out'
                        }}
                      />
                      <div
                        style={{
                          width: '60%',
                          height: '12px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          animation: 'kodaPulse 1.5s infinite ease-in-out'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {relatedVideos.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      playVideo(item);
                      if (mainScrollRef.current) {
                        mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
                      }
                    }}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '16px',
                      transition: 'all 180ms cubic-bezier(0.2, 0, 0, 1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, #282a2f)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* 16:9 Thumbnail Frame */}
                    <div
                      style={{
                        position: 'relative',
                        width: '168px',
                        height: '94px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: '#1f1f1f',
                        flexShrink: 0
                      }}
                    >
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          backgroundColor: 'rgba(0, 0, 0, 0.82)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px'
                        }}
                      >
                        {item.durationFormatted}
                      </span>
                      {typeof item.watchedPercentage === 'number' && item.watchedPercentage > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            backgroundColor: 'rgba(255, 255, 255, 0.3)'
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${item.watchedPercentage}%`,
                              backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)'
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        paddingTop: '2px'
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 4px',
                          fontSize: '14px',
                          fontWeight: 600,
                          lineHeight: '1.3',
                          color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {item.title}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant, #94a3b8)', fontWeight: 500 }}>
                          {item.channelName}
                        </span>
                        {item.isVerified && (
                          <span
                            className="material-symbols-rounded"
                            style={{ fontSize: '13px', color: 'var(--md-sys-color-primary, #a8c7fa)', fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant, #94a3b8)' }}>
                        {item.viewCount} • {item.uploadedDate || 'Recommended'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-app Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#313033',
            color: '#f4eff4',
            padding: '10px 22px',
            borderRadius: '9999px',
            fontSize: '13.5px',
            fontWeight: 600,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
            zIndex: 120,
            animation: 'kodaToastIn 200ms ease'
          }}
        >
          {toastMessage}
        </div>
      )}

      <style>{`
        @keyframes kodaWatchFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kodaToastIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes kodaPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes kodaRippleFade {
          0% { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        .koda-video-fullscreen,
        .koda-video-fullscreen:fullscreen,
        .koda-video-fullscreen:-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          aspect-ratio: auto !important;
          position: fixed !important;
          inset: 0 !important;
          z-index: 999999 !important;
        }
        @media (max-width: 1024px) {
          .koda-watch-grid {
            flex-direction: column !important;
          }
          .koda-watch-sidebar {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );

  // Helper renderer for Video Viewport (shared between Normal and Theater mode)
  function renderVideoViewport(isTheater: boolean) {
    return (
      <div
        ref={videoViewportRef}
        className={isFullscreen ? 'koda-video-fullscreen' : ''}
        style={{
          position: isFullscreen ? 'fixed' : 'relative',
          inset: isFullscreen ? 0 : undefined,
          width: isFullscreen ? '100vw' : '100%',
          height: isFullscreen ? '100vh' : '100%',
          maxHeight: isFullscreen ? '100vh' : undefined,
          backgroundColor: '#000000',
          zIndex: isFullscreen ? 1000 : 1,
          overflow: 'hidden',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onMouseMove={resetControlsTimer}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleViewportClick}
      >
        {useEmbedPlayer ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${currentVideo?.id}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`}
            title={currentVideo?.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#000'
            }}
          />
        ) : (
          <>
            <NativeVideoPlayerEngine />

            {/* Koda Floating 2x Speed Badge (Press-and-Hold Gesture) */}
            {isHolding2x && (
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 30,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(0, 0, 0, 0.85)',
                  backdropFilter: 'blur(12px)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
                  animation: 'kodaToastIn 150ms ease'
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: '20px', color: 'var(--md-sys-color-primary, #67e8f9)' }}
                >
                  fast_forward
                </span>
                <span>2× Speed</span>
              </div>
            )}

            {/* Double-tap Seek Arc Ripple Indicator */}
            {seekRipple && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: seekRipple.side === 'left' ? 0 : '60%',
                  right: seekRipple.side === 'right' ? 0 : '60%',
                  width: '40%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 25,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: seekRipple.side === 'left' ? '0 100% 100% 0' : '100% 0 0 100%',
                  animation: 'kodaRippleFade 450ms ease-out forwards'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '38px', color: '#fff' }}>
                  {seekRipple.side === 'left' ? 'replay_10' : 'forward_10'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                  {seekRipple.side === 'left' ? '-10s' : '+10s'}
                </span>
              </div>
            )}

            {/* Click Ripple Icon in Center (fades out immediately) */}
            {clickPlayRipple && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 10
                }}
              >
                <div
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'kodaRippleFade 450ms ease-out forwards'
                  }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '38px', fontVariationSettings: "'FILL' 1" }}
                  >
                    {clickPlayRipple === 'play' ? 'play_arrow' : 'pause'}
                  </span>
                </div>
              </div>
            )}

            {/* Buffering Indicator */}
            {isBuffering && !videoPlaybackError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 5
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.72)',
                    padding: '10px 20px',
                    borderRadius: '9999px',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  <M3LoadingIndicator size="sm" message="Buffering stream..." />
                </div>
              </div>
            )}

            {/* Playback Error Overlay */}
            {videoPlaybackError && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(15, 13, 19, 0.95)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  textAlign: 'center',
                  gap: '14px',
                  zIndex: 25
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#8c1d18',
                    color: '#f9dedc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
                    error_outline
                  </span>
                </div>

                <div style={{ maxWidth: '440px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                    Stream Interrupted
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.72)', lineHeight: '1.4' }}>
                    {videoPlaybackError}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={() => currentVideo && playVideo(currentVideo)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--md-sys-color-primary, #ffd8e4)',
                      color: 'var(--md-sys-color-on-primary, #4a192c)',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Retry Stream
                  </button>

                  <button
                    onClick={() => setUseEmbedPlayer(true)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.16)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Switch to Embedded Player
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Material You 3 Top Floating Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isFullscreen ? 'space-between' : 'flex-end',
            gap: '12px',
            zIndex: 25,
            pointerEvents: (showControls || !isPlaying) && !isHolding2x ? 'auto' : 'none',
            opacity: (showControls || !isPlaying) && !isHolding2x ? 1 : 0,
            transition: 'opacity 200ms ease'
          }}
        >
          {/* Fullscreen Video Title (ONLY rendered in Fullscreen to eliminate duplicate titles) */}
          {isFullscreen && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 14px 6px 10px',
                borderRadius: '14px',
                backgroundColor: 'rgba(18, 20, 24, 0.76)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                maxWidth: '65%',
                minWidth: 0
              }}
            >
              <button
                onClick={(e) => handleFullscreenToggle(e)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title="Exit Fullscreen (f / Esc)"
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  arrow_back
                </span>
              </button>
              <span
                style={{
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {watchDetails?.title || currentVideo?.title || 'YouTube Video'}
              </span>
            </div>
          )}

          {/* Top Right Action Button Cluster: Single Settings Button + Single Fullscreen Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Playback Settings Button (Opens Quality, Speed, Audio Tracks sheet) */}
            <button
              onClick={() => openSettings('quality')}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                backgroundColor: 'rgba(18, 20, 24, 0.76)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.76)';
              }}
              title="Playback Settings (Quality, Speed, Audio)"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                tune
              </span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={(e) => handleFullscreenToggle(e)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                backgroundColor: 'rgba(18, 20, 24, 0.76)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.76)';
              }}
              title={isFullscreen ? 'Exit Fullscreen (f)' : 'Fullscreen (f)'}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>
          </div>
        </div>

        {/* Material You 3 Center Transport Controls */}
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            zIndex: 20,
            pointerEvents: (showControls || !isPlaying) && !isHolding2x ? 'auto' : 'none',
            opacity: (showControls || !isPlaying) && !isHolding2x ? 1 : 0,
            transition: 'opacity 220ms ease, transform 220ms cubic-bezier(0.2, 0, 0, 1)'
          }}
        >
          {/* Rewind 10s Squircle Button */}
          <button
            onClick={() => {
              seek(Math.max(0, currentTime - 10));
              setSeekRipple({ side: 'left', amount: 10 });
              if (seekRippleTimeoutRef.current) clearTimeout(seekRippleTimeoutRef.current);
              seekRippleTimeoutRef.current = setTimeout(() => setSeekRipple(null), 500);
            }}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '16px',
              backgroundColor: 'rgba(18, 20, 24, 0.72)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid rgba(255, 255, 255, 0.16)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 180ms cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 150ms ease',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.72)';
            }}
            title="Rewind 10s (j)"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
              replay_10
            </span>
          </button>

          {/* Center Play/Pause Expressive M3 Squircle Button */}
          <button
            onClick={triggerPlayToggle}
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '24px',
              backgroundColor: 'var(--md-sys-color-primary-container, #d3e3fd)',
              color: 'var(--md-sys-color-on-primary-container, #041e49)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(168, 199, 250, 0.45)',
              transition: 'transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275), border-radius 200ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.borderRadius = '20px';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderRadius = '24px';
            }}
            title={isPlaying ? 'Pause (k / Space)' : 'Play (k / Space)'}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: '42px', fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          {/* Forward 10s Squircle Button */}
          <button
            onClick={() => {
              seek(Math.min(duration, currentTime + 10));
              setSeekRipple({ side: 'right', amount: 10 });
              if (seekRippleTimeoutRef.current) clearTimeout(seekRippleTimeoutRef.current);
              seekRippleTimeoutRef.current = setTimeout(() => setSeekRipple(null), 500);
            }}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '16px',
              backgroundColor: 'rgba(18, 20, 24, 0.72)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid rgba(255, 255, 255, 0.16)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 180ms cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 150ms ease',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.72)';
            }}
            title="Forward 10s (l)"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
              forward_10
            </span>
          </button>
        </div>

        {/* Material You 3 Expressive Bottom Control Deck */}
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            opacity: showControls || !isPlaying ? 1 : 0,
            pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
            transition: 'opacity 200ms ease',
            padding: '0 20px 18px',
            zIndex: 25
          }}
        >
          {/* Material 3 Expressive Blocky Scrubber Bar */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
            onMouseEnter={() => setIsHoveringScrubber(true)}
            onMouseLeave={() => {
              setIsHoveringScrubber(false);
              setScrubberHoverRatio(null);
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setScrubberHoverRatio(ratio);
              setScrubberHoverTime(ratio * duration);
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seek(ratio * duration);
            }}
          >
            {/* Floating Time Tooltip Box */}
            {isHoveringScrubber && scrubberHoverRatio !== null && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '26px',
                  left: `${scrubberHoverRatio * 100}%`,
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(18, 20, 24, 0.94)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: '#fff',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
                  animation: 'kodaToastIn 100ms ease'
                }}
              >
                {formatTime(scrubberHoverTime)}
              </div>
            )}

            {/* Background Track (M3 Expressive blocky rounded rect) */}
            <div
              style={{
                width: '100%',
                height: isHoveringScrubber ? '8px' : '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.22)',
                borderRadius: '4px',
                position: 'relative',
                transition: 'height 160ms cubic-bezier(0.2, 0, 0, 1)'
              }}
            >
              {/* Active Progress Bar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${progressPercent}%`,
                  backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
                  borderRadius: '4px'
                }}
              />

              {/* M3 Expressive Blocky Squircle Thumb */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${progressPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isHoveringScrubber ? '12px' : '8px',
                  height: isHoveringScrubber ? '24px' : '18px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
                  boxShadow: '0 0 12px rgba(168, 199, 250, 0.8), 0 2px 6px rgba(0, 0, 0, 0.4)',
                  transition: 'width 140ms ease, height 140ms ease, border-radius 140ms ease'
                }}
              />
            </div>
          </div>

          {/* Bottom Controls Row: Monospace Time Readout + Volume Slider + Theater Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            {/* Left: Time and Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Monospace Time Block */}
              <div
                style={{
                  backgroundColor: 'rgba(18, 20, 24, 0.72)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                  letterSpacing: '0.4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>{formatTime(currentTime)}</span>
                <span style={{ opacity: 0.5 }}>/</span>
                <span style={{ opacity: 0.85 }}>{formatTime(duration)}</span>
              </div>

              {/* Volume Button with Expandable Slider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(18, 20, 24, 0.72)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '4px 8px',
                  borderRadius: '10px'
                }}
                onMouseEnter={() => setIsHoveringVolume(true)}
                onMouseLeave={() => setIsHoveringVolume(false)}
              >
                <button
                  onClick={toggleMute}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={isMuted ? 'Unmute (m)' : 'Mute (m)'}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    {isMuted || volume === 0
                      ? 'volume_off'
                      : volume < 0.5
                      ? 'volume_down'
                      : 'volume_up'}
                  </span>
                </button>

                {isHoveringVolume && (
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (isMuted) toggleMute();
                    }}
                    style={{
                      width: '64px',
                      height: '4px',
                      accentColor: 'var(--md-sys-color-primary, #a8c7fa)',
                      cursor: 'pointer'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Right: Theater Mode toggle (when not in fullscreen) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isFullscreen && (
                <button
                  onClick={() => setIsTheaterMode(!isTheaterMode)}
                  style={{
                    backgroundColor: 'rgba(18, 20, 24, 0.72)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '5px 12px',
                    color: '#fff',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background-color 150ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(18, 20, 24, 0.72)';
                  }}
                  title={isTheaterMode ? 'Exit theater mode (t)' : 'Theater mode (t)'}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                    {isTheaterMode ? 'crop_square' : 'crop_16_9'}
                  </span>
                  <span>{isTheaterMode ? 'Standard' : 'Theater'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Koda Playback & Audio Track Settings Sheet (Mounted directly inside viewport for 100% Fullscreen Support) */}
        <KodaPlaybackSettingsSheet
          isOpen={isSettingsSheetOpen}
          onClose={() => setIsSettingsSheetOpen(false)}
          initialTab={settingsInitialTab}
        />

        {/* Video Comments Sheet (Mounted directly inside viewport for 100% Fullscreen Support) */}
        <VideoCommentsSheet
          videoId={currentVideo?.id || ''}
          isOpen={isCommentsSheetOpen}
          onClose={() => setIsCommentsSheetOpen(false)}
          totalCommentCount={watchDetails?.comments?.countText}
        />
      </div>
    );
  }
};
