import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { create } from 'zustand';
import { TrackMetadata, TasteEntry } from '../types';
import { artistPhotoService } from '../api/artistPhotoService';
import { isLikelyNonMusicVideo } from '../api/innertubeService';

interface KodaDB extends DBSchema {
  history: {
    key: string;
    value: TasteEntry;
    indexes: { 'by-playedAt': number; 'by-artist': string };
  };
  likedTracks: {
    key: string;
    value: TrackMetadata;
  };
}

const dbMap = new Map<string, Promise<IDBPDatabase<KodaDB>>>();

export interface SavedPlaylistItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  trackCount?: number;
  savedAt: number;
}

export interface FollowedArtistItem {
  id: string;
  name: string;
  thumbnailUrl?: string;
  subscribersText?: string;
  followedAt: number;
}

export interface SubscribedChannelItem {
  id: string;
  name: string;
  handle?: string;
  avatarUrl?: string;
  subscribedAt: number;
}

export interface LikedVideoItem {
  id: string;
  title: string;
  channelName: string;
  channelId?: string;
  channelIconUrl?: string;
  thumbnailUrl: string;
  duration?: number;
  viewCountText?: string;
  watchedPercentage?: number;
  resumeTimeSeconds?: number;
  likedAt: number;
}

export interface PlayLogEntry {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  thumbnailUrl?: string;
  highResThumbnailUrl?: string;
  duration: number; // in seconds
  timestamp: number; // epoch ms
}

export interface LocalPlaylistItem {
  id: string;
  title: string;
  description?: string;
  tracks: TrackMetadata[];
  thumbnailUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HiddenPlaylistItem {
  id: string;
  title: string;
  author?: string;
  thumbnailUrl?: string;
  hiddenAt: number;
}

function getActiveAccountId(): string {
  try {
    const raw = localStorage.getItem('ourtube_auth_cache') || localStorage.getItem('koda_auth_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.selectedChannelId) {
        return sanitizeAccountId(parsed.selectedChannelId);
      }
    }
  } catch {
    // fallback
  }
  return '0_own';
}

function sanitizeAccountId(id?: string | null): string {
  if (!id) return '0_own';
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getDB(accountId: string = getActiveAccountId()) {
  const safeId = sanitizeAccountId(accountId);
  const dbName = `koda-web-db-${safeId}`;

  if (!dbMap.has(dbName)) {
    const promise = openDB<KodaDB>(dbName, 1, {
      upgrade(db) {
        const historyStore = db.createObjectStore('history', { keyPath: 'trackId' });
        historyStore.createIndex('by-playedAt', 'playedAt');
        historyStore.createIndex('by-artist', 'artist');

        db.createObjectStore('likedTracks', { keyPath: 'id' });
      }
    });
    dbMap.set(dbName, promise);
  }
  return dbMap.get(dbName)!;
}

interface TasteStoreState {
  activeAccountId: string;
  likedTracks: TrackMetadata[];
  history: TasteEntry[];
  playLog: PlayLogEntry[];
  localPlaylists: LocalPlaylistItem[];
  hiddenPlaylists: HiddenPlaylistItem[];
  saveMusicHistory: boolean;
  savedPlaylists: SavedPlaylistItem[];
  followedArtists: FollowedArtistItem[];
  subscribedChannels: SubscribedChannelItem[];
  likedVideos: LikedVideoItem[];
  videoHistory: LikedVideoItem[];
  watchLaterVideos: LikedVideoItem[];
  isLoading: boolean;
  pickedArtists: string[];
  pickedGenres: string[];
  deckVerdicts: Record<string, 'YES' | 'NO' | 'LOVE'>;
  isTasteSetupCompleted: boolean;
  loadInitialData: (accountId?: string) => Promise<void>;
  recordPlayback: (track: TrackMetadata, completionRate: number) => Promise<void>;
  removePlayHistoryEntry: (
    trackId: string,
    timestamp?: number,
    allPlaysOfSong?: boolean
  ) => Promise<{ history: TasteEntry[]; playLog: PlayLogEntry[] }>;
  clearMusicHistory: () => Promise<{ history: TasteEntry[]; playLog: PlayLogEntry[] }>;
  restoreMusicHistory: (snapshot: { history: TasteEntry[]; playLog: PlayLogEntry[] }) => Promise<void>;
  setSaveMusicHistory: (enabled: boolean) => void;
  createLocalPlaylist: (
    title: string,
    description?: string,
    initialTracks?: TrackMetadata[]
  ) => LocalPlaylistItem;
  updateLocalPlaylist: (id: string, title: string, description?: string) => void;
  deleteLocalPlaylist: (id: string) => void;
  addTrackToLocalPlaylist: (playlistId: string, track: TrackMetadata) => void;
  removeTrackFromLocalPlaylist: (playlistId: string, trackId: string) => void;
  hidePlaylist: (playlist: Omit<HiddenPlaylistItem, 'hiddenAt'>) => void;
  unhidePlaylist: (playlistId: string) => void;
  recordVideoPlayback: (video: Omit<LikedVideoItem, 'likedAt'>) => void;
  updateVideoProgress: (videoId: string, currentTime: number, duration: number) => void;
  toggleLikeTrack: (track: TrackMetadata) => Promise<boolean>;
  isLiked: (trackId: string) => boolean;
  toggleSavePlaylist: (playlist: Omit<SavedPlaylistItem, 'savedAt'>) => boolean;
  isPlaylistSaved: (playlistId: string) => boolean;
  toggleFollowArtist: (artist: Omit<FollowedArtistItem, 'followedAt'>) => boolean;
  isArtistFollowed: (artistIdOrName: string) => boolean;
  toggleSubscribeChannel: (channel: Omit<SubscribedChannelItem, 'subscribedAt'>) => boolean;
  syncSubscribedChannels: (channels: { id: string; name: string; avatarUrl?: string }[]) => void;
  isChannelSubscribed: (channelIdOrName: string) => boolean;
  toggleLikeVideo: (video: Omit<LikedVideoItem, 'likedAt'>) => boolean;
  isVideoLiked: (videoId: string) => boolean;
  toggleWatchLaterVideo: (video: Omit<LikedVideoItem, 'likedAt'>) => boolean;
  isWatchLaterVideo: (videoId: string) => boolean;
  importTasteData: (payload: any) => Promise<void>;
  togglePickedArtist: (artist: string) => void;
  togglePickedGenre: (genre: string) => void;
  recordDeckVerdict: (trackId: string, verdict: 'YES' | 'NO' | 'LOVE') => void;
  setTasteSetupCompleted: (completed: boolean) => void;
}

const initialAccountId = getActiveAccountId();

function synthesizePlayLogFromHistory(historyEntries: TasteEntry[], existingLog: PlayLogEntry[]): PlayLogEntry[] {
  const logByTrack = new Map<string, number>();
  for (const item of existingLog) {
    logByTrack.set(item.trackId, (logByTrack.get(item.trackId) || 0) + 1);
  }
  const additions: PlayLogEntry[] = [];
  for (const entry of historyEntries) {
    const haveCount = logByTrack.get(entry.trackId) || 0;
    const targetCount = Math.max(1, entry.playCount || 1);
    if (haveCount < targetCount) {
      const missing = Math.min(targetCount - haveCount, 25);
      const baseTs = entry.playedAt || Date.now();
      const durSec = entry.duration && entry.duration > 0 ? entry.duration : 210;
      for (let i = 0; i < missing; i++) {
        const ts = baseTs - i * 1000;
        additions.push({
          id: `${entry.trackId}_${ts}_${i}`,
          trackId: entry.trackId,
          title: entry.title,
          artist: entry.artist,
          artistId: entry.artistId,
          album: entry.album,
          thumbnailUrl: entry.thumbnailUrl,
          highResThumbnailUrl: entry.highResThumbnailUrl,
          duration: durSec,
          timestamp: ts
        });
      }
    }
  }
  if (additions.length === 0) return existingLog;
  return [...existingLog, ...additions]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 2000);
}

export const useTasteStore = create<TasteStoreState>((set, get) => ({
  activeAccountId: initialAccountId,
  likedTracks: [],
  history: [],
  playLog: JSON.parse(localStorage.getItem(`koda_play_log_${initialAccountId}`) || '[]'),
  localPlaylists: JSON.parse(localStorage.getItem(`koda_local_playlists_${initialAccountId}`) || '[]'),
  hiddenPlaylists: JSON.parse(localStorage.getItem(`koda_hidden_playlists_${initialAccountId}`) || '[]'),
  saveMusicHistory: localStorage.getItem('koda_save_history') !== 'false',
  savedPlaylists: JSON.parse(localStorage.getItem(`koda_saved_playlists_${initialAccountId}`) || '[]'),
  followedArtists: JSON.parse(localStorage.getItem(`koda_followed_artists_${initialAccountId}`) || '[]'),
  subscribedChannels: JSON.parse(localStorage.getItem(`koda_subscribed_channels_${initialAccountId}`) || '[]'),
  likedVideos: JSON.parse(localStorage.getItem(`koda_liked_videos_${initialAccountId}`) || '[]'),
  videoHistory: JSON.parse(localStorage.getItem(`koda_video_history_${initialAccountId}`) || '[]'),
  watchLaterVideos: JSON.parse(localStorage.getItem(`koda_watch_later_videos_${initialAccountId}`) || '[]'),
  isLoading: true,
  pickedArtists: JSON.parse(localStorage.getItem(`koda_picked_artists_${initialAccountId}`) || '[]'),
  pickedGenres: JSON.parse(localStorage.getItem(`koda_picked_genres_${initialAccountId}`) || '[]'),
  deckVerdicts: JSON.parse(localStorage.getItem(`koda_deck_verdicts_${initialAccountId}`) || '{}'),
  isTasteSetupCompleted: localStorage.getItem(`koda_taste_setup_done_${initialAccountId}`) === 'true',

  togglePickedArtist: (artist: string) => {
    const safeId = get().activeAccountId;
    const current = get().pickedArtists;
    const next = current.includes(artist)
      ? current.filter((a) => a !== artist)
      : [...current, artist];
    localStorage.setItem(`koda_picked_artists_${safeId}`, JSON.stringify(next));
    set({ pickedArtists: next });
  },

  togglePickedGenre: (genre: string) => {
    const safeId = get().activeAccountId;
    const current = get().pickedGenres;
    const next = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre];
    localStorage.setItem(`koda_picked_genres_${safeId}`, JSON.stringify(next));
    set({ pickedGenres: next });
  },

  recordDeckVerdict: (trackId: string, verdict: 'YES' | 'NO' | 'LOVE') => {
    const safeId = get().activeAccountId;
    const current = { ...get().deckVerdicts, [trackId]: verdict };
    localStorage.setItem(`koda_deck_verdicts_${safeId}`, JSON.stringify(current));
    set({ deckVerdicts: current });
  },

  setTasteSetupCompleted: (completed: boolean) => {
    const safeId = get().activeAccountId;
    localStorage.setItem(`koda_taste_setup_done_${safeId}`, String(completed));
    set({ isTasteSetupCompleted: completed });
  },

  loadInitialData: async (accountId?: string) => {
    const targetId = sanitizeAccountId(accountId || getActiveAccountId());
    try {
      set({ isLoading: true, activeAccountId: targetId });
      const db = await getDB(targetId);
      const liked = await db.getAll('likedTracks');
      const rawHist = await db.getAllFromIndex('history', 'by-playedAt');
      const localVideoHistory: LikedVideoItem[] = JSON.parse(
        localStorage.getItem(`koda_video_history_${targetId}`) || '[]'
      );
      const videoIds = new Set(localVideoHistory.map((v) => v.id));

      // Purge any non-music YouTube videos that previously leaked into the Music history store
      const cleanHist: TasteEntry[] = [];
      for (const entry of rawHist) {
        if (
          videoIds.has(entry.trackId) ||
          isLikelyNonMusicVideo({
            title: entry.title,
            artist: entry.artist,
            album: entry.album,
            duration: entry.duration,
            thumbnailUrl: entry.thumbnailUrl
          })
        ) {
          await db.delete('history', entry.trackId).catch(() => {});
        } else {
          cleanHist.push(entry);
        }
      }

      const reversedHist = cleanHist.reverse();
      const storedPlayLog: PlayLogEntry[] = JSON.parse(
        localStorage.getItem(`koda_play_log_${targetId}`) || '[]'
      ).filter(
        (p: PlayLogEntry) =>
          !videoIds.has(p.trackId) &&
          !isLikelyNonMusicVideo({
            title: p.title,
            artist: p.artist,
            album: p.album,
            duration: p.duration,
            thumbnailUrl: p.thumbnailUrl
          })
      );
      const hydratedPlayLog = synthesizePlayLogFromHistory(reversedHist, storedPlayLog);
      if (hydratedPlayLog.length !== storedPlayLog.length) {
        localStorage.setItem(`koda_play_log_${targetId}`, JSON.stringify(hydratedPlayLog));
      }

      set({
        activeAccountId: targetId,
        likedTracks: liked,
        history: reversedHist,
        playLog: hydratedPlayLog,
        localPlaylists: JSON.parse(localStorage.getItem(`koda_local_playlists_${targetId}`) || '[]'),
        hiddenPlaylists: JSON.parse(localStorage.getItem(`koda_hidden_playlists_${targetId}`) || '[]'),
        saveMusicHistory: localStorage.getItem('koda_save_history') !== 'false',
        savedPlaylists: JSON.parse(localStorage.getItem(`koda_saved_playlists_${targetId}`) || '[]'),
        followedArtists: JSON.parse(localStorage.getItem(`koda_followed_artists_${targetId}`) || '[]'),
        subscribedChannels: JSON.parse(localStorage.getItem(`koda_subscribed_channels_${targetId}`) || '[]'),
        likedVideos: JSON.parse(localStorage.getItem(`koda_liked_videos_${targetId}`) || '[]'),
        videoHistory: localVideoHistory,
        watchLaterVideos: JSON.parse(localStorage.getItem(`koda_watch_later_videos_${targetId}`) || '[]'),
        pickedArtists: JSON.parse(localStorage.getItem(`koda_picked_artists_${targetId}`) || '[]'),
        pickedGenres: JSON.parse(localStorage.getItem(`koda_picked_genres_${targetId}`) || '[]'),
        deckVerdicts: JSON.parse(localStorage.getItem(`koda_deck_verdicts_${targetId}`) || '{}'),
        isTasteSetupCompleted: localStorage.getItem(`koda_taste_setup_done_${targetId}`) === 'true',
        isLoading: false
      });
    } catch (err) {
      console.warn(`[Koda TasteStore] Failed to load data for account ${targetId}:`, err);
      set({ isLoading: false });
    }
  },

  recordPlayback: async (track: TrackMetadata, completionRate: number) => {
    try {
      const saveHistorySetting = localStorage.getItem('koda_save_history');
      const isIncognito = (window as any).__koda_incognito_session === true;
      if (saveHistorySetting === 'false' || isIncognito) {
        return;
      }

      // Never record non-music YouTube videos into Music Mode history
      if (isLikelyNonMusicVideo(track)) {
        return;
      }

      artistPhotoService.setArtistPhoto(track.artist, track.highResThumbnailUrl || track.thumbnailUrl);
      const currentId = get().activeAccountId;
      const db = await getDB(currentId);
      const existing = await db.get('history', track.id);
      const now = Date.now();
      const entry: TasteEntry = {
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        artistId: track.artistId,
        album: track.album,
        thumbnailUrl: track.thumbnailUrl,
        highResThumbnailUrl: track.highResThumbnailUrl,
        duration: track.duration,
        playedAt: now,
        playCount: (existing?.playCount || 0) + 1,
        completionRate: Math.max(completionRate, existing?.completionRate || 0)
      };

      await db.put('history', entry);
      const hist = await db.getAllFromIndex('history', 'by-playedAt');

      const logEntry: PlayLogEntry = {
        id: `${track.id}_${now}`,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        artistId: track.artistId,
        album: track.album,
        thumbnailUrl: track.thumbnailUrl,
        highResThumbnailUrl: track.highResThumbnailUrl,
        duration: track.duration && track.duration > 0 ? track.duration : 210,
        timestamp: now
      };
      const nextLog = [logEntry, ...get().playLog].slice(0, 2000);
      localStorage.setItem(`koda_play_log_${currentId}`, JSON.stringify(nextLog));

      set({ history: hist.reverse(), playLog: nextLog });
    } catch (err) {
      console.warn('[Koda TasteStore] Error saving history:', err);
    }
  },

  removePlayHistoryEntry: async (
    trackId: string,
    timestamp?: number,
    allPlaysOfSong: boolean = false
  ) => {
    const currentId = get().activeAccountId;
    const snapshot = {
      history: [...get().history],
      playLog: [...get().playLog]
    };
    try {
      const db = await getDB(currentId);
      let nextLog = [...get().playLog];
      if (allPlaysOfSong || timestamp === undefined) {
        nextLog = nextLog.filter((item) => item.trackId !== trackId);
        await db.delete('history', trackId).catch(() => {});
      } else {
        // Remove consecutive run matching this song around the timestamp, or single entry
        const idx = nextLog.findIndex(
          (item) => item.trackId === trackId && item.timestamp === timestamp
        );
        if (idx !== -1) {
          // Also remove any immediately consecutive plays in the same run
          let endIdx = idx + 1;
          while (endIdx < nextLog.length && nextLog[endIdx].trackId === trackId) {
            const sameDay =
              Math.floor(nextLog[endIdx].timestamp / 86400000) ===
              Math.floor(timestamp / 86400000);
            if (!sameDay) break;
            endIdx++;
          }
          nextLog.splice(idx, endIdx - idx);
        } else {
          nextLog = nextLog.filter((item) => item.trackId !== trackId);
        }
        const remainingForSong = nextLog.filter((item) => item.trackId === trackId);
        if (remainingForSong.length === 0) {
          await db.delete('history', trackId).catch(() => {});
        } else {
          const existing = await db.get('history', trackId);
          if (existing) {
            await db.put('history', {
              ...existing,
              playCount: remainingForSong.length,
              playedAt: remainingForSong[0].timestamp
            });
          }
        }
      }
      localStorage.setItem(`koda_play_log_${currentId}`, JSON.stringify(nextLog));
      const hist = await db.getAllFromIndex('history', 'by-playedAt');
      set({ history: hist.reverse(), playLog: nextLog });
    } catch (err) {
      console.warn('[Koda TasteStore] Failed to remove history entry:', err);
    }
    return snapshot;
  },

  clearMusicHistory: async () => {
    const currentId = get().activeAccountId;
    const snapshot = {
      history: [...get().history],
      playLog: [...get().playLog]
    };
    try {
      const db = await getDB(currentId);
      await db.clear('history');
      localStorage.setItem(`koda_play_log_${currentId}`, '[]');
      set({ history: [], playLog: [] });
    } catch (err) {
      console.warn('[Koda TasteStore] Failed to clear history:', err);
    }
    return snapshot;
  },

  restoreMusicHistory: async (snapshot) => {
    const currentId = get().activeAccountId;
    try {
      const db = await getDB(currentId);
      await db.clear('history');
      for (const entry of snapshot.history) {
        await db.put('history', entry);
      }
      localStorage.setItem(`koda_play_log_${currentId}`, JSON.stringify(snapshot.playLog));
      set({
        history: [...snapshot.history],
        playLog: [...snapshot.playLog]
      });
    } catch (err) {
      console.warn('[Koda TasteStore] Failed to restore history:', err);
    }
  },

  setSaveMusicHistory: (enabled: boolean) => {
    localStorage.setItem('koda_save_history', enabled ? 'true' : 'false');
    set({ saveMusicHistory: enabled });
  },

  createLocalPlaylist: (title: string, description?: string, initialTracks: TrackMetadata[] = []) => {
    const safeId = get().activeAccountId;
    const now = Date.now();
    const newPl: LocalPlaylistItem = {
      id: `local_pl_${now}`,
      title: title.trim() || 'Untitled Playlist',
      description: description?.trim() || undefined,
      tracks: initialTracks,
      thumbnailUrl: initialTracks[0]?.highResThumbnailUrl || initialTracks[0]?.thumbnailUrl,
      createdAt: now,
      updatedAt: now
    };
    const next = [newPl, ...get().localPlaylists];
    localStorage.setItem(`koda_local_playlists_${safeId}`, JSON.stringify(next));
    set({ localPlaylists: next });
    return newPl;
  },

  updateLocalPlaylist: (id: string, title: string, description?: string) => {
    const safeId = get().activeAccountId;
    const next = get().localPlaylists.map((pl) =>
      pl.id === id
        ? {
            ...pl,
            title: title.trim() || pl.title,
            description: description?.trim() || undefined,
            updatedAt: Date.now()
          }
        : pl
    );
    localStorage.setItem(`koda_local_playlists_${safeId}`, JSON.stringify(next));
    set({ localPlaylists: next });
  },

  deleteLocalPlaylist: (id: string) => {
    const safeId = get().activeAccountId;
    const next = get().localPlaylists.filter((pl) => pl.id !== id);
    localStorage.setItem(`koda_local_playlists_${safeId}`, JSON.stringify(next));
    set({ localPlaylists: next });
  },

  addTrackToLocalPlaylist: (playlistId: string, track: TrackMetadata) => {
    const safeId = get().activeAccountId;
    const next = get().localPlaylists.map((pl) => {
      if (pl.id !== playlistId) return pl;
      if (pl.tracks.some((t) => t.id === track.id)) return pl;
      const updatedTracks = [...pl.tracks, track];
      return {
        ...pl,
        tracks: updatedTracks,
        thumbnailUrl: pl.thumbnailUrl || track.highResThumbnailUrl || track.thumbnailUrl,
        updatedAt: Date.now()
      };
    });
    localStorage.setItem(`koda_local_playlists_${safeId}`, JSON.stringify(next));
    set({ localPlaylists: next });
  },

  removeTrackFromLocalPlaylist: (playlistId: string, trackId: string) => {
    const safeId = get().activeAccountId;
    const next = get().localPlaylists.map((pl) => {
      if (pl.id !== playlistId) return pl;
      const updatedTracks = pl.tracks.filter((t) => t.id !== trackId);
      return {
        ...pl,
        tracks: updatedTracks,
        thumbnailUrl: updatedTracks[0]?.highResThumbnailUrl || updatedTracks[0]?.thumbnailUrl,
        updatedAt: Date.now()
      };
    });
    localStorage.setItem(`koda_local_playlists_${safeId}`, JSON.stringify(next));
    set({ localPlaylists: next });
  },

  hidePlaylist: (playlist) => {
    const safeId = get().activeAccountId;
    const current = get().hiddenPlaylists;
    if (current.some((h) => h.id === playlist.id)) return;
    const next: HiddenPlaylistItem[] = [
      { ...playlist, hiddenAt: Date.now() },
      ...current
    ];
    localStorage.setItem(`koda_hidden_playlists_${safeId}`, JSON.stringify(next));
    set({ hiddenPlaylists: next });
  },

  unhidePlaylist: (playlistId: string) => {
    const safeId = get().activeAccountId;
    const next = get().hiddenPlaylists.filter((h) => h.id !== playlistId);
    localStorage.setItem(`koda_hidden_playlists_${safeId}`, JSON.stringify(next));
    set({ hiddenPlaylists: next });
  },

  recordVideoPlayback: (video: Omit<LikedVideoItem, 'likedAt'>) => {
    try {
      const saveHistorySetting = localStorage.getItem('koda_save_history');
      const isIncognito = (window as any).__koda_incognito_session === true;
      if (saveHistorySetting === 'false' || isIncognito) {
        return;
      }
      const safeId = get().activeAccountId;
      const current = get().videoHistory;
      const existing = current.find((v) => v.id === video.id);
      const next: LikedVideoItem[] = [
        {
          ...existing,
          ...video,
          watchedPercentage: video.watchedPercentage ?? existing?.watchedPercentage ?? 5,
          resumeTimeSeconds: video.resumeTimeSeconds ?? existing?.resumeTimeSeconds ?? 0,
          likedAt: Date.now()
        },
        ...current.filter((v) => v.id !== video.id)
      ].slice(0, 60);
      localStorage.setItem(`koda_video_history_${safeId}`, JSON.stringify(next));
      set({ videoHistory: next });
    } catch (err) {
      console.warn('[Koda TasteStore] Error saving video history:', err);
    }
  },

  updateVideoProgress: (videoId: string, currentTime: number, duration: number) => {
    if (!videoId || !duration || duration <= 0 || currentTime < 2) return;
    try {
      const safeId = get().activeAccountId;
      const current = get().videoHistory;
      const idx = current.findIndex((v) => v.id === videoId);
      if (idx === -1) return;
      const pct = Math.min(100, Math.max(3, Math.round((currentTime / duration) * 100)));
      const existing = current[idx];
      // Only write if changed by >= 2% or >= 5s
      if (
        existing.watchedPercentage === pct &&
        Math.abs((existing.resumeTimeSeconds || 0) - currentTime) < 5
      ) {
        return;
      }
      const next = [...current];
      next[idx] = {
        ...existing,
        duration: duration || existing.duration,
        watchedPercentage: pct,
        resumeTimeSeconds: pct >= 96 ? 0 : Math.floor(currentTime)
      };
      localStorage.setItem(`koda_video_history_${safeId}`, JSON.stringify(next));
      set({ videoHistory: next });
    } catch {}
  },

  toggleLikeTrack: async (track: TrackMetadata) => {
    try {
      const currentId = get().activeAccountId;
      const db = await getDB(currentId);
      const isCurrentlyLiked = get().isLiked(track.id);

      if (isCurrentlyLiked) {
        await db.delete('likedTracks', track.id);
        set((state) => ({
          likedTracks: state.likedTracks.filter((t) => t.id !== track.id)
        }));
        return false;
      } else {
        await db.put('likedTracks', track);
        set((state) => ({
          likedTracks: [track, ...state.likedTracks]
        }));
        return true;
      }
    } catch (err) {
      console.warn('[Koda TasteStore] Error toggling like:', err);
      return false;
    }
  },

  isLiked: (trackId: string) => {
    return get().likedTracks.some((t) => t.id === trackId);
  },

  toggleSavePlaylist: (playlist) => {
    const safeId = get().activeAccountId;
    const current = get().savedPlaylists;
    const exists = current.some((p) => p.id === playlist.id);
    const next = exists
      ? current.filter((p) => p.id !== playlist.id)
      : [{ ...playlist, savedAt: Date.now() }, ...current];
    localStorage.setItem(`koda_saved_playlists_${safeId}`, JSON.stringify(next));
    set({ savedPlaylists: next });
    return !exists;
  },

  isPlaylistSaved: (playlistId: string) => {
    return get().savedPlaylists.some((p) => p.id === playlistId);
  },

  toggleFollowArtist: (artist) => {
    const safeId = get().activeAccountId;
    const current = get().followedArtists;
    const exists = current.some(
      (a) => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()
    );
    const next = exists
      ? current.filter(
          (a) => a.id !== artist.id && a.name.toLowerCase() !== artist.name.toLowerCase()
        )
      : [{ ...artist, followedAt: Date.now() }, ...current];
    localStorage.setItem(`koda_followed_artists_${safeId}`, JSON.stringify(next));
    set({ followedArtists: next });
    return !exists;
  },

  isArtistFollowed: (artistIdOrName: string) => {
    const target = artistIdOrName.toLowerCase();
    return get().followedArtists.some(
      (a) => a.id.toLowerCase() === target || a.name.toLowerCase() === target
    );
  },

  toggleSubscribeChannel: (channel) => {
    const normalizeName = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/\s+and\s+\d+\s+more$/i, '')
        .replace(/^@/, '')
        .trim();
    const safeId = get().activeAccountId;
    const current = get().subscribedChannels;
    const targetName = normalizeName(channel.name);
    const exists = current.some(
      (c) =>
        (channel.id && c.id === channel.id) ||
        (targetName && normalizeName(c.name) === targetName)
    );
    const next = exists
      ? current.filter(
          (c) =>
            c.id !== channel.id &&
            (!targetName || normalizeName(c.name) !== targetName)
        )
      : [
          {
            ...channel,
            name: channel.name.replace(/\s+and\s+\d+\s+more$/i, '').trim(),
            subscribedAt: Date.now()
          },
          ...current
        ];
    localStorage.setItem(`koda_subscribed_channels_${safeId}`, JSON.stringify(next));
    set({ subscribedChannels: next });
    return !exists;
  },

  syncSubscribedChannels: (channels) => {
    if (!Array.isArray(channels) || channels.length === 0) return;
    const normalizeName = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/\s+and\s+\d+\s+more$/i, '')
        .replace(/^@/, '')
        .trim();
    const safeId = get().activeAccountId;
    const current = get().subscribedChannels;
    const merged = [...current];
    let changed = false;

    for (const ch of channels) {
      const cleanName = (ch.name || '').replace(/\s+and\s+\d+\s+more$/i, '').trim();
      const norm = normalizeName(cleanName);
      if (!norm || norm === 'youtube creator' || norm === 'creator') continue;

      const existingIdx = merged.findIndex(
        (c) =>
          (ch.id && c.id === ch.id) ||
          normalizeName(c.name) === norm
      );
      if (existingIdx === -1) {
        merged.push({
          id: ch.id || `ch_${norm.replace(/[^a-z0-9]/g, '_')}`,
          name: cleanName,
          avatarUrl: ch.avatarUrl,
          subscribedAt: Date.now()
        });
        changed = true;
      } else {
        const existing = merged[existingIdx];
        const needsIdUpdate = ch.id && ch.id.startsWith('UC') && !existing.id.startsWith('UC');
        const needsAvatarUpdate = ch.avatarUrl && !existing.avatarUrl;
        if (needsIdUpdate || needsAvatarUpdate) {
          merged[existingIdx] = {
            ...existing,
            id: needsIdUpdate ? ch.id : existing.id,
            avatarUrl: existing.avatarUrl || ch.avatarUrl
          };
          changed = true;
        }
      }
    }

    if (changed) {
      localStorage.setItem(`koda_subscribed_channels_${safeId}`, JSON.stringify(merged));
      set({ subscribedChannels: merged });
    }
  },

  isChannelSubscribed: (channelIdOrName: string) => {
    if (!channelIdOrName) return false;
    const normalizeName = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/\s+and\s+\d+\s+more$/i, '')
        .replace(/^@/, '')
        .trim();
    const target = normalizeName(channelIdOrName);
    if (!target) return false;
    return get().subscribedChannels.some(
      (c) =>
        c.id.toLowerCase() === channelIdOrName.toLowerCase().trim() ||
        normalizeName(c.name) === target
    );
  },

  toggleLikeVideo: (video) => {
    const safeId = get().activeAccountId;
    const current = get().likedVideos;
    const exists = current.some((v) => v.id === video.id);
    const next = exists
      ? current.filter((v) => v.id !== video.id)
      : [{ ...video, likedAt: Date.now() }, ...current];
    localStorage.setItem(`koda_liked_videos_${safeId}`, JSON.stringify(next));
    set({ likedVideos: next });
    return !exists;
  },

  isVideoLiked: (videoId: string) => {
    return get().likedVideos.some((v) => v.id === videoId);
  },

  toggleWatchLaterVideo: (video) => {
    const safeId = get().activeAccountId;
    const current = get().watchLaterVideos;
    const exists = current.some((v) => v.id === video.id);
    const next = exists
      ? current.filter((v) => v.id !== video.id)
      : [{ ...video, likedAt: Date.now() }, ...current];
    localStorage.setItem(`koda_watch_later_videos_${safeId}`, JSON.stringify(next));
    set({ watchLaterVideos: next });
    return !exists;
  },

  isWatchLaterVideo: (videoId: string) => {
    return get().watchLaterVideos.some((v) => v.id === videoId);
  },

  importTasteData: async (payload: any) => {
    const safeId = get().activeAccountId;
    const db = await getDB(safeId);

    if (Array.isArray(payload?.likedTracks)) {
      for (const track of payload.likedTracks) {
        if (track?.id) await db.put('likedTracks', track);
      }
    }
    if (Array.isArray(payload?.history)) {
      for (const entry of payload.history) {
        if (entry?.trackId) await db.put('history', entry);
      }
    }
    if (Array.isArray(payload?.savedPlaylists)) {
      localStorage.setItem(`koda_saved_playlists_${safeId}`, JSON.stringify(payload.savedPlaylists));
    }
    if (Array.isArray(payload?.followedArtists)) {
      localStorage.setItem(`koda_followed_artists_${safeId}`, JSON.stringify(payload.followedArtists));
    }
    if (Array.isArray(payload?.subscribedChannels)) {
      localStorage.setItem(`koda_subscribed_channels_${safeId}`, JSON.stringify(payload.subscribedChannels));
    }
    if (Array.isArray(payload?.likedVideos)) {
      localStorage.setItem(`koda_liked_videos_${safeId}`, JSON.stringify(payload.likedVideos));
    }
    if (Array.isArray(payload?.pickedArtists)) {
      localStorage.setItem(`koda_picked_artists_${safeId}`, JSON.stringify(payload.pickedArtists));
    }
    if (Array.isArray(payload?.pickedGenres)) {
      localStorage.setItem(`koda_picked_genres_${safeId}`, JSON.stringify(payload.pickedGenres));
    }
    if (payload?.deckVerdicts && typeof payload.deckVerdicts === 'object') {
      localStorage.setItem(`koda_deck_verdicts_${safeId}`, JSON.stringify(payload.deckVerdicts));
    }
    await get().loadInitialData(safeId);
  }
}));
