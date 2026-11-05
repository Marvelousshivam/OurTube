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

function streamResolverPlugin(): Plugin {
  return {
    name: 'koda-stream-resolver',
    configureServer(server) {
      server.middlewares.use('/api/resolve-stream', async (req, res) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const videoId = url.searchParams.get('videoId');

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
            .filter((f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

          const bestAudio =
            audioFormats.find((f) => f.mimeType.includes('mp4a')) ||
            audioFormats[0] ||
            formats.find((f) => f.url);

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              audioUrl: bestAudio?.url,
              audioBitrate: bestAudio?.bitrate,
              format: bestAudio?.mimeType,
              expiresInSeconds: playerRes.data?.streamingData?.expiresInSeconds || 21600
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
