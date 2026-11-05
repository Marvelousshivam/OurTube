import { LyricsData, LyricsLine } from '../types';

export class LyricsService {
  /**
   * Fetches synchronized lyrics for a track from LRCLIB
   */
  public async getLyrics(
    trackName: string,
    artistName: string,
    durationSeconds: number
  ): Promise<LyricsData | null> {
    try {
      const cleanTitle = this.cleanTrackTitle(trackName);
      const cleanArtist = this.cleanArtistName(artistName);

      const params = new URLSearchParams({
        track_name: cleanTitle,
        artist_name: cleanArtist,
        duration: Math.round(durationSeconds).toString()
      });

      const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);

      if (!response.ok) {
        // Try fallback search query
        return await this.searchLyrics(cleanTitle, cleanArtist);
      }

      const data = await response.json();

      if (data.syncedLyrics) {
        return {
          synced: true,
          provider: 'lrclib',
          lines: this.parseLrc(data.syncedLyrics)
        };
      }

      if (data.plainLyrics) {
        return {
          synced: false,
          provider: 'lrclib',
          lines: data.plainLyrics
            .split('\n')
            .filter((l: string) => l.trim().length > 0)
            .map((text: string, idx: number) => ({ time: idx * 5, text }))
        };
      }

      return null;
    } catch (err) {
      console.warn('[Koda Lyrics] Failed to fetch lyrics:', err);
      return null;
    }
  }

  private async searchLyrics(trackName: string, artistName: string): Promise<LyricsData | null> {
    try {
      const q = encodeURIComponent(`${trackName} ${artistName}`);
      const res = await fetch(`https://lrclib.net/api/search?q=${q}`);
      if (!res.ok) return null;
      const list = await res.json();
      if (!Array.isArray(list) || list.length === 0) return null;

      const top = list.find((item: any) => item.syncedLyrics) || list[0];
      if (top.syncedLyrics) {
        return {
          synced: true,
          provider: 'lrclib',
          lines: this.parseLrc(top.syncedLyrics)
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parses standard LRC format: [mm:ss.xx] Lyrics text
   */
  public parseLrc(lrcText: string): LyricsLine[] {
    const lines: LyricsLine[] = [];
    const rawLines = lrcText.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const matches = [...trimmed.matchAll(timeRegex)];
      if (matches.length === 0) continue;

      const text = trimmed.replace(timeRegex, '').trim();

      for (const match of matches) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const fraction = match[3] ? parseFloat(`0.${match[3]}`) : 0;
        const totalSeconds = minutes * 60 + seconds + fraction;

        lines.push({
          time: totalSeconds,
          text: text || '♪'
        });
      }
    }

    return lines.sort((a, b) => a.time - b.time);
  }

  private cleanTrackTitle(title: string): string {
    return title
      .replace(/\s*[\(\[](?:feat|ft|official|audio|video|lyrics|remix|hd|4k)[^\)\]]*[\)\]]/gi, '')
      .trim();
  }

  private cleanArtistName(artist: string): string {
    return artist.split(/[,&]/)[0].trim();
  }
}

export const lyricsService = new LyricsService();
