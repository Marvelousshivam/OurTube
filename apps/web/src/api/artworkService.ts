/**
 * BitChord High-Res Artwork Engine
 * Snaps requests to YouTube Music's standard square CDN sizes,
 * rewrites Google CDN parameters to pre-cached 544px/1200px masters, and provides fallback logic.
 */

import React from 'react';

const GOOGLE_USER_CONTENT_CDN = /googleusercontent\.com/;
const GGPHT_CDN = /ggpht\.com/;
const YTIMG_REGEX = /i\d*\.ytimg\.com\/(?:vi|vi_webp)\/([a-zA-Z0-9_-]{11})\//;

/**
 * Guaranteed inline SVG fallback so no broken <img> icon can ever appear even offline
 */
export const FALLBACK_ARTWORK_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2b2329"/>
          <stop offset="50%" stop-color="#1f1a1d"/>
          <stop offset="100%" stop-color="#141113"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#ffb1c8" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#ffb1c8" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#bg)"/>
      <circle cx="200" cy="200" r="180" fill="url(#glow)"/>
      <circle cx="200" cy="200" r="88" fill="none" stroke="rgba(255,216,228,0.16)" stroke-width="2"/>
      <circle cx="200" cy="200" r="28" fill="rgba(255,216,228,0.12)"/>
      <path d="M212 138v78.5c-4.8-2.8-10.6-4.5-16.8-4.5-16.6 0-30 11.2-30 25s13.4 25 30 25 30-11.2 30-25V166h28v-28h-41.2z" fill="rgba(255,216,228,0.65)"/>
    </svg>`
  );

/**
 * Normalizes protocol-relative or relative YouTube Music image URLs and filters out known broken placeholders.
 */
function normalizeRawArtworkUrl(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  let url = raw.trim();
  if (!url) return '';

  if (url.startsWith('//')) {
    url = `https:${url}`;
  } else if (url.startsWith('/')) {
    url = `https://music.youtube.com${url}`;
  }

  // Filter out known invalid YouTube placeholder URLs
  if (
    url.includes('no_thumbnail') ||
    url.includes('/vi/default.jpg') ||
    url.includes('/vi/undefined/') ||
    url.includes('/vi/null/') ||
    url.includes('/vi/playlist_')
  ) {
    return '';
  }

  return url;
}

/**
 * Returns a high-resolution, CDN-cached artwork URL for the given display width.
 * Snaps to standard square sizes (max 544px studio master) to prevent Google CDN 400/404/429 errors.
 */
export function sizedArtwork(url: string | null | undefined, displayWidth: number = 226, aspect: number = 1): string {
  const normalized = normalizeRawArtworkUrl(url);
  if (!normalized) {
    return FALLBACK_ARTWORK_DATA_URI;
  }

  // Handle i.ytimg.com video thumbnails: always use hqdefault.jpg (guaranteed to exist for 100% of videos,
  // whereas maxresdefault.jpg 404s on ~40% of music tracks and older songs).
  if (normalized.includes('ytimg.com')) {
    // Preserve custom playlist collage URLs (e.g. i.ytimg.com/pl_c/...) with their signed query params
    if (normalized.includes('/pl_c/')) {
      return normalized;
    }
    const match = normalized.match(YTIMG_REGEX);
    if (match && match[1]) {
      const videoId = match[1];
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
    return normalized;
  }

  // Handle yt3.ggpht.com (playlist collages & channel avatars): use =s parameter or preserve signed URL
  if (GGPHT_CDN.test(normalized)) {
    if (normalized.includes('?')) return normalized;
    if (/=s\d+/.test(normalized)) {
      const targetS = displayWidth <= 120 ? 176 : 544;
      return normalized.replace(/=s\d+[^/]*$/, `=s${targetS}`);
    }
    return normalized;
  }

  if (!GOOGLE_USER_CONTENT_CDN.test(normalized) || Math.abs(aspect - 1) > 0.05) {
    return normalized;
  }

  const dpr = Math.min(typeof window === 'undefined' ? 2 : window.devicePixelRatio || 1, 2);
  const needed = displayWidth * dpr;

  // Snap to standard pre-cached YouTube Music sizes.
  // 544 is YouTube Music's universal studio master; requesting 1200 causes 400/404/429 on many tracks.
  let targetSize = 544;
  if (needed <= 60) targetSize = 60;
  else if (needed <= 120) targetSize = 120;
  else if (needed <= 226) targetSize = 226;
  else targetSize = 544;

  return artworkAtPixels(normalized, targetSize);
}

/**
 * Convenience helper returning the maximum studio master artwork (544x544)
 */
export function highResArtwork(url: string | null | undefined): string {
  return sizedArtwork(url, 544);
}

/**
 * Strips existing size parameters from a Google CDN URL and applies an exact pixel size.
 */
export function artworkAtPixels(url: string, px: number = 544): string {
  if (!url || !GOOGLE_USER_CONTENT_CDN.test(url)) return url || '';
  // If URL has signed query params (e.g. ?sqp=...), preserve them if no =w/-h suffix exists
  const [cleanUrl] = url.split('?');
  const safePx = Math.min(px, 544);
  // Only strip genuine trailing size modifiers like =w120-h120-l90-rj, =s544, etc.
  const base = cleanUrl.replace(/=(?:w\d+|s\d+|h\d+|c\b)[^/]*$/, '');
  return `${base}=w${safePx}-h${safePx}-l90-rj`;
}

/**
 * Helper to handle image load error on ytimg or Google CDN throttles/404s
 */
export function handleArtworkError(
  e: React.SyntheticEvent<HTMLImageElement>,
  originalUrl?: string
) {
  const target = e.currentTarget;
  const currentSrc = target.src || '';

  // Prevent infinite error loops
  const step = parseInt(target.dataset.fallbackStep || '0', 10);
  if (step >= 4) {
    target.src = FALLBACK_ARTWORK_DATA_URI;
    return;
  }
  target.dataset.fallbackStep = String(step + 1);

  // 1. If 1200 failed, downgrade to 544
  if (currentSrc.includes('=w1200-h1200')) {
    target.src = currentSrc.replace(/=w1200-h1200[^/]*$/, '=w544-h544-l90-rj');
    return;
  }

  // 2. If 544 failed, downgrade to 226
  if (currentSrc.includes('=w544-h544')) {
    target.src = currentSrc.replace(/=w544-h544[^/]*$/, '=w226-h226-l90-rj');
    return;
  }

  // 3. Fallbacks for ytimg maxresdefault / sddefault / hqdefault
  if (currentSrc.includes('maxresdefault.jpg') || currentSrc.includes('sddefault.jpg')) {
    target.src = currentSrc.replace(/(?:maxresdefault|sddefault)\.jpg/, 'hqdefault.jpg');
    return;
  }

  if (currentSrc.includes('hqdefault.jpg')) {
    target.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg');
    return;
  }

  // 4. Try normalized original URL if different
  const normOrig = normalizeRawArtworkUrl(originalUrl);
  if (normOrig && currentSrc !== normOrig && !normOrig.includes('maxresdefault') && !normOrig.includes('=w1200')) {
    target.src = normOrig;
    return;
  }

  // 5. Final fallback to inline SVG cover art (never 404s)
  target.src = FALLBACK_ARTWORK_DATA_URI;
}
