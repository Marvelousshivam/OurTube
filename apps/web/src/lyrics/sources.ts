export type LyricsSourceId =
  | 'lrc-red'
  | 'bini'
  | 'better-lyrics'
  | 'better-lyrics-portato'
  | 'paxsenix'
  | 'paxsenix-spotify'
  | 'paxsenix-musixmatch'
  | 'lyrics-plus'
  | 'unison'
  | 'youtube-captions'
  | 'youtube-music'
  | 'kugou'
  | 'lrclib'
  | 'musixmatch'
  | 'genius';

export interface LyricsSource {
  id: LyricsSourceId;
  label: string;
  detail: string;
  requiresExtension?: boolean;
  requiresKey?: boolean;
}

/**
 * Default priority order matching BitChord's LyricsSource.kt:
 * word-timed first, then line-timed, then plain text.
 */
export const LYRICS_SOURCES: readonly LyricsSource[] = [
  { id: 'lrc-red', label: 'lrc.red', detail: 'Word-synced TTML lyrics' },
  { id: 'bini', label: 'BiniLyrics', detail: 'Word-synced lyrics via ISRC match' },
  { id: 'better-lyrics', label: 'BetterLyrics', detail: 'Word-by-word lyrics from Apple Music' },
  { id: 'better-lyrics-portato', label: 'BetterLyrics Portato', detail: 'Word-by-word lyrics from QQ Music' },
  { id: 'paxsenix', label: 'PaxSenix', detail: 'Word-by-word lyrics from Apple Music', requiresExtension: true },
  { id: 'paxsenix-spotify', label: 'PaxSenix: Spotify', detail: 'Requires a PaxSenix key', requiresExtension: true, requiresKey: true },
  { id: 'paxsenix-musixmatch', label: 'PaxSenix: Musixmatch', detail: 'Requires a PaxSenix key', requiresExtension: true, requiresKey: true },
  { id: 'lyrics-plus', label: 'LyricsPlus', detail: 'Syllable-by-syllable community lyrics' },
  { id: 'unison', label: 'Unison', detail: 'Word-synced lyrics contributed by listeners' },
  { id: 'youtube-captions', label: 'YouTube Captions', detail: 'Timed captions matched to the playing video' },
  { id: 'youtube-music', label: 'YouTube Music', detail: 'Plain lyrics from the playing video' },
  { id: 'kugou', label: 'KuGou', detail: 'Synced LRC lyrics via Companion Extension', requiresExtension: true },
  { id: 'lrclib', label: 'LRCLIB', detail: 'Line-synced and plain lyrics' },
  { id: 'musixmatch', label: 'Musixmatch', detail: 'RichSync & line-synced lyrics via Extension', requiresExtension: true },
  { id: 'genius', label: 'Genius', detail: 'Plain text lyrics fallback', requiresExtension: true }
];

export function sourceById(id: string): LyricsSource | undefined {
  return LYRICS_SOURCES.find((s) => s.id === id);
}

/**
 * Restores a saved priority order, dropping unknown IDs and inserting any newly
 * added sources at their relative position in LYRICS_SOURCES.
 */
export function orderedSources(savedIds: readonly string[]): LyricsSourceId[] {
  const known = new Set<string>(LYRICS_SOURCES.map((s) => s.id));
  const result = savedIds.filter((id): id is LyricsSourceId => known.has(id));
  for (let i = 0; i < LYRICS_SOURCES.length; i++) {
    const id = LYRICS_SOURCES[i]!.id;
    if (result.includes(id)) continue;
    const prev = i > 0 ? LYRICS_SOURCES[i - 1]!.id : null;
    const after = prev ? result.indexOf(prev) : -1;
    result.splice(after >= 0 ? after + 1 : result.length, 0, id);
  }
  return result;
}

const SEARCH_NOISE =
  /\s*[([]\s*(?:official(?:\s+(?:music|lyric|lyrics|hd|4k|audio))?(?:\s+video)?|music\s+video|lyric(?:s|\s+video)?|visualizer|audio(?:\s+only)?|full\s+(?:song|video|audio)|hd|hq|4k|mv|m\/v|explicit|clean|remaster(?:ed)?(?:\s+\d{4})?|prod\.?\s+by\s+[^)\]]+|ft\.?\s+[^)\]]+|feat\.?\s+[^)\]]+)\s*[)\]]/gi;

const TOPIC_CHANNEL = /\s*-\s*Topic$/i;

export function forLyricsSearch(raw: string): string {
  const cleaned = raw.replace(SEARCH_NOISE, '').replace(/\s+/g, ' ').trim();
  return cleaned || raw.trim();
}

export function artistForLyricsSearch(raw: string): string {
  const cleaned = forLyricsSearch(raw.replace(TOPIC_CHANNEL, ''));
  return cleaned || raw.trim();
}
