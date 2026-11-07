import {
  FetchRequestPayload,
  FetchResponsePayload,
  StreamResolutionRequest,
  StreamResolutionResponse,
  YouTubeAudioTrackOption,
  parseAudioTracksFromAdaptiveFormats
} from '@koda/bridge-types';
import { getAuthState, getActiveIdentity, getSigningSecret, calculateSapisidHash, MUSIC_ORIGIN } from './auth';
import { installExtensionFetchRule } from './rules';
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
  // Ensure background extension request rules are installed
  await installExtensionFetchRule();

  const identity = await getActiveIdentity();
  const secret = await getSigningSecret();

  // If caller explicitly specified X-Goog-AuthUser or authuser param, prioritize caller's active selected account
  const callerAuthUser =
    payload.headers?.['X-Goog-AuthUser'] ||
    (() => {
      try {
        return new URL(payload.url).searchParams.get('authuser');
      } catch {
        return null;
      }
    })();
  const effectiveAuthUser = callerAuthUser || identity.authUser || '0';

  const callerPageId = payload.headers?.['X-Goog-PageId'];
  const effectivePageId = callerPageId !== undefined ? callerPageId : identity.pageId;

  // Ensure authuser query parameter strictly matches effectiveAuthUser
  let targetUrl = payload.url;
  try {
    const parsedUrl = new URL(payload.url);
    parsedUrl.searchParams.set('authuser', effectiveAuthUser);
    targetUrl = parsedUrl.toString();
  } catch {
    // Keep fallback if not full URL
  }

  const isDesktopYt =
    !targetUrl.includes('music.youtube.com') &&
    (targetUrl.includes('www.youtube.com') || targetUrl.includes('youtube.com/youtubei'));
  const targetOrigin = isDesktopYt ? 'https://www.youtube.com' : MUSIC_ORIGIN;
  const targetClientName = isDesktopYt ? '1' : '67';
  const targetClientVersion = isDesktopYt ? '2.20251006.00.00' : '1.20251006.03.00';

  // Ensure body context contains active user and onBehalfOfUser if brand/secondary channel
  let requestBody: any = payload.body;
  if (requestBody) {
    try {
      const parsedBody = typeof requestBody === 'string' ? JSON.parse(requestBody) : { ...requestBody };
      if (parsedBody && typeof parsedBody === 'object') {
        parsedBody.context = parsedBody.context || {};
        const clientDefaults = isDesktopYt
          ? {
              clientName: 'WEB',
              clientVersion: '2.20251006.00.00',
              hl: 'en',
              gl: 'US',
              originalUrl: 'https://www.youtube.com/',
              platform: 'DESKTOP'
            }
          : {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20251006.03.00',
              hl: 'en',
              gl: 'IN',
              originalUrl: 'https://music.youtube.com/',
              platform: 'DESKTOP'
            };

        parsedBody.context.client = {
          ...clientDefaults,
          ...(parsedBody.context.client || {})
        };
        if (effectivePageId) {
          parsedBody.context.user = parsedBody.context.user || {};
          parsedBody.context.user.onBehalfOfUser = effectivePageId;
        } else if (parsedBody.context?.user) {
          delete parsedBody.context.user.onBehalfOfUser;
          delete parsedBody.context.user.authuser;
          if (Object.keys(parsedBody.context.user).length === 0) {
            delete parsedBody.context.user;
          }
        }
        requestBody = JSON.stringify(parsedBody);
      }
    } catch {
      // Keep original body if parsing fails
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Origin': targetOrigin,
    'Origin': targetOrigin,
    'Referer': `${targetOrigin}/`,
    'X-YouTube-Client-Name': targetClientName,
    'X-YouTube-Client-Version': targetClientVersion,
    ...(payload.headers || {}),
    // Enforce active selected account over any stale headers passed from caller
    'X-Goog-AuthUser': effectiveAuthUser
  };

  if (effectivePageId) {
    headers['X-Goog-PageId'] = effectivePageId;
  } else {
    delete headers['X-Goog-PageId'];
  }

  if (secret) {
    headers['Authorization'] = await calculateSapisidHash(secret, targetOrigin);
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

    // Parse all available audio tracks using Koda's xtags & audioTrack model
    const audioPref = payload.audioQuality || 'high';
    const audioTracks = parseAudioTracksFromAdaptiveFormats(adaptiveFormats, audioPref);
    
    // Select the requested track, or the original soundtrack by default
    let selectedTrack: YouTubeAudioTrackOption | undefined;
    if (payload.audioTrackId) {
      selectedTrack = audioTracks.find((t) => t.id === payload.audioTrackId);
    }
    if (!selectedTrack) {
      selectedTrack = audioTracks.find((t) => t.isOriginal) || audioTracks[0];
    }

    const audioFormats = adaptiveFormats
      .filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
      .sort((a, b) =>
        audioPref === 'low'
          ? (a.bitrate || 0) - (b.bitrate || 0)
          : (b.bitrate || 0) - (a.bitrate || 0)
      );

    const preferredAudioFormat =
      audioPref === 'normal' && audioFormats.length > 1
        ? audioFormats[Math.floor(audioFormats.length / 2)]
        : audioFormats.find((f) => f.mimeType.includes('mp4a')) || audioFormats[0];

    // Fallback best audio if audioTracks was empty
    let bestAudio =
      (selectedTrack?.url ? { url: selectedTrack.url, bitrate: selectedTrack.bitrate, mimeType: 'audio/mp4' } : null) ||
      preferredAudioFormat ||
      formats.find((f) => f.url);

    let bestVideo: any = null;
    if (payload.mode === 'video') {
      // If there are multiple audio tracks (e.g. dubs exist), DO NOT use muxed formats,
      // because muxed formats contain YouTube's forced regional dub!
      const hasDubsOrChoice = audioTracks.length > 1 || (selectedTrack && !selectedTrack.isOriginal);

      const muxedFormats = formats
        .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url)
        .sort((a, b) => (b.height || 0) - (a.height || 0));

      const videoFormats = adaptiveFormats
        .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url)
        .sort((a, b) => (b.height || 0) - (a.height || 0));

      if (!hasDubsOrChoice && muxedFormats.length > 0 && (!payload.quality || payload.quality === 'auto' || payload.quality === '720p' || payload.quality === '360p')) {
        bestVideo = muxedFormats[0];
        if (!bestAudio?.url) bestAudio = bestVideo;
      } else {
        if (payload.quality && payload.quality !== 'auto') {
          const targetHeight = parseInt(payload.quality.replace('p', ''), 10);
          bestVideo = videoFormats.find((f) => f.height === targetHeight) || videoFormats[0];
        } else {
          bestVideo = videoFormats[0];
        }
      }
    }

    const hasRequiredStreams = payload.mode === 'video'
      ? Boolean(bestVideo?.url)
      : Boolean(bestAudio?.url);

    if (hasRequiredStreams && (bestAudio?.url || bestVideo?.url)) {
      return {
        audioUrl: selectedTrack?.url || bestAudio?.url || bestVideo?.url,
        videoUrl: bestVideo?.url,
        audioBitrate: selectedTrack?.bitrate || bestAudio?.bitrate,
        videoQuality: bestVideo ? `${bestVideo.height}p` : undefined,
        expiresInSeconds: res.data?.streamingData?.expiresInSeconds
          ? parseInt(res.data.streamingData.expiresInSeconds, 10)
          : 21600,
        format: bestVideo?.mimeType || bestAudio?.mimeType,
        audioTracks,
        selectedAudioTrackId: selectedTrack?.id
      };
    }
  } catch (err) {
    console.warn('[Koda Extension Proxy] VISIONOS stream resolution error:', err);
  }

  // 2. Comprehensive Fallback: getInfo with signature and n-token deciphering
  try {
    const yt = await getInnertube();
    if (!yt) return { audioUrl: undefined, videoUrl: undefined };
    const info = await yt.getInfo(videoId);

    // Try extracting audio tracks from fallback formats
    const adaptive = (info.streaming_data?.adaptive_formats || []) as any[];
    const audioPref = payload.audioQuality || 'high';
    const audioTracks = parseAudioTracksFromAdaptiveFormats(adaptive, audioPref);
    let selectedTrack: YouTubeAudioTrackOption | undefined;
    if (payload.audioTrackId) {
      selectedTrack = audioTracks.find((t) => t.id === payload.audioTrackId);
    }
    if (!selectedTrack) {
      selectedTrack = audioTracks.find((t) => t.isOriginal) || audioTracks[0];
    }

    // Decipher URLs for audioTracks if needed
    for (const track of audioTracks) {
      if (!track.url) {
        const rawFmt = adaptive.find(
          (f) => ((f.audioTrack || f.audio_track)?.id || 'default') === track.id
        );
        if (rawFmt && typeof rawFmt.decipher === 'function') {
          try {
            track.url = await rawFmt.decipher(yt.session.player);
          } catch {}
        }
      }
    }

    const ytAudioQuality = audioPref === 'low' ? 'efficiency' : 'best';

    if (payload.mode === 'video') {
      let chosenVideoFormat: any = null;
      let chosenAudioFormat: any = null;

      const hasDubsOrChoice = audioTracks.length > 1;

      // Only use muxed video+audio when there are NO alternate audio dubs!
      if (!hasDubsOrChoice && (!payload.quality || payload.quality === 'auto' || payload.quality === '720p' || payload.quality === '360p')) {
        try {
          chosenVideoFormat = info.chooseFormat({ type: 'video+audio', quality: payload.quality || 'best' });
          chosenAudioFormat = chosenVideoFormat;
        } catch {}
      }

      if (!chosenVideoFormat) {
        try {
          chosenVideoFormat = info.chooseFormat({ type: 'video', quality: payload.quality || 'best' });
          chosenAudioFormat = info.chooseFormat({ type: 'audio', quality: ytAudioQuality });
        } catch {}
      }

      const videoUrl = chosenVideoFormat ? await chosenVideoFormat.decipher(yt.session.player) : undefined;
      const audioUrl = selectedTrack?.url || (chosenAudioFormat ? await chosenAudioFormat.decipher(yt.session.player) : undefined);

      if (videoUrl) {
        return {
          audioUrl: audioUrl || videoUrl,
          videoUrl,
          audioBitrate: selectedTrack?.bitrate || chosenAudioFormat?.bitrate,
          videoQuality: chosenVideoFormat?.quality_label || (chosenVideoFormat?.height ? `${chosenVideoFormat.height}p` : undefined),
          expiresInSeconds: 21600,
          format: chosenVideoFormat?.mime_type,
          audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
          selectedAudioTrackId: selectedTrack?.id
        };
      }
    } else {
      // Audio / Music Mode
      const audio = info.chooseFormat({ type: 'audio', quality: ytAudioQuality });
      const audioUrl = selectedTrack?.url || (audio ? await audio.decipher(yt.session.player) : undefined);

      if (audioUrl) {
        return {
          audioUrl,
          videoUrl: undefined,
          audioBitrate: selectedTrack?.bitrate || audio?.bitrate,
          videoQuality: undefined,
          expiresInSeconds: 21600,
          format: audio?.mime_type,
          audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
          selectedAudioTrackId: selectedTrack?.id
        };
      }
    }
  } catch (fallbackErr) {
    console.warn('[Koda Extension Proxy] Fallback decipher resolution error:', fallbackErr);
  }

  return {
    audioUrl: undefined,
    videoUrl: undefined
  };
}

export async function handleScrapePage(targetUrl: string = 'https://www.youtube.com/'): Promise<any> {
  const identity = await getActiveIdentity();
  const secret = await getSigningSecret();
  const targetOrigin = 'https://www.youtube.com';

  let fetchUrl = targetUrl;
  try {
    const parsed = new URL(targetUrl);
    if (!parsed.searchParams.has('authuser')) {
      parsed.searchParams.set('authuser', identity.authUser);
    }
    fetchUrl = parsed.toString();
  } catch {
    // ignore
  }

  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Goog-AuthUser': identity.authUser
  };

  if (secret) {
    headers['Authorization'] = await calculateSapisidHash(secret, targetOrigin);
  }

  try {
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!res.ok) return null;
    const html = await res.text();

    const match =
      html.match(/var\s+ytInitialData\s*=\s*({.+?});<\/script>/s) ||
      html.match(/window\["ytInitialData"\]\s*=\s*({.+?});<\/script>/s);

    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.warn('[OurTube Companion] Failed to parse ytInitialData JSON:', e);
      }
    }
  } catch (err) {
    console.warn('[OurTube Companion] Scrape error:', err);
  }

  return null;
}

