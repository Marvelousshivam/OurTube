import { create } from 'zustand';
import {
  TrackMetadata,
  PlaybackMode,
  VideoQuality,
  RepeatMode,
  PlayerStyle,
  LyricsData,
  QueueEntry,
  VideoItem,
  YouTubeAudioTrackOption,
  YouTubeCaptionTrackOption
} from '../types';
import { applyDynamicThemeFromImage } from '../theme/dynamicTheme';
import { useTasteStore } from './tasteStore';
import { useSettingsStore } from './settingsStore';
import { resolveLosslessForTrack, type ResolvedLosslessStream } from '../api/losslessAddon';
import {
  resolveStream,
  prefetchStream,
  prefetchVideoStream,
  getCachedStream,
  invalidateStreamCache
} from '../api/streamResolver';
import { sizedArtwork } from '../api/artworkService';
import {
  asEntry,
  buildContextQueue,
  buildOneOffQueue,
  addToUserQueue,
  clearUpcomingUserQueue,
  extendStation,
  computeJump,
  shuffleUpcomingQueue
} from '../playback/queueTimeline';
import { innertubeService } from '../api/innertubeService';
import { lyricsService } from '../api/lyricsService';
import type { LyricsSourceId } from '../lyrics/sources';
import type { SourceState } from '../lyrics/repository';

// Monotonic request counter for bulletproof track activation and race-condition prevention
let activePlaybackToken = 0;
let isFetchingRadio = false;
let sleepTimerHandle: any = null;
let seekNonceCounter = 0;
let lastNonWatchHash = '#home';

export const ACTIVE_VIDEO_STORAGE_KEY = 'koda_last_active_video';

export function saveActiveVideoSnapshot(video: VideoItem | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!video) {
      localStorage.removeItem(ACTIVE_VIDEO_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_VIDEO_STORAGE_KEY, JSON.stringify(video));
    }
  } catch {}
}

export function loadActiveVideoSnapshot(videoId?: string): VideoItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_VIDEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VideoItem;
    if (!parsed || typeof parsed.id !== 'string') return null;
    if (videoId && parsed.id !== videoId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function syncVideoWatchUrl(videoId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const currentHash = window.location.hash || '#home';
    if (videoId) {
      if (!currentHash.startsWith('#watch')) {
        lastNonWatchHash = currentHash;
      }
      const targetHash = `#watch?v=${encodeURIComponent(videoId)}`;
      if (currentHash !== targetHash) {
        window.history.pushState(
          { kodaWatchVideoId: videoId, returnHash: lastNonWatchHash },
          '',
          targetHash
        );
      }
    } else if (currentHash.startsWith('#watch')) {
      const returnHash =
        (window.history.state && window.history.state.returnHash) ||
        lastNonWatchHash ||
        '#home';
      window.history.pushState({ kodaWatchVideoId: null }, '', returnHash);
    }
  } catch {}
}

export interface StreamSpec {
  isLossless: boolean;
  badgeText: string;
  shortBadgeText: string;
  codec: string;
  sampleRate?: number;
  bitDepth?: number;
  bitrateKbps?: number;
  sourceName: string;
  outputMode: 'WASAPI Exclusive (Bit-Perfect)' | 'Standard Shared Mixer';
  dacDeviceName?: string;
}

interface PlayerState {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  currentTime: number;
  bufferedTime: number;
  seekTarget: { time: number; nonce: number } | null;
  duration: number;
  volume: number;
  isMuted: boolean;
  isBuffering: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  stationMood: string;
  unshuffledQueue: QueueEntry[] | null;
  queue: QueueEntry[];
  queueIndex: number;
  videoQuality: VideoQuality;
  streamAudioUrl: string | null;
  streamVideoUrl: string | null;
  activeStreamSpec: StreamSpec | null;
  fallbackAudioUrl: string | null;
  setActiveStreamSpec: (spec: StreamSpec | null) => void;
  isExpanded: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  playerStyle: PlayerStyle;
  ambientBackground: boolean;
  autoplay: boolean;
  lyricsData: LyricsData | null;
  isLyricsLoading: boolean;
  lyricsSourceStates: Partial<Record<LyricsSourceId, SourceState>>;
  selectedLyricsSource: LyricsSourceId | null;
  lyricsTimingOffsetMs: number;
  setSelectedLyricsSource: (source: LyricsSourceId | null) => Promise<void>;
  setLyricsTimingOffsetMs: (offsetMs: number) => void;
  reloadCurrentLyrics: () => Promise<void>;

  // Video Mode State & Actions (Matching Koda VideoPlayerContent)
  currentVideo: VideoItem | null;
  isVideoWatchOpen: boolean;
  isMiniVideoPlayerOpen: boolean;
  videoPlaybackError: string | null;
  activeChannel: { id?: string; name: string; avatarUrl?: string } | null;
  openChannel: (channel: { id?: string; name: string; avatarUrl?: string }) => void;
  closeChannel: () => void;
  playVideo: (video: VideoItem) => Promise<void>;
  hydrateCurrentVideo: (partial: Partial<VideoItem>) => void;
  setVideoWatchOpen: (open: boolean) => void;
  setMiniVideoPlayerOpen: (open: boolean) => void;
  setVideoPlaybackError: (err: string | null) => void;
  minimizeVideo: () => void;
  closeVideo: () => void;
  listenAsMusic: () => Promise<void>;
  retryVideoStream: (fallbackQuality?: VideoQuality) => Promise<boolean>;

  // Playback Control & Koda Features
  playbackSpeed: number;
  isHoldTo2x: boolean;
  audioTracks: YouTubeAudioTrackOption[];
  selectedAudioTrackId: string | null;
  captionTracks: YouTubeCaptionTrackOption[];
  selectedCaptionTrackId: string | null;
  resumedFromSeconds: number | null;
  isLooping: boolean;
  fitMode: 'fit' | 'fill';
  sleepTimerEndsAt: number | null;
  sleepTimerMinutes: number | null;
  setPlaybackSpeed: (speed: number) => void;
  setHoldTo2x: (active: boolean) => void;
  setAudioTrack: (trackId: string) => Promise<void>;
  setCaptionTrack: (trackId: string | null) => void;
  clearResumedFrom: () => void;
  preloadRelatedVideoStreams: (videoIds: string[]) => void;
  toggleLoop: () => void;
  toggleFitMode: () => void;
  setSleepTimer: (minutes: number | null) => void;

  // Actions
  playTrack: (track: TrackMetadata, newQueue?: TrackMetadata[], sourceTitle?: string) => Promise<void>;
  jumpToQueueIndex: (index: number) => Promise<void>;
  _streamAndActivateTrack: (track: TrackMetadata) => Promise<void>;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleAutoplay: () => void;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setVideoQuality: (quality: VideoQuality) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setExpanded: (expanded: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  setPlayerStyle: (style: PlayerStyle) => void;
  setAmbientBackground: (enabled: boolean) => void;
  addToQueue: (track: TrackMetadata, playNext?: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearUserQueue: () => void;
  updatePlaybackProgress: (currentTime: number, duration: number, bufferedTime?: number) => void;
  setBuffering: (isBuffering: boolean) => void;
  loadRadioQueue: (trackId: string, mood?: string) => Promise<void>;
  loadLyricsForTrack: (track: TrackMetadata, reqToken?: number) => Promise<void>;
  preloadUpcomingTracks: (tracks: TrackMetadata[]) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  playbackMode: 'music',
  currentTime: 0,
  bufferedTime: 0,
  seekTarget: null,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isBuffering: false,
  repeatMode: 'off',
  isShuffled: false,
  stationMood: 'All',
  unshuffledQueue: null,
  queue: [],
  queueIndex: -1,
  videoQuality: (localStorage.getItem('koda_video_quality')?.replace(/"/g, '') as VideoQuality) || 'auto',
  streamAudioUrl: null,
  streamVideoUrl: null,
  activeStreamSpec: null,
  fallbackAudioUrl: null,
  setActiveStreamSpec: (spec) => set({ activeStreamSpec: spec }),
  isExpanded: false,
  isLyricsOpen: false,
  isQueueOpen: false,
  playerStyle: (localStorage.getItem('koda_player_style') as PlayerStyle) || 'EDITORIAL',
  ambientBackground: localStorage.getItem('koda_ambient_bg') !== 'false',
  autoplay: localStorage.getItem('koda_auto_load_queue') !== 'false' && localStorage.getItem('ourtube_autoplay') !== 'false',
  lyricsData: null,
  isLyricsLoading: false,
  lyricsSourceStates: {},
  selectedLyricsSource: null,
  lyricsTimingOffsetMs: 0,
  currentVideo: null,
  isVideoWatchOpen: false,
  isMiniVideoPlayerOpen: false,
  videoPlaybackError: null,
  activeChannel: null,

  openChannel: (channel) => {
    set({ activeChannel: channel });
  },

  closeChannel: () => {
    set({ activeChannel: null });
  },

  playbackSpeed: 1.0,
  isHoldTo2x: false,
  audioTracks: [],
  selectedAudioTrackId: null,
  captionTracks: [],
  selectedCaptionTrackId: null,
  resumedFromSeconds: null,
  isLooping: false,
  fitMode: 'fit',
  sleepTimerEndsAt: null,
  sleepTimerMinutes: null,

  setVideoPlaybackError: (err: string | null) => {
    set({ videoPlaybackError: err });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  setHoldTo2x: (active: boolean) => {
    set({ isHoldTo2x: active });
  },

  setCaptionTrack: (trackId: string | null) => {
    set({ selectedCaptionTrackId: trackId });
  },

  clearResumedFrom: () => {
    set({ resumedFromSeconds: null });
  },

  preloadRelatedVideoStreams: (videoIds: string[]) => {
    const quality = get().videoQuality;
    const firstId = videoIds.find((id) => Boolean(id));
    if (!firstId) return;
    setTimeout(() => {
      prefetchVideoStream(firstId, quality);
    }, 1500);
  },

  setAudioTrack: async (trackId: string) => {
    const track = get().audioTracks.find((t) => t.id === trackId);
    if (track?.url) {
      set({
        streamAudioUrl: track.url,
        selectedAudioTrackId: trackId
      });
      return;
    }
    const currentVideoId = get().currentVideo?.id || get().currentTrack?.id;
    if (currentVideoId) {
      set({ isBuffering: true });
      try {
        const res = await resolveStream({
          videoId: currentVideoId,
          quality: get().videoQuality,
          mode: 'video',
          audioTrackId: trackId
        });
        if (res.audioUrl) {
          set({
            streamAudioUrl: res.audioUrl,
            selectedAudioTrackId: trackId,
            audioTracks: res.audioTracks || get().audioTracks,
            isBuffering: false
          });
        } else {
          set({ isBuffering: false });
        }
      } catch {
        set({ isBuffering: false });
      }
    }
  },

  toggleLoop: () => {
    set((state) => ({ isLooping: !state.isLooping }));
  },

  toggleFitMode: () => {
    set((state) => ({ fitMode: state.fitMode === 'fit' ? 'fill' : 'fit' }));
  },

  setSleepTimer: (minutes: number | null) => {
    if (sleepTimerHandle) {
      clearTimeout(sleepTimerHandle);
      sleepTimerHandle = null;
    }
    if (minutes === null || minutes <= 0) {
      set({ sleepTimerEndsAt: null, sleepTimerMinutes: null });
      return;
    }
    const endsAt = Date.now() + minutes * 60 * 1000;
    set({ sleepTimerEndsAt: endsAt, sleepTimerMinutes: minutes });
    sleepTimerHandle = setTimeout(() => {
      set({ isPlaying: false, sleepTimerEndsAt: null, sleepTimerMinutes: null });
    }, minutes * 60 * 1000);
  },

  playVideo: async (video: VideoItem) => {
    saveActiveVideoSnapshot(video);
    syncVideoWatchUrl(video.id);

    // If already playing this exact video in MiniVideoPlayer, just expand it without resetting currentTime
    const existingVideo = get().currentVideo;
    if (
      existingVideo?.id === video.id &&
      get().streamVideoUrl &&
      !get().videoPlaybackError
    ) {
      set({
        isVideoWatchOpen: true,
        isMiniVideoPlayerOpen: false,
        isPlaying: true
      });
      return;
    }

    const token = ++activePlaybackToken;
    const savedEntry = useTasteStore
      .getState()
      .videoHistory.find((v) => v.id === video.id);
    const savedResumeTime =
      savedEntry?.resumeTimeSeconds &&
      savedEntry.resumeTimeSeconds > 5 &&
      (savedEntry.watchedPercentage || 0) < 95
        ? savedEntry.resumeTimeSeconds
        : 0;

    // Zero-wait synchronous cache check (when pre-warmed by card hover or Up-Next queue)
    const activeQuality = get().videoQuality;
    const instantCached = getCachedStream({
      videoId: video.id,
      quality: activeQuality,
      mode: 'video'
    });

    set({
      currentVideo: video,
      playbackMode: 'video',
      isPlaying: true,
      isBuffering: !instantCached?.videoUrl,
      isVideoWatchOpen: true,
      isMiniVideoPlayerOpen: false,
      videoPlaybackError: null,
      // Immediately set cached stream or clear previous video's stream so old video never bleeds through
      streamVideoUrl: instantCached?.videoUrl || null,
      streamAudioUrl: instantCached?.videoUrl
        ? instantCached.audioUrl || instantCached.videoUrl
        : null,
      audioTracks: instantCached?.audioTracks || [],
      selectedAudioTrackId: instantCached?.selectedAudioTrackId || null,
      captionTracks: instantCached?.captionTracks || [],
      selectedCaptionTrackId: null,
      resumedFromSeconds: savedResumeTime >= 5 ? savedResumeTime : null,
      currentTime: savedResumeTime,
      bufferedTime: 0,
      seekTarget: savedResumeTime > 0 ? { time: savedResumeTime, nonce: ++seekNonceCounter } : null,
      duration: video.duration || 180,
      isExpanded: false
    });

    try {
      applyDynamicThemeFromImage(video.thumbnailUrl);
    } catch {}

    // Record video play into dedicated Video Mode history (never pollute Music Mode history)
    useTasteStore.getState().recordVideoPlayback({
      id: video.id,
      title: video.title,
      channelName: video.channelName,
      channelId: video.channelId,
      channelIconUrl: video.channelIconUrl,
      duration: video.duration || 180,
      thumbnailUrl: video.thumbnailUrl,
      viewCountText: video.viewCount
    });

    if (instantCached?.videoUrl) {
      return;
    }

    try {
      const res = await resolveStream({
        videoId: video.id,
        quality: activeQuality,
        mode: 'video'
      });

      if (token === activePlaybackToken) {
        if (!res.videoUrl) {
          set({
            streamVideoUrl: null,
            streamAudioUrl: res.audioUrl || null,
            audioTracks: res.audioTracks || [],
            selectedAudioTrackId: res.selectedAudioTrackId || null,
            captionTracks: res.captionTracks || [],
            isBuffering: false,
            videoPlaybackError: 'Direct video stream could not be loaded. Tap Retry Stream below.'
          });
        } else {
          set({
            streamVideoUrl: res.videoUrl,
            streamAudioUrl: res.audioUrl || res.videoUrl,
            audioTracks: res.audioTracks || [],
            selectedAudioTrackId: res.selectedAudioTrackId || null,
            captionTracks: res.captionTracks || [],
            isBuffering: false,
            videoPlaybackError: null
          });
        }
      }
    } catch (err) {
      console.warn('[PlayerStore] Video stream resolution error:', err);
      if (token === activePlaybackToken) {
        set({
          isBuffering: false,
          videoPlaybackError: 'Stream resolution failed. Tap Retry Stream below.'
        });
      }
    }
  },

  hydrateCurrentVideo: (partial: Partial<VideoItem>) => {
    const existing = get().currentVideo;
    if (!existing) return;
    const updated: VideoItem = {
      ...existing,
      ...partial,
      id: existing.id
    };
    set({ currentVideo: updated });
    saveActiveVideoSnapshot(updated);
    if (updated.title && updated.title !== 'Loading video...') {
      useTasteStore.getState().recordVideoPlayback({
        id: updated.id,
        title: updated.title,
        channelName: updated.channelName,
        channelId: updated.channelId,
        channelIconUrl: updated.channelIconUrl,
        duration: updated.duration || get().duration || 180,
        thumbnailUrl: updated.thumbnailUrl,
        viewCountText: updated.viewCount
      });
    }
  },

  setVideoWatchOpen: (open: boolean) => {
    const currentVideo = get().currentVideo;
    if (open && currentVideo?.id) {
      syncVideoWatchUrl(currentVideo.id);
    } else if (!open) {
      syncVideoWatchUrl(null);
    }
    set({ isVideoWatchOpen: open });
  },

  setMiniVideoPlayerOpen: (open: boolean) => {
    set({ isMiniVideoPlayerOpen: open });
  },

  minimizeVideo: () => {
    syncVideoWatchUrl(null);
    set({ isVideoWatchOpen: false, isMiniVideoPlayerOpen: true });
  },

  closeVideo: () => {
    saveActiveVideoSnapshot(null);
    syncVideoWatchUrl(null);
    set({
      currentVideo: null,
      streamVideoUrl: null,
      isPlaying: false,
      isVideoWatchOpen: false,
      isMiniVideoPlayerOpen: false
    });
  },

  retryVideoStream: async (fallbackQuality?: VideoQuality) => {
    const video = get().currentVideo;
    if (!video) return false;
    const savedTime = get().currentTime;
    const targetQuality = fallbackQuality || get().videoQuality;
    invalidateStreamCache(video.id);

    set({
      isBuffering: true,
      videoPlaybackError: null,
      videoQuality: targetQuality
    });

    try {
      const res = await resolveStream({
        videoId: video.id,
        quality: targetQuality,
        mode: 'video',
        audioTrackId: get().selectedAudioTrackId || undefined
      });

      if (res?.videoUrl) {
        set({
          streamVideoUrl: res.videoUrl,
          streamAudioUrl: res.audioUrl || res.videoUrl,
          audioTracks: res.audioTracks || get().audioTracks,
          selectedAudioTrackId: res.selectedAudioTrackId || get().selectedAudioTrackId,
          seekTarget: savedTime > 0 ? { time: savedTime, nonce: ++seekNonceCounter } : null,
          isBuffering: false,
          videoPlaybackError: null,
          isPlaying: true
        });
        return true;
      }
      set({ isBuffering: false });
      return false;
    } catch {
      set({ isBuffering: false });
      return false;
    }
  },

  listenAsMusic: async () => {
    const video = get().currentVideo;
    if (!video) return;

    const track: TrackMetadata = {
      id: video.id,
      title: video.title,
      artist: video.channelName,
      artistId: video.channelId,
      duration: video.duration,
      thumbnailUrl: video.thumbnailUrl,
      highResThumbnailUrl: video.thumbnailUrl
    };

    set({
      isVideoWatchOpen: false,
      isMiniVideoPlayerOpen: false,
      playbackMode: 'music',
      currentTrack: track,
      isExpanded: true
    });

    await get().playTrack(track);
  },

  loadLyricsForTrack: async (track: TrackMetadata, reqToken?: number) => {
    const activeOnly = get().selectedLyricsSource ?? undefined;
    set({
      isLyricsLoading: true,
      ...(activeOnly ? {} : { lyricsSourceStates: {} })
    });
    try {
      // Avoid passing the dummy 210s placeholder duration from cards without duration labels
      const rawDur = track.duration && track.duration !== 210 ? track.duration : (get().duration && get().duration !== 210 ? get().duration : 0);
      const data = await lyricsService.getLyrics(
        track.title,
        track.artist,
        rawDur,
        track.id,
        track.album || null,
        {
          only: activeOnly,
          onSource: (source, state) => {
            if (get().currentTrack?.id === track.id) {
              set((prev) => ({
                lyricsSourceStates: {
                  ...prev.lyricsSourceStates,
                  [source]: state
                }
              }));
            }
          }
        }
      );
      // Sequence token check: only apply lyrics if this request hasn't been superseded
      if ((reqToken === undefined || reqToken === activePlaybackToken) && get().currentTrack?.id === track.id) {
        set({ lyricsData: data, isLyricsLoading: false });
      }
    } catch (err) {
      console.warn('[OurTube Player] Lyrics load error:', err);
      if ((reqToken === undefined || reqToken === activePlaybackToken) && get().currentTrack?.id === track.id) {
        set({ lyricsData: null, isLyricsLoading: false });
      }
    }
  },

  setSelectedLyricsSource: async (source: LyricsSourceId | null) => {
    set({ selectedLyricsSource: source });
    const track = get().currentTrack;
    if (track) {
      await get().loadLyricsForTrack(track);
    }
  },

  setLyricsTimingOffsetMs: (offsetMs: number) => {
    set({ lyricsTimingOffsetMs: Math.max(-10000, Math.min(10000, Math.round(offsetMs))) });
  },

  reloadCurrentLyrics: async () => {
    const track = get().currentTrack;
    if (track) {
      await get().loadLyricsForTrack(track);
    }
  },

  toggleAutoplay: () => {
    const next = !get().autoplay;
    localStorage.setItem('ourtube_autoplay', String(next));
    set({ autoplay: next });
    if (next && get().currentTrack) {
      get().loadRadioQueue(get().currentTrack!.id);
    }
  },

  setPlayerStyle: (style: PlayerStyle) => {
    localStorage.setItem('koda_player_style', style);
    set({ playerStyle: style });
  },

  setAmbientBackground: (enabled: boolean) => {
    localStorage.setItem('koda_ambient_bg', String(enabled));
    set({ ambientBackground: enabled });
  },

  loadRadioQueue: async (trackId: string, mood?: string) => {
    const activeMood = mood || get().stationMood || 'All';
    if (mood) {
      set({ stationMood: mood });
    }
    if ((!get().autoplay && !mood) || isFetchingRadio) return;
    isFetchingRadio = true;
    try {
      let candidates = await innertubeService.getWatchNextRadio(trackId);
      const filterExplicit = localStorage.getItem('koda_filter_explicit') === 'true';
      if (filterExplicit) {
        candidates = candidates.filter((c) => !c.isExplicit);
      }

      if (activeMood === 'Familiar') {
        const taste = useTasteStore.getState();
        const knownArtists = new Set([
          ...taste.history.map((h) => h.artist.toLowerCase()),
          ...taste.likedTracks.map((t) => t.artist.toLowerCase()),
          ...taste.pickedArtists.map((a) => a.toLowerCase())
        ]);
        const familiar = candidates.filter((c) => knownArtists.has((c.artist || '').toLowerCase()));
        const rest = candidates.filter((c) => !knownArtists.has((c.artist || '').toLowerCase()));
        candidates = [...familiar, ...rest];
      } else if (activeMood === 'Discover') {
        const taste = useTasteStore.getState();
        const playedIds = new Set(taste.history.map((h) => h.trackId));
        const unplayed = candidates.filter((c) => !playedIds.has(c.id));
        const rest = candidates.filter((c) => playedIds.has(c.id));
        candidates = [...unplayed, ...rest];
      } else if (activeMood === 'Deep cuts') {
        candidates = [...candidates].reverse();
      }

      if (candidates.length > 0) {
        set((state) => {
          // If user explicitly switched station mood chip, refresh upcoming autoplay tier
          const baseQueue = mood
            ? state.queue.filter((entry, idx) => idx <= state.queueIndex || entry.tier !== 'autoplay')
            : state.queue;
          const maxPerArtist = activeMood === 'Discover' ? 1 : 2;
          const additional = extendStation(baseQueue, candidates, 25, maxPerArtist);
          return additional.length > 0 ? { queue: [...baseQueue, ...additional] } : {};
        });
      }
    } catch (err) {
      console.warn('[OurTube Player] loadRadioQueue error:', err);
    } finally {
      isFetchingRadio = false;
    }
  },

  preloadUpcomingTracks: async (tracks: TrackMetadata[]) => {
    for (const track of tracks) {
      if (!track?.id) continue;
      try {
        // Pre-resolve direct audio stream URLs in background so upcoming tracks play in 0ms
        prefetchStream({
          videoId: track.id,
          quality: get().videoQuality,
          mode: get().playbackMode
        }).catch(() => {});
      } catch {}
    }
  },

  _streamAndActivateTrack: async (track: TrackMetadata) => {
    const reqToken = ++activePlaybackToken;
    const highRes = sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 1200);
    const resolvedTrack: TrackMetadata = {
      ...track,
      highResThumbnailUrl: highRes
    };

    // Synchronously clear previous track's audio & lyrics so they never leak into the new track
    set({
      currentTrack: resolvedTrack,
      streamAudioUrl: null,
      streamVideoUrl: null,
      activeStreamSpec: null,
      fallbackAudioUrl: null,
      lyricsData: null,
      isLyricsLoading: true,
      lyricsSourceStates: {},
      selectedLyricsSource: null,
      lyricsTimingOffsetMs: 0,
      isBuffering: true,
      currentTime: 0,
      duration: track.duration || 0
    });

    // Fetch rich lyrics in background bound to this exact sequence token
    get().loadLyricsForTrack(resolvedTrack, reqToken);

    // Dynamically apply M3 Expressive theme extracted from album cover
    applyDynamicThemeFromImage(highRes);

    // Update OS MediaSession controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'OurTube',
        artwork: [
          { src: highRes, sizes: '512x512', type: 'image/jpeg' },
          { src: highRes, sizes: '1200x1200', type: 'image/jpeg' }
        ]
      });
    }

    // Resolve stream URLs: race lossless addon resolution if user has enabled extensions
    try {
      const mode = get().playbackMode;
      const settings = useSettingsStore.getState();
      const hasEnabledAddons =
        settings.losslessEnabled && settings.losslessAddons.some((a) => a.enabled);

      const ytPromise = resolveStream({
        videoId: track.id,
        quality: get().videoQuality,
        mode
      });

      const losslessPromise =
        hasEnabledAddons && mode === 'music'
          ? resolveLosslessForTrack(track, settings.losslessAddons, settings.rzZombieTracker)
          : Promise.resolve(null);

      const [res, losslessRes] = await Promise.all([ytPromise, losslessPromise]);

      // Discard out-of-order responses if superseded by a newer track selection
      if (reqToken !== activePlaybackToken) {
        return;
      }

      if (losslessRes?.url) {
        const isDacBitPerfect =
          settings.dacBitPerfectExclusive &&
          typeof window !== 'undefined' &&
          Boolean((window as any).__TAURI_INTERNALS__);

        const sampleRate = losslessRes.sampleRate || 44100;
        const bitDepth = losslessRes.bitDepth || 16;
        const codec = losslessRes.codec || 'FLAC';
        const rateKhz = (sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1);

        const badgeText = isDacBitPerfect
          ? `${bitDepth}-BIT / ${rateKhz}KHZ ${codec} • BIT-PERFECT`
          : `${bitDepth}-BIT / ${rateKhz}KHZ ${codec} • ${bitDepth >= 24 ? 'HI-RES' : 'LOSSLESS'}`;
        const shortBadgeText = isDacBitPerfect
          ? `${bitDepth}-BIT ${codec} • BIT-PERFECT`
          : `${bitDepth}-BIT ${codec}`;

        set({
          streamAudioUrl: losslessRes.url,
          fallbackAudioUrl: res?.audioUrl || null,
          streamVideoUrl: null,
          isPlaying: true,
          isBuffering: false,
          activeStreamSpec: {
            isLossless: true,
            badgeText,
            shortBadgeText,
            codec,
            sampleRate,
            bitDepth,
            bitrateKbps: losslessRes.bitrateKbps,
            sourceName: losslessRes.addonName,
            outputMode: isDacBitPerfect ? 'WASAPI Exclusive (Bit-Perfect)' : 'Standard Shared Mixer'
          }
        });

        // Record play into local taste profile
        useTasteStore.getState().recordPlayback(resolvedTrack, 0.1);

        // Pre-cache upcoming tracks
        const { queue, queueIndex } = get();
        const upcoming = queue.slice(queueIndex + 1, queueIndex + 4).map((e) => e.track);
        if (upcoming.length > 0) {
          get().preloadUpcomingTracks(upcoming);
        }
      } else if (res?.audioUrl) {
        set({
          streamAudioUrl: res.audioUrl,
          fallbackAudioUrl: null,
          streamVideoUrl: res.videoUrl || null,
          isPlaying: true,
          isBuffering: false,
          activeStreamSpec: {
            isLossless: false,
            badgeText: '256k AAC • STUDIO',
            shortBadgeText: '256k AAC',
            codec: 'AAC',
            bitrateKbps: 256,
            sourceName: 'YouTube Music',
            outputMode: 'Standard Shared Mixer'
          }
        });

        // Record play into local taste profile once stream resolves
        useTasteStore.getState().recordPlayback(resolvedTrack, 0.1);

        // Pre-cache the next 2-3 tracks in queue for seamless, gapless playback
        const { queue, queueIndex } = get();
        const upcoming = queue.slice(queueIndex + 1, queueIndex + 4).map((e) => e.track);
        if (upcoming.length > 0) {
          get().preloadUpcomingTracks(upcoming);
        }
      } else {
        console.warn('[OurTube Player] No direct audio stream URL returned for:', track.id);
        set({ isBuffering: false });
      }
    } catch (err) {
      if (reqToken === activePlaybackToken) {
        console.warn('[OurTube Player] Stream resolution failed:', err);
        set({ isBuffering: false });
      }
    }
  },

  playTrack: async (track: TrackMetadata, newQueue?: TrackMetadata[], sourceTitle?: string) => {
    let queue: QueueEntry[] = [];
    let queueIndex = 0;

    if (newQueue && newQueue.length > 0) {
      // Preserve upcoming user queue from the existing timeline
      const currentQueue = get().queue;
      const currentIndex = get().queueIndex;
      const preservedUserQueue = (currentIndex >= 0 && currentIndex < currentQueue.length)
        ? currentQueue.slice(currentIndex + 1).filter((e) => e.tier === 'user')
        : [];

      const clickedIndex = newQueue.findIndex((t) => t.id === track.id);
      const targetIndex = clickedIndex >= 0 ? clickedIndex : 0;
      const built = buildContextQueue(newQueue, targetIndex, sourceTitle, preservedUserQueue);
      queue = built.queue;
      queueIndex = built.queueIndex;
    } else {
      // Single track played (e.g. from Search): start new single track context and seed YouTube Music autoplay radio
      const built = buildOneOffQueue(track);
      queue = built.queue;
      queueIndex = built.queueIndex;
    }

    const unshuffledQueue = [...queue];
    if (get().isShuffled && queue.length > queueIndex + 2) {
      queue = shuffleUpcomingQueue(queue, queueIndex);
    }

    set({
      queue,
      unshuffledQueue,
      queueIndex
    });

    await get()._streamAndActivateTrack(track);

    // Autoplay Radio Extension: Seed YouTube Music watch-next radio ONLY when playing a single track (not a playlist)
    if (get().autoplay && (!newQueue || newQueue.length <= 1)) {
      get().loadRadioQueue(track.id);
    }
  },

  jumpToQueueIndex: async (index: number) => {
    const { queue, queueIndex } = get();
    if (index < 0 || index >= queue.length) return;

    const { newQueue, newIndex, shouldPivotStation } = computeJump(queue, queueIndex, index);
    const targetTrack = newQueue[newIndex].track;

    set({
      queue: newQueue,
      queueIndex: newIndex
    });

    await get()._streamAndActivateTrack(targetTrack);

    if (shouldPivotStation) {
      get().loadRadioQueue(targetTrack.id);
    }
  },

  togglePlay: () => {
    const isPlaying = !get().isPlaying;
    set({ isPlaying });
  },

  seek: (time: number) => {
    const clamped = Math.max(0, time);
    set({
      currentTime: clamped,
      seekTarget: { time: clamped, nonce: ++seekNonceCounter }
    });
  },

  setVolume: (volume: number) => {
    set({ volume: Math.max(0, Math.min(1, volume)), isMuted: false });
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  nextTrack: async () => {
    const { queue, queueIndex, repeatMode, autoplay } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'one' && get().currentTrack) {
      get().seek(0);
      set({ isPlaying: true });
      return;
    }

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        // Cycle back to the first context or user entry
        const firstPlayable = queue.findIndex((e) => e.tier === 'context' || e.tier === 'user');
        nextIndex = firstPlayable !== -1 ? firstPlayable : 0;
        set({ queueIndex: nextIndex });
        await get()._streamAndActivateTrack(queue[nextIndex].track);
        return;
      } else if (autoplay) {
        // Extend radio queue ONLY when queue is genuinely exhausted
        const lastEntry = queue[queue.length - 1];
        if (lastEntry) {
          const candidates = await innertubeService.getWatchNextRadio(lastEntry.track.id);
          let extendedQueue: QueueEntry[] = [];
          set((state) => {
            const additional = extendStation(state.queue, candidates, 25);
            if (additional.length > 0) {
              extendedQueue = [...state.queue, ...additional];
              return { queue: extendedQueue, queueIndex: nextIndex };
            }
            return {};
          });
          if (extendedQueue.length > nextIndex) {
            await get()._streamAndActivateTrack(extendedQueue[nextIndex].track);
            return;
          }
        }
        set({ isPlaying: false });
        return;
      } else {
        set({ isPlaying: false });
        return;
      }
    }

    // Autoplay pre-fetch guard (YouTube Music / BitChord alignment):
    // Only pre-fetch next radio tracks if:
    // 1. autoplay is ON
    // 2. repeatMode is 'off' (repeat-all loops the playlist)
    // 3. NO remaining upcoming context tracks exist in the queue (playlist has finished)
    const remainingContext = queue.slice(nextIndex).filter((e) => e.tier === 'context');
    if (autoplay && repeatMode === 'off' && remainingContext.length === 0 && nextIndex >= queue.length - 2) {
      const currentTrackId = queue[nextIndex]?.track.id || queue[0]?.track.id;
      if (currentTrackId) {
        get().loadRadioQueue(currentTrackId);
      }
    }

    set({ queueIndex: nextIndex });
    await get()._streamAndActivateTrack(queue[nextIndex].track);
  },

  prevTrack: async () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 3) {
      get().seek(0);
      return;
    }
    if (queue.length === 0) return;

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    set({ queueIndex: prevIndex });
    await get()._streamAndActivateTrack(queue[prevIndex].track);
  },

  setPlaybackMode: (mode: PlaybackMode) => {
    const current = get().currentTrack;
    const savedTime = get().currentTime;
    set({ playbackMode: mode });
    if (current) {
      resolveStream({
        videoId: current.id,
        quality: get().videoQuality,
        mode
      }).then((res) => {
        const latestTime = get().currentTime || savedTime;
        set({
          streamAudioUrl: res.audioUrl || get().streamAudioUrl,
          streamVideoUrl: res.videoUrl || null,
          seekTarget: latestTime > 0.5 ? { time: latestTime, nonce: ++seekNonceCounter } : get().seekTarget
        });
      });
    }
  },

  setVideoQuality: (quality: VideoQuality) => {
    try {
      localStorage.setItem('koda_video_quality', quality);
    } catch {}
    const preservedTime = get().currentTime;
    set({ videoQuality: quality, isBuffering: true });
    const currentVideoId = get().currentVideo?.id || (get().playbackMode === 'video' ? get().currentTrack?.id : null);
    if (currentVideoId) {
      resolveStream({
        videoId: currentVideoId,
        quality,
        mode: 'video',
        audioTrackId: get().selectedAudioTrackId || undefined
      })
        .then((res) => {
          if (res.videoUrl) {
            const latestTime = get().currentTime || preservedTime;
            set({
              streamVideoUrl: res.videoUrl,
              streamAudioUrl: res.audioUrl || res.videoUrl,
              audioTracks: res.audioTracks || get().audioTracks,
              seekTarget: latestTime > 0 ? { time: latestTime, nonce: ++seekNonceCounter } : null,
              isBuffering: false
            });
          } else {
            set({ isBuffering: false });
          }
        })
        .catch(() => {
          set({ isBuffering: false });
        });
    } else {
      set({ isBuffering: false });
    }
  },

  toggleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIdx = modes.indexOf(get().repeatMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    set({ repeatMode: nextMode });
  },

  toggleShuffle: () => {
    set((state) => {
      const nextShuffled = !state.isShuffled;
      if (nextShuffled) {
        const unshuffled = state.unshuffledQueue || [...state.queue];
        const shuffled = shuffleUpcomingQueue(state.queue, state.queueIndex);
        return {
          isShuffled: true,
          unshuffledQueue: unshuffled,
          queue: shuffled
        };
      } else {
        if (state.unshuffledQueue && state.currentTrack) {
          const currentId = state.currentTrack.id;
          const restoredIdx = state.unshuffledQueue.findIndex((e) => e.track.id === currentId);
          if (restoredIdx !== -1) {
            return {
              isShuffled: false,
              queue: state.unshuffledQueue,
              queueIndex: restoredIdx,
              unshuffledQueue: null
            };
          }
        }
        return { isShuffled: false, unshuffledQueue: null };
      }
    });
  },

  setExpanded: (expanded: boolean) => {
    set({ isExpanded: expanded });
  },

  setLyricsOpen: (open: boolean) => {
    set({ isLyricsOpen: open, isQueueOpen: open ? false : get().isQueueOpen });
  },

  setQueueOpen: (open: boolean) => {
    set({ isQueueOpen: open, isLyricsOpen: open ? false : get().isLyricsOpen });
  },

  addToQueue: (track: TrackMetadata, playNext: boolean = false) => {
    const { queue, queueIndex } = get();
    const result = addToUserQueue(queue, queueIndex, track, playNext);
    set({ queue: result.queue });
  },

  clearUserQueue: () => {
    const { queue, queueIndex } = get();
    const cleared = clearUpcomingUserQueue(queue, queueIndex);
    set({ queue: cleared });
  },

  removeFromQueue: (index: number) => {
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(index, 1);
      let newQueueIndex = state.queueIndex;
      if (index < state.queueIndex) {
        newQueueIndex = Math.max(0, state.queueIndex - 1);
      } else if (newQueueIndex >= newQueue.length) {
        newQueueIndex = Math.max(0, newQueue.length - 1);
      }
      return { queue: newQueue, queueIndex: newQueueIndex };
    });
  },

  updatePlaybackProgress: (currentTime: number, duration: number, bufferedTime?: number) => {
    set({
      currentTime,
      duration: duration || get().duration,
      ...(bufferedTime !== undefined ? { bufferedTime } : {})
    });
  },

  setBuffering: (isBuffering: boolean) => {
    set({ isBuffering });
  }
}));
