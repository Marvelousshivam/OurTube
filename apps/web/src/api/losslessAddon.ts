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

// In-memory cache for resolved track IDs
const losslessCache = new Map<string, ResolvedLosslessStream | null>();

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

/**
 * Searches and resolves a lossless stream for a track across enabled addons.
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
  const primaryArtist = (track.artist || '').split(/[,&]/)[0].trim();
  const searchQuery = `${cleanTitle} ${primaryArtist}`.trim();

  for (const addon of enabledAddons) {
    try {
      const searchUrl = `${addon.baseUrl}/search?q=${encodeURIComponent(searchQuery)}&quality=LOSSLESS&atmos=auto`;
      const res = await fetchAddonJson<{ tracks?: LosslessTrackCandidate[] }>(searchUrl, trackerToken);
      if (!res.ok || !res.data || !Array.isArray(res.data.tracks)) {
        continue;
      }

      const candidates = res.data.tracks;
      const targetDuration = track.duration || 0;
      const normCleanTitle = normalizeStr(cleanTitle);
      const normArtist = normalizeStr(primaryArtist);

      // Find the best match
      const matched = candidates.find((c) => {
        if (!c.id || !c.title) return false;

        // Duration check: if both have duration, ensure delta <= 8s
        if (targetDuration > 0 && c.duration && c.duration > 0) {
          const delta = Math.abs(c.duration - targetDuration);
          if (delta > 8) return false;
        }

        const candTitleNorm = normalizeStr(c.title);
        const candArtistNorm = normalizeStr(c.artist || '');

        const titleMatch =
          candTitleNorm === normCleanTitle ||
          candTitleNorm.includes(normCleanTitle) ||
          normCleanTitle.includes(candTitleNorm);

        const artistMatch =
          !normArtist ||
          candArtistNorm.includes(normArtist) ||
          normArtist.includes(candArtistNorm);

        return titleMatch && artistMatch;
      });

      if (!matched) {
        continue;
      }

      // Resolve stream
      const streamUrl = `${addon.baseUrl}/stream/${encodeURIComponent(matched.id)}?quality=LOSSLESS&atmos=auto`;
      const streamRes = await fetchAddonJson<any>(streamUrl, trackerToken);
      if (!streamRes.ok || !streamRes.data?.url) {
        continue;
      }

      const streamData = streamRes.data;
      const sampleRate = Number(streamData.sampleRate) || 44100;
      const bitDepth = Number(streamData.bitDepth) || 16;
      const bitrateKbps = Number(streamData.bitrate) || Math.round((sampleRate * bitDepth * 2) / 1000);
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
        candidateTitle: matched.title,
        candidateArtist: matched.artist
      };

      // Register URL with stream server allowlist if running on desktop
      if (isTauri) {
        invoke('allow_stream_url', { url: resolved.url }).catch(() => {});
      }

      losslessCache.set(track.id, resolved);
      return resolved;
    } catch (err) {
      console.warn(`[OurTube Lossless] Error querying addon ${addon.name}:`, err);
    }
  }

  losslessCache.set(track.id, null);
  return null;
}
