/**
 * BitChord High-Res Artwork Engine
 * Snaps requests to YouTube Music's standard square CDN sizes,
 * rewrites Google CDN parameters to pre-cached 544px/1200px masters, and provides fallback logic.
 */

import React from 'react';

const SQUARE_SIZES = [60, 120, 226, 544, 1200];
const RESIZABLE_CDN = /googleusercontent\.com|ggpht\.com/;
const YTIMG_REGEX = /i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\/([a-z0-9_-]+)\.jpg/;

/**
 * Returns a high-resolution, CDN-cached artwork URL for the given display width.
 * Snaps to standard square sizes to avoid uncached size 429 throttling.
 */
export function sizedArtwork(url: string | null | undefined, displayWidth: number = 226, aspect: number = 1): string {
  if (!url) {
    return 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
  }

  // Handle i.ytimg.com thumbnails: upgrade to maxresdefault for large displays or hqdefault
  if (url.includes('i.ytimg.com')) {
    const match = url.match(YTIMG_REGEX);
    if (match && match[1]) {
      const videoId = match[1];
      if (displayWidth >= 200) {
        return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      }
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
    return url;
  }

  if (!RESIZABLE_CDN.test(url) || Math.abs(aspect - 1) > 0.05) {
    return url;
  }

  const dpr = Math.min(typeof window === 'undefined' ? 2 : window.devicePixelRatio || 1, 2.5);
  const needed = displayWidth * dpr;

  // Snap to standard pre-cached YouTube Music sizes.
  // 544 is YouTube Music's native high-res master; 1200 is used only for extremely large displays.
  let targetSize = 544;
  if (needed <= 60) targetSize = 60;
  else if (needed <= 120) targetSize = 120;
  else if (needed <= 226) targetSize = 226;
  else if (needed <= 600) targetSize = 544;
  else targetSize = 1200;

  return artworkAtPixels(url, targetSize);
}

/**
 * Convenience helper returning the maximum studio master artwork
 */
export function highResArtwork(url: string | null | undefined): string {
  return sizedArtwork(url, 544);
}

/**
 * Strips existing size parameters from a Google CDN URL and applies an exact pixel size.
 */
export function artworkAtPixels(url: string, px: number = 544): string {
  if (!url || !RESIZABLE_CDN.test(url)) return url || '';
  // Strip query parameters first if any
  const [cleanUrl] = url.split('?');
  // Strip trailing size params like =w120-h120-l90-rj, =s60-c-k-c0x00ffffff-no-rj, =s88, etc.
  const base = cleanUrl.replace(/=[^/=]*$/, '');
  return `${base}=w${px}-h${px}-l90-rj`;
}

/**
 * Helper to handle image load error on ytimg maxresdefault or 429 throttles
 */
export function handleArtworkError(
  e: React.SyntheticEvent<HTMLImageElement>,
  originalUrl?: string
) {
  const target = e.currentTarget;
  const currentSrc = target.src;

  // 1. If 429 or failure on 1200, downgrade to 544
  if (currentSrc.includes('=w1200-h1200')) {
    target.src = currentSrc.replace('=w1200-h1200-l90-rj', '=w544-h544-l90-rj');
    return;
  }

  // 2. If 429 on 544, downgrade to 226
  if (currentSrc.includes('=w544-h544')) {
    target.src = currentSrc.replace('=w544-h544-l90-rj', '=w226-h226-l90-rj');
    return;
  }

  // 3. Fallbacks for ytimg
  if (currentSrc.includes('maxresdefault.jpg')) {
    target.src = currentSrc.replace('maxresdefault.jpg', 'hqdefault.jpg');
    return;
  }

  if (currentSrc.includes('hqdefault.jpg')) {
    target.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg');
    return;
  }

  if (originalUrl && currentSrc !== originalUrl) {
    target.src = originalUrl;
    return;
  }

  // Final fallback to graceful music placeholder
  target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
}
