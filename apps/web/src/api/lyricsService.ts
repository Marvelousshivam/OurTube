import { LyricsData, LyricsLine } from '../types';
import {
  lookupLyrics,
  type LookupOptions,
  type LyricsResult
} from '../lyrics/repository';
import type { LyricsSourceId } from '../lyrics/sources';

function toLyricsData(result: LyricsResult): LyricsData {
  const lines: LyricsLine[] = result.lines
    .filter((l) => l.text.trim() !== '')
    .map((l) => ({
      time: l.timeMs / 1000,
      text: l.text,
      words: l.words.length
        ? l.words.map((w) => ({
            word: w.text,
            time: w.startMs / 1000,
            duration: Math.max(0.05, (w.endMs - w.startMs) / 1000)
          }))
        : undefined
    }));

  return {
    synced: result.synced,
    wordSynced: result.wordSynced,
    provider: result.label,
    sourceId: result.source,
    label: result.label,
    lines,
    ttml: result.ttml
  };
}

class LyricsService {
  /**
   * Resolves lyrics using BitChord's 15-source priority race:
   * lrc.red -> BiniLyrics -> BetterLyrics -> BetterLyrics Portato -> PaxSenix
   * -> LyricsPlus -> Unison -> YouTube Captions -> YouTube Music -> KuGou
   * -> LRCLIB -> Musixmatch -> Genius.
   */
  public async getLyrics(
    title: string,
    artist: string,
    duration: number,
    videoId?: string,
    album?: string | null,
    options?: LookupOptions
  ): Promise<LyricsData | null> {
    const result = await lookupLyrics(
      {
        videoId: videoId || '',
        title,
        artist,
        durationMs: Math.max(0, Math.round((duration || 0) * 1000)),
        album: album ?? null
      },
      options
    );
    return result ? toLyricsData(result) : null;
  }

  public async getLyricsFromSource(
    source: LyricsSourceId,
    title: string,
    artist: string,
    duration: number,
    videoId?: string,
    album?: string | null,
    onSource?: LookupOptions['onSource']
  ): Promise<LyricsData | null> {
    return this.getLyrics(title, artist, duration, videoId, album, {
      only: source,
      onSource
    });
  }
}

export const lyricsService = new LyricsService();
