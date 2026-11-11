/**
 * Desktop (Tauri) transport for the bridge protocol.
 *
 * In a browser, bridgeClient talks to the companion extension over
 * window.postMessage. Inside the Tauri shell the same message types are
 * answered here: InnerTube/API fetches go to the Rust `proxy_fetch` command
 * (no CORS wall in a desktop app), stream resolution stays in the webview
 * (streamResolver's direct VISIONOS/decipher path now works through the
 * proxied fetch), and media bytes are served by the Rust stream server.
 *
 * Ported from apps/extension/src/background/serviceWorker.ts.
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  AuthState,
  FetchRequestPayload,
  FetchResponsePayload
} from '@koda/bridge-types';

const UNAUTHENTICATED: AuthState = {
  isAuthenticated: false,
  accounts: [],
  selectedChannelId: null,
  selectedChannel: null
};

const DISCORD_UNAVAILABLE = {
  available: false,
  connected: false,
  enabled: false,
  user: null,
  gateway: 'off' as const,
  problem: 'Discord Rich Presence is not wired up in the desktop app yet'
};

export async function handleDesktopRequest<T = any>(type: string, payload?: any): Promise<T> {
  switch (type) {
    case 'KODA_BRIDGE_PING':
    case 'OURTUBE_BRIDGE_PING':
      return {
        name: 'OurTube Desktop',
        version: '1.0.0',
        status: 'ready'
      } as T;

    // Signed-in account support is a phase-1 follow-up (see docs/desktop.md).
    // Anonymous playback works without it.
    case 'KODA_BRIDGE_GET_AUTH':
    case 'OURTUBE_BRIDGE_GET_AUTH':
    case 'KODA_BRIDGE_GET_ACCOUNTS':
    case 'OURTUBE_BRIDGE_GET_ACCOUNTS':
    case 'KODA_BRIDGE_SELECT_ACCOUNT':
    case 'OURTUBE_BRIDGE_SELECT_ACCOUNT':
      return UNAUTHENTICATED as T;

    case 'KODA_BRIDGE_FETCH':
    case 'OURTUBE_BRIDGE_FETCH':
      return await invoke<FetchResponsePayload>('proxy_fetch', {
        payload: payload as FetchRequestPayload
      }) as T;

    // Returning empty here makes streamResolver fall through to its direct
    // in-webview VISIONOS/decipher resolution, which works on desktop because
    // getWebInnertube() routes its fetch through proxy_fetch.
    case 'KODA_BRIDGE_STREAM_URL':
    case 'OURTUBE_BRIDGE_STREAM_URL':
      return { audioUrl: undefined, videoUrl: undefined } as T;

    case 'KODA_BRIDGE_SCRAPE_HOME':
    case 'OURTUBE_BRIDGE_SCRAPE_HOME':
      return (await scrapePageDesktop(payload?.url)) as T;

    case 'KODA_BRIDGE_DISCORD_STATE':
    case 'OURTUBE_BRIDGE_DISCORD_STATE':
    case 'KODA_BRIDGE_DISCORD_CONNECT':
    case 'OURTUBE_BRIDGE_DISCORD_CONNECT':
    case 'KODA_BRIDGE_DISCORD_DISCONNECT':
    case 'OURTUBE_BRIDGE_DISCORD_DISCONNECT':
    case 'KODA_BRIDGE_DISCORD_SET_ENABLED':
    case 'OURTUBE_BRIDGE_DISCORD_SET_ENABLED':
    case 'KODA_BRIDGE_DISCORD':
    case 'OURTUBE_BRIDGE_DISCORD':
      return DISCORD_UNAVAILABLE as T;

    default:
      throw new Error(`Unsupported desktop bridge message: ${type}`);
  }
}

/**
 * Port of the extension's handleScrapePage: fetch a YouTube HTML page through
 * the Rust proxy and pull ytInitialData out of it.
 */
async function scrapePageDesktop(targetUrl: string = 'https://www.youtube.com/'): Promise<any> {
  try {
    const res = await invoke<FetchResponsePayload>('proxy_fetch', {
      payload: {
        url: targetUrl,
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      } as FetchRequestPayload
    });
    const html = typeof res.data === 'string' ? res.data : null;
    if (!html) return null;
    const match =
      html.match(/var\s+ytInitialData\s*=\s*({.+?});<\/script>/s) ||
      html.match(/window\["ytInitialData"\]\s*=\s*({.+?});<\/script>/s);
    return match?.[1] ? JSON.parse(match[1]) : null;
  } catch (err) {
    console.warn('[OurTube Desktop] Scrape page error:', err);
    return null;
  }
}
