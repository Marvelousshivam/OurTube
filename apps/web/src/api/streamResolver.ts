import { Innertube, Platform, UniversalCache, Types } from 'youtubei.js/web';
import { bridgeClient } from './bridgeClient';
import { StreamResolutionResponse } from '@koda/bridge-types';

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

async function getWebInnertube(): Promise<Innertube> {
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
}

/**
 * Resolves a high-quality direct audio/video stream URL.
 * Architecture:
 * 1. Same-origin Vite dev server stream endpoint (/api/resolve-stream) -> 0ms local Node.js resolution
 * 2. In-browser direct VISIONOS Innertube resolution with simpleRequestFetch -> 0ms preflight, direct googlevideo.com URLs
 * 3. Companion extension bridge fallback -> handles signed-in SAPISID sessions
 * 4. In-browser signature deciphering fallback
 */
export async function resolveStream(options: StreamOptions): Promise<StreamResolutionResponse> {
  const { videoId, quality = 'auto', mode = 'music' } = options;

  // 1. Companion extension bridge (direct host permissions in background, 0 CORS, supports signed sessions)
  if (bridgeClient.getIsAvailable()) {
    try {
      const bridgeRes = await bridgeClient.resolveStream({
        videoId,
        quality,
        mode
      });

      if (bridgeRes?.audioUrl) {
        return bridgeRes;
      }
    } catch (bridgeErr) {
      console.warn('[StreamResolver] Extension bridge stream resolution failed:', bridgeErr);
    }
  }

  // 2. Same-Origin Vite stream resolver (when running under local Vite dev server)
  try {
    const res = await window.fetch(`/api/resolve-stream?videoId=${encodeURIComponent(videoId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.audioUrl) {
        return {
          audioUrl: data.audioUrl,
          audioBitrate: data.audioBitrate,
          videoQuality: quality,
          expiresInSeconds: data.expiresInSeconds || 21600,
          format: data.format
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

    const audioFormats = adaptiveFormats
      .filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Prefer AAC (mp4a, itag 140) or high-bitrate Opus (itag 251)
    const bestAudio =
      audioFormats.find((f) => f.mimeType.includes('mp4a')) ||
      audioFormats[0] ||
      formats.find((f) => f.url);

    let bestVideo: any = null;
    if (mode === 'video') {
      const videoFormats = adaptiveFormats
        .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url)
        .sort((a, b) => (b.height || 0) - (a.height || 0));

      if (quality !== 'auto') {
        const targetHeight = parseInt(quality.replace('p', ''), 10);
        bestVideo = videoFormats.find((f) => f.height === targetHeight) || videoFormats[0];
      } else {
        bestVideo = videoFormats[0];
      }
    }

    if (bestAudio?.url) {
      console.log('[OurTube StreamResolver] Direct VISIONOS resolution successful:', bestAudio.mimeType, bestAudio.bitrate);
      return {
        audioUrl: bestAudio.url,
        videoUrl: bestVideo?.url,
        audioBitrate: bestAudio.bitrate,
        videoQuality: bestVideo ? `${bestVideo.height}p` : undefined,
        expiresInSeconds: res.data?.streamingData?.expiresInSeconds
          ? parseInt(res.data.streamingData.expiresInSeconds, 10)
          : 21600,
        format: bestAudio.mimeType
      };
    }
  } catch (directErr) {
    console.warn('[StreamResolver] Direct VISIONOS resolution error:', directErr);
  }

  // 4. Fallback: getInfo with signature deciphering
  try {
    const yt = await getWebInnertube();
    const info = await yt.getInfo(videoId);
    const audio = info.chooseFormat({ type: 'audio', quality: 'best' });
    const video = mode === 'video' ? info.chooseFormat({ type: 'video', quality: 'best' }) : null;

    const audioUrl = audio ? await audio.decipher(yt.session.player) : undefined;
    const videoUrl = video ? await video.decipher(yt.session.player) : undefined;

    if (audioUrl) {
      console.log('[OurTube StreamResolver] Deciphered audio resolution successful');
      return {
        audioUrl,
        videoUrl,
        audioBitrate: audio?.bitrate,
        videoQuality: video ? `${video.height}p` : undefined,
        expiresInSeconds: 21600,
        format: audio?.mime_type
      };
    }
  } catch (decipherErr) {
    console.warn('[StreamResolver] Decipher resolution error:', decipherErr);
  }

  return {
    audioUrl: undefined,
    videoUrl: undefined
  };
}
