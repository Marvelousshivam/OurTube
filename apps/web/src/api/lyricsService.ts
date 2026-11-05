import { LyricsData, LyricsLine } from '../types';
import { writeTtml } from '../lyrics/ttml';
import { innertubeService } from './innertubeService';

export class LyricsService {
  private lyricsCache = new Map<string, LyricsData | null>();
  private inFlightLyrics = new Map<string, Promise<LyricsData | null>>();

  /**
   * Fetches rich synchronized lyrics for a track with hot in-memory caching.
   * Tier 1: lrc.red (Apple Music word-by-word synced TTML karaoke)
   * Tier 2: LRCLIB (line-synced LRC converted to Apple Music TTML)
   * Tier 3: YouTube Music official lyrics tab (plain lyrics converted to TTML)
   */
  public async getLyrics(
    trackName: string,
    artistName: string,
    durationSeconds: number,
    videoId?: string
  ): Promise<LyricsData | null> {
    const cleanTitle = this.cleanTrackTitle(trackName);
    const cleanArtist = this.cleanArtistName(artistName);
    const cacheKey = videoId || `${cleanTitle}:::${cleanArtist}`;

    if (this.lyricsCache.has(cacheKey)) {
      return this.lyricsCache.get(cacheKey) || null;
    }

    if (this.inFlightLyrics.has(cacheKey)) {
      return this.inFlightLyrics.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const result = await this._doFetchLyrics(cleanTitle, cleanArtist, durationSeconds, videoId);
        this.lyricsCache.set(cacheKey, result);
        return result;
      } finally {
        this.inFlightLyrics.delete(cacheKey);
      }
    })();

    this.inFlightLyrics.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  private async _doFetchLyrics(
    cleanTitle: string,
    cleanArtist: string,
    durationSeconds: number,
    videoId?: string
  ): Promise<LyricsData | null> {
    // 1. Tier 1: lrc.red (Word-by-word Apple Music TTML)
    try {
      const redResult = await this.fetchFromLrcRed(cleanTitle, cleanArtist, durationSeconds);
      if (redResult) return redResult;
    } catch (err) {
      console.warn('[OurTube Lyrics] lrc.red fetch error:', err);
    }

    // 2. Tier 2: LRCLIB (LRC synced / plain converted to TTML)
    try {
      const lrclibResult = await this.fetchFromLrclib(cleanTitle, cleanArtist, durationSeconds);
      if (lrclibResult) return lrclibResult;
    } catch (err) {
      console.warn('[OurTube Lyrics] LRCLIB fetch error:', err);
    }

    // 3. Tier 3: YouTube Music lyrics tab
    if (videoId) {
      try {
        const ytLyrics = await innertubeService.getSongLyrics(videoId);
        if (ytLyrics) {
          const lines: LyricsLine[] = ytLyrics
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .map((text, idx) => ({ time: idx * 5, text }));

          return {
            synced: false,
            wordSynced: false,
            provider: 'innertube',
            ttml: writeTtml(lines),
            lines
          };
        }
      } catch (err) {
        console.warn('[OurTube Lyrics] YouTube lyrics fetch error:', err);
      }
    }

    return null;
  }

  /**
   * Searches and fetches word-synced TTML from lrc.red
   */
  private async fetchFromLrcRed(
    title: string,
    artist: string,
    durationSeconds: number
  ): Promise<LyricsData | null> {
    const query = `${title} ${artist}`.trim();
    const searchUrl = `https://lrc.red/search.json?q=${encodeURIComponent(query)}`;

    const res = await fetch(searchUrl, { credentials: 'omit' });
    if (!res.ok) return null;

    const data = await res.json();
    const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
    if (hits.length === 0) return null;

    // Pick best match based on duration proximity (within 10s) or first hit
    let bestHit = hits[0];
    if (durationSeconds > 0) {
      const match = hits.find(
        (h) => typeof h.duration === 'number' && Math.abs(h.duration - durationSeconds) <= 10
      );
      if (match) bestHit = match;
    }

    if (!bestHit?.isrc) return null;

    // Fetch TTML XML for the selected ISRC
    const ttmlRes = await fetch(`https://lrc.red/s/${bestHit.isrc}.ttml`, { credentials: 'omit' });
    if (!ttmlRes.ok) return null;

    const ttml = await ttmlRes.text();
    if (!ttml || !ttml.includes('<tt')) return null;

    const wordSynced = ttml.includes('lrc:timing="Word"') || /<span\s+begin=/i.test(ttml);
    const lines = this.parseTtmlToLines(ttml);

    return {
      synced: true,
      wordSynced,
      provider: 'lrc.red',
      ttml,
      lines
    };
  }

  /**
   * Fetches lyrics from LRCLIB
   */
  private async fetchFromLrclib(
    title: string,
    artist: string,
    durationSeconds: number
  ): Promise<LyricsData | null> {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      duration: Math.round(durationSeconds).toString()
    });

    let res = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    let data: any = null;

    if (res.ok) {
      data = await res.json();
    } else {
      // Fallback search
      const q = encodeURIComponent(`${title} ${artist}`);
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${q}`);
      if (searchRes.ok) {
        const list = await searchRes.json();
        if (Array.isArray(list) && list.length > 0) {
          data = list.find((item: any) => item.syncedLyrics) || list[0];
        }
      }
    }

    if (!data) return null;

    if (data.syncedLyrics) {
      const lines = this.parseLrc(data.syncedLyrics);
      return {
        synced: true,
        wordSynced: false,
        provider: 'lrclib',
        ttml: writeTtml(lines),
        lines
      };
    }

    if (data.plainLyrics) {
      const lines: LyricsLine[] = data.plainLyrics
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0)
        .map((text: string, idx: number) => ({ time: idx * 5, text }));

      return {
        synced: false,
        wordSynced: false,
        provider: 'lrclib',
        ttml: writeTtml(lines),
        lines
      };
    }

    return null;
  }

  /**
   * Parses Apple Music TTML into plain LyricsLine[]
   */
  public parseTtmlToLines(ttml: string): LyricsLine[] {
    const lines: LyricsLine[] = [];
    const pRegex = /<p\s+begin="([^"]+)"[^>]*>(.*?)<\/p>/gis;
    let match: RegExpExecArray | null;

    while ((match = pRegex.exec(ttml)) !== null) {
      const beginStr = match[1];
      const innerHtml = match[2];
      const text = innerHtml
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();

      let time = 0;
      if (beginStr.includes(':')) {
        const parts = beginStr.split(':');
        if (parts.length === 2) {
          time = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        } else if (parts.length === 3) {
          time = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        }
      } else {
        time = parseFloat(beginStr) || 0;
      }

      if (text) {
        lines.push({ time, text });
      }
    }

    return lines.sort((a, b) => a.time - b.time);
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
      .replace(/^.+?\s*[-–—]\s*/, '')
      .replace(
        /\s*[\(\[](?:feat|ft|official|audio|video|lyrics|lyric video|remix|hd|4k|visualizer|acoustic)[^\)\]]*[\)\]]/gi,
        ''
      )
      .trim();
  }

  private cleanArtistName(artist: string): string {
    return artist
      .split(/[,&/]/)[0]
      .replace(/\s*(?:feat|ft)\.?\s*.+/i, '')
      .trim();
  }
}

export const lyricsService = new LyricsService();
