/**
 * Desktop (Tauri) transport for the bridge protocol.
 *
 * In a browser, bridgeClient talks to the companion extension over
 * window.postMessage. Inside the Tauri shell the same message types are
 * answered here:
 * - Auth & brand-channel discovery -> desktopAuth + Rust cookie store
 * - InnerTube/API fetches -> Rust `proxy_fetch` (signed with SAPISIDHASH)
 * - Stream resolution -> in-webview youtubei.js routed through anonymous
 *   `proxy_fetch`, media bytes served by the chunked Rust stream server
 * - Lyrics (15 sources) -> Rust `lyrics_fetch`
 * - Discord Rich Presence -> Rust `discord_*` over local named pipe IPC
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type {
  FetchRequestPayload,
  FetchResponsePayload,
  LyricsFetchRequestPayload,
  LyricsFetchResponsePayload
} from '@koda/bridge-types';
import {
  getActiveIdentity,
  getDesktopAuthState,
  invalidateDesktopAuthCache,
  setSelectedChannelId
} from './desktopAuth';

let authListenerRegistered = false;

export function registerDesktopAuthListener(onAuthChanged: () => void): void {
  if (authListenerRegistered || typeof window === 'undefined') return;
  authListenerRegistered = true;
  listen('auth-changed', () => {
    invalidateDesktopAuthCache();
    onAuthChanged();
  }).catch((err) => {
    console.warn('[OurTube Desktop] Failed to listen for auth-changed:', err);
  });
}

export async function handleDesktopRequest<T = any>(type: string, payload?: any): Promise<T> {
  switch (type) {
    case 'KODA_BRIDGE_PING':
    case 'OURTUBE_BRIDGE_PING':
      return {
        name: 'OurTube Desktop',
        version: '1.0.0',
        status: 'ready'
      } as T;

    case 'KODA_BRIDGE_GET_AUTH':
    case 'OURTUBE_BRIDGE_GET_AUTH':
    case 'KODA_BRIDGE_GET_ACCOUNTS':
    case 'OURTUBE_BRIDGE_GET_ACCOUNTS':
      return (await getDesktopAuthState(Boolean(payload?.forceRefresh))) as T;

    case 'KODA_BRIDGE_SELECT_ACCOUNT':
    case 'OURTUBE_BRIDGE_SELECT_ACCOUNT':
      if (payload?.channelId) {
        setSelectedChannelId(payload.channelId);
      }
      return (await getDesktopAuthState(true)) as T;

    case 'KODA_BRIDGE_FETCH':
    case 'OURTUBE_BRIDGE_FETCH':
      return (await handleDesktopProxyFetch(payload as FetchRequestPayload)) as T;

    case 'KODA_BRIDGE_LYRICS_FETCH':
    case 'OURTUBE_BRIDGE_LYRICS_FETCH':
      return (await invoke<LyricsFetchResponsePayload>('lyrics_fetch', {
        payload: payload as LyricsFetchRequestPayload
      })) as T;

    // Returning empty here makes streamResolver fall through to its direct
    // in-webview VISIONOS/decipher resolution, which runs anonymously through
    // desktopProxyFetch (keeping stream fetches off the user's Google account).
    case 'KODA_BRIDGE_STREAM_URL':
    case 'OURTUBE_BRIDGE_STREAM_URL':
      return { audioUrl: undefined, videoUrl: undefined } as T;

    case 'KODA_BRIDGE_SCRAPE_HOME':
    case 'OURTUBE_BRIDGE_SCRAPE_HOME':
      return (await scrapePageDesktop(payload?.url)) as T;

    case 'KODA_BRIDGE_DISCORD_STATE':
    case 'OURTUBE_BRIDGE_DISCORD_STATE':
      return (await invoke('discord_state')) as T;

    case 'KODA_BRIDGE_DISCORD_CONNECT':
    case 'OURTUBE_BRIDGE_DISCORD_CONNECT':
      return (await invoke('discord_connect')) as T;

    case 'KODA_BRIDGE_DISCORD_DISCONNECT':
    case 'OURTUBE_BRIDGE_DISCORD_DISCONNECT':
      return (await invoke('discord_disconnect')) as T;

    case 'KODA_BRIDGE_DISCORD_SET_ENABLED':
    case 'OURTUBE_BRIDGE_DISCORD_SET_ENABLED':
      return (await invoke('discord_set_enabled', {
        enabled: Boolean(payload?.enabled)
      })) as T;

    case 'KODA_BRIDGE_DISCORD':
    case 'OURTUBE_BRIDGE_DISCORD':
      return (await invoke('discord_set_presence', {
        payload: {
          track: payload?.track ?? null,
          options: payload?.options ?? {}
        }
      })) as T;

    default:
      throw new Error(`Unsupported desktop bridge message: ${type}`);
  }
}

/**
 * Port of `handleProxyFetch` from `apps/extension/src/background/proxy.ts`.
 * Injects active account / brand-channel context (`onBehalfOfUser`) and
 * delegates cookie + SAPISIDHASH signing to Rust `proxy_fetch`.
 */
async function handleDesktopProxyFetch(
  payload: FetchRequestPayload
): Promise<FetchResponsePayload> {
  const identity = getActiveIdentity();

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

  const isDesktopYt =
    !payload.url.includes('music.youtube.com') &&
    (payload.url.includes('www.youtube.com') || payload.url.includes('youtube.com/youtubei'));

  let requestBody: any = payload.body;
  if (requestBody) {
    try {
      const parsedBody =
        typeof requestBody === 'string' ? JSON.parse(requestBody) : { ...requestBody };
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

  return await invoke<FetchResponsePayload>('proxy_fetch', {
    payload: {
      url: payload.url,
      method: payload.method || 'GET',
      headers: payload.headers,
      body: requestBody,
      signed: true,
      authUser: effectiveAuthUser,
      pageId: effectivePageId ?? undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    }
  });
}

/**
 * Port of the extension's `handleScrapePage`: fetch a YouTube HTML page
 * through the signed Rust proxy and pull `ytInitialData` out of it.
 */
async function scrapePageDesktop(targetUrl: string = 'https://www.youtube.com/'): Promise<any> {
  try {
    const identity = getActiveIdentity();
    const res = await invoke<FetchResponsePayload>('proxy_fetch', {
      payload: {
        url: targetUrl,
        method: 'GET',
        signed: true,
        authUser: identity.authUser,
        pageId: identity.pageId ?? undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
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
