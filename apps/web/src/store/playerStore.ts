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
  YouTubeAudioTrackOption
} from '../types';
import { applyDynamicThemeFromImage } from '../theme/dynamicTheme';
import { useTasteStore } from './tasteStore';
import { resolveStream, prefetchStream } from '../api/streamResolver';
import { sizedArtwork } from '../api/artworkService';
import {
  asEntry,
  buildContextQueue,
  buildOneOffQueue,
  addToUserQueue,
  clearUpcomingUserQueue,
  extendStation,
  computeJump
} from '../playback/queueTimeline';
import { innertubeService } from '../api/innertubeService';
import { lyricsService } from '../api/lyricsService';

// Monotonic request counter for bulletproof track activation and race-condition prevention
let activePlaybackToken = 0;
let isFetchingRadio = false;
let sleepTimerHandle: any = null;

interface PlayerState {
  currentTrack: TrackMetadata | null;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isBuffering: boolean;
  repeatMode: RepeatMode;
  isShuffled: boolean;
  queue: QueueEntry[];
  queueIndex: number;
  videoQuality: VideoQuality;
  streamAudioUrl: string | null;
  streamVideoUrl: string | null;
  isExpanded: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  playerStyle: PlayerStyle;
  ambientBackground: boolean;
  autoplay: boolean;
  lyricsData: LyricsData | null;
  isLyricsLoading: boolean;

  // Video Mode State & Actions (Matching Koda VideoPlayerContent)
  currentVideo: VideoItem | null;
  isVideoWatchOpen: boolean;
  isMiniVideoPlayerOpen: boolean;
  videoPlaybackError: string | null;
  playVideo: (video: VideoItem) => Promise<void>;
  setVideoWatchOpen: (open: boolean) => void;
  setMiniVideoPlayerOpen: (open: boolean) => void;
  setVideoPlaybackError: (err: string | null) => void;
  minimizeVideo: () => void;
  closeVideo: () => void;
  listenAsMusic: () => Promise<void>;

  // Playback Control & Koda Features
  playbackSpeed: number;
  isHoldTo2x: boolean;
  audioTracks: YouTubeAudioTrackOption[];
  selectedAudioTrackId: string | null;
  isLooping: boolean;
  fitMode: 'fit' | 'fill';
  sleepTimerEndsAt: number | null;
  sleepTimerMinutes: number | null;
  setPlaybackSpeed: (speed: number) => void;
  setHoldTo2x: (active: boolean) => void;
  setAudioTrack: (trackId: string) => Promise<void>;
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
  updatePlaybackProgress: (currentTime: number, duration: number) => void;
  setBuffering: (isBuffering: boolean) => void;
  loadRadioQueue: (trackId: string) => Promise<void>;
  loadLyricsForTrack: (track: TrackMetadata, reqToken?: number) => Promise<void>;
  preloadUpcomingTracks: (tracks: TrackMetadata[]) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  playbackMode: 'music',
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isBuffering: false,
  repeatMode: 'off',
  isShuffled: false,
  queue: [],
  queueIndex: -1,
  videoQuality: 'auto',
  streamAudioUrl: null,
  streamVideoUrl: null,
  isExpanded: false,
  isLyricsOpen: false,
  isQueueOpen: false,
  playerStyle: (localStorage.getItem('koda_player_style') as PlayerStyle) || 'EDITORIAL',
  ambientBackground: localStorage.getItem('koda_ambient_bg') !== 'false',
  autoplay: localStorage.getItem('ourtube_autoplay') !== 'false',
  lyricsData: null,
  isLyricsLoading: false,
  currentVideo: null,
  isVideoWatchOpen: false,
  isMiniVideoPlayerOpen: false,
  videoPlaybackError: null,

  playbackSpeed: 1.0,
  isHoldTo2x: false,
  audioTracks: [],
  selectedAudioTrackId: null,
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
    const token = ++activePlaybackToken;
    set({
      currentVideo: video,
      playbackMode: 'video',
      isPlaying: true,
      isBuffering: true,
      isVideoWatchOpen: true,
      isMiniVideoPlayerOpen: false,
      videoPlaybackError: null,
      currentTime: 0,
      duration: video.duration || 180,
      isExpanded: false
    });

    try {
      applyDynamicThemeFromImage(video.thumbnailUrl);
    } catch {}

    try {
      const res = await resolveStream({
        videoId: video.id,
        quality: get().videoQuality,
        mode: 'video'
      });

      if (token === activePlaybackToken) {
        if (!res.videoUrl) {
          set({
            streamVideoUrl: null,
            streamAudioUrl: res.audioUrl || null,
            audioTracks: res.audioTracks || [],
            selectedAudioTrackId: res.selectedAudioTrackId || null,
            isBuffering: false,
            videoPlaybackError: 'Direct video stream could not be loaded. Tap below to retry or switch to embedded player.'
          });
        } else {
          set({
            streamVideoUrl: res.videoUrl,
            streamAudioUrl: res.audioUrl || res.videoUrl,
            audioTracks: res.audioTracks || [],
            selectedAudioTrackId: res.selectedAudioTrackId || null,
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
          videoPlaybackError: 'Stream resolution failed. Tap below to retry or switch to embedded player.'
        });
      }
    }
  },

  setVideoWatchOpen: (open: boolean) => {
    set({ isVideoWatchOpen: open });
  },

  setMiniVideoPlayerOpen: (open: boolean) => {
    set({ isMiniVideoPlayerOpen: open });
  },

  minimizeVideo: () => {
    set({ isVideoWatchOpen: false, isMiniVideoPlayerOpen: true });
  },

  closeVideo: () => {
    set({
      currentVideo: null,
      streamVideoUrl: null,
      isPlaying: false,
      isVideoWatchOpen: false,
      isMiniVideoPlayerOpen: false
    });
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
    set({ isLyricsLoading: true });
    try {
      const data = await lyricsService.getLyrics(
        track.title,
        track.artist,
        track.duration || 0,
        track.id
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

  loadRadioQueue: async (trackId: string) => {
    if (!get().autoplay || isFetchingRadio) return;
    isFetchingRadio = true;
    try {
      const candidates = await innertubeService.getWatchNextRadio(trackId);
      if (candidates.length > 0) {
        set((state) => {
          const additional = extendStation(state.queue, candidates, 25);
          return additional.length > 0 ? { queue: [...state.queue, ...additional] } : {};
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

        // Pre-fetch lyrics into hot cache for instant display
        lyricsService.getLyrics(
          track.title,
          track.artist,
          track.duration || 0,
          track.id
        ).catch(() => {});
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
      lyricsData: null,
      isLyricsLoading: true,
      isBuffering: true,
      currentTime: 0,
      duration: track.duration || 0
    });

    // Fetch rich lyrics in background bound to this exact sequence token
    get().loadLyricsForTrack(resolvedTrack, reqToken);

    // Record play into local playback history immediately
    useTasteStore.getState().recordPlayback(resolvedTrack, 0.1);

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

    // Resolve direct unencrypted stream URLs (AAC 140 / Opus 251)
    try {
      const mode = get().playbackMode;
      const res = await resolveStream({
        videoId: track.id,
        quality: get().videoQuality,
        mode
      });

      // Discard out-of-order responses if superseded by a newer track selection
      if (reqToken !== activePlaybackToken) {
        return;
      }

      if (res?.audioUrl) {
        set({
          streamAudioUrl: res.audioUrl,
          streamVideoUrl: res.videoUrl || null,
          isPlaying: true,
          isBuffering: false
        });

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

      // Record play into local taste profile
      useTasteStore.getState().recordPlayback(resolvedTrack, 0.1);
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

    set({
      queue,
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
    set({ currentTime: time });
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
    set({ playbackMode: mode });
    const current = get().currentTrack;
    if (current) {
      resolveStream({
        videoId: current.id,
        quality: get().videoQuality,
        mode
      }).then((res) => {
        set({
          streamAudioUrl: res.audioUrl || get().streamAudioUrl,
          streamVideoUrl: res.videoUrl || null
        });
      });
    }
  },

  setVideoQuality: (quality: VideoQuality) => {
    set({ videoQuality: quality });
    const currentVideoId = get().currentVideo?.id || (get().playbackMode === 'video' ? get().currentTrack?.id : null);
    if (currentVideoId) {
      resolveStream({
        videoId: currentVideoId,
        quality,
        mode: 'video',
        audioTrackId: get().selectedAudioTrackId || undefined
      }).then((res) => {
        if (res.videoUrl) {
          set({
            streamVideoUrl: res.videoUrl,
            streamAudioUrl: res.audioUrl || res.videoUrl,
            audioTracks: res.audioTracks || get().audioTracks
          });
        }
      });
    }
  },

  toggleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIdx = modes.indexOf(get().repeatMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    set({ repeatMode: nextMode });
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffled: !state.isShuffled }));
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

  updatePlaybackProgress: (currentTime: number, duration: number) => {
    set({ currentTime, duration: duration || get().duration });
  },

  setBuffering: (isBuffering: boolean) => {
    set({ isBuffering });
  }
}));
