import { create } from 'zustand';
import { TrackMetadata, PlaybackMode, VideoQuality, RepeatMode, PlayerStyle } from '../types';
import { applyDynamicThemeFromImage } from '../theme/dynamicTheme';
import { useTasteStore } from './tasteStore';
import { resolveStream } from '../api/streamResolver';
import { sizedArtwork } from '../api/artworkService';
import { extendStation } from '../api/queueBuilder';
import { innertubeService } from '../api/innertubeService';

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
  queue: TrackMetadata[];
  queueIndex: number;
  videoQuality: VideoQuality;
  streamAudioUrl: string | null;
  streamVideoUrl: string | null;
  isExpanded: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  playerStyle: PlayerStyle;
  ambientBackground: boolean;

  // Actions
  playTrack: (track: TrackMetadata, newQueue?: TrackMetadata[]) => Promise<void>;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
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
  addToQueue: (track: TrackMetadata) => void;
  removeFromQueue: (index: number) => void;
  updatePlaybackProgress: (currentTime: number, duration: number) => void;
  setBuffering: (isBuffering: boolean) => void;
  loadRadioQueue: (trackId: string) => Promise<void>;
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

  setPlayerStyle: (style: PlayerStyle) => {
    localStorage.setItem('koda_player_style', style);
    set({ playerStyle: style });
  },

  setAmbientBackground: (enabled: boolean) => {
    localStorage.setItem('koda_ambient_bg', String(enabled));
    set({ ambientBackground: enabled });
  },

  loadRadioQueue: async (trackId: string) => {
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
      console.warn('[Koda Player] loadRadioQueue error:', err);
    }
  },

  playTrack: async (track: TrackMetadata, newQueue?: TrackMetadata[]) => {
    let queue = get().queue;
    let queueIndex = get().queueIndex;

    const highRes = sizedArtwork(track.highResThumbnailUrl || track.thumbnailUrl, 1200);
    const resolvedTrack: TrackMetadata = {
      ...track,
      highResThumbnailUrl: highRes
    };

    if (newQueue) {
      queue = newQueue.map((t) => ({
        ...t,
        highResThumbnailUrl: sizedArtwork(t.highResThumbnailUrl || t.thumbnailUrl, 1200)
      }));
      queueIndex = queue.findIndex((t) => t.id === track.id);
      if (queueIndex === -1) {
        queue = [resolvedTrack, ...queue];
        queueIndex = 0;
      }
    } else if (!queue.some((t) => t.id === track.id)) {
      queue = [...queue, resolvedTrack];
      queueIndex = queue.length - 1;
    } else {
      queueIndex = queue.findIndex((t) => t.id === track.id);
    }

    set({
      currentTrack: resolvedTrack,
      queue,
      queueIndex,
      isBuffering: true,
      currentTime: 0,
      duration: track.duration || 0
    });

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

    // Autoplay Radio Extension: If single song was played or queue is small, fetch watch-next radio
    if (queue.length <= 2) {
      get().loadRadioQueue(track.id);
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
    const { queue, queueIndex, repeatMode } = get();
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
      } else {
        // Try extending radio queue before stopping
        const lastTrack = queue[queue.length - 1];
        if (lastTrack) {
          const candidates = await innertubeService.getWatchNextRadio(lastTrack.id);
          const additional = extendStation(queue, candidates, 25);
          if (additional.length > 0) {
            set({ queue: [...queue, ...additional] });
            await get().playTrack(additional[0]);
            return;
          }
        }
        set({ isPlaying: false });
        return;
      }
    }

    // Pre-fetch next radio tracks if approaching end of queue
    if (nextIndex >= queue.length - 2) {
      get().loadRadioQueue(queue[nextIndex]?.id || queue[0].id);
    }

    await get().playTrack(queue[nextIndex]);
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

    await get().playTrack(queue[prevIndex]);
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

  addToQueue: (track: TrackMetadata) => {
    set((state) => ({ queue: [...state.queue, track] }));
  },

  removeFromQueue: (index: number) => {
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(index, 1);
      return { queue: newQueue };
    });
  },

  updatePlaybackProgress: (currentTime: number, duration: number) => {
    set({ currentTime, duration: duration || get().duration });
  },

  setBuffering: (isBuffering: boolean) => {
    set({ isBuffering });
  }
}));
