import { create } from 'zustand';
import { TrackMetadata, PlaybackMode, VideoQuality, RepeatMode, PlayerStyle, LyricsData, QueueEntry } from '../types';
import { applyDynamicThemeFromImage } from '../theme/dynamicTheme';
import { useTasteStore } from './tasteStore';
import { resolveStream } from '../api/streamResolver';
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
  loadLyricsForTrack: (track: TrackMetadata) => Promise<void>;
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

  loadLyricsForTrack: async (track: TrackMetadata) => {
    set({ isLyricsLoading: true });
    try {
      const data = await lyricsService.getLyrics(
        track.title,
        track.artist,
        track.duration || 0,
        track.id
      );
      if (get().currentTrack?.id === track.id) {
        set({ lyricsData: data, isLyricsLoading: false });
      }
    } catch (err) {
      console.warn('[OurTube Player] Lyrics load error:', err);
      if (get().currentTrack?.id === track.id) {
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
    if (!get().autoplay) return;
    try {
      const candidates = await innertubeService.getWatchNextRadio(trackId);
      if (candidates.length > 0) {
        const currentQueue = get().queue;
        const additional = extendStation(currentQueue, candidates, 25);
        if (additional.length > 0) {
          set({ queue: [...currentQueue, ...additional] });
        }
      }
    } catch (err) {
      console.warn('[OurTube Player] loadRadioQueue error:', err);
    }
  },

  _streamAndActivateTrack: async (track: TrackMetadata) => {
    const highRes = sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 1200);
    const resolvedTrack: TrackMetadata = {
      ...track,
      highResThumbnailUrl: highRes
    };

    set({
      currentTrack: resolvedTrack,
      isBuffering: true,
      currentTime: 0,
      duration: track.duration || 0
    });

    // Fetch rich lyrics in background
    get().loadLyricsForTrack(resolvedTrack);

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

      if (res?.audioUrl) {
        set({
          streamAudioUrl: res.audioUrl,
          streamVideoUrl: res.videoUrl || null,
          isPlaying: true,
          isBuffering: false
        });
      } else {
        console.warn('[Koda Player] No direct audio stream URL returned for:', track.id);
        set({ isBuffering: false });
      }

      // Record play into local taste profile
      useTasteStore.getState().recordPlayback(resolvedTrack, 0.1);
    } catch (err) {
      console.warn('[Koda Player] Stream resolution failed:', err);
      set({ isBuffering: false });
    }
  },

  playTrack: async (track: TrackMetadata, newQueue?: TrackMetadata[], sourceTitle?: string) => {
    let queue: QueueEntry[] = [];
    let queueIndex = 0;

    if (newQueue && newQueue.length > 0) {
      const built = buildContextQueue(newQueue, 0, sourceTitle);
      queue = built.queue;
      queueIndex = queue.findIndex((e) => e.track.id === track.id);
      if (queueIndex === -1) {
        queue = [asEntry(track, 'context', sourceTitle), ...queue];
        queueIndex = 0;
      }
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

    // Autoplay Radio Extension: Seed YouTube Music watch-next radio when autoplay is enabled
    if (get().autoplay && (!newQueue || newQueue.length <= 1 || queue.length <= 2)) {
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
        nextIndex = 0;
      } else if (autoplay) {
        // Try extending radio queue before stopping
        const lastEntry = queue[queue.length - 1];
        if (lastEntry) {
          const candidates = await innertubeService.getWatchNextRadio(lastEntry.track.id);
          const additional = extendStation(queue, candidates, 25);
          if (additional.length > 0) {
            const extendedQueue = [...queue, ...additional];
            set({ queue: extendedQueue, queueIndex: nextIndex });
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

    // Pre-fetch next radio tracks if approaching end of queue
    if (autoplay && nextIndex >= queue.length - 3) {
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
    const current = get().currentTrack;
    if (current && get().playbackMode === 'video') {
      resolveStream({
        videoId: current.id,
        quality,
        mode: 'video'
      }).then((res) => {
        if (res.videoUrl) {
          set({ streamVideoUrl: res.videoUrl });
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
