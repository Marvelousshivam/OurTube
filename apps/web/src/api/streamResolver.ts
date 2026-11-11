import { Innertube, Platform, UniversalCache, Types } from 'youtubei.js/web';
import { bridgeClient } from './bridgeClient';
import {
  StreamResolutionResponse,
  parseAudioTracksFromAdaptiveFormats,
  parseCaptionTracksFromPlayerResponse,
  YouTubeAudioTrackOption
} from '@koda/bridge-types';
import { useSettingsStore } from '../store/settingsStore';
import { invoke } from '@tauri-apps/api/core';
import { isDesktopApp } from './desktop';

let chunkedSwReady = false;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/koda-stream-sw.js', { scope: '/' })
    .then((reg) => {
      if (reg.active || navigator.serviceWorker.controller) {
        chunkedSwReady = true;
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (installing) {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'activated') {
              chunkedSwReady = true;
            }
          });
        }
      });
    })
    .catch(() => {
      chunkedSwReady = false;
    });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    chunkedSwReady = Boolean(navigator.serviceWorker.controller);
  });
}

const VALID_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeVideoId(videoId?: string | null): boolean {
  return Boolean(videoId && VALID_VIDEO_ID_RE.test(videoId.trim()));
}

let probeVideoEl: HTMLVideoElement | null = null;
let probeAudioEl: HTMLAudioElement | null = null;

function isMediaMimeSupported(mimeType?: string | null, kind: 'video' | 'audio' = 'video'): boolean {
  if (!mimeType) return false;
  if (typeof document === 'undefined') return true;
  try {
    if (kind === 'video') {
      if (!probeVideoEl) probeVideoEl = document.createElement('video');
      return probeVideoEl.canPlayType(mimeType) !== '';
    } else {
      if (!probeAudioEl) probeAudioEl = document.createElement('audio');
      return probeAudioEl.canPlayType(mimeType) !== '';
    }
  } catch {
    return true;
  }
}

/**
 * Wraps a progressive googlevideo.com stream URL into our local Service Worker
 * ChunkedStreamDataSource endpoint (/koda-stream-sw.js) so open-ended <video> Range
 * requests are converted into bounded backpressure-aware chunk requests.
 */
export function wrapChunkedStreamUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return rawUrl;
  if (!chunkedSwReady && !navigator.serviceWorker.controller) return rawUrl;
  // Desktop: media is served by the Rust stream server, not the service worker
  if (isDesktopApp()) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.endsWith('.googlevideo.com')) return rawUrl;
    if (parsed.hostname.startsWith('manifest.') || parsed.pathname.endsWith('.m3u8')) return rawUrl;
    const clen = parseInt(parsed.searchParams.get('clen') || '0', 10);
    if (!Number.isFinite(clen) || clen <= 0) return rawUrl;
    return `/__koda_chunk_stream__?url=${encodeURIComponent(rawUrl)}`;
  } catch {
    return rawUrl;
  }
}

const prewarmedUrls = new Set<string>();

/**
 * Warms the initial 1.5 MB of a googlevideo stream into the Koda Service Worker startup RAM cache
 * (or browser HTTP cache if the Service Worker is not yet active).
 */
export function prewarmStreamBytes(rawUrl?: string | null): void {
  if (!rawUrl || typeof window === 'undefined') return;
  // Desktop: no service worker cache, and direct googlevideo fetches are CORS-blocked
  if (isDesktopApp()) return;
  if (prewarmedUrls.has(rawUrl)) return;
  prewarmedUrls.add(rawUrl);
  if (prewarmedUrls.size > 40) {
    const oldest = prewarmedUrls.values().next().value;
    if (oldest) prewarmedUrls.delete(oldest);
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'KODA_PREWARM_STREAM',
        url: rawUrl
      });
      return;
    }
    const parsed = new URL(rawUrl);
    if (parsed.hostname.endsWith('.googlevideo.com')) {
      const clen = parseInt(parsed.searchParams.get('clen') || '0', 10);
      const endByte = clen > 0 ? Math.min(clen - 1, 524287) : 524287;
      parsed.searchParams.set('range', `0-${endByte}`);
      window.fetch(parsed.toString(), { method: 'GET', credentials: 'omit' }).catch(() => {});
    }
  } catch {
    // Ignore prewarm errors
  }
}

const YOUTUBE_HOSTS = new Set(['music.youtube.com', 'www.youtube.com', 'youtube.com']);
const SAFELISTED = new Set(['accept', 'accept-language', 'content-language']);

/**
 * InnerTube clients that accept cookie (SAPISIDHASH) authentication.
 * iOS/visionOS/Android clients do NOT accept browser cookies, so they stay anonymous.
 */
const COOKIE_AUTH_PLAYER_CLIENTS: Record<string, string> = {
  TVHTML5: '7',
  WEB: '1',
  MWEB: '2'
};

/** When YouTube answers anonymous requests with "Sign in to confirm you're not a bot",
 * stop sending anonymous /player requests for a while instead of hammering it. */
const ANON_BLOCK_COOLDOWN_MS = 10 * 60 * 1000;
let anonymousBlockedUntil = 0;

function markAnonymousBlocked(reason?: string): void {
  if (Date.now() >= anonymousBlockedUntil) {
    console.warn(
      `[OurTube StreamResolver] Anonymous playback refused by YouTube (${reason || 'LOGIN_REQUIRED'}). ` +
        'Using signed-in session only for the next 10 minutes.'
    );
  }
  anonymousBlockedUntil = Date.now() + ANON_BLOCK_COOLDOWN_MS;
}

function isAnonymousBlocked(): boolean {
  return Date.now() < anonymousBlockedUntil;
}

function hasSignedInSession(): boolean {
  return bridgeClient.getIsAvailable() && Boolean(bridgeClient.getAuthState()?.isAuthenticated);
}

/**
 * Read-Only / Anonymous Playback by default:
 * Only attach the user's signed-in session to /player requests when anonymous resolution fails
 * (e.g. age-restricted video or LOGIN_REQUIRED challenge), protecting the user's Google account
 * from routine playback/prefetch traffic.
 */
let allowAuthenticatedPlayerFallback = false;

/**
 * Sends a /player request through the companion extension using the user's own signed-in
 * YouTube session. Returns null when not applicable so the caller falls back to anonymous.
 */
async function tryAuthenticatedPlayerFetch(_url: URL, body: string): Promise<Response | null> {
  if (!hasSignedInSession()) return null;
  if (!allowAuthenticatedPlayerFallback && !isAnonymousBlocked()) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  const clientName: string | undefined = parsed?.context?.client?.clientName;
  const clientId = clientName ? COOKIE_AUTH_PLAYER_CLIENTS[clientName] : undefined;
  if (!clientId) return null;

  // Include contentCheckOk & racyCheckOk so age-restricted videos play when signed in
  parsed.contentCheckOk = true;
  parsed.racyCheckOk = true;

  try {
    const authUser = bridgeClient.getAuthState()?.selectedChannel?.authUser || '0';
    const result = await bridgeClient.fetchInnertube({
      url: `https://www.youtube.com/youtubei/v1/player?prettyPrint=false`,
      method: 'POST',
      headers: {
        'X-Goog-AuthUser': authUser,
        'X-YouTube-Client-Name': clientId,
        'X-YouTube-Client-Version': String(parsed.context.client.clientVersion || '')
      },
      body: parsed
    });
    if (!result) return null;
    const payload = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    return new Response(payload, {
      status: result.status || 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.warn('[OurTube StreamResolver] Signed-in /player request via extension failed:', err);
    return null;
  }
}

/**
 * youtubei answers CORS preflights with 400, so InnerTube calls must be "simple" requests:
 * a text/plain body, no custom headers, and anonymous credentials: 'omit'.
 * Origin, Referer and X-Origin are added by the extension's DNR rules.
 */
async function simpleRequestFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : input.toString());

  if (!YOUTUBE_HOSTS.has(url.hostname) || url.pathname.startsWith('/api/jnn/')) {
    return fetch(input, init);
  }

  const method = init?.method ?? request?.method ?? 'GET';
  const source = new Headers(init?.headers ?? request?.headers);
  const headers = new Headers();
  source.forEach((value, key) => {
    if (SAFELISTED.has(key.toLowerCase())) headers.set(key, value);
  });

  let body: BodyInit | null | undefined = init?.body;
  if (body === undefined && request && method !== 'GET' && method !== 'HEAD') {
    body = await request.text();
  }

  // Signed-in /player requests go through the companion extension only when explicitly enabled
  if (url.pathname === '/youtubei/v1/player' && typeof body === 'string') {
    const authenticated = await tryAuthenticatedPlayerFetch(url, body);
    if (authenticated) return authenticated;
  }

  if (body != null) headers.set('Content-Type', 'text/plain;charset=UTF-8');

  return fetch(url, {
    method,
    headers,
    body: body ?? null,
    signal: init?.signal ?? request?.signal ?? null,
    credentials: 'omit'
  });
}

/**
 * Desktop (Tauri) fetch for youtubei.js: routes the request through the Rust
 * proxy_fetch command, which may set Origin/Referer/X-Origin and is not
 * subject to CORS. Rebuilds a standard Response for youtubei.js.
 */
async function desktopProxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : input.toString());

  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return fetch(input, init);
  }

  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  new Headers(init?.headers ?? request?.headers).forEach((value, key) => {
    headers[key] = value;
  });

  let body: string | undefined;
  if (init?.body != null) {
    body = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
  } else if (request && method !== 'GET' && method !== 'HEAD') {
    body = await request.text();
  }

  // Signed-in /player fallback only when anonymous resolution failed (e.g. age-restricted video)
  if (url.pathname === '/youtubei/v1/player' && typeof body === 'string') {
    const authenticated = await tryAuthenticatedPlayerFetch(url, body);
    if (authenticated) return authenticated;
  }

  const res = await invoke<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: unknown;
  }>('proxy_fetch', {
    payload: {
      url: url.toString(),
      method,
      headers,
      body,
      signed: false,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    }
  });

  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? null);
  const responseHeaders = new Headers(res.headers || {});
  // The body is already decoded; stale framing headers would corrupt the Response.
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-encoding');
  const nullBody = res.status === 204 || res.status === 304;
  return new Response(nullBody ? null : text, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders
  });
}

let webInnertubeInstance: Innertube | null = null;
let initPromise: Promise<Innertube> | null = null;

export async function getWebInnertube(): Promise<Innertube> {
  if (webInnertubeInstance) return webInnertubeInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Runs the player's signature and n-parameter functions extracted by YouTube.js
      Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
        const properties: string[] = [];
        if (env.n) properties.push(`n: exportedVars.nFunction(${JSON.stringify(env.n)})`);
        if (env.sig) properties.push(`sig: exportedVars.sigFunction(${JSON.stringify(env.sig)})`);
        return new Function(`${data.output}\nreturn { ${properties.join(', ')} }`)();
      };

      const instance = await Innertube.create({
        cache: new UniversalCache(true),
        // Desktop: route through the Rust proxy (no CORS wall in the Tauri shell)
        fetch: isDesktopApp() ? desktopProxyFetch : simpleRequestFetch,
        retrieve_player: true
      });
      webInnertubeInstance = instance;
      return instance;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export interface StreamOptions {
  videoId: string;
  quality?: 'auto' | '1080p' | '720p' | '480p' | '360p';
  mode?: 'music' | 'video';
  audioTrackId?: string;
}

interface CachedStreamEntry {
  response: StreamResolutionResponse;
  expiresAt: number;
}

// In-memory high-performance LRU-like stream cache for seamless 0ms instant playback
const streamResolutionCache = new Map<string, CachedStreamEntry>();
const inFlightStreamResolutions = new Map<string, Promise<StreamResolutionResponse>>();

function getCacheKey(options: StreamOptions): string {
  return `${options.videoId}:${options.quality || 'auto'}:${options.mode || 'music'}:${options.audioTrackId || 'orig'}`;
}

function extractUrlExpiryMs(rawUrl?: string | null): number | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    const expireSec = parseInt(parsed.searchParams.get('expire') || '0', 10);
    if (Number.isFinite(expireSec) && expireSec > 0) {
      // Refresh at least 5 minutes before actual googlevideo.com URL expiration
      return expireSec * 1000 - 5 * 60 * 1000;
    }
  } catch {
    // ignore
  }
  return null;
}

export function getCachedStream(options: StreamOptions): StreamResolutionResponse | null {
  const key = getCacheKey(options);
  const entry = streamResolutionCache.get(key);
  if (!entry) return null;
  const now = Date.now();
  const urlExpiry =
    extractUrlExpiryMs(entry.response.videoUrl) ?? extractUrlExpiryMs(entry.response.audioUrl);
  if (now > entry.expiresAt || (urlExpiry !== null && now >= urlExpiry)) {
    streamResolutionCache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCachedStream(options: StreamOptions, response: StreamResolutionResponse): void {
  if (!response?.audioUrl) return;
  const key = getCacheKey(options);
  const fallbackTtlMs = (response.expiresInSeconds ? response.expiresInSeconds - 300 : 1800) * 1000;
  const urlExpiry =
    extractUrlExpiryMs(response.videoUrl) ?? extractUrlExpiryMs(response.audioUrl);
  const computedExpiresAt =
    urlExpiry !== null
      ? Math.min(urlExpiry, Date.now() + fallbackTtlMs)
      : Date.now() + Math.max(60000, fallbackTtlMs);
  streamResolutionCache.set(key, {
    response,
    expiresAt: computedExpiresAt
  });
}

export function invalidateStreamCache(videoId: string): void {
  for (const key of Array.from(streamResolutionCache.keys())) {
    if (key.startsWith(`${videoId}:`)) {
      streamResolutionCache.delete(key);
    }
  }
}

/**
 * Pre-fetches and caches direct audio stream URLs in background so upcoming queue items play seamlessly.
 */
export async function prefetchStream(options: StreamOptions): Promise<StreamResolutionResponse> {
  if (!isValidYouTubeVideoId(options?.videoId)) {
    return { audioUrl: undefined, videoUrl: undefined };
  }
  const cached = getCachedStream(options);
  if (cached) {
    if (options.mode === 'video') {
      prewarmStreamBytes(cached.videoUrl);
      if (cached.audioUrl && cached.audioUrl !== cached.videoUrl) {
        prewarmStreamBytes(cached.audioUrl);
      }
    }
    return cached;
  }
  // Don't burn requests on speculative prefetches while YouTube is challenging us
  if (isAnonymousBlocked()) {
    return { audioUrl: undefined, videoUrl: undefined };
  }
  const resolved = await resolveStream(options);
  if (options.mode === 'video' && resolved) {
    prewarmStreamBytes(resolved.videoUrl);
    if (resolved.audioUrl && resolved.audioUrl !== resolved.videoUrl) {
      prewarmStreamBytes(resolved.audioUrl);
    }
  }
  return resolved;
}

const prefetchedVideoIds = new Set<string>();

/**
 * High-speed video stream prefetcher for hover intent & Up-Next queue warming.
 * Resolves the video stream URL into memory cache and warms the initial keyframe bytes.
 */
export function prefetchVideoStream(
  videoId: string,
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p' = 'auto'
): void {
  if (!isValidYouTubeVideoId(videoId)) return;
  const key = `${videoId}:${quality}`;
  if (prefetchedVideoIds.has(key)) return;
  prefetchedVideoIds.add(key);
  if (prefetchedVideoIds.size > 40) {
    const oldest = prefetchedVideoIds.values().next().value;
    if (oldest) prefetchedVideoIds.delete(oldest);
  }
  prefetchStream({ videoId, mode: 'video', quality }).catch(() => {});
}

let desktopStreamPort: number | null = null;
async function getDesktopStreamPort(): Promise<number> {
  if (desktopStreamPort === null) {
    desktopStreamPort = await invoke<number>('stream_port');
  }
  return desktopStreamPort;
}

async function wrapDesktopMediaUrl(rawUrl?: string | null): Promise<string | undefined> {
  if (!rawUrl) return undefined;
  try {
    const host = new URL(rawUrl).hostname;
    if (host !== 'googlevideo.com' && !host.endsWith('.googlevideo.com')) return rawUrl;
  } catch {
    return rawUrl;
  }
  const port = await getDesktopStreamPort();
  return `http://127.0.0.1:${port}/stream?url=${encodeURIComponent(rawUrl)}`;
}

async function wrapDesktopStreamUrls(res: StreamResolutionResponse): Promise<StreamResolutionResponse> {
  const audioTracks = res.audioTracks
    ? await Promise.all(
        res.audioTracks.map(async (t) => ({
          ...t,
          url: (await wrapDesktopMediaUrl(t.url)) ?? t.url
        }))
      )
    : undefined;
  return {
    ...res,
    audioUrl: await wrapDesktopMediaUrl(res.audioUrl),
    videoUrl: await wrapDesktopMediaUrl(res.videoUrl),
    audioTracks
  };
}

/**
 * Resolves a high-quality direct audio/video stream URL.
 * Architecture:
 * 1. In-memory hot cache -> 0ms instant retrieval for queued/pre-buffered tracks
 * 2. Companion extension bridge (anonymous VISIONOS / getInfo)
 * 3. Same-origin Vite dev server stream endpoint (/api/resolve-stream)
 * 4. In-browser direct VISIONOS Innertube resolution with simpleRequestFetch
 * 5. In-browser signature deciphering fallback (anonymous first, then signed-in fallback if required)
 */
export async function resolveStream(options: StreamOptions): Promise<StreamResolutionResponse> {
  if (!isValidYouTubeVideoId(options?.videoId)) {
    return { audioUrl: undefined, videoUrl: undefined };
  }
  const cacheKey = getCacheKey(options);

  // 0. Check hot memory cache
  const cached = getCachedStream(options);
  if (cached) {
    return cached;
  }

  // De-duplicate concurrent in-flight resolutions for the same videoId
  if (inFlightStreamResolutions.has(cacheKey)) {
    return inFlightStreamResolutions.get(cacheKey)!;
  }

  const resolutionPromise = (async () => {
    try {
      const res = await _doResolveStream(options);
      // Desktop: serve googlevideo media through the Rust stream server
      // (sends no Origin/Referer, so streams don't 403, and seeking works
      // via forwarded Range requests)
      const finalRes = res && isDesktopApp() ? await wrapDesktopStreamUrls(res) : res;
      if (finalRes?.audioUrl) {
        setCachedStream(options, finalRes);
      }
      return finalRes;
    } finally {
      inFlightStreamResolutions.delete(cacheKey);
    }
  })();

  inFlightStreamResolutions.set(cacheKey, resolutionPromise);
  return resolutionPromise;
}

async function _doResolveStream(options: StreamOptions): Promise<StreamResolutionResponse> {
  const { videoId, quality = 'auto', mode = 'music', audioTrackId } = options;
  const qualityPref = useSettingsStore.getState().audioQuality;
  const mappedAudioQuality: 'high' | 'normal' | 'low' =
    qualityPref === 'saver' ? 'low' : qualityPref === 'normal' ? 'normal' : 'high';

  // Anonymous paths (1-3) are skipped while YouTube is refusing anonymous requests.
  const anonymousAllowed = !isAnonymousBlocked();

  // 1. Companion extension bridge (direct host permissions in background, 0 CORS)
  if (anonymousAllowed && bridgeClient.getIsAvailable()) {
    try {
      const bridgeRes = await bridgeClient.resolveStream({
        videoId,
        quality,
        audioQuality: mappedAudioQuality,
        mode,
        audioTrackId
      });

      // In video mode, ONLY accept bridge response if videoUrl is actually resolved!
      if (bridgeRes && (mode !== 'video' ? Boolean(bridgeRes.audioUrl) : Boolean(bridgeRes.videoUrl))) {
        return bridgeRes;
      }
    } catch (bridgeErr) {
      console.warn('[StreamResolver] Extension bridge stream resolution failed:', bridgeErr);
    }
  }

  // 2. Same-Origin Vite stream resolver (when running under local Vite dev server)
  if (anonymousAllowed) {
    try {
      const res = await window.fetch(
        `/api/resolve-stream?videoId=${encodeURIComponent(videoId)}&quality=${encodeURIComponent(quality)}&mode=${encodeURIComponent(mode)}&audioTrackId=${encodeURIComponent(audioTrackId || '')}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.audioUrl && (mode !== 'video' || data?.videoUrl)) {
          return {
            audioUrl: data.audioUrl,
            videoUrl: data.videoUrl,
            audioBitrate: data.audioBitrate,
            videoQuality: data.videoQuality || quality,
            expiresInSeconds: data.expiresInSeconds || 21600,
            format: data.format,
            captionTracks: data.captionTracks
          };
        }
      }
    } catch {
      // Continue to direct resolution
    }
  }

  // 3. Direct Innertube VISIONOS resolution (CORS-free simple request, returns direct unencrypted googlevideo.com URLs)
  if (anonymousAllowed) {
    try {
      const yt = await getWebInnertube();
      const res: any = await yt.actions.execute('/player', {
        videoId,
        client: 'VISIONOS',
        contentCheckOk: true,
        racyCheckOk: true
      });
      const playability = res.data?.playabilityStatus;
      if (playability?.status === 'LOGIN_REQUIRED') {
        markAnonymousBlocked(playability.reason);
      }
      const adaptiveFormats: any[] = res.data?.streamingData?.adaptiveFormats || [];
      const formats: any[] = res.data?.streamingData?.formats || [];

      // Parse audio tracks to guarantee original audio preference & eliminate regional auto-dubs
      const audioTracks = parseAudioTracksFromAdaptiveFormats(adaptiveFormats, mappedAudioQuality);
      let selectedTrack: YouTubeAudioTrackOption | undefined;
      if (audioTrackId) {
        selectedTrack = audioTracks.find((t) => t.id === audioTrackId);
      }
      if (!selectedTrack) {
        selectedTrack = audioTracks.find((t) => t.isOriginal) || audioTracks[0];
      }

      const audioFormats = adaptiveFormats
        .filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url && isMediaMimeSupported(f.mimeType, 'audio'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      // Choose audio stream respecting Audio Quality setting (High, Normal, Saver)
      let bestAudio: any;
      if (selectedTrack?.url) {
        bestAudio = {
          url: selectedTrack.url,
          bitrate: selectedTrack.bitrate,
          mimeType: selectedTrack.mimeType || 'audio/mp4'
        };
      } else if (qualityPref === 'saver') {
        bestAudio = audioFormats[audioFormats.length - 1] || audioFormats[0];
      } else if (qualityPref === 'normal') {
        bestAudio =
          audioFormats.find((f) => (f.bitrate || 0) <= 160000 && (f.bitrate || 0) >= 96000) ||
          audioFormats[0];
      } else {
        bestAudio =
          audioFormats.find((f) => f.mimeType.includes('mp4a')) ||
          audioFormats[0] ||
          formats.find((f) => f.url);
      }

      let bestVideo: any = null;
      let usingMuxedVideo = false;
      if (mode === 'video') {
        const muxedFormats = formats
          .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url && isMediaMimeSupported(f.mimeType, 'video'))
          .sort((a, b) => (b.height || 0) - (a.height || 0));

        const videoFormats = adaptiveFormats
          .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url && isMediaMimeSupported(f.mimeType, 'video'))
          .sort((a, b) => {
            const heightDiff = (b.height || 0) - (a.height || 0);
            if (heightDiff !== 0) return heightDiff;
            // Prefer H.264 (avc1) for hardware decode efficiency & zero-stutter compatibility
            const aAvc = a.mimeType?.includes('avc1') ? 1 : 0;
            const bAvc = b.mimeType?.includes('avc1') ? 1 : 0;
            return bAvc - aAvc;
          });

        const targetHeight =
          quality && quality !== 'auto' ? parseInt(quality.replace('p', ''), 10) : 1080;

        // Prefer adaptive HD video + separate adaptive audio track so we get 1080p/720p + original soundtrack
        bestVideo =
          videoFormats.find((f) => f.height === targetHeight && f.mimeType?.includes('avc1')) ||
          videoFormats.find((f) => f.height === targetHeight) ||
          videoFormats.find(
            (f) => (f.height || 0) <= targetHeight && (f.height || 0) >= 720 && f.mimeType?.includes('avc1')
          ) ||
          videoFormats.find((f) => (f.height || 0) <= targetHeight && (f.height || 0) >= 720) ||
          videoFormats.find((f) => f.mimeType?.includes('avc1')) ||
          videoFormats[0];

        if (!bestVideo && muxedFormats.length > 0) {
          bestVideo = muxedFormats[0];
          usingMuxedVideo = true;
        }

        // Live stream HLS fallback if no static adaptive/muxed formats exist
        const hlsManifestUrl = res.data?.streamingData?.hlsManifestUrl;
        if (!bestVideo && hlsManifestUrl) {
          bestVideo = {
            url: hlsManifestUrl,
            height: targetHeight,
            mimeType: 'application/vnd.apple.mpegurl'
          };
          usingMuxedVideo = true;
        }
      }

      const captionTracks = parseCaptionTracksFromPlayerResponse(res.data);

      const hasRequiredStreams =
        mode === 'video' ? Boolean(bestVideo?.url) : Boolean(bestAudio?.url);

      if (hasRequiredStreams && (bestAudio?.url || bestVideo?.url)) {
        const resolvedAudioUrl = usingMuxedVideo
          ? bestVideo?.url
          : selectedTrack?.url || bestAudio?.url || bestVideo?.url;
        console.log(
          '[OurTube StreamResolver] Direct VISIONOS resolution successful:',
          bestVideo?.mimeType || bestAudio?.mimeType
        );
        return {
          audioUrl: resolvedAudioUrl,
          videoUrl: bestVideo?.url,
          audioBitrate: selectedTrack?.bitrate || bestAudio?.bitrate,
          videoQuality: bestVideo ? `${bestVideo.height}p` : undefined,
          expiresInSeconds: res.data?.streamingData?.expiresInSeconds
            ? parseInt(res.data.streamingData.expiresInSeconds, 10)
            : 21600,
          format: bestVideo?.mimeType || bestAudio?.mimeType,
          audioTracks,
          selectedAudioTrackId: selectedTrack?.id,
          captionTracks
        };
      }
    } catch (directErr) {
      console.warn('[StreamResolver] Direct VISIONOS resolution error:', directErr);
    }
  }

  // 4. Deciphered fallback: try anonymous WEB decipher first, then opt-in to signed-in
  //    TV/MWEB decipher only if anonymous resolution could not play the video (e.g. age-restricted).
  if (anonymousAllowed) {
    const anonDeciphered = await resolveViaDecipher(videoId, mode, quality, undefined, false);
    if (anonDeciphered) return anonDeciphered;
  }

  const signedIn = hasSignedInSession();
  if (signedIn) {
    for (const client of ['TV', 'MWEB'] as const) {
      const resolved = await resolveViaDecipher(videoId, mode, quality, client, true);
      if (resolved) return resolved;
    }
  }

  if (!signedIn && isAnonymousBlocked()) {
    console.warn(
      '[OurTube StreamResolver] YouTube is asking to sign in. Connect the companion extension and sign in to YouTube to keep playing.'
    );
  }

  return {
    audioUrl: undefined,
    videoUrl: undefined
  };
}

async function resolveViaDecipher(
  videoId: string,
  mode: 'music' | 'video',
  quality: StreamOptions['quality'],
  client?: string,
  useAuthenticatedSession: boolean = false
): Promise<StreamResolutionResponse | null> {
  const label = client || 'WEB';
  const prevAuthFlag = allowAuthenticatedPlayerFallback;
  allowAuthenticatedPlayerFallback = useAuthenticatedSession;
  try {
    const yt = await getWebInnertube();
    const info = await yt.getBasicInfo(videoId, client ? { client: client as any } : undefined);

    const status = info.playability_status?.status;
    if (status && status !== 'OK') {
      console.warn(`[StreamResolver] ${label} playability: ${status} - ${info.playability_status?.reason || ''}`);
      if (status === 'LOGIN_REQUIRED' && !hasSignedInSession()) {
        markAnonymousBlocked(info.playability_status?.reason);
      }
      return null;
    }

    if (mode === 'video') {
      let chosenVideoFormat: any = null;
      let chosenAudioFormat: any = null;

      // For auto or standard quality (<= 720p), prefer muxed video+audio MP4
      if (!quality || quality === 'auto' || quality === '720p' || quality === '360p') {
        try {
          chosenVideoFormat = info.chooseFormat({ type: 'video+audio', quality: quality || 'best' });
          chosenAudioFormat = chosenVideoFormat;
        } catch {}
      }

      // If no muxed format or higher quality (1080p+) requested, choose separate video and audio
      if (!chosenVideoFormat) {
        try {
          chosenVideoFormat = info.chooseFormat({ type: 'video', quality: quality || 'best' });
          chosenAudioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
        } catch {}
      }

      const videoUrl = chosenVideoFormat ? await chosenVideoFormat.decipher(yt.session.player) : undefined;
      const audioUrl = chosenAudioFormat ? await chosenAudioFormat.decipher(yt.session.player) : undefined;

      if (videoUrl) {
        console.log(
          `[OurTube StreamResolver] ${label} deciphered video resolution successful:`,
          chosenVideoFormat?.quality_label
        );
        return {
          audioUrl: audioUrl || videoUrl,
          videoUrl,
          audioBitrate: chosenAudioFormat?.bitrate,
          videoQuality:
            chosenVideoFormat?.quality_label ||
            (chosenVideoFormat?.height ? `${chosenVideoFormat.height}p` : undefined),
          expiresInSeconds: 21600,
          format: chosenVideoFormat?.mime_type
        };
      }
    } else {
      // Audio / Music mode
      const audio = info.chooseFormat({ type: 'audio', quality: 'best' });
      const audioUrl = audio ? await audio.decipher(yt.session.player) : undefined;

      if (audioUrl) {
        console.log(`[OurTube StreamResolver] ${label} deciphered audio resolution successful`);
        return {
          audioUrl,
          videoUrl: undefined,
          audioBitrate: audio?.bitrate,
          videoQuality: undefined,
          expiresInSeconds: 21600,
          format: audio?.mime_type
        };
      }
    }
  } catch (decipherErr) {
    console.warn(`[StreamResolver] ${label} decipher resolution error:`, decipherErr);
  } finally {
    allowAuthenticatedPlayerFallback = prevAuthFlag;
  }
  return null;
}
