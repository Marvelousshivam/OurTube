import { bridgeClient } from '../api/bridgeClient';
import { isDesktopApp } from '../api/desktop';

export const LYRIC_EXTENSION_ORIGINS = [
  'https://mobileservice.kugou.com',
  'https://lyrics.kugou.com',
  'https://apic.musixmatch.com',
  'https://www.musixmatch.com',
  'https://genius.com',
  'https://music.apple.com',
  'https://amp-api.music.apple.com',
  'https://api.paxsenix.org',
  'https://lyrics.paxsenix.org',
  'https://lyrics-api.boidu.dev',
  'https://unison.boidu.dev',
  'https://lyricsplus.prjktla.my.id',
  'https://lyricsplus.binimum.org'
];

const DIRECT_TIMEOUT_MS = 6500;
const EXTENSION_TIMEOUT_MS = 14000;

export interface GetOptions {
  route?: 'direct' | 'extension';
  headers?: Record<string, string>;
  patient?: boolean;
}

async function viaExtensionOrProxy(
  url: string,
  headers: Record<string, string> | undefined,
  timeoutMs: number
): Promise<string | null> {
  // 1. Try Companion Extension LYRICS_FETCH first when connected
  if (bridgeClient.getIsAvailable()) {
    const response = await bridgeClient.lyricsFetch(
      { url, ...(headers ? { headers } : {}) },
      timeoutMs
    );
    if (response && response.status >= 200 && response.status < 300) {
      return response.bodyEncoding === 'base64'
        ? new TextDecoder().decode(
            Uint8Array.from(atob(response.body), (c) => c.charCodeAt(0))
          )
        : response.body;
    }
    if (isDesktopApp()) {
      return null;
    }
  }

  // 2. Fallback to Vite / server-side /api/lyrics-proxy (prevents browser CORS & 401 Origin errors)
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const proxyHeaders: Record<string, string> = {};
      if (headers?.Authorization || headers?.authorization) {
        proxyHeaders['x-lyric-authorization'] =
          headers.Authorization || headers.authorization || '';
      }
      const res = await fetch(`/api/lyrics-proxy?url=${encodeURIComponent(url)}`, {
        headers: proxyHeaders,
        signal: controller.signal
      });
      if (!res.ok) return null;
      const payload = (await res.json()) as {
        ok?: boolean;
        status?: number;
        body?: string;
      };
      return payload?.ok && typeof payload.body === 'string' && payload.body.trim()
        ? payload.body
        : null;
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

const PROXY_PREFERRED_HOSTS = new Set([
  'lyrics-api.boidu.dev',
  'unison.boidu.dev',
  'lyricsplus.prjktla.my.id',
  'lyricsplus.binimum.org',
  'mobileservice.kugou.com',
  'lyrics.kugou.com',
  'apic.musixmatch.com',
  'www.musixmatch.com',
  'genius.com',
  'music.apple.com',
  'amp-api.music.apple.com',
  'api.paxsenix.org'
]);

export async function lyricsGet(
  url: string,
  { route = 'direct', headers, patient }: GetOptions = {}
): Promise<string | null> {
  const timeoutMs = patient ? EXTENSION_TIMEOUT_MS : DIRECT_TIMEOUT_MS;
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }

  if (route === 'extension' || PROXY_PREFERRED_HOSTS.has(hostname)) {
    return viaExtensionOrProxy(url, headers, timeoutMs);
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json, text/plain, */*', ...headers },
        signal: controller.signal,
        referrerPolicy: 'no-referrer'
      });
      if (response.ok) {
        return await response.text();
      }
      if (response.status === 401 || response.status === 403) {
        return viaExtensionOrProxy(url, headers, timeoutMs);
      }
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return viaExtensionOrProxy(url, headers, timeoutMs);
  }
}

export function urlWith(
  base: string,
  params: Record<string, string | number | null | undefined>
): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

let appleTokenPromise: Promise<string | null> | null = null;

export function appleWebToken(): Promise<string | null> {
  appleTokenPromise ??= (async () => {
    const page = await lyricsGet('https://music.apple.com/us/new', { route: 'extension' });
    const script = page?.match(/\/assets\/index~[^"]+\.js/)?.[0];
    if (!script) return null;
    const source = await lyricsGet(`https://music.apple.com${script}`, { route: 'extension' });
    return source?.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0] ?? null;
  })().then((token) => {
    if (!token) appleTokenPromise = null;
    return token;
  });
  return appleTokenPromise;
}
