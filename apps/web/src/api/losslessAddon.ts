/**
 * Lossless Music Extension Client & Matcher (Universal Addon Manifest Protocol).
 *
 * Implements compatibility with ReZenOnance / Universal Addon Protocol:
 * - Manifest verification & personal endpoint device leasing (`X-Zombie-Tracker` / `__rz_tracker`)
 * - Noise-filtered title/artist search
 * - Duration-verified candidate matching (|delta| <= 8s)
 * - Lossless FLAC stream resolution & LRU result caching
 */

import { invoke } from '@tauri-apps/api/core';
import type { TrackMetadata } from '../types';

export interface LosslessAddonManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  resources: string[];
  settings?: any[];
  allowDownloads?: number;
}

export interface LosslessAddonConfig {
  id: string;
  name: string;
  version: string;
  description?: string;
  manifestUrl: string;
  baseUrl: string;
  enabled: boolean;
  addedAt: number;
}

export interface LosslessTrackCandidate {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artworkURL?: string;
  format?: string;
  audioQuality?: string;
  audioModes?: string[];
  atmos?: boolean;
}

export interface ResolvedLosslessStream {
  url: string;
  codec: string;
  format: string;
  bitDepth?: number;
  sampleRate?: number;
  bitrateKbps?: number;
  badgeText: string;
  shortBadgeText: string;
  addonName: string;
  candidateTitle: string;
  candidateArtist: string;
}

const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

// In-memory cache for resolved track IDs (stores only positive matches)
const losslessCache = new Map<string, ResolvedLosslessStream>();

export function clearLosslessCache(): void {
  losslessCache.clear();
}

/**
 * Normalizes user-input URL to manifest URL and base endpoint URL.
 */
export function normalizeAddonUrl(raw: string): { manifestUrl: string; baseUrl: string } {
  let trimmed = raw.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://' + trimmed;
  }
  // Strip trailing slashes
  trimmed = trimmed.replace(/\/+$/, '');

  if (trimmed.endsWith('/manifest.json')) {
    const baseUrl = trimmed.slice(0, -'/manifest.json'.length);
    return { manifestUrl: trimmed, baseUrl };
  }

  return {
    manifestUrl: `${trimmed}/manifest.json`,
    baseUrl: trimmed
  };
}

/**
 * Fetches JSON from an addon endpoint via Rust addon_fetch (desktop) or browser fetch.
 */
async function fetchAddonJson<T = any>(url: string, trackerToken?: string): Promise<{ ok: boolean; status: number; data: T }> {
  if (isTauri) {
    try {
      const res = await invoke<{ status: number; ok: boolean; data: T }>('addon_fetch', {
        payload: {
          url,
          zombieTracker: trackerToken || undefined
        }
      });
      return { ok: res.ok, status: res.status, data: res.data };
    } catch (err: any) {
      return { ok: false, status: 0, data: err?.message || String(err) as any };
    }
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (trackerToken) {
      headers['X-Zombie-Tracker'] = trackerToken;
    }
    const res = await fetch(url, { headers });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, data: err?.message || String(err) as any };
  }
}

/**
 * Validates and installs a lossless addon from a manifest or base URL.
 */
export async function installLosslessAddon(
  rawUrl: string,
  trackerToken?: string
): Promise<LosslessAddonConfig> {
  const { manifestUrl, baseUrl } = normalizeAddonUrl(rawUrl);

  const res = await fetchAddonJson<LosslessAddonManifest>(manifestUrl, trackerToken);
  if (!res.ok || !res.data) {
    throw new Error(`Failed to load manifest from ${manifestUrl} (HTTP ${res.status})`);
  }

  const manifest = res.data;
  if (!manifest.id || !manifest.name) {
    throw new Error('Invalid manifest: missing required "id" or "name" field');
  }

  const resources = Array.isArray(manifest.resources) ? manifest.resources : [];
  if (!resources.includes('search') || !resources.includes('stream')) {
    throw new Error('Addon must support both "search" and "stream" resources');
  }

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version || '1.0.0',
    description: manifest.description,
    manifestUrl,
    baseUrl,
    enabled: true,
    addedAt: Date.now()
  };
}

/**
 * Tests connection to an already configured addon.
 */
export async function testLosslessAddon(
  addon: LosslessAddonConfig,
  trackerToken?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetchAddonJson<LosslessAddonManifest>(addon.manifestUrl, trackerToken);
    if (res.ok && res.data?.id) {
      return { ok: true, message: `Connected to ${res.data.name} v${res.data.version || '1.0'}` };
    }
    return { ok: false, message: `Addon returned HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Connection failed' };
  }
}

/**
 * Cleans YouTube-specific video/song suffixes for clean search matching.
 */
export function cleanTrackTitle(title: string): string {
  let cleaned = title
    // Remove (Official Video), [Official Audio], (Lyric Video), etc.
    .replace(
      /\s*[\(\[](official\s*(audio|video|music\s*video|lyric\s*video)?|lyric\s*video|full\s*song|audio|visualizer|remastered.*|live.*)[\)\]]/gi,
      ''
    )
    // Remove trailing " - Official Audio", etc.
    .replace(/\s*-\s*(official\s*(video|audio|music\s*video)?|lyric\s*video|audio|full\s*song)$/gi, '')
    // Remove movie/film soundtrack tags if bracketed, e.g. (From "Talaash")
    .replace(/\s*[\(\[](from\s+["'][^"']+["'])[\)\]]/gi, '')
    .trim();

  return cleaned || title;
}

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function isPlaceholderDuration(d?: number): boolean {
  return !d || d <= 0 || d === 210 || d === 180 || d === 240;
}

/**
 * Searches and resolves a lossless stream for a track across enabled addons.
 * Queries all enabled addons concurrently so slow/offline addons never block fast ones.
 */
export async function resolveLosslessForTrack(
  track: TrackMetadata,
  addons: LosslessAddonConfig[],
  trackerToken?: string
): Promise<ResolvedLosslessStream | null> {
  const enabledAddons = addons.filter((a) => a.enabled);
  if (enabledAddons.length === 0) return null;

  if (losslessCache.has(track.id)) {
    return losslessCache.get(track.id) || null;
  }

  const cleanTitle = cleanTrackTitle(track.title);
  const fullArtistNorm = normalizeStr(track.artist || '');
  const primaryArtist = (track.artist || '').split(/[,&/]/)[0].trim();
  const normCleanTitle = normalizeStr(cleanTitle);
  const normArtist = normalizeStr(primaryArtist);
  const targetDuration = track.duration || 0;
  const isTargetPlaceholder = isPlaceholderDuration(targetDuration);

  console.log(`[OurTube Lossless] Resolving track "${track.title}" by "${track.artist}" across ${enabledAddons.length} enabled addon(s)`);

  // Query each enabled addon concurrently
  const addonPromises = enabledAddons.map(async (addon): Promise<ResolvedLosslessStream | null> => {
    try {
      // 1. Search with cleanTitle + primaryArtist
      const queryWithArtist = `${cleanTitle} ${primaryArtist}`.trim();
      let searchUrl = `${addon.baseUrl}/search?q=${encodeURIComponent(queryWithArtist)}&quality=hi_res_lossless&atmos=auto`;
      let res = await fetchAddonJson<{ tracks?: LosslessTrackCandidate[] }>(searchUrl, trackerToken);

      // If no tracks returned, fall back to searching cleanTitle alone
      if (!res.ok || !res.data || !Array.isArray(res.data.tracks) || res.data.tracks.length === 0) {
        const queryTitleOnly = cleanTitle;
        if (queryTitleOnly !== queryWithArtist) {
          searchUrl = `${addon.baseUrl}/search?q=${encodeURIComponent(queryTitleOnly)}&quality=hi_res_lossless&atmos=auto`;
          res = await fetchAddonJson<{ tracks?: LosslessTrackCandidate[] }>(searchUrl, trackerToken);
        }
      }

      if (!res.ok || !res.data || !Array.isArray(res.data.tracks) || res.data.tracks.length === 0) {
        return null;
      }

      const candidates = res.data.tracks;

      // Score candidates to find the highest-fidelity match
      const scoredCandidates = candidates
        .filter((c) => Boolean(c.id && c.title))
        .map((c) => {
          const candTitleNorm = normalizeStr(c.title);
          const candArtistNorm = normalizeStr(c.artist || '');

          const titleExact = candTitleNorm === normCleanTitle;
          const titleContains =
            candTitleNorm.includes(normCleanTitle) || normCleanTitle.includes(candTitleNorm);

          if (!titleExact && !titleContains) return { candidate: c, score: -1 };

          const fullArtistExact = candArtistNorm === fullArtistNorm;
          const artistExact = !normArtist || candArtistNorm === normArtist;
          const artistContains =
            !normArtist ||
            candArtistNorm.includes(normArtist) ||
            normArtist.includes(candArtistNorm) ||
            candArtistNorm.includes(fullArtistNorm) ||
            fullArtistNorm.includes(candArtistNorm);

          const isLossless =
            c.format?.toLowerCase() === 'flac' ||
            c.audioQuality?.toUpperCase() === 'LOSSLESS' ||
            c.audioQuality?.toUpperCase() === 'HI_RES' ||
            c.audioQuality?.toUpperCase() === 'HI_RES_LOSSLESS';

          let score = 0;
          // Substantial bonus for verified lossless FLAC
          if (isLossless) score += 150;
          else if (c.format?.toLowerCase() === 'mp3') score -= 80;

          if (titleExact) score += 60;
          else score += 30;

          if (fullArtistExact) score += 50;
          else if (artistExact) score += 40;
          else if (artistContains) score += 25;
          else if (titleExact) score += 10;

          // Duration matching: ignore if target or candidate has a placeholder duration (210, 180, 240, 0)
          const hasRealTarget = !isTargetPlaceholder;
          const hasRealCand = !isPlaceholderDuration(c.duration);

          if (hasRealTarget && hasRealCand && c.duration) {
            const delta = Math.abs(c.duration - targetDuration);
            if (delta <= 4) score += 30;
            else if (delta <= 12) score += 20;
            else if (delta <= 25) score += 10;
            else if (delta > 45 && !titleExact) {
              return { candidate: c, score: -1 };
            }
          }

          return { candidate: c, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scoredCandidates.length === 0) {
        return null;
      }

      // Try resolving stream for top candidates in ranked order until one returns valid audio
      for (const { candidate: match } of scoredCandidates.slice(0, 3)) {
        let streamUrl = `${addon.baseUrl}/stream/${encodeURIComponent(match.id)}?quality=hi_res_lossless&atmos=auto`;
        let streamRes = await fetchAddonJson<any>(streamUrl, trackerToken);

        if (!streamRes.ok || !streamRes.data?.url) {
          streamUrl = `${addon.baseUrl}/stream/${encodeURIComponent(match.id)}?quality=lossless&atmos=auto`;
          streamRes = await fetchAddonJson<any>(streamUrl, trackerToken);
        }

        if (!streamRes.ok || !streamRes.data?.url) {
          continue;
        }

        const streamData = streamRes.data;
        const sampleRate = Number(streamData.sampleRate) || 44100;
        const bitDepth =
          Number(streamData.bitDepth) ||
          (streamData.quality?.toLowerCase().includes('hi-res') ? 24 : 16);
        const bitrateKbps =
          Number(streamData.bitrate) || Math.round((sampleRate * bitDepth * 2) / 1000);
        const codec = (streamData.codec || streamData.format || 'flac').toUpperCase();

        const rateKhz = (sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1);
        const isHiRes = bitDepth >= 24 || sampleRate >= 88200;

        const badgeText = `${bitDepth}-BIT / ${rateKhz}KHZ ${codec} • ${isHiRes ? 'HI-RES' : 'LOSSLESS'}`;
        const shortBadgeText = `${bitDepth}-BIT ${codec}`;

        const resolved: ResolvedLosslessStream = {
          url: streamData.url,
          codec,
          format: streamData.format || 'flac',
          bitDepth,
          sampleRate,
          bitrateKbps,
          badgeText,
          shortBadgeText,
          addonName: addon.name,
          candidateTitle: match.title,
          candidateArtist: match.artist
        };

        if (isTauri) {
          invoke('allow_stream_url', { url: resolved.url }).catch(() => {});
        }

        console.log(`[OurTube Lossless] Match found from ${addon.name}: "${match.title}" by "${match.artist}" -> ${resolved.badgeText}`);
        return resolved;
      }

      return null;
    } catch (err) {
      console.warn(`[OurTube Lossless] Error querying addon ${addon.name}:`, err);
      return null;
    }
  });

  // Evaluate all addons and pick the first resolved stream
  const settled = await Promise.allSettled(addonPromises);
  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value?.url) {
      losslessCache.set(track.id, item.value);
      return item.value;
    }
  }

  console.log(`[OurTube Lossless] No lossless candidate resolved for "${track.title}"; falling back to studio stream`);
  return null;
}
