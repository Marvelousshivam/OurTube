import { Innertube, Platform, UniversalCache, Types } from 'youtubei.js/web';
import { bridgeClient } from './bridgeClient';
import {
  StreamResolutionResponse,
  parseAudioTracksFromAdaptiveFormats,
  parseCaptionTracksFromPlayerResponse,
  YouTubeAudioTrackOption
} from '@koda/bridge-types';
import { useSettingsStore } from '../store/settingsStore';

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

/**
 * Wraps a progressive googlevideo.com stream URL into our local Service Worker
 * ChunkedStreamDataSource endpoint (/koda-stream-sw.js) so open-ended <video> Range
 * requests are converted into bounded 2MB/8MB chunk requests (bypassing YouTube's 1.0x bitrate throttle).
 */
export function wrapChunkedStreamUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return rawUrl;
  if (!chunkedSwReady && !navigator.serviceWorker.controller) return rawUrl;
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
 * Warms the initial 1 MB of a googlevideo stream using a bounded range parameter (&range=0-1048575)
 * into both the browser HTTP cache and the Koda Service Worker startup RAM cache.
 */
export function prewarmStreamBytes(rawUrl?: string | null): void {
  if (!rawUrl || typeof window === 'undefined') return;
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
    }
    const parsed = new URL(rawUrl);
    if (parsed.hostname.endsWith('.googlevideo.com')) {
      const clen = parseInt(parsed.searchParams.get('clen') || '0', 10);
      const endByte = clen > 0 ? Math.min(clen - 1, 786431) : 786431; // 768 KB instant keyframe slice
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
  if (body != null) headers.set('Content-Type', 'text/plain;charset=UTF-8');

  return fetch(url, {
    method,
    headers,
    body: body ?? null,
    signal: init?.signal ?? request?.signal ?? null,
    credentials: 'omit'
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
        fetch: simpleRequestFetch,
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

export function getCachedStream(options: StreamOptions): StreamResolutionResponse | null {
  const key = getCacheKey(options);
  const entry = streamResolutionCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    streamResolutionCache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCachedStream(options: StreamOptions, response: StreamResolutionResponse): void {
  if (!response?.audioUrl) return;
  const key = getCacheKey(options);
  const ttlMs = (response.expiresInSeconds ? response.expiresInSeconds - 120 : 21600) * 1000;
  streamResolutionCache.set(key, {
    response,
    expiresAt: Date.now() + Math.max(60000, ttlMs)
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
  if (!videoId || videoId.length < 5) return;
  const key = `${videoId}:${quality}`;
  if (prefetchedVideoIds.has(key)) return;
  prefetchedVideoIds.add(key);
  if (prefetchedVideoIds.size > 40) {
    const oldest = prefetchedVideoIds.values().next().value;
    if (oldest) prefetchedVideoIds.delete(oldest);
  }
  prefetchStream({ videoId, mode: 'video', quality }).catch(() => {});
}

/**
 * Resolves a high-quality direct audio/video stream URL.
 * Architecture:
 * 1. In-memory hot cache -> 0ms instant retrieval for queued/pre-buffered tracks
 * 2. Same-origin Vite dev server stream endpoint (/api/resolve-stream) -> 0ms local Node.js resolution
 * 3. In-browser direct VISIONOS Innertube resolution with simpleRequestFetch -> direct googlevideo.com URLs
 * 4. Companion extension bridge fallback -> handles signed-in SAPISID sessions
 * 5. In-browser signature deciphering fallback
 */
export async function resolveStream(options: StreamOptions): Promise<StreamResolutionResponse> {
  const { videoId, quality = 'auto', mode = 'music' } = options;
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
      if (res?.audioUrl) {
        setCachedStream(options, res);
      }
      return res;
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

  // 1. Companion extension bridge (direct host permissions in background, 0 CORS, supports signed sessions)
  if (bridgeClient.getIsAvailable()) {
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

  // 3. Direct Innertube VISIONOS resolution (CORS-free simple request, returns direct unencrypted googlevideo.com URLs)
  try {
    const yt = await getWebInnertube();
    const res = await yt.actions.execute('/player', { videoId, client: 'VISIONOS' });
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
      .filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Choose audio stream respecting Audio Quality setting (High, Normal, Saver)
    let bestAudio: any;
    if (selectedTrack?.url) {
      bestAudio = { url: selectedTrack.url, bitrate: selectedTrack.bitrate, mimeType: 'audio/mp4' };
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
        .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url)
        .sort((a, b) => (b.height || 0) - (a.height || 0));

      const videoFormats = adaptiveFormats
        .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url)
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
        videoFormats.find((f) => (f.height || 0) <= targetHeight && (f.height || 0) >= 720) ||
        videoFormats[0];

      if (!bestVideo && muxedFormats.length > 0) {
        bestVideo = muxedFormats[0];
        usingMuxedVideo = true;
      }
    }

    const captionTracks = parseCaptionTracksFromPlayerResponse(res.data);

    const hasRequiredStreams = mode === 'video'
      ? Boolean(bestVideo?.url)
      : Boolean(bestAudio?.url);

    if (hasRequiredStreams && (bestAudio?.url || bestVideo?.url)) {
      const resolvedAudioUrl = usingMuxedVideo
        ? bestVideo?.url
        : selectedTrack?.url || bestAudio?.url || bestVideo?.url;
      console.log('[OurTube StreamResolver] Direct VISIONOS resolution successful:', bestVideo?.mimeType || bestAudio?.mimeType);
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

  // 4. Comprehensive Fallback: getInfo with signature and n-token deciphering
  try {
    const yt = await getWebInnertube();
    const info = await yt.getInfo(videoId);

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
        console.log('[OurTube StreamResolver] Deciphered video resolution successful:', chosenVideoFormat?.quality_label);
        return {
          audioUrl: audioUrl || videoUrl,
          videoUrl,
          audioBitrate: chosenAudioFormat?.bitrate,
          videoQuality: chosenVideoFormat?.quality_label || (chosenVideoFormat?.height ? `${chosenVideoFormat.height}p` : undefined),
          expiresInSeconds: 21600,
          format: chosenVideoFormat?.mime_type
        };
      }
    } else {
      // Audio / Music mode
      const audio = info.chooseFormat({ type: 'audio', quality: 'best' });
      const audioUrl = audio ? await audio.decipher(yt.session.player) : undefined;

      if (audioUrl) {
        console.log('[OurTube StreamResolver] Deciphered audio resolution successful');
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
    console.warn('[StreamResolver] Decipher resolution error:', decipherErr);
  }

  return {
    audioUrl: undefined,
    videoUrl: undefined
  };
}
