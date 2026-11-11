import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { Innertube } from 'youtubei.js';

let serverInnertube: Innertube | null = null;
async function getServerInnertube(): Promise<Innertube> {
  if (!serverInnertube) {
    serverInnertube = await Innertube.create();
  }
  return serverInnertube;
}

const ALLOWED_LYRIC_HOSTS = new Set([
  'lrc.red',
  'lyrics-api.binimum.org',
  'lyrics-api.boidu.dev',
  'unison.boidu.dev',
  'lyrics.paxsenix.org',
  'api.paxsenix.org',
  'lyricsplus.prjktla.my.id',
  'lyricsplus.binimum.org',
  'lrclib.net',
  'mobileservice.kugou.com',
  'lyrics.kugou.com',
  'apic.musixmatch.com',
  'www.musixmatch.com',
  'genius.com',
  'music.apple.com',
  'amp-api.music.apple.com'
]);

const viteMxmGuid = 'd4f8a9b0-2c3e-4f5a-8b9c-0d1e2f3a4b5c';

function streamResolverPlugin(): Plugin {
  return {
    name: 'koda-stream-resolver',
    configureServer(server) {
      server.middlewares.use('/api/lyrics-proxy', async (req, res) => {
        const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);
        const targetRaw = reqUrl.searchParams.get('url');
        if (!targetRaw) {
          res.statusCode = 400;
          res.end('Missing url');
          return;
        }
        try {
          const parsed = new URL(targetRaw);
          if (parsed.protocol !== 'https:' || !ALLOWED_LYRIC_HOSTS.has(parsed.hostname)) {
            res.statusCode = 403;
            res.end('Disallowed lyric host');
            return;
          }

          const headers: Record<string, string> = {
            Accept: 'application/json, text/plain, */*',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          };

          const customAuth = req.headers['x-lyric-authorization'];
          if (typeof customAuth === 'string' && customAuth.trim()) {
            headers['Authorization'] = customAuth.trim();
          }
          if (parsed.hostname === 'amp-api.music.apple.com') {
            headers['Origin'] = 'https://music.apple.com';
            headers['Referer'] = 'https://music.apple.com/';
          }
          if (
            parsed.hostname === 'apic.musixmatch.com' &&
            parsed.pathname.includes('/token.get')
          ) {
            headers['Cookie'] = `x-mxm-token-guid=${viteMxmGuid}; mxm_bab=AB`;
          }

          const upstream = await fetch(parsed.toString(), {
            method: 'GET',
            headers,
            redirect: 'follow'
          });

          const text = await upstream.text();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              ok: upstream.ok,
              status: upstream.status,
              body: text
            })
          );
        } catch (err: any) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, status: 502, body: '' }));
        }
      });

      server.middlewares.use('/api/resolve-stream', async (req, res) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const videoId = url.searchParams.get('videoId');
        const mode = url.searchParams.get('mode') || 'music';
        const quality = url.searchParams.get('quality') || 'auto';
        const audioTrackId = url.searchParams.get('audioTrackId') || undefined;

        if (!videoId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'videoId is required' }));
          return;
        }

        try {
          const yt = await getServerInnertube();
          const playerRes = await yt.actions.execute('/player', { videoId, client: 'VISIONOS' });
          const adaptiveFormats: any[] = playerRes.data?.streamingData?.adaptiveFormats || [];
          const formats: any[] = playerRes.data?.streamingData?.formats || [];

          const audioFormats = adaptiveFormats
            .filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url && !f.isDrc)
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

          let bestAudio =
            (audioTrackId
              ? audioFormats.find((f) => (f.audioTrack?.id || 'default') === audioTrackId)
              : audioFormats.find((f) => f.audioTrack?.audioIsDefault)) ||
            audioFormats.find((f) => f.mimeType.includes('mp4a')) ||
            audioFormats[0] ||
            formats.find((f) => f.url);

          let bestVideo: any = null;
          let usingMuxedVideo = false;
          if (mode === 'video') {
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

            const muxedFormats = formats
              .filter((f) => f.mimeType && f.mimeType.startsWith('video/') && f.url)
              .sort((a, b) => (b.height || 0) - (a.height || 0));

            const targetHeight =
              quality && quality !== 'auto' ? parseInt(quality.replace('p', ''), 10) : 1080;

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
          }

          const rawCaptionTracks: any[] =
            playerRes.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          const captionTracks = rawCaptionTracks
            .filter((t) => t?.baseUrl)
            .map((t) => {
              const id = t.vssId || t.languageCode || 'en';
              const rawName =
                t.name?.simpleText ||
                t.name?.runs?.map((r: any) => r.text).join('') ||
                t.languageCode ||
                'Subtitles';
              const isAutoGenerated = t.kind === 'asr' || String(id).startsWith('a.');
              return {
                id,
                languageCode: t.languageCode || 'en',
                displayName:
                  isAutoGenerated && !rawName.toLowerCase().includes('auto')
                    ? `${rawName} (auto)`
                    : rawName,
                baseUrl: t.baseUrl,
                isAutoGenerated
              };
            });

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              audioUrl: usingMuxedVideo ? bestVideo?.url : bestAudio?.url || bestVideo?.url,
              videoUrl: bestVideo?.url,
              audioBitrate: bestAudio?.bitrate,
              videoQuality: bestVideo?.height ? `${bestVideo.height}p` : undefined,
              format: bestVideo?.mimeType || bestAudio?.mimeType,
              expiresInSeconds: playerRes.data?.streamingData?.expiresInSeconds || 21600,
              captionTracks
            })
          );
        } catch (err: any) {
          console.warn('[Vite Stream Resolver] Error resolving stream:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), streamResolverPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/ytmusic': {
        target: 'https://music.youtube.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ytmusic/, ''),
        headers: {
          Origin: 'https://music.youtube.com',
          Referer: 'https://music.youtube.com/'
        }
      }
    }
  }
});
