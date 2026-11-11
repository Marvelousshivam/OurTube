import { withBackgroundVocals, type LyricLine } from './model';
import { lyricsGet } from './http';
import type { Parsed } from './parse';
import * as providers from './providers';
import { enabledSources, useLyricsSettings } from './settings';
import {
  artistForLyricsSearch,
  forLyricsSearch,
  sourceById,
  type LyricsSourceId
} from './sources';
import { writeTtml } from './ttml';

export interface LyricsTrack {
  videoId: string;
  title: string;
  artist: string;
  durationMs: number;
  album: string | null;
}

export interface LyricsResult {
  source: LyricsSourceId;
  label: string;
  lines: LyricLine[];
  /** What <am-lyrics> renders: the provider's own TTML or ours written from the lines. */
  ttml: string;
  wordSynced: boolean;
  synced: boolean;
}

export type SourceState = 'pending' | 'found' | 'missing';

const IDENTIFY_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 12 * 60 * 60_000;

/** Bounded in-memory cache of recording ISRCs per videoId. */
const isrcs = new Map<string, string>();
function rememberIsrc(videoId: string, isrc: string | null | undefined) {
  if (!isrc || !videoId) return;
  isrcs.delete(videoId);
  isrcs.set(videoId, isrc);
  if (isrcs.size > 100) {
    isrcs.delete(isrcs.keys().next().value!);
  }
}

/** Per-provider result cache so switching providers in the dropdown is instant if already resolved. */
const providerResultCache = new Map<string, { at: number; result: LyricsResult | null }>();
const lookupCache = new Map<string, { at: number; result: LyricsResult | null }>();

export function forgetLyricsCache() {
  providerResultCache.clear();
  lookupCache.clear();
}

function toResult(source: LyricsSourceId, parsed: Parsed): LyricsResult {
  const lines = withBackgroundVocals(parsed.lines);
  return {
    source,
    label: sourceById(source)?.label ?? source,
    lines,
    ttml: parsed.ttml ?? writeTtml(lines),
    wordSynced: lines.some((l) => l.words.length > 0),
    synced: lines.some((l) => l.timeMs > 0 || l.words.length > 0)
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms))
  ]);
}

export interface LookupOptions {
  /** Ask this one provider only (used by the M3 provider switcher chip). */
  only?: LyricsSourceId;
  onSource?: (source: LyricsSourceId, state: SourceState) => void;
}

export async function lookupLyrics(
  track: LyricsTrack,
  { only, onSource }: LookupOptions = {}
): Promise<LyricsResult | null> {
  const sequence = only ? [only] : enabledSources();
  if (!sequence.length) return null;

  const { paxsenixKey, preferSyllables } = useLyricsSettings.getState();
  const trackKey = `${track.videoId}|${track.durationMs}|${track.title}|${track.artist}`;
  const fullKey = `${trackKey}|${only ?? ''}|${sequence.join(',')}|${preferSyllables}`;

  // If the user explicitly clicked a single provider that already finished during the auto race, return it immediately!
  if (only) {
    const perSourceHit = providerResultCache.get(`${trackKey}|${only}`);
    if (perSourceHit && Date.now() - perSourceHit.at < CACHE_TTL_MS) {
      onSource?.(only, perSourceHit.result ? 'found' : 'missing');
      return perSourceHit.result;
    }
  }

  const cached = lookupCache.get(fullKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS && !onSource) {
    return cached.result;
  }

  const query: providers.LyricsQuery = {
    videoId: track.videoId,
    title: forLyricsSearch(track.title),
    artist: artistForLyricsSearch(track.artist),
    durationMs: track.durationMs,
    album: track.album,
    isrc: isrcs.get(track.videoId) ?? null
  };

  let hit: providers.BiniHit | null = null;
  if (!query.isrc && sequence.includes('bini')) {
    hit = await withTimeout(
      providers.biniIdentify(query).catch(() => null),
      IDENTIFY_TIMEOUT_MS
    );
    if (hit?.isrc) {
      rememberIsrc(track.videoId, hit.isrc);
      query.isrc = hit.isrc;
    }
  }

  const documents = new Map<string, Promise<string | null>>();
  const get: providers.SharedGet = (url) => {
    let pending = documents.get(url);
    if (!pending) {
      pending = lyricsGet(url);
      documents.set(url, pending);
    }
    return pending;
  };

  const fetchFrom = (source: LyricsSourceId): Promise<Parsed | null> => {
    switch (source) {
      case 'lrc-red':
        return providers.lrcRed(query, get);
      case 'bini':
        return providers.bini(query, get, hit).then((found) => {
          rememberIsrc(track.videoId, found?.isrc);
          return found;
        });
      case 'better-lyrics':
        return providers.betterLyrics(query);
      case 'better-lyrics-portato':
        return providers.betterLyricsPortato(query);
      case 'paxsenix':
        return providers.paxSenix(query);
      case 'paxsenix-spotify':
        return providers.paxSenixSpotify(query, paxsenixKey);
      case 'paxsenix-musixmatch':
        return providers.paxSenixMusixmatch(query, paxsenixKey);
      case 'lyrics-plus':
        return providers.lyricsPlus(query);
      case 'unison':
        return providers.unison(query);
      case 'youtube-captions':
        return providers.youtubeCaptions(query);
      case 'youtube-music':
        return providers.youtubeMusicLyrics(query);
      case 'kugou':
        return providers.kugou(query);
      case 'lrclib':
        return providers.lrclib(query);
      case 'musixmatch':
        return providers.musixmatch(query);
      case 'genius':
        return providers.genius(query);
    }
  };

  const run = (source: LyricsSourceId): Promise<LyricsResult | null> => {
    const sourceCacheKey = `${trackKey}|${source}`;
    const existing = providerResultCache.get(sourceCacheKey);
    if (existing && Date.now() - existing.at < CACHE_TTL_MS) {
      onSource?.(source, existing.result ? 'found' : 'missing');
      return Promise.resolve(existing.result);
    }

    onSource?.(source, 'pending');
    return fetchFrom(source)
      .catch(() => null)
      .then((parsed) => {
        const result = parsed?.lines.some((l) => l.text.trim())
          ? toResult(source, parsed)
          : null;
        providerResultCache.set(sourceCacheKey, { at: Date.now(), result });
        onSource?.(source, result ? 'found' : 'missing');
        return result;
      });
  };

  // Genius starts lazily only if all timed/primary sources above it miss
  const racing = sequence.map((source) => ({
    source,
    job: source === 'genius' && !only ? null : run(source)
  }));

  let lineSynced: LyricsResult | null = null;
  let plain: LyricsResult | null = null;
  let winner: LyricsResult | null = null;

  for (const entry of racing) {
    if (entry.source === 'genius' && !only && (lineSynced || plain)) {
      onSource?.('genius', 'missing');
      continue;
    }
    const found = await (entry.job ?? run(entry.source));
    if (!found) continue;
    if (only) {
      winner = found;
      break;
    }
    if (found.wordSynced) {
      winner = found;
      break;
    }
    if (found.synced && !preferSyllables) {
      winner = found;
      break;
    }
    if (found.synced) lineSynced ??= found;
    else plain ??= found;
  }

  winner ??= lineSynced ?? plain;
  lookupCache.set(fullKey, { at: Date.now(), result: winner });
  return winner;
}
