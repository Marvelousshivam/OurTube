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

function getActiveAccountId(): string {
  try {
    const raw = localStorage.getItem('koda_auth_cache');
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
  isLoading: boolean;
  pickedArtists: string[];
  pickedGenres: string[];
  deckVerdicts: Record<string, 'YES' | 'NO' | 'LOVE'>;
  isTasteSetupCompleted: boolean;
  loadInitialData: (accountId?: string) => Promise<void>;
  recordPlayback: (track: TrackMetadata, completionRate: number) => Promise<void>;
  toggleLikeTrack: (track: TrackMetadata) => Promise<boolean>;
  isLiked: (trackId: string) => boolean;
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
  }
}));
