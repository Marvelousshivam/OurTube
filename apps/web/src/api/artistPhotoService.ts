import { innertubeService } from './innertubeService';
import { sizedArtwork } from './artworkService';

const STORAGE_KEY = 'ourtube_artist_photos_v1';

class ArtistPhotoService {
  private cache: Record<string, string> = {};
  private pending: Set<string> = new Set();
  private subscribers: Set<() => void> = new Set();

  constructor() {
    this.loadCache();
  }

  private loadCache() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.cache = JSON.parse(saved);
      }
    } catch {
      this.cache = {};
    }
  }

  private saveCache() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      // Storage quota or error handling
    }
  }

  public subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb());
  }

  /**
   * Synchronously returns cached photo URL for artist if available
   */
  public getCachedPhoto(artistName: string): string | null {
    if (!artistName) return null;
    const clean = artistName.trim().toLowerCase();
    return this.cache[clean] || null;
  }

  /**
   * Manually sets or primes an artist's photo (e.g. from track artwork)
   */
  public setArtistPhoto(artistName: string, photoUrl: string) {
    if (!artistName || !photoUrl) return;
    const clean = artistName.trim().toLowerCase();
    if (!this.cache[clean]) {
      this.cache[clean] = sizedArtwork(photoUrl, 226);
      this.saveCache();
      this.notify();
    }
  }

  /**
   * Resolves artist photo asynchronously via InnerTube search / details
   */
  public async resolveArtistPhoto(artistName: string): Promise<string | null> {
    if (!artistName) return null;
    const clean = artistName.trim().toLowerCase();

    if (this.cache[clean]) {
      return this.cache[clean];
    }

    if (this.pending.has(clean)) {
      return null;
    }

    this.pending.add(clean);

    try {
      // 1. Try resolving artist details via InnerTube
      const details = await innertubeService.getArtistDetails(artistName);
      if (details?.avatarUrl || details?.heroImage) {
        const photo = sizedArtwork(details.avatarUrl || details.heroImage, 226);
        this.cache[clean] = photo;
        this.saveCache();
        this.notify();
        return photo;
      }

      // 2. Fallback: Search for songs by artist and extract high-res thumbnail
      const songs = await innertubeService.search(artistName, 'songs');
      if (songs.length > 0 && songs[0].thumbnailUrl) {
        const photo = sizedArtwork(songs[0].thumbnailUrl, 226);
        this.cache[clean] = photo;
        this.saveCache();
        this.notify();
        return photo;
      }
    } catch (err) {
      console.warn(`[ArtistPhotoService] Could not resolve photo for "${artistName}":`, err);
    } finally {
      this.pending.delete(clean);
    }

    return null;
  }

  /**
   * Batch resolves photos for a list of artist names
   */
  public batchResolve(artistNames: string[]) {
    for (const name of artistNames) {
      if (name && !this.getCachedPhoto(name)) {
        this.resolveArtistPhoto(name);
      }
    }
  }
}

export const artistPhotoService = new ArtistPhotoService();
