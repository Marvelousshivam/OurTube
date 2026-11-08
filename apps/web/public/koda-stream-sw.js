/**
 * Koda Web ChunkedStreamDataSource Service Worker (Ported from temp_koda ChunkedStreamDataSource.kt)
 *
 * googlevideo.com paces open-ended HTTP requests ("Range: bytes=0-" with no end bound)
 * to roughly 1.0x the media bitrate, causing tiny read-ahead buffers (1-2s) and slow seeks.
 * By intercepting /__koda_chunk_stream__ and issuing bounded "&range=start-end" chunk requests
 * (2 MB initial startup chunk + 8 MB pipelined chunks), googlevideo.com serves at full
 * CDN line speed (5-22 MB/s), filling 30-120s of read-ahead runway in seconds.
 */

const FIRST_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB fast startup chunk
const NEXT_CHUNK_BYTES = 8 * 1024 * 1024;  // 8 MB steady-state chunk (matches temp_koda)
const PREWARM_BYTES = 1536 * 1024;         // 1.5 MB pre-warmed startup slice

// In-memory LRU cache of pre-warmed startup chunks (bytes 0 .. stripEnd)
const startupCache = new Map();
const MAX_STARTUP_CACHE_ENTRIES = 14;

function putStartupCache(streamKey, bytes) {
  if (!streamKey || !bytes || !bytes.byteLength) return;
  if (startupCache.has(streamKey)) startupCache.delete(streamKey);
  startupCache.set(streamKey, {
    bytes,
    storedAt: Date.now()
  });
  while (startupCache.size > MAX_STARTUP_CACHE_ENTRIES) {
    const oldestKey = startupCache.keys().next().value;
    if (!oldestKey) break;
    startupCache.delete(oldestKey);
  }
}

function getStartupCache(streamKey) {
  const entry = startupCache.get(streamKey);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > 10 * 60 * 1000) {
    startupCache.delete(streamKey);
    return null;
  }
  return entry.bytes;
}

function getStreamKey(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const id = u.searchParams.get('id') || '';
    const itag = u.searchParams.get('itag') || '';
    const clen = u.searchParams.get('clen') || '';
    return `${id}:${itag}:${clen}`;
  } catch {
    return rawUrl;
  }
}

function shouldChunkUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith('.googlevideo.com')) return false;
    if (u.hostname.startsWith('manifest.')) return false;
    if (u.pathname.includes('manifest') || u.pathname.endsWith('.m3u8')) return false;
    const clen = parseInt(u.searchParams.get('clen') || '0', 10);
    return Number.isFinite(clen) && clen > 0;
  } catch {
    return false;
  }
}

function buildRangeUrl(rawUrl, startByte, endByteInclusive) {
  const u = new URL(rawUrl);
  u.searchParams.set('range', `${startByte}-${endByteInclusive}`);
  return u.toString();
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'KODA_PREWARM_STREAM' || !data.url) return;
  const rawUrl = data.url;
  if (!shouldChunkUrl(rawUrl)) return;

  const streamKey = getStreamKey(rawUrl);
  if (getStartupCache(streamKey)) return;

  event.waitUntil(
    (async () => {
      try {
        const u = new URL(rawUrl);
        const clen = parseInt(u.searchParams.get('clen') || '0', 10);
        if (!clen || clen <= 0) return;
        const endByte = Math.min(clen - 1, PREWARM_BYTES - 1);
        const rangeUrl = buildRangeUrl(rawUrl, 0, endByte);
        const res = await fetch(rangeUrl, { credentials: 'omit' });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 0) {
            putStartupCache(streamKey, new Uint8Array(buf));
          }
        }
      } catch {
        // Ignore background prewarm failures
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);
  if (reqUrl.pathname !== '/__koda_chunk_stream__') return;

  const rawUrl = reqUrl.searchParams.get('url');
  if (!rawUrl) {
    event.respondWith(new Response('Missing url parameter', { status: 400 }));
    return;
  }

  if (!shouldChunkUrl(rawUrl)) {
    event.respondWith(Response.redirect(rawUrl, 302));
    return;
  }

  event.respondWith(handleChunkedStreamRequest(event.request, rawUrl));
});

async function handleChunkedStreamRequest(request, rawUrl) {
  const parsedTarget = new URL(rawUrl);
  const totalLength = parseInt(parsedTarget.searchParams.get('clen') || '0', 10);
  const mimeParam = parsedTarget.searchParams.get('mime') || 'video/mp4';
  const contentType = decodeURIComponent(mimeParam);

  let startByte = 0;
  let endByte = totalLength - 1;

  const rangeHeader = request.headers.get('Range') || request.headers.get('range');
  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      startByte = parseInt(match[1], 10);
      if (match[2] && match[2].length > 0) {
        endByte = Math.min(totalLength - 1, parseInt(match[2], 10));
      }
    }
  }

  if (startByte >= totalLength || startByte > endByte) {
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${totalLength}`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const contentLength = endByte - startByte + 1;
  const streamKey = getStreamKey(rawUrl);
  let cancelled = false;
  let activeAbortController = null;

  const stream = new ReadableStream({
    async start(controller) {
      let position = startByte;
      let isFirstChunk = true;

      try {
        // 1. Serve from RAM startup cache if starting inside pre-warmed window
        const cachedStartup = getStartupCache(streamKey);
        if (cachedStartup && position < cachedStartup.byteLength) {
          const sliceEnd = Math.min(cachedStartup.byteLength, endByte + 1);
          const slice = cachedStartup.subarray(position, sliceEnd);
          if (slice.byteLength > 0) {
            controller.enqueue(slice);
            position += slice.byteLength;
          }
        }

        // 2. Roll over bounded range requests until endByte or cancellation
        while (position <= endByte && !cancelled) {
          const chunkSize = isFirstChunk ? FIRST_CHUNK_BYTES : NEXT_CHUNK_BYTES;
          isFirstChunk = false;
          const chunkTargetEnd = Math.min(endByte, position + chunkSize - 1);
          const chunkUrl = buildRangeUrl(rawUrl, position, chunkTargetEnd);

          activeAbortController = new AbortController();
          const res = await fetch(chunkUrl, {
            method: 'GET',
            credentials: 'omit',
            signal: activeAbortController.signal
          });

          if (!res.ok && res.status !== 206) {
            throw new Error(`Chunk HTTP ${res.status}`);
          }

          if (!res.body) {
            const buf = new Uint8Array(await res.arrayBuffer());
            if (buf.byteLength === 0) break;
            if (position === 0 && !getStartupCache(streamKey)) {
              putStartupCache(streamKey, buf.slice(0, Math.min(buf.byteLength, PREWARM_BYTES)));
            }
            controller.enqueue(buf);
            position += buf.byteLength;
            continue;
          }

          const reader = res.body.getReader();
          let chunkBytesRead = 0;
          const collectForStartup = position === 0 && !getStartupCache(streamKey);
          const startupPieces = [];
          let startupBytesCollected = 0;

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.byteLength > 0) {
              if (collectForStartup && startupBytesCollected < PREWARM_BYTES) {
                const needed = PREWARM_BYTES - startupBytesCollected;
                startupPieces.push(value.slice(0, Math.min(value.byteLength, needed)));
                startupBytesCollected += Math.min(value.byteLength, needed);
              }
              controller.enqueue(value);
              position += value.byteLength;
              chunkBytesRead += value.byteLength;
            }
          }

          if (collectForStartup && startupBytesCollected > 0) {
            const merged = new Uint8Array(startupBytesCollected);
            let offset = 0;
            for (const piece of startupPieces) {
              merged.set(piece, offset);
              offset += piece.byteLength;
            }
            putStartupCache(streamKey, merged);
          }

          // Guard against empty chunk loops (same as temp_koda's chunkProgressed check)
          if (chunkBytesRead <= 0) {
            break;
          }
        }

        if (!cancelled) {
          controller.close();
        }
      } catch (err) {
        if (!cancelled) {
          try {
            controller.error(err);
          } catch {}
        }
      }
    },
    cancel() {
      cancelled = true;
      if (activeAbortController) {
        try {
          activeAbortController.abort();
        } catch {}
      }
    }
  });

  return new Response(stream, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(contentLength),
      'Content-Range': `bytes ${startByte}-${endByte}/${totalLength}`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}
