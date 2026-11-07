import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { create } from 'zustand';
import { TrackMetadata, TasteEntry } from '../types';
import { artistPhotoService } from '../api/artistPhotoService';

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
  thumbnailUrl: string;
  duration?: number;
  viewCountText?: string;
  likedAt: number;
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
  savedPlaylists: SavedPlaylistItem[];
  followedArtists: FollowedArtistItem[];
  subscribedChannels: SubscribedChannelItem[];
  likedVideos: LikedVideoItem[];
  isLoading: boolean;
  pickedArtists: string[];
  pickedGenres: string[];
  deckVerdicts: Record<string, 'YES' | 'NO' | 'LOVE'>;
  isTasteSetupCompleted: boolean;
  loadInitialData: (accountId?: string) => Promise<void>;
  recordPlayback: (track: TrackMetadata, completionRate: number) => Promise<void>;
  toggleLikeTrack: (track: TrackMetadata) => Promise<boolean>;
  isLiked: (trackId: string) => boolean;
  toggleSavePlaylist: (playlist: Omit<SavedPlaylistItem, 'savedAt'>) => boolean;
  isPlaylistSaved: (playlistId: string) => boolean;
  toggleFollowArtist: (artist: Omit<FollowedArtistItem, 'followedAt'>) => boolean;
  isArtistFollowed: (artistIdOrName: string) => boolean;
  toggleSubscribeChannel: (channel: Omit<SubscribedChannelItem, 'subscribedAt'>) => boolean;
  isChannelSubscribed: (channelIdOrName: string) => boolean;
  toggleLikeVideo: (video: Omit<LikedVideoItem, 'likedAt'>) => boolean;
  isVideoLiked: (videoId: string) => boolean;
  importTasteData: (payload: any) => Promise<void>;
  togglePickedArtist: (artist: string) => void;
  togglePickedGenre: (genre: string) => void;
  recordDeckVerdict: (trackId: string, verdict: 'YES' | 'NO' | 'LOVE') => void;
  setTasteSetupCompleted: (completed: boolean) => void;
}

const initialAccountId = getActiveAccountId();

export const useTasteStore = create<TasteStoreState>((set, get) => ({
  activeAccountId: initialAccountId,
  likedTracks: [],
  history: [],
  savedPlaylists: JSON.parse(localStorage.getItem(`koda_saved_playlists_${initialAccountId}`) || '[]'),
  followedArtists: JSON.parse(localStorage.getItem(`koda_followed_artists_${initialAccountId}`) || '[]'),
  subscribedChannels: JSON.parse(localStorage.getItem(`koda_subscribed_channels_${initialAccountId}`) || '[]'),
  likedVideos: JSON.parse(localStorage.getItem(`koda_liked_videos_${initialAccountId}`) || '[]'),
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
      const hist = await db.getAllFromIndex('history', 'by-playedAt');

      set({
        activeAccountId: targetId,
        likedTracks: liked,
        history: hist.reverse(),
        savedPlaylists: JSON.parse(localStorage.getItem(`koda_saved_playlists_${targetId}`) || '[]'),
        followedArtists: JSON.parse(localStorage.getItem(`koda_followed_artists_${targetId}`) || '[]'),
        subscribedChannels: JSON.parse(localStorage.getItem(`koda_subscribed_channels_${targetId}`) || '[]'),
        likedVideos: JSON.parse(localStorage.getItem(`koda_liked_videos_${targetId}`) || '[]'),
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

      artistPhotoService.setArtistPhoto(track.artist, track.highResThumbnailUrl || track.thumbnailUrl);
      const currentId = get().activeAccountId;
      const db = await getDB(currentId);
      const existing = await db.get('history', track.id);
      const entry: TasteEntry = {
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        artistId: track.artistId,
        album: track.album,
        thumbnailUrl: track.thumbnailUrl,
        highResThumbnailUrl: track.highResThumbnailUrl,
        duration: track.duration,
        playedAt: Date.now(),
        playCount: (existing?.playCount || 0) + 1,
        completionRate: Math.max(completionRate, existing?.completionRate || 0)
      };

      await db.put('history', entry);
      const hist = await db.getAllFromIndex('history', 'by-playedAt');
      set({ history: hist.reverse() });
    } catch (err) {
      console.warn('[Koda TasteStore] Error saving history:', err);
    }
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
    const safeId = get().activeAccountId;
    const current = get().subscribedChannels;
    const exists = current.some(
      (c) => c.id === channel.id || c.name.toLowerCase() === channel.name.toLowerCase()
    );
    const next = exists
      ? current.filter(
          (c) => c.id !== channel.id && c.name.toLowerCase() !== channel.name.toLowerCase()
        )
      : [{ ...channel, subscribedAt: Date.now() }, ...current];
    localStorage.setItem(`koda_subscribed_channels_${safeId}`, JSON.stringify(next));
    set({ subscribedChannels: next });
    return !exists;
  },

  isChannelSubscribed: (channelIdOrName: string) => {
    const target = channelIdOrName.toLowerCase();
    return get().subscribedChannels.some(
      (c) => c.id.toLowerCase() === target || c.name.toLowerCase() === target
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
