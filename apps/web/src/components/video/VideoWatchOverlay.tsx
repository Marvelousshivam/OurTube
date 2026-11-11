import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import {
  useVideoShaderStore,
  isShaderEffectActive,
  isPictureNeutral,
  getPresetMeta
} from '../../store/videoShaderStore';
import { NativeVideoPlayerEngine } from './NativeVideoPlayerEngine';
import { VideoCommentsSheet } from './VideoCommentsSheet';
import { KodaVideoTitleCard } from './KodaVideoTitleCard';
import { KodaPlaybackSettingsSheet } from './KodaPlaybackSettingsSheet';
import { VideoItem, VideoWatchDetails, VideoCommentItem } from '../../types';
import { innertubeService } from '../../api/innertubeService';
import { prefetchVideoStream } from '../../api/streamResolver';
import {
  SponsorSegment,
  CaptionCueItem,
  fetchSponsorSegments,
  fetchReturnYouTubeDislikes,
  parseVideoChaptersFromDescription,
  parseTimedComments,
  fetchCaptionCues
} from '../../api/sponsorBlockAndDislikes';
import { M3LoadingIndicator } from '../common/M3LoadingIndicator';

export const VideoWatchOverlay: React.FC = () => {
  const {
    currentVideo,
    isVideoWatchOpen,
    isPlaying,
    currentTime,
    duration,
    bufferedTime,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    isBuffering,
    videoPlaybackError,
    setVideoPlaybackError,
    togglePlay,
    seek,
    retryVideoStream,
    minimizeVideo,
    closeVideo,
    listenAsMusic,
    playVideo,
    hydrateCurrentVideo,
    videoQuality,
    setVideoQuality,
    setHoldTo2x,
    playbackSpeed,
    setPlaybackSpeed,
    audioTracks,
    selectedAudioTrackId,
    captionTracks,
    selectedCaptionTrackId,
    setCaptionTrack,
    resumedFromSeconds,
    clearResumedFrom,
    preloadRelatedVideoStreams,
    autoplay,
    openChannel
  } = usePlayerStore();

  const shaderStore = useVideoShaderStore();

  const {
    isVideoLiked,
    toggleLikeVideo,
    isChannelSubscribed,
    toggleSubscribeChannel,
    isWatchLaterVideo,
    toggleWatchLaterVideo
  } = useTasteStore();

  const [showControls, setShowControls] = useState(true);
  const [isDisliked, setIsDisliked] = useState(false);
  const [dislikeCountText, setDislikeCountText] = useState<string | null>(null);
  const [sponsorSegments, setSponsorSegments] = useState<SponsorSegment[]>([]);
  const [skippedSponsorToast, setSkippedSponsorToast] = useState<SponsorSegment | null>(null);
  const [isChaptersSheetOpen, setIsChaptersSheetOpen] = useState(false);
  const [captionCues, setCaptionCues] = useState<CaptionCueItem[]>([]);
  const [scrubStartMarkerTime, setScrubStartMarkerTime] = useState<number | null>(null);
  const [watchDetails, setWatchDetails] = useState<VideoWatchDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<VideoItem[]>([]);
  const [commentsList, setCommentsList] = useState<VideoCommentItem[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isCommentsSheetOpen, setIsCommentsSheetOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'quality' | 'speed' | 'audio' | 'shaders'>('quality');
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPreviewTime, setScrubPreviewTime] = useState<number | null>(null);
  const [scrubberHoverRatio, setScrubberHoverRatio] = useState<number | null>(null);
  const [scrubberHoverTime, setScrubberHoverTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [clickPlayRipple, setClickPlayRipple] = useState<'play' | 'pause' | null>(null);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [isHolding2x, setIsHolding2x] = useState(false);
  const [holdBoostSpeed, setHoldBoostSpeed] = useState(2.0);
  const [screenLocked, setScreenLocked] = useState(false);
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [timedCommentsActive, setTimedCommentsActive] = useState(true);
  const [seekRipple, setSeekRipple] = useState<{ side: 'left' | 'right'; amount: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sponsorToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressedSponsorUuidsRef = useRef<Set<string>>(new Set());
  const rippleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartXRef = useRef<number>(0);
  const preHoldSpeedRef = useRef<number>(1.0);
  const unlockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLongPressRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekRippleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const openSettings = (tab: 'quality' | 'speed' | 'audio' | 'shaders' = 'quality') => {
    setSettingsInitialTab(tab);
    setIsSettingsSheetOpen(true);
  };

  // Reset state on new video + fetch SponsorBlock segments & ReturnYouTubeDislike count
  useEffect(() => {
    setIsDescriptionExpanded(false);
    setIsCommentsSheetOpen(false);
    setIsChaptersSheetOpen(false);
    setCommentsList([]);
    setSponsorSegments([]);
    setSkippedSponsorToast(null);
    setDislikeCountText(null);
    setCaptionCues([]);
    suppressedSponsorUuidsRef.current.clear();

    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }

    if (!currentVideo?.id) return;
    let cancelled = false;

    fetchSponsorSegments(currentVideo.id).then((segs) => {
      if (!cancelled) setSponsorSegments(segs);
    });

    fetchReturnYouTubeDislikes(currentVideo.id).then((res) => {
      if (!cancelled && res?.formatted) {
        setDislikeCountText(res.formatted);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentVideo?.id]);

  // Auto-dismiss ResumePlaybackChip after 6.5s
  useEffect(() => {
    if (!resumedFromSeconds) return;
    const timer = setTimeout(() => {
      clearResumedFrom();
    }, 6500);
    return () => clearTimeout(timer);
  }, [resumedFromSeconds, clearResumedFrom]);

  // Load Closed Caption cues when a caption track is selected
  useEffect(() => {
    if (!selectedCaptionTrackId) {
      setCaptionCues([]);
      return;
    }
    const track = captionTracks.find((t) => t.id === selectedCaptionTrackId);
    if (!track?.baseUrl) {
      setCaptionCues([]);
      return;
    }
    let cancelled = false;
    fetchCaptionCues(track.baseUrl).then((cues) => {
      if (!cancelled) setCaptionCues(cues);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCaptionTrackId, captionTracks]);

  // SponsorBlock Auto-Skip Engine (Ported from temp_koda VideoPlayerViewModel.kt)
  useEffect(() => {
    if (
      !shaderStore.sponsorBlockEnabled ||
      !shaderStore.sponsorAutoSkip ||
      sponsorSegments.length === 0 ||
      isScrubbing ||
      !isPlaying
    ) {
      return;
    }

    for (const seg of sponsorSegments) {
      if (suppressedSponsorUuidsRef.current.has(seg.uuid)) continue;
      if (currentTime >= seg.startSec && currentTime < seg.endSec - 0.35) {
        suppressedSponsorUuidsRef.current.add(seg.uuid);
        seek(seg.endSec);
        setSkippedSponsorToast(seg);
        if (sponsorToastTimeoutRef.current) clearTimeout(sponsorToastTimeoutRef.current);
        sponsorToastTimeoutRef.current = setTimeout(() => {
          setSkippedSponsorToast(null);
        }, 5200);
        break;
      }
    }
  }, [
    currentTime,
    sponsorSegments,
    shaderStore.sponsorBlockEnabled,
    shaderStore.sponsorAutoSkip,
    isScrubbing,
    isPlaying,
    seek
  ]);

  // Sync browser tab title with active video
  useEffect(() => {
    if (!isVideoWatchOpen || !currentVideo) return;
    const prevTitle = document.title;
    const activeTitle = watchDetails?.title || currentVideo.title;
    if (activeTitle && activeTitle !== 'Loading video...') {
      document.title = `${activeTitle} — OurTube`;
    }
    return () => {
      document.title = prevTitle || 'OurTube — Personal Music & Video';
    };
  }, [isVideoWatchOpen, currentVideo?.id, currentVideo?.title, watchDetails?.title]);

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

        hydrateCurrentVideo({
          title: details.title || currentVideo.title,
          channelName: details.channel?.name || currentVideo.channelName,
          channelId: details.channel?.id || currentVideo.channelId,
          channelIconUrl: details.channel?.avatarUrl || currentVideo.channelIconUrl,
          viewCount: details.viewCount || currentVideo.viewCount,
          uploadedDate: details.publishedDate || currentVideo.uploadedDate
        });

        if (details.relatedVideos && details.relatedVideos.length > 0) {
          setRelatedVideos(details.relatedVideos);
          preloadRelatedVideoStreams(details.relatedVideos.slice(0, 1).map((v) => v.id));
        } else {
          // Fallback to channel recommendations
          innertubeService
            .search(`${details.channel?.name || currentVideo.channelName} recommendations`, 'all')
            .then((tracks) => {
              if (isCancelled) return;
              const mapped = tracks.slice(0, 12).map((t) => ({
                id: t.id,
                title: t.title,
                channelName: t.artist,
                channelId: t.artistId,
                thumbnailUrl: t.highResThumbnailUrl || t.thumbnailUrl,
                duration: t.duration || 240,
                durationFormatted: `${Math.floor((t.duration || 240) / 60)}:${String((t.duration || 240) % 60).padStart(2, '0')}`,
                viewCount: t.viewCount ? `${t.viewCount.toLocaleString()} views` : 'Recommended',
                uploadedDate: 'Related'
              }));
              setRelatedVideos(mapped);
              preloadRelatedVideoStreams(mapped.slice(0, 1).map((v) => v.id));
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

  // Hold-to-2x..4x slide speed boost gesture handlers (Koda Signature Interaction)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (screenLocked) {
      setShowControls(true);
      resetControlsTimer();
      return;
    }
    if (e.button !== 0) return;
    isLongPressRef.current = false;
    holdStartXRef.current = e.clientX;
    preHoldSpeedRef.current = playbackSpeed;
    holdTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setHoldBoostSpeed(2.0);
      setIsHolding2x(true);
      setHoldTo2x(true);
    }, 280);
  };

  const handlePointerMoveViewport = (e: React.PointerEvent) => {
    resetControlsTimer();
    if (!isLongPressRef.current || !isHolding2x) return;
    const dx = e.clientX - holdStartXRef.current;
    // Slide right to boost up to 4.0x, slide left back down to 2.0x
    const boosted = Math.max(2.0, Math.min(4.0, Math.round((2.0 + dx / 90) * 10) / 10));
    if (boosted !== holdBoostSpeed) {
      setHoldBoostSpeed(boosted);
      setPlaybackSpeed(boosted);
    }
  };

  const handlePointerUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      setIsHolding2x(false);
      setHoldTo2x(false);
      if (playbackSpeed !== preHoldSpeedRef.current) {
        setPlaybackSpeed(preHoldSpeedRef.current);
      }
      setHoldBoostSpeed(2.0);
    }
  };

  // Accumulating Double-tap seek & debounced single-tap play/pause handler
  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (screenLocked) {
      setShowControls((prev) => !prev);
      return;
    }
    if (isLongPressRef.current) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (now - lastTapTimeRef.current < 320) {
      // Cancel pending single-tap play/pause toggle
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      // Accumulating Double tap detected (-10s, -20s, -30s / +10s, +20s, +30s)
      if (x < width * 0.38) {
        seek(Math.max(0, currentTime - 10));
        setSeekRipple((prev) => ({
          side: 'left',
          amount: prev?.side === 'left' ? prev.amount + 10 : 10
        }));
      } else if (x > width * 0.62) {
        seek(Math.min(duration, currentTime + 10));
        setSeekRipple((prev) => ({
          side: 'right',
          amount: prev?.side === 'right' ? prev.amount + 10 : 10
        }));
      } else {
        handleFullscreenToggle();
      }
      if (seekRippleTimeoutRef.current) clearTimeout(seekRippleTimeoutRef.current);
      seekRippleTimeoutRef.current = setTimeout(() => setSeekRipple(null), 650);
      lastTapTimeRef.current = now;
    } else {
      lastTapTimeRef.current = now;
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        triggerPlayToggle();
      }, 240);
    }
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
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      // Do not double-trigger play/pause when Space or Enter is pressed on a focused button
      if (
        (e.key === ' ' || e.key === 'Enter') &&
        target &&
        (target.tagName === 'BUTTON' || target.closest('button, [role="button"]'))
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

  const displayTime = isScrubbing && scrubPreviewTime !== null ? scrubPreviewTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, Math.max(0, (bufferedTime / duration) * 100)) : 0;
  const activeShaderBadge = isShaderEffectActive(shaderStore)
    ? shaderStore.activePreset === 'none' && !isPictureNeutral(shaderStore)
      ? 'Tuned'
      : getPresetMeta(shaderStore.activePreset).title
    : null;

  // Metadata with thorough fallbacks
  const channelName = watchDetails?.channel?.name || currentVideo.channelName;
  const channelId = watchDetails?.channel?.id || currentVideo.channelId || channelName;
  const channelAvatarUrl = watchDetails?.channel?.avatarUrl || currentVideo.channelIconUrl;
  const subscriberCount = watchDetails?.channel?.subscriberCount;
  const isVerified = Boolean(watchDetails?.channel?.isVerified ?? currentVideo.isVerified);
  const viewCountFormatted = watchDetails?.viewCount || currentVideo.viewCount;
  const uploadDateFormatted = watchDetails?.publishedDate || currentVideo.uploadedDate || 'Uploaded recently';
  const descriptionText = watchDetails?.description || currentVideo.description || '';
  const isLiked = isVideoLiked(currentVideo.id);
  const isSubscribed = isChannelSubscribed(channelId || channelName);
  const isSaved = isWatchLaterVideo(currentVideo.id);

  // Chapters, SponsorBlock, Timed Comments & Captions derived state
  const chapters = parseVideoChaptersFromDescription(descriptionText, duration || currentVideo.duration || 0);
  const activeChapter = chapters.find(
    (c) => displayTime >= c.startSec && displayTime < c.endSec
  );
  const hoveredChapter =
    scrubberHoverRatio !== null
      ? chapters.find((c) => scrubberHoverTime >= c.startSec && scrubberHoverTime < c.endSec)
      : null;
  const hoveredSponsorSegment =
    shaderStore.sponsorBlockEnabled && scrubberHoverRatio !== null
      ? sponsorSegments.find((s) => scrubberHoverTime >= s.startSec && scrubberHoverTime <= s.endSec)
      : null;
  const activeManualSponsorSegment = shaderStore.sponsorBlockEnabled
    ? sponsorSegments.find((s) => currentTime >= s.startSec && currentTime < s.endSec - 0.3)
    : null;

  const timedComments = timedCommentsActive ? parseTimedComments(commentsList, duration) : [];
  const activeTimedComment = timedCommentsActive
    ? timedComments.find(
        (tc) => currentTime >= tc.timestampSec && currentTime <= tc.timestampSec + 5.5
      )
    : null;

  const activeCaptionCue = selectedCaptionTrackId
    ? captionCues.find((c) => currentTime >= c.startSec && currentTime <= c.endSec)
    : null;

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
        animation: 'm3WatchStageEnter 400ms var(--m3-spring-spatial-slow, cubic-bezier(0.16, 1, 0.3, 1)) both'
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

      {/* Main Scrollable Viewport (Unified Persistent CSS Grid so <NativeVideoPlayerEngine> NEVER unmounts on Theater toggle) */}
      <div
        ref={mainScrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          scrollBehavior: 'smooth'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '2160px',
            margin: '0 auto',
            padding: '12px 20px 80px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 402px',
            gridTemplateRows: 'max-content minmax(0, 1fr)',
            columnGap: '20px',
            rowGap: '14px',
            alignItems: 'start'
          }}
          className="koda-watch-grid"
        >
          {/* PERSISTENT ELEMENT #1: Video Player Stage (Spans full width in Theater Mode, left column in Standard Mode — zero DOM remount!) */}
          <div
            key="koda-persistent-video-stage"
            style={{
              gridColumn: isTheaterMode ? '1 / -1' : '1 / 2',
              position: 'relative',
              width: '100%'
            }}
          >
            {shaderStore.ambientGlowEnabled && !isFullscreen && !isTheaterMode && (
              <img
                src={currentVideo.thumbnailUrl}
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '-18px',
                  width: 'calc(100% + 36px)',
                  height: 'calc(100% + 36px)',
                  objectFit: 'cover',
                  filter: 'blur(54px) saturate(1.85) brightness(0.68)',
                  opacity: isPlaying ? 0.52 : 0.28,
                  transition: 'opacity 600ms ease',
                  pointerEvents: 'none',
                  zIndex: 0,
                  borderRadius: '28px'
                }}
              />
            )}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                aspectRatio: '16 / 9',
                maxHeight: isFullscreen ? 'none' : isTheaterMode ? '78vh' : 'calc(100vh - 210px)',
                borderRadius: isFullscreen ? 0 : isTheaterMode ? '22px' : '16px',
                overflow: 'hidden',
                backgroundColor: '#000',
                boxShadow: '0 10px 34px rgba(0, 0, 0, 0.65)',
                border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {renderVideoViewport(isTheaterMode)}
            </div>
          </div>

          {/* PRIMARY LEFT COLUMN: Info + Actions + Description + Inline Comments */}
          <div
            style={{
              gridColumn: '1 / 2',
              minWidth: 0,
              width: '100%'
            }}
          >
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
                      const nextLiked = toggleLikeVideo({
                        id: currentVideo.id,
                        title: currentVideo.title,
                        channelName,
                        channelId,
                        thumbnailUrl: currentVideo.thumbnailUrl,
                        duration: currentVideo.duration,
                        viewCountText: viewCountFormatted
                      });
                      if (nextLiked) {
                        setIsDisliked(false);
                        showToastNotification('Added to Liked Videos');
                      } else {
                        showToastNotification('Removed from Liked Videos');
                      }
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.93)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: isLiked ? '14px' : '0px',
                      backgroundColor: isLiked ? 'var(--md-sys-color-primary, #ffd8e4)' : 'transparent',
                      color: isLiked ? 'var(--md-sys-color-on-primary, #4a192c)' : 'var(--md-sys-color-on-surface, #e2e2e9)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition:
                        'border-radius 280ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), background-color 180ms ease, color 180ms ease, transform 160ms var(--m3-spring-spatial-default)'
                    }}
                  >
                    <span
                      key={isLiked ? 'liked' : 'unliked'}
                      className="material-symbols-rounded"
                      style={{
                        fontSize: '18px',
                        fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0",
                        animation: isLiked
                          ? 'm3ThumbLikeBurst 380ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))'
                          : 'none'
                      }}
                    >
                      thumb_up
                    </span>
                    <span>{watchDetails?.likeCount || (isLiked ? 'Liked' : 'Like')}</span>
                  </button>

                  <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />

                  {/* Dislike Button with ReturnYouTubeDislike live count */}
                  <button
                    onClick={() => {
                      const nextDisliked = !isDisliked;
                      setIsDisliked(nextDisliked);
                      if (nextDisliked && isLiked) {
                        toggleLikeVideo({
                          id: currentVideo.id,
                          title: currentVideo.title,
                          channelName,
                          channelId,
                          thumbnailUrl: currentVideo.thumbnailUrl,
                          duration: currentVideo.duration,
                          viewCountText: viewCountFormatted
                        });
                      }
                    }}
                    title="Dislike (ReturnYouTubeDislike)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      border: 'none',
                      backgroundColor: isDisliked ? 'var(--md-sys-color-primary, #ffd8e4)' : 'transparent',
                      color: isDisliked ? 'var(--md-sys-color-on-primary, #4a192c)' : 'var(--md-sys-color-on-surface, #e2e2e9)',
                      fontWeight: 700,
                      fontSize: '13px',
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
                    {dislikeCountText && <span>{dislikeCountText}</span>}
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

                {/* Watch Later Button */}
                <button
                  onClick={() => {
                    const added = toggleWatchLaterVideo({
                      id: currentVideo.id,
                      title: currentVideo.title,
                      channelName,
                      channelId,
                      channelIconUrl: channelAvatarUrl,
                      duration: currentVideo.duration || duration || 180,
                      thumbnailUrl: currentVideo.thumbnailUrl,
                      viewCountText: viewCountFormatted
                    });
                    showToastNotification(
                      added ? 'Saved to Watch Later' : 'Removed from Watch Later'
                    );
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '16px',
                    backgroundColor: isSaved
                      ? 'var(--md-sys-color-primary-container, #3f4759)'
                      : 'var(--md-sys-color-surface-container-highest, #33353a)',
                    color: isSaved
                      ? 'var(--md-sys-color-on-primary-container, #d6e3ff)'
                      : 'var(--md-sys-color-on-surface, #e2e2e9)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 150ms ease'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    {isSaved ? 'task_alt' : 'schedule'}
                  </span>
                  <span>{isSaved ? 'In Watch Later' : 'Watch Later'}</span>
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

              {/* Shaders Quick Button (Signature Koda 16-Preset Engine) */}
              <button
                onClick={() => openSettings('shaders')}
                title="Video Shaders & Picture Tuning (16 Presets + Custom GLSL)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '16px',
                  backgroundColor: activeShaderBadge
                    ? 'var(--md-sys-color-primary-container, #3f4759)'
                    : 'var(--md-sys-color-surface-container-highest, #33353a)',
                  color: activeShaderBadge
                    ? 'var(--md-sys-color-on-primary-container, #d6e3ff)'
                    : 'var(--md-sys-color-on-surface, #e2e2e9)',
                  border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background-color 150ms ease'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  auto_fix_high
                </span>
                <span>{activeShaderBadge ? `Shader: ${activeShaderBadge}` : 'Shaders'}</span>
              </button>

              {/* Settings Pill (Opens Koda Playback & Audio Track Sheet) */}
              <button
                onClick={() => openSettings('quality')}
                title="Playback, speed, quality, shaders, and audio track settings"
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
              <div
                onClick={() =>
                  openChannel({
                    id: channelId,
                    name: channelName,
                    avatarUrl: channelAvatarUrl
                  })
                }
                title={`View ${channelName} channel`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  minWidth: 0,
                  cursor: 'pointer'
                }}
              >
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
                  const nowSubbed = toggleSubscribeChannel({
                    id: channelId,
                    name: channelName,
                    avatarUrl: channelAvatarUrl
                  });
                  showToastNotification(
                    nowSubbed ? `Subscribed to ${channelName}` : `Unsubscribed from ${channelName}`
                  );
                }}
                style={{
                  padding: '10px 22px',
                  borderRadius: isSubscribed ? '14px' : '9999px',
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
                  transition:
                    'border-radius 320ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), background-color 200ms ease, color 200ms ease, transform 180ms var(--m3-spring-spatial-default)',
                  boxShadow: isSubscribed ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.3)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.93)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isSubscribed && (
                  <span
                    key="subbed-icon"
                    className="material-symbols-rounded"
                    style={{
                      fontSize: '18px',
                      fontVariationSettings: "'FILL' 1",
                      animation: 'm3ThumbLikeBurst 360ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))'
                    }}
                  >
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
              gridColumn: '2 / 3',
              gridRow: isTheaterMode ? '2 / 3' : '1 / 3',
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
                {relatedVideos.map((item, idx) => (
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
                      animation: 'm3CardCascade 320ms var(--m3-spring-spatial-slow, cubic-bezier(0.16, 1, 0.3, 1)) both',
                      animationDelay: `${Math.min(idx * 35, 350)}ms`,
                      transition:
                        'border-radius 280ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), background-color 180ms ease, transform 200ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container-high, #282a2f)';
                      e.currentTarget.style.borderRadius = '22px';
                      e.currentTarget.style.transform = 'translateX(3px)';
                      prefetchVideoStream(item.id, videoQuality);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderRadius = '16px';
                      e.currentTarget.style.transform = 'translateX(0)';
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
            grid-template-columns: 1fr !important;
          }
          .koda-watch-sidebar {
            grid-column: 1 / -1 !important;
            grid-row: auto !important;
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
        onPointerMove={handlePointerMoveViewport}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleViewportClick}
      >
        <NativeVideoPlayerEngine
          onEnded={() => {
            if (autoplay && relatedVideos.length > 0) {
              playVideo(relatedVideos[0]);
            } else {
              usePlayerStore.setState({ isPlaying: false });
            }
          }}
        />

            {/* Koda Floating Hold-and-Slide Speed Boost Badge (2.0x .. 4.0x) */}
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
                  fontWeight: 800,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
                  animation: 'kodaToastIn 150ms ease'
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: '20px', color: 'var(--md-sys-color-primary, #a8c7fa)' }}
                >
                  fast_forward
                </span>
                <span>{holdBoostSpeed.toFixed(1)}× Speed</span>
                <span style={{ fontSize: '11px', opacity: 0.72, fontWeight: 600 }}>• Slide to boost</span>
              </div>
            )}

            {/* Accumulating Double-tap Seek Arc Ripple Indicator (-10s, -20s, -30s / +10s, +20s, +30s) */}
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
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: seekRipple.side === 'left' ? '0 100% 100% 0' : '100% 0 0 100%',
                  animation: 'kodaRippleFade 450ms ease-out forwards'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '38px', color: '#fff' }}>
                  {seekRipple.side === 'left' ? 'replay_10' : 'forward_10'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                  {seekRipple.side === 'left' ? `-${seekRipple.amount}s` : `+${seekRipple.amount}s`}
                </span>
              </div>
            )}

            {/* Screen Lock Hold-to-Unlock Floating Pill (Koda Screen Lock Mode) */}
            {screenLocked && (
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setUnlockProgress(10);
                  if (unlockIntervalRef.current) clearInterval(unlockIntervalRef.current);
                  const start = Date.now();
                  unlockIntervalRef.current = setInterval(() => {
                    const pct = Math.min(100, ((Date.now() - start) / 1100) * 100);
                    setUnlockProgress(pct);
                    if (pct >= 100) {
                      if (unlockIntervalRef.current) clearInterval(unlockIntervalRef.current);
                      unlockIntervalRef.current = null;
                      setUnlockProgress(0);
                      setScreenLocked(false);
                      showToastNotification('Touch controls unlocked');
                    }
                  }, 30);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (unlockIntervalRef.current) {
                    clearInterval(unlockIntervalRef.current);
                    unlockIntervalRef.current = null;
                  }
                  setUnlockProgress(0);
                }}
                onPointerLeave={() => {
                  if (unlockIntervalRef.current) {
                    clearInterval(unlockIntervalRef.current);
                    unlockIntervalRef.current = null;
                  }
                  setUnlockProgress(0);
                }}
                style={{
                  position: 'absolute',
                  bottom: '28px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 40,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 20px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(18, 20, 24, 0.88)',
                  backdropFilter: 'blur(16px)',
                  border: '1.5px solid rgba(168, 199, 250, 0.35)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.65)'
                }}
              >
                {unlockProgress > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${unlockProgress}%`,
                      backgroundColor: 'rgba(168, 199, 250, 0.28)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                <span className="material-symbols-rounded" style={{ fontSize: '18px', color: '#a8c7fa' }}>
                  lock
                </span>
                <span>Hold to Unlock Controls</span>
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
                    onClick={() => {
                      retryVideoStream('720p').then((ok) => {
                        if (!ok && currentVideo) {
                          playVideo(currentVideo);
                        }
                      });
                    }}
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
                </div>
              </div>
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
            display: screenLocked ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: isFullscreen ? 'space-between' : 'flex-end',
            gap: '12px',
            zIndex: 25,
            pointerEvents: (showControls || !isPlaying) && !isHolding2x && !screenLocked ? 'auto' : 'none',
            opacity: (showControls || !isPlaying) && !isHolding2x && !screenLocked ? 1 : 0,
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

          {/* Top Right Action Button Cluster: CC + Active Shader Badge + Shaders + Settings + Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Closed Captions (CC) Quick Toggle Button */}
            {captionTracks.length > 0 && (
              <button
                onClick={() => {
                  if (selectedCaptionTrackId) {
                    setCaptionTrack(null);
                    showToastNotification('Subtitles off');
                  } else {
                    const preferred =
                      captionTracks.find((t) => t.languageCode?.startsWith('en') && !t.isAutoGenerated) ||
                      captionTracks.find((t) => t.languageCode?.startsWith('en')) ||
                      captionTracks[0];
                    if (preferred) {
                      setCaptionTrack(preferred.id);
                      showToastNotification(`Subtitles: ${preferred.displayName}`);
                    }
                  }
                }}
                style={{
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '12px',
                  backgroundColor: selectedCaptionTrackId
                    ? 'rgba(168, 199, 250, 0.24)'
                    : 'rgba(18, 20, 24, 0.76)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: selectedCaptionTrackId
                    ? '1px solid rgba(168, 199, 250, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.14)',
                  color: selectedCaptionTrackId ? '#d3e3fd' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                  transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
                }}
                title={
                  selectedCaptionTrackId
                    ? 'Disable Closed Captions (c)'
                    : 'Enable Closed Captions (c)'
                }
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  {selectedCaptionTrackId ? 'closed_caption' : 'closed_caption_off'}
                </span>
                <span>CC</span>
              </button>
            )}

            {/* Active Shader Pill / Quick Shaders Button */}
            <button
              onClick={() => openSettings('shaders')}
              style={{
                height: '38px',
                padding: activeShaderBadge ? '0 12px' : '0 10px',
                borderRadius: '12px',
                backgroundColor: activeShaderBadge
                  ? 'rgba(168, 199, 250, 0.24)'
                  : 'rgba(18, 20, 24, 0.76)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: activeShaderBadge
                  ? '1px solid rgba(168, 199, 250, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.14)',
                color: activeShaderBadge ? '#d3e3fd' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
              }}
              title="Video Shaders & Picture Tuning (16 Presets + Custom GLSL)"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                auto_fix_high
              </span>
              {activeShaderBadge && <span>{activeShaderBadge}</span>}
            </button>

            {/* Playback Settings Button (Opens Quality, Speed, Audio, Shaders sheet) */}
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
              title="Playback Settings (Quality, Speed, Audio, Shaders)"
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
            display: screenLocked ? 'none' : 'flex',
            alignItems: 'center',
            gap: '24px',
            zIndex: 20,
            pointerEvents: (showControls || !isPlaying) && !isHolding2x && !screenLocked ? 'auto' : 'none',
            opacity: (showControls || !isPlaying) && !isHolding2x && !screenLocked ? 1 : 0,
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

          {/* Center Play/Pause Expressive M3 Shape-Morphing Button (Circle when paused <-> Squircle when playing) */}
          <button
            onClick={triggerPlayToggle}
            style={{
              width: '74px',
              height: '74px',
              borderRadius: isPlaying ? '22px' : '37px',
              backgroundColor: 'var(--md-sys-color-primary-container, #d3e3fd)',
              color: 'var(--md-sys-color-on-primary-container, #041e49)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(168, 199, 250, 0.45)',
              transition:
                'transform 240ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), border-radius 320ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.9)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isPlaying ? 'Pause (k / Space)' : 'Play (k / Space)'}
          >
            <span
              key={isPlaying ? 'pause' : 'play'}
              className="material-symbols-rounded"
              style={{
                fontSize: '42px',
                fontVariationSettings: "'FILL' 1",
                animation: 'm3PlayPop 260ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))'
              }}
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

        {/* Closed Captions (Subtitles) Cinema Overlay */}
        {activeCaptionCue && (
          <div
            style={{
              position: 'absolute',
              bottom: showControls || !isPlaying ? '98px' : '32px',
              left: '50%',
              transform: 'translateX(-50%)',
              maxWidth: '82%',
              backgroundColor: 'rgba(10, 12, 16, 0.84)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              padding: '6px 16px',
              borderRadius: '10px',
              color: '#fff',
              fontSize: isFullscreen || isTheater ? '17px' : '14.5px',
              fontWeight: 600,
              lineHeight: 1.4,
              textAlign: 'center',
              whiteSpace: 'pre-line',
              pointerEvents: 'none',
              zIndex: 23,
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.55)',
              transition: 'bottom 200ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            {activeCaptionCue.text}
          </div>
        )}

        {/* Live Timed Comment Overlay Pill (Ported from temp_koda TimedCommentOverlay) */}
        {activeTimedComment && !screenLocked && (
          <div
            key={activeTimedComment.id}
            onClick={(e) => {
              e.stopPropagation();
              setIsCommentsSheetOpen(true);
            }}
            style={{
              position: 'absolute',
              bottom: showControls || !isPlaying ? '88px' : '28px',
              left: '20px',
              maxWidth: 'min(420px, 72%)',
              backgroundColor: 'rgba(16, 18, 24, 0.84)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(168, 199, 250, 0.28)',
              borderRadius: '16px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              zIndex: 24,
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.55)',
              animation: 'kodaToastIn 220ms cubic-bezier(0.2, 0, 0, 1)',
              transition: 'bottom 200ms cubic-bezier(0.2, 0, 0, 1)'
            }}
            title="Click to open comments"
          >
            {activeTimedComment.authorAvatarUrl ? (
              <img
                src={activeTimedComment.authorAvatarUrl}
                alt={activeTimedComment.authorName}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0
                }}
              />
            ) : (
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(168, 199, 250, 0.2)',
                  color: '#d3e3fd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  flexShrink: 0
                }}
              >
                {activeTimedComment.authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#d3e3fd',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {activeTimedComment.authorName}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(168, 199, 250, 0.2)',
                    color: '#a8c7fa'
                  }}
                >
                  {formatTime(activeTimedComment.timestampSec)}
                </span>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#f1f3f9',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '1px'
                }}
              >
                {activeTimedComment.text}
              </div>
            </div>
          </div>
        )}

        {/* Right-Side Contextual Chips: SponsorBlock Undo / Manual Skip / Resume Playback Chip */}
        {!screenLocked && (skippedSponsorToast || activeManualSponsorSegment || resumedFromSeconds !== null) && (
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: showControls || !isPlaying ? '88px' : '28px',
              right: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '8px',
              zIndex: 24,
              transition: 'bottom 200ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            {/* SponsorBlock Auto-Skip Undo Toast */}
            {skippedSponsorToast && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 20, 26, 0.88)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${skippedSponsorToast.color}`,
                  borderRadius: '14px',
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
                  animation: 'kodaToastIn 180ms cubic-bezier(0.2, 0, 0, 1)'
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: skippedSponsorToast.color,
                    flexShrink: 0
                  }}
                />
                <span>Skipped {skippedSponsorToast.label}</span>
                <button
                  onClick={() => {
                    suppressedSponsorUuidsRef.current.add(skippedSponsorToast.uuid);
                    seek(skippedSponsorToast.startSec);
                    setSkippedSponsorToast(null);
                  }}
                  style={{
                    backgroundColor: 'rgba(168, 199, 250, 0.2)',
                    border: '1px solid rgba(168, 199, 250, 0.4)',
                    color: '#d3e3fd',
                    borderRadius: '8px',
                    padding: '3px 8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Undo
                </button>
              </div>
            )}

            {/* Manual Skip Segment Pill (when auto-skip is off or segment was undone) */}
            {!skippedSponsorToast && activeManualSponsorSegment && (
              <button
                onClick={() => {
                  seek(activeManualSponsorSegment.endSec);
                  showToastNotification(`Skipped ${activeManualSponsorSegment.label}`);
                }}
                style={{
                  backgroundColor: 'rgba(16, 20, 26, 0.88)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1.5px solid ${activeManualSponsorSegment.color}`,
                  borderRadius: '14px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
                  animation: 'kodaToastIn 180ms cubic-bezier(0.2, 0, 0, 1)'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '17px', color: activeManualSponsorSegment.color }}>
                  fast_forward
                </span>
                <span>Skip {activeManualSponsorSegment.label}</span>
              </button>
            )}

            {/* Resume Playback Chip (Ported from temp_koda ResumePlaybackChip) */}
            {resumedFromSeconds !== null && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 20, 26, 0.88)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(168, 199, 250, 0.35)',
                  borderRadius: '14px',
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#e2e2e9',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
                  animation: 'kodaToastIn 200ms cubic-bezier(0.2, 0, 0, 1)'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px', color: '#a8c7fa' }}>
                  history
                </span>
                <span>Resumed from {formatTime(resumedFromSeconds)}</span>
                <button
                  onClick={() => {
                    seek(0);
                    clearResumedFrom();
                    showToastNotification('Started from beginning');
                  }}
                  style={{
                    backgroundColor: 'rgba(168, 199, 250, 0.2)',
                    border: '1px solid rgba(168, 199, 250, 0.45)',
                    color: '#d3e3fd',
                    borderRadius: '8px',
                    padding: '3px 8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        )}

        {/* Material You 3 Expressive Bottom Control Deck */}
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: screenLocked ? 'none' : 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
            opacity: (showControls || !isPlaying || isScrubbing) && !screenLocked ? 1 : 0,
            pointerEvents: (showControls || !isPlaying || isScrubbing) && !screenLocked ? 'auto' : 'none',
            transition: 'opacity 200ms ease',
            padding: '0 20px 18px',
            zIndex: 25
          }}
        >
          {/* Material 3 Expressive Blocky Scrubber Bar with Pointer-Drag Scrubbing & Buffered Track */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: '10px',
              touchAction: 'none'
            }}
            onMouseEnter={() => setIsHoveringScrubber(true)}
            onMouseLeave={() => {
              if (!isScrubbing) {
                setIsHoveringScrubber(false);
                setScrubberHoverRatio(null);
              }
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!duration) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const target = ratio * duration;
              setScrubStartMarkerTime(currentTime);
              setIsScrubbing(true);
              setIsHoveringScrubber(true);
              setScrubberHoverRatio(ratio);
              setScrubberHoverTime(target);
              setScrubPreviewTime(target);
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const target = ratio * duration;
              setScrubberHoverRatio(ratio);
              setScrubberHoverTime(target);
              if (isScrubbing) {
                setScrubPreviewTime(target);
              }
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (isScrubbing) {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const target = ratio * duration;
                setIsScrubbing(false);
                setScrubPreviewTime(null);
                setScrubStartMarkerTime(null);
                seek(target);
              }
            }}
            onPointerCancel={() => {
              setIsScrubbing(false);
              setScrubPreviewTime(null);
              setScrubStartMarkerTime(null);
            }}
          >
            {/* Floating SeekPreviewCard Tooltip Box (Time + Delta + Chapter / Sponsor Label) */}
            {(isHoveringScrubber || isScrubbing) && scrubberHoverRatio !== null && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '28px',
                  left: `${Math.max(8, Math.min(92, scrubberHoverRatio * 100))}%`,
                  transform: 'translateX(-50%)',
                  backgroundColor: 'rgba(14, 16, 22, 0.94)',
                  backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  color: '#fff',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.65)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  animation: 'kodaToastIn 100ms ease',
                  zIndex: 30
                }}
              >
                {(hoveredChapter || hoveredSponsorSegment) && (
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: hoveredSponsorSegment ? hoveredSponsorSegment.color : '#d3e3fd',
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {hoveredSponsorSegment
                      ? `${hoveredSponsorSegment.label}${hoveredChapter ? ` • ${hoveredChapter.title}` : ''}`
                      : hoveredChapter?.title}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    fontFamily: 'monospace'
                  }}
                >
                  <span>{formatTime(scrubberHoverTime)}</span>
                  {Math.abs(scrubberHoverTime - currentTime) >= 1 && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        color: scrubberHoverTime >= currentTime ? '#a8c7fa' : '#ffb4ab'
                      }}
                    >
                      ({scrubberHoverTime >= currentTime ? '+' : '-'}
                      {formatTime(Math.abs(scrubberHoverTime - currentTime))})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Background Track (M3 Expressive blocky rounded rect) */}
            <div
              style={{
                width: '100%',
                height: isHoveringScrubber || isScrubbing ? '8px' : '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                position: 'relative',
                overflow: 'visible',
                transition: 'height 160ms cubic-bezier(0.2, 0, 0, 1)'
              }}
            >
              {/* Contiguous Buffered Range Track */}
              {bufferedPercent > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${bufferedPercent}%`,
                    backgroundColor: 'rgba(255, 255, 255, 0.36)',
                    borderRadius: '4px',
                    transition: 'width 200ms linear'
                  }}
                />
              )}

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

              {/* SponsorBlock Colored Segment Overlays */}
              {shaderStore.sponsorBlockEnabled &&
                duration > 0 &&
                sponsorSegments.map((seg) => {
                  const leftPct = Math.max(0, Math.min(100, (seg.startSec / duration) * 100));
                  const widthPct = Math.max(
                    0.4,
                    Math.min(100 - leftPct, ((seg.endSec - seg.startSec) / duration) * 100)
                  );
                  return (
                    <div
                      key={seg.uuid}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: '100%',
                        backgroundColor: seg.color,
                        opacity: 0.88,
                        borderRadius: '2px',
                        pointerEvents: 'none'
                      }}
                    />
                  );
                })}

              {/* Chapter Tick Separators */}
              {duration > 0 &&
                chapters.slice(1).map((ch) => {
                  const leftPct = Math.max(0, Math.min(100, (ch.startSec / duration) * 100));
                  return (
                    <div
                      key={`tick-${ch.startSec}`}
                      style={{
                        position: 'absolute',
                        top: '-1px',
                        left: `${leftPct}%`,
                        width: '2px',
                        height: 'calc(100% + 2px)',
                        backgroundColor: 'rgba(10, 12, 16, 0.92)',
                        pointerEvents: 'none'
                      }}
                    />
                  );
                })}

              {/* Scrub Start Return Marker (Ported from temp_koda scrubStartMarkerPosition) */}
              {isScrubbing && scrubStartMarkerTime !== null && duration > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    left: `${Math.max(0, Math.min(100, (scrubStartMarkerTime / duration) * 100))}%`,
                    transform: 'translateX(-50%)',
                    width: '3px',
                    height: 'calc(100% + 6px)',
                    borderRadius: '2px',
                    backgroundColor: '#fff',
                    boxShadow: '0 0 6px rgba(0,0,0,0.8)',
                    pointerEvents: 'none'
                  }}
                />
              )}

              {/* M3 Expressive Blocky Squircle Thumb */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${progressPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isHoveringScrubber || isScrubbing ? '12px' : '8px',
                  height: isHoveringScrubber || isScrubbing ? '24px' : '18px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--md-sys-color-primary, #a8c7fa)',
                  boxShadow: '0 0 12px rgba(168, 199, 250, 0.8), 0 2px 6px rgba(0, 0, 0, 0.4)',
                  transition: 'width 140ms ease, height 140ms ease, border-radius 140ms ease'
                }}
              />
            </div>
          </div>

          {/* Bottom Controls Row: Monospace Time Readout + Volume Slider + Chapter Chip + Theater Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            {/* Left: Time, Volume, and Active Chapter Chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
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
                  gap: '5px',
                  flexShrink: 0
                }}
              >
                <span>{formatTime(displayTime)}</span>
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
                  borderRadius: '10px',
                  flexShrink: 0
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

              {/* Active Chapter Pill (Ported from temp_koda ChapterTitleChip) */}
              {activeChapter && (
                <button
                  onClick={() => setIsChaptersSheetOpen(true)}
                  style={{
                    backgroundColor: 'rgba(18, 20, 24, 0.76)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(168, 199, 250, 0.25)',
                    borderRadius: '10px',
                    padding: '5px 10px',
                    color: '#e2e2e9',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: 0,
                    maxWidth: '260px'
                  }}
                  title="View all video chapters"
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '15px', color: '#a8c7fa', flexShrink: 0 }}
                  >
                    bookmarks
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {activeChapter.title}
                  </span>
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '15px', opacity: 0.7, flexShrink: 0 }}
                  >
                    chevron_right
                  </span>
                </button>
              )}
            </div>

            {/* Right: SponsorSegments indicator + Theater Mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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

        {/* Video Chapters Drawer Sheet (Mounted directly inside viewport for Fullscreen Support) */}
        {isChaptersSheetOpen && chapters.length > 0 && (
          <div
            onClick={() => setIsChaptersSheetOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(6px)',
              zIndex: 55,
              display: 'flex',
              justifyContent: 'flex-end',
              animation: 'kodaFadeIn 180ms ease'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(360px, 88%)',
                height: '100%',
                backgroundColor: 'rgba(16, 18, 24, 0.96)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                padding: '16px',
                gap: '12px',
                overflowY: 'auto'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '20px', color: '#a8c7fa' }}>
                    bookmarks
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    Chapters ({chapters.length})
                  </span>
                </div>
                <button
                  onClick={() => setIsChaptersSheetOpen(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                    close
                  </span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {chapters.map((ch, idx) => {
                  const isCurrent = activeChapter?.startSec === ch.startSec;
                  return (
                    <button
                      key={`${ch.startSec}-${idx}`}
                      onClick={() => {
                        seek(ch.startSec);
                        setIsChaptersSheetOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        backgroundColor: isCurrent
                          ? 'rgba(168, 199, 250, 0.18)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: isCurrent
                          ? '1px solid rgba(168, 199, 250, 0.45)'
                          : '1px solid rgba(255, 255, 255, 0.06)',
                        color: isCurrent ? '#d3e3fd' : '#e2e2e9',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: isCurrent ? 700 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {ch.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(168, 199, 250, 0.14)',
                          color: '#a8c7fa',
                          flexShrink: 0
                        }}
                      >
                        {formatTime(ch.startSec)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Koda Playback, Shaders & Audio Track Settings Sheet (Mounted directly inside viewport for 100% Fullscreen Support) */}
        <KodaPlaybackSettingsSheet
          open={isSettingsSheetOpen}
          isOpen={isSettingsSheetOpen}
          onClose={() => setIsSettingsSheetOpen(false)}
          initialTab={settingsInitialTab}
          isTheater={isTheater}
          timedCommentsActive={timedCommentsActive}
          onTimedCommentsChanged={setTimedCommentsActive}
          commentsOpen={isCommentsSheetOpen}
          onOpenComments={() => setIsCommentsSheetOpen(true)}
          onEnterPip={minimizeVideo}
          onListenAsMusic={listenAsMusic}
          onLockScreen={() => {
            setScreenLocked(true);
            setIsSettingsSheetOpen(false);
            showToastNotification('Touch controls locked');
          }}
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
