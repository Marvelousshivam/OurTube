import { Innertube } from 'youtubei.js';
import { bridgeClient } from './bridgeClient';
import { StreamResolutionResponse } from '@koda/bridge-types';

let webInnertubeInstance: Innertube | null = null;

async function getWebInnertube(): Promise<Innertube> {
  if (!webInnertubeInstance) {
    webInnertubeInstance = await Innertube.create({
      fetch: window.fetch.bind(window)
    });
  }
  return webInnertubeInstance;
}

export interface StreamOptions {
  videoId: string;
  quality?: 'auto' | '1080p' | '720p' | '480p' | '360p';
  mode?: 'music' | 'video';
}

/**
 * Resolves a high-quality unencrypted direct audio/video stream URL.
 * Architecture:
 * 1. Same-origin Vite dev server stream endpoint (/api/resolve-stream) -> 0ms CORS, instant Node.js resolution
 * 2. Companion extension bridge -> handles signed-in SAPISID sessions and DNR header injection
 * 3. In-browser Innertube with bound fetch as resilient fallback
 */
export async function resolveStream(options: StreamOptions): Promise<StreamResolutionResponse> {
  const { videoId, quality = 'auto', mode = 'music' } = options;

  // 1. Same-Origin Vite stream resolver (0 CORS, 0 preflight, instant Node.js resolution)
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
    // Continue to extension bridge or direct Innertube
  }

  // 2. Try companion extension bridge
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
      console.warn('[StreamResolver] Extension bridge stream resolution failed, attempting direct Innertube:', bridgeErr);
    }
  }

  // 3. Direct Innertube VISIONOS resolution (no deciphering needed, returns raw googlevideo.com URLs)
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
