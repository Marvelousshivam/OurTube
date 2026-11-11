/**
 * Desktop (Tauri) YouTube account & brand-channel discovery.
 *
 * Ported 1:1 from `apps/extension/src/background/auth.ts`, routing signed
 * InnerTube calls through the Rust `proxy_fetch` command (`signed: true`),
 * which attaches the app's WebView2 YouTube cookies and SAPISIDHASH in Rust.
 */
import { invoke } from '@tauri-apps/api/core';
import type {
  AuthState,
  FetchResponsePayload,
  YtAccount,
  YtChannel
} from '@koda/bridge-types';

export const MUSIC_ORIGIN = 'https://music.youtube.com';
const MAX_LOGINS = 3;
const WEB_REMIX_VERSION = '1.20251006.03.00';
const SELECTED_CHANNEL_KEY = 'koda_selected_channel_id';
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;

export interface DesktopIdentity {
  authUser: string;
  pageId: string | null;
}

let cachedAuth: { data: AuthState; time: number } | null = null;
let inFlightAuthPromise: Promise<AuthState> | null = null;

export function invalidateDesktopAuthCache(): void {
  cachedAuth = null;
}

export function getSelectedChannelId(): string | null {
  try {
    return localStorage.getItem(SELECTED_CHANNEL_KEY) || null;
  } catch {
    return null;
  }
}

export function setSelectedChannelId(id: string): void {
  cachedAuth = null;
  try {
    localStorage.setItem(SELECTED_CHANNEL_KEY, id);
  } catch (err) {
    console.warn('[OurTube Desktop Auth] Failed to save selected channel:', err);
  }
}

export function getActiveIdentity(): DesktopIdentity {
  const selectedId = getSelectedChannelId();
  if (selectedId && selectedId.includes(':')) {
    const [authUser, pageId] = selectedId.split(':');
    return {
      authUser: authUser || '0',
      pageId: pageId === 'own' ? null : pageId
    };
  }
  return { authUser: '0', pageId: null };
}

function findRenderers(root: any, key: string, out: any[] = []): any[] {
  if (Array.isArray(root)) {
    for (const item of root) findRenderers(item, key, out);
  } else if (root && typeof root === 'object') {
    for (const [k, v] of Object.entries(root)) {
      if (k === key && v && typeof v === 'object' && !Array.isArray(v)) out.push(v);
      else findRenderers(v, key, out);
    }
  }
  return out;
}

function extractText(node: any): string {
  if (node?.runs) return node.runs.map((r: any) => r.text || '').join('');
  return node?.simpleText || '';
}

function extractPhoto(item: any): string | null {
  const thumbnails = item?.accountPhoto?.thumbnails || item?.thumbnail?.thumbnails;
  return thumbnails?.slice(-1)[0]?.url || null;
}

function extractPageId(item: any): string | null {
  if (item?.pageId) return String(item.pageId);
  if (item?.serviceEndpoint?.selectActiveIdentityEndpoint?.supportedTokens) {
    for (const token of item.serviceEndpoint.selectActiveIdentityEndpoint.supportedTokens) {
      if (token?.pageIdToken?.pageId) return String(token.pageIdToken.pageId);
    }
  }
  if (item?.endpoint?.selectActiveIdentityEndpoint?.supportedTokens) {
    for (const token of item.endpoint.selectActiveIdentityEndpoint.supportedTokens) {
      if (token?.pageIdToken?.pageId) return String(token.pageIdToken.pageId);
    }
  }
  return null;
}

async function signedFetch(
  endpoint: string,
  identity: DesktopIdentity,
  bodyPayload: any = {}
): Promise<any> {
  const queryParams = new URLSearchParams();
  queryParams.set('authuser', identity.authUser);
  queryParams.set('prettyPrint', 'false');

  const url = `${MUSIC_ORIGIN}/youtubei/v1/${endpoint}?${queryParams.toString()}`;
  const res = await invoke<FetchResponsePayload>('proxy_fetch', {
    payload: {
      url,
      method: 'POST',
      signed: true,
      authUser: identity.authUser,
      pageId: identity.pageId ?? undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      body: {
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: WEB_REMIX_VERSION,
            hl: 'en',
            gl: 'US'
          },
          user: {
            onBehalfOfUser: identity.pageId || undefined
          }
        },
        ...bodyPayload
      }
    }
  });

  if (!res || res.status < 200 || res.status >= 300) {
    return null;
  }
  return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
}

async function webSessionIndex(): Promise<string | null> {
  try {
    const res = await invoke<FetchResponsePayload>('proxy_fetch', {
      payload: {
        url: `${MUSIC_ORIGIN}/`,
        method: 'GET',
        signed: true,
        authUser: '0',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        headers: {
          Accept: 'text/html'
        }
      }
    });
    if (!res || res.status < 200 || res.status >= 300) return null;
    const html = typeof res.data === 'string' ? res.data : '';
    const match = /"SESSION_INDEX":"?(\d+)/.exec(html);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function readLogin(authUser: string): Promise<YtAccount | null> {
  const identity: DesktopIdentity = { authUser, pageId: null };
  try {
    const menu = await signedFetch('account/account_menu', identity);
    if (!menu) return null;

    const headers = findRenderers(menu, 'activeAccountHeaderRenderer');
    const header = headers[0];
    if (!header) return null;

    const name = extractText(header.accountName) || 'YouTube Music User';
    const email = extractText(header.email) || null;
    const handle = extractText(header.channelHandle) || null;
    const avatarUrl = extractPhoto(header);

    const channels: YtChannel[] = [];
    try {
      const list = await signedFetch('account/accounts_list', identity);
      if (list) {
        const items = findRenderers(list, 'accountItem');
        for (const item of items) {
          const chName = extractText(item.accountName);
          if (!chName) continue;
          const pageId = extractPageId(item);
          const id = `${authUser}:${pageId ?? 'own'}`;
          if (channels.some((c) => c.id === id)) continue;

          channels.push({
            id,
            name: chName,
            handle: extractText(item.channelHandle) || extractText(item.accountByline) || handle,
            avatarUrl: extractPhoto(item) || avatarUrl,
            brand: pageId !== null,
            authUser,
            pageId,
            selectedOnWeb: item.isSelected === true
          });
        }
      }
    } catch {
      // ignore channel list failure
    }

    if (channels.length === 0) {
      channels.push({
        id: `${authUser}:own`,
        name,
        handle: handle || email,
        avatarUrl,
        brand: false,
        authUser,
        pageId: null,
        selectedOnWeb: true
      });
    }

    return {
      authUser,
      name,
      email,
      avatarUrl,
      channels
    };
  } catch (err) {
    console.warn(`[OurTube Desktop Auth] Error reading login index ${authUser}:`, err);
    return null;
  }
}

async function discoverAccounts(): Promise<{ accounts: YtAccount[]; webIndex: string | null }> {
  const [results, webIndex] = await Promise.all([
    Promise.all(Array.from({ length: MAX_LOGINS }, (_, i) => readLogin(String(i)))),
    webSessionIndex()
  ]);

  const accounts: YtAccount[] = [];
  const seen = new Set<string>();

  for (const acc of results) {
    if (!acc) continue;
    const key = `${acc.name}_${acc.authUser}_${acc.email || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    accounts.push(acc);
  }

  if (accounts.length === 0) {
    try {
      const fallbackIdentity: DesktopIdentity = { authUser: '0', pageId: null };
      const guide = await signedFetch('browse', fallbackIdentity, { browseId: 'FEmusic_home' });
      const avatar = guide ? extractPhoto(guide) : null;
      const headers = findRenderers(guide, 'activeAccountHeaderRenderer');
      const header = headers[0];
      const parsedName = header ? extractText(header.accountName) : null;
      const parsedHandle = header ? extractText(header.channelHandle) : null;
      const parsedEmail = header ? extractText(header.email) : null;

      if (parsedName || avatar) {
        const displayName = parsedName || 'YouTube Account';
        accounts.push({
          authUser: '0',
          name: displayName,
          email: parsedEmail,
          avatarUrl: avatar,
          channels: [
            {
              id: '0:own',
              name: displayName,
              handle: parsedHandle || null,
              avatarUrl: avatar,
              brand: false,
              authUser: '0',
              pageId: null,
              selectedOnWeb: true
            }
          ]
        });
      }
    } catch {
      // Unauthenticated or unreachable session
    }
  }

  return { accounts, webIndex };
}

export async function getDesktopAuthState(forceRefresh: boolean = false): Promise<AuthState> {
  const now = Date.now();
  if (!forceRefresh && cachedAuth && now - cachedAuth.time < AUTH_CACHE_TTL_MS) {
    return cachedAuth.data;
  }
  if (!forceRefresh && inFlightAuthPromise) {
    return inFlightAuthPromise;
  }

  inFlightAuthPromise = _computeDesktopAuthState().finally(() => {
    inFlightAuthPromise = null;
  });
  return inFlightAuthPromise;
}

async function _computeDesktopAuthState(): Promise<AuthState> {
  const signedIn = await invoke<boolean>('auth_signed_in').catch(() => false);
  const selectedChannelId = getSelectedChannelId();

  if (!signedIn) {
    return {
      isAuthenticated: false,
      accounts: [],
      selectedChannelId: null,
      selectedChannel: null
    };
  }

  const { accounts, webIndex } = await discoverAccounts();

  if (accounts.length === 0) {
    const fallbackChannel: YtChannel = {
      id: '0:own',
      name: 'YouTube Session',
      handle: null,
      avatarUrl: null,
      brand: false,
      authUser: '0',
      pageId: null,
      selectedOnWeb: true
    };
    accounts.push({
      authUser: '0',
      name: 'YouTube Session',
      email: null,
      avatarUrl: null,
      channels: [fallbackChannel]
    });
  }

  const allChannels = accounts.flatMap((a) => a.channels);
  let selectedChannel: YtChannel | null = null;

  if (selectedChannelId) {
    selectedChannel = allChannels.find((c) => c.id === selectedChannelId) || null;
    if (!selectedChannel) {
      const [authPrefix] = selectedChannelId.split(':');
      const matchingAccount = accounts.find((a) => a.authUser === authPrefix);
      if (matchingAccount && matchingAccount.channels.length > 0) {
        selectedChannel = matchingAccount.channels[0];
      }
    }
  }

  if (selectedChannel && selectedChannel.id !== selectedChannelId) {
    setSelectedChannelId(selectedChannel.id);
  }

  if (!selectedChannel && webIndex !== null) {
    const webAccount = accounts.find((a) => a.authUser === webIndex);
    if (webAccount) {
      selectedChannel =
        webAccount.channels.find((c) => c.selectedOnWeb) || webAccount.channels[0] || null;
    }
  }

  if (!selectedChannel && allChannels.length > 0) {
    selectedChannel = allChannels.find((c) => c.selectedOnWeb) || allChannels[0];
  }

  const result: AuthState = {
    isAuthenticated: true,
    accounts,
    selectedChannelId: selectedChannel?.id || null,
    selectedChannel
  };

  cachedAuth = { data: result, time: Date.now() };
  return result;
}

export async function openDesktopLogin(addSession: boolean = false): Promise<void> {
  await invoke('auth_open_login', { addSession });
}

export async function signOutDesktop(): Promise<void> {
  cachedAuth = null;
  try {
    localStorage.removeItem(SELECTED_CHANNEL_KEY);
    localStorage.removeItem('ourtube_auth_cache');
  } catch {
    // ignore
  }
  await invoke('auth_sign_out');
}
