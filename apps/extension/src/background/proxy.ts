import {
  FetchRequestPayload,
  FetchResponsePayload,
  StreamResolutionRequest,
  StreamResolutionResponse
} from '@koda/bridge-types';
import { getAuthState, getActiveIdentity, MUSIC_ORIGIN } from './auth';
import { Innertube } from 'youtubei.js/web';

let innertubeInstance: Innertube | null = null;

async function getInnertube(): Promise<Innertube | null> {
  if (!innertubeInstance) {
    try {
      innertubeInstance = await Innertube.create();
    } catch (e) {
      console.warn('[OurTube Companion] Extension Innertube init failed:', e);
      return null;
    }
  }
  return innertubeInstance;
}

export async function handleProxyFetch(payload: FetchRequestPayload): Promise<FetchResponsePayload> {
  const auth = await getAuthState();
  const identity = await getActiveIdentity();

  // Ensure authuser query parameter is always present on target URL so Google routes to the selected account
  let targetUrl = payload.url;
  try {
    const parsedUrl = new URL(payload.url);
    if (!parsedUrl.searchParams.has('authuser')) {
      parsedUrl.searchParams.set('authuser', identity.authUser);
    }
    targetUrl = parsedUrl.toString();
  } catch {
    // Keep fallback if not full URL
  }

  // Ensure body context contains active user and onBehalfOfUser if brand/secondary channel
  let requestBody: any = payload.body;
  if (requestBody) {
    try {
      const parsedBody = typeof requestBody === 'string' ? JSON.parse(requestBody) : { ...requestBody };
      if (parsedBody && typeof parsedBody === 'object') {
        parsedBody.context = parsedBody.context || {};
        parsedBody.context.client = {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20251006.03.00',
          hl: 'en',
          gl: 'IN',
          ...(parsedBody.context.client || {})
        };
        parsedBody.context.user = parsedBody.context.user || {};
        if (identity.pageId) {
          parsedBody.context.user.onBehalfOfUser = identity.pageId;
        }
        parsedBody.context.user.authuser = identity.authUser;
        requestBody = JSON.stringify(parsedBody);
      }
    } catch {
      // Keep original body if parsing fails
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Origin': MUSIC_ORIGIN,
    'Origin': MUSIC_ORIGIN,
    'Referer': `${MUSIC_ORIGIN}/`,
    'X-YouTube-Client-Name': '67',
    'X-YouTube-Client-Version': '1.20251006.03.00',
    'X-Goog-AuthUser': identity.authUser,
    ...(payload.headers || {})
  };

  if (identity.pageId) {
    headers['X-Goog-PageId'] = identity.pageId;
  }

  if (auth.isAuthenticated && auth.sapisidHash) {
    headers['Authorization'] = auth.sapisidHash;
  }

  const response = await fetch(targetUrl, {
    method: payload.method || 'GET',
    headers,
    body: requestBody,
    credentials: 'include'
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let responseData: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    data: responseData
  };
}

export async function handleStreamResolution(payload: StreamResolutionRequest): Promise<StreamResolutionResponse> {
  const videoId = payload.videoId;

  // 1. Direct unencrypted resolution via VISIONOS client
  try {
    const yt = await getInnertube();
    if (!yt) return { audioUrl: undefined, videoUrl: undefined };
    const res = await yt.actions.execute('/player', { videoId, client: 'VISIONOS' });
    const adaptiveFormats: any[] = res.data?.streamingData?.adaptiveFormats || [];
    const formats: any[] = res.data?.streamingData?.formats || [];

    const audioFormats = adaptiveFormats
      .filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Prefer AAC (mp4a, itag 140) or high-quality Opus (itag 251)
    const bestAudio =
      audioFormats.find((f) => f.mimeType.includes('mp4a')) ||
      audioFormats[0] ||
      formats.find((f) => f.url);

    let bestVideo: any = null;
    if (payload.mode === 'video') {
      const videoFormats = adaptiveFormats
        .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url)
        .sort((a, b) => (b.height || 0) - (a.height || 0));

      if (payload.quality && payload.quality !== 'auto') {
        const targetHeight = parseInt(payload.quality.replace('p', ''), 10);
        bestVideo = videoFormats.find((f) => f.height === targetHeight) || videoFormats[0];
      } else {
        bestVideo = videoFormats[0];
      }
    }

    if (bestAudio?.url) {
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
  } catch (err) {
    console.warn('[Koda Extension Proxy] VISIONOS stream resolution error:', err);
  }

  // 2. Fallback: getInfo with signature deciphering
  try {
    const yt = await getInnertube();
    if (!yt) return { audioUrl: undefined, videoUrl: undefined };
    const info = await yt.getInfo(videoId);
    const audio = info.chooseFormat({ type: 'audio', quality: 'best' });
    const video = payload.mode === 'video' ? info.chooseFormat({ type: 'video', quality: 'best' }) : null;

    const audioUrl = audio ? await audio.decipher(yt.session.player) : undefined;
    const videoUrl = video ? await video.decipher(yt.session.player) : undefined;

    if (audioUrl) {
      return {
        audioUrl,
        videoUrl,
        audioBitrate: audio?.bitrate,
        videoQuality: video ? `${video.height}p` : undefined,
        expiresInSeconds: 21600,
        format: audio?.mime_type
      };
    }
  } catch (fallbackErr) {
    console.warn('[Koda Extension Proxy] Fallback decipher resolution error:', fallbackErr);
  }

  return {
    audioUrl: undefined,
    videoUrl: undefined
  };
}
