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

let dbPromise: Promise<IDBPDatabase<KodaDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<KodaDB>('koda-web-db', 1, {
      upgrade(db) {
        const historyStore = db.createObjectStore('history', { keyPath: 'trackId' });
        historyStore.createIndex('by-playedAt', 'playedAt');
        historyStore.createIndex('by-artist', 'artist');

        db.createObjectStore('likedTracks', { keyPath: 'id' });
      }
    });
  }
  return dbPromise;
}

interface TasteStoreState {
  likedTracks: TrackMetadata[];
  history: TasteEntry[];
  isLoading: boolean;
  pickedArtists: string[];
  pickedGenres: string[];
  deckVerdicts: Record<string, 'YES' | 'NO' | 'LOVE'>;
  isTasteSetupCompleted: boolean;
  loadInitialData: () => Promise<void>;
  recordPlayback: (track: TrackMetadata, completionRate: number) => Promise<void>;
  toggleLikeTrack: (track: TrackMetadata) => Promise<boolean>;
  isLiked: (trackId: string) => boolean;
  togglePickedArtist: (artist: string) => void;
  togglePickedGenre: (genre: string) => void;
  recordDeckVerdict: (trackId: string, verdict: 'YES' | 'NO' | 'LOVE') => void;
  setTasteSetupCompleted: (completed: boolean) => void;
}

export const useTasteStore = create<TasteStoreState>((set, get) => ({
  likedTracks: [],
  history: [],
  isLoading: true,
  pickedArtists: JSON.parse(localStorage.getItem('koda_picked_artists') || '[]'),
  pickedGenres: JSON.parse(localStorage.getItem('koda_picked_genres') || '[]'),
  deckVerdicts: JSON.parse(localStorage.getItem('koda_deck_verdicts') || '{}'),
  isTasteSetupCompleted: localStorage.getItem('koda_taste_setup_done') === 'true',

  togglePickedArtist: (artist: string) => {
    const current = get().pickedArtists;
    const next = current.includes(artist)
      ? current.filter((a) => a !== artist)
      : [...current, artist];
    localStorage.setItem('koda_picked_artists', JSON.stringify(next));
    set({ pickedArtists: next });
  },

  togglePickedGenre: (genre: string) => {
    const current = get().pickedGenres;
    const next = current.includes(genre)
      ? current.filter((g) => g !== genre)
      : [...current, genre];
    localStorage.setItem('koda_picked_genres', JSON.stringify(next));
    set({ pickedGenres: next });
  },

  recordDeckVerdict: (trackId: string, verdict: 'YES' | 'NO' | 'LOVE') => {
    const current = { ...get().deckVerdicts, [trackId]: verdict };
    localStorage.setItem('koda_deck_verdicts', JSON.stringify(current));
    set({ deckVerdicts: current });
  },

  setTasteSetupCompleted: (completed: boolean) => {
    localStorage.setItem('koda_taste_setup_done', String(completed));
    set({ isTasteSetupCompleted: completed });
  },

  loadInitialData: async () => {
    try {
      const db = await getDB();
      const liked = await db.getAll('likedTracks');
      const hist = await db.getAllFromIndex('history', 'by-playedAt');
      set({
        likedTracks: liked,
        history: hist.reverse(),
        isLoading: false
      });
    } catch (err) {
      console.warn('[Koda TasteStore] Failed to load local data:', err);
      set({ isLoading: false });
    }
  },

  recordPlayback: async (track: TrackMetadata, completionRate: number) => {
    try {
      artistPhotoService.setArtistPhoto(track.artist, track.highResThumbnailUrl || track.thumbnailUrl);
      const db = await getDB();
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
      const db = await getDB();
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
