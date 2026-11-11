import { AuthState, YtAccount, YtChannel } from '@koda/bridge-types';
import { installExtensionFetchRule } from './rules';

export const MUSIC_ORIGIN = 'https://music.youtube.com';
const SIGNING_COOKIES = ['SAPISID', '__Secure-3PAPISID', '__Secure-1PAPISID'];
const COOKIE_URLS = [
  'https://music.youtube.com/',
  'https://www.youtube.com/',
  'https://youtube.com/',
  'https://accounts.google.com/'
];
const MAX_LOGINS = 3;
const WEB_REMIX_VERSION = '1.20251006.03.00';

export interface Identity {
  authUser: string;
  pageId: string | null;
}

export async function calculateSapisidHash(
  sapisid: string,
  origin: string = MUSIC_ORIGIN
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const rawString = `${timestamp} ${sapisid} ${origin}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(rawString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `SAPISIDHASH ${timestamp}_${hashHex}`;
}

export async function getSigningSecret(): Promise<string | null> {
  // 1. Check direct URL cookies as BitChord does
  for (const url of COOKIE_URLS) {
    for (const name of SIGNING_COOKIES) {
      try {
        const cookie = await chrome.cookies.get({ url, name });
        if (cookie?.value) {
          return cookie.value;
        }
      } catch {
        // continue
      }
    }
  }

  // 2. Query all cookies across youtube.com domain
  try {
    const domainCookies = await chrome.cookies.getAll({ domain: 'youtube.com' });
    for (const name of SIGNING_COOKIES) {
      const match = domainCookies.find((c) => c.name === name);
      if (match?.value) return match.value;
    }
  } catch {
    // continue
  }

  // 3. Query all cookies by name across all granted host permissions
  for (const name of SIGNING_COOKIES) {
    try {
      const cookies = await chrome.cookies.getAll({ name });
      if (cookies && cookies.length > 0) {
        const match =
          cookies.find((c) => c.domain.includes('youtube.com') || c.domain.includes('google.com')) ||
          cookies[0];
        if (match?.value) {
          return match.value;
        }
      }
    } catch {
      // continue
    }
  }

  return null;
}

export async function getSelectedChannelId(): Promise<string | null> {
  try {
    const data = await chrome.storage.local.get('koda_selected_channel_id');
    return data?.koda_selected_channel_id || null;
  } catch {
    return null;
  }
}

let cachedAuth: { data: AuthState; time: number } | null = null;

export async function setSelectedChannelId(id: string): Promise<void> {
  cachedAuth = null;
  try {
    await chrome.storage.local.set({ koda_selected_channel_id: id });
  } catch (err) {
    console.warn('[Koda Auth] Failed to save selected channel:', err);
  }
}

export async function getActiveIdentity(): Promise<Identity> {
  const selectedId = await getSelectedChannelId();
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
  identity: Identity,
  bodyPayload: any = {}
): Promise<any> {
  const secret = await getSigningSecret();
  if (!secret) return null;

  await installExtensionFetchRule();

  const hash = await calculateSapisidHash(secret, MUSIC_ORIGIN);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': hash,
    'X-Goog-AuthUser': identity.authUser,
    'X-Origin': MUSIC_ORIGIN,
    'X-Youtube-Client-Name': '67',
    'X-Youtube-Client-Version': WEB_REMIX_VERSION
  };

  if (identity.pageId) {
    headers['X-Goog-PageId'] = identity.pageId;
  }

  const queryParams = new URLSearchParams();
  queryParams.set('authuser', identity.authUser);
  queryParams.set('prettyPrint', 'false');

  const url = `${MUSIC_ORIGIN}/youtubei/v1/${endpoint}?${queryParams.toString()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      context: {
        client: { clientName: 'WEB_REMIX', clientVersion: WEB_REMIX_VERSION, hl: 'en', gl: 'US' },
        user: {
          onBehalfOfUser: identity.pageId || undefined
        }
      },
      ...bodyPayload
    }),
    credentials: 'include'
  });

  if (!res.ok) {
    console.warn(`[OurTube Auth] ${endpoint} answered HTTP ${res.status}`);
    return null;
  }

  return res.json();
}

/**
 * Extracts current SESSION_INDEX from YouTube Music HTML
 */
async function webSessionIndex(): Promise<string | null> {
  try {
    const secret = await getSigningSecret();
    if (!secret) return null;
    await installExtensionFetchRule();
    const hash = await calculateSapisidHash(secret, MUSIC_ORIGIN);

    const res = await fetch(`${MUSIC_ORIGIN}/`, {
      method: 'GET',
      headers: {
        'Authorization': hash,
        'X-Goog-AuthUser': '0',
        'X-Origin': MUSIC_ORIGIN,
        'Accept': 'text/html'
      },
      credentials: 'include'
    });

    if (!res.ok) return null;
    const html = await res.text();
    const match = /"SESSION_INDEX":"?(\d+)/.exec(html);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function readLogin(authUser: string): Promise<YtAccount | null> {
  const identity: Identity = { authUser, pageId: null };

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
      // Ignore channel list failure
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
    console.warn(`[Koda Auth] Error reading login index ${authUser}:`, err);
    return null;
  }
}

export async function discoverAccounts(): Promise<{ accounts: YtAccount[]; webIndex: string | null }> {
  const secret = await getSigningSecret();
  if (!secret) return { accounts: [], webIndex: null };

  // Scan logins with priority on 0 and 1, plus web session index
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

  // Fallback: If accounts_list was blocked or empty but user has valid session
  if (accounts.length === 0) {
    try {
      const fallbackIdentity: Identity = { authUser: '0', pageId: null };
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

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
let inFlightAuthPromise: Promise<AuthState> | null = null;

export async function getAuthState(forceRefresh: boolean = false): Promise<AuthState> {
  const now = Date.now();
  if (!forceRefresh && cachedAuth && now - cachedAuth.time < AUTH_CACHE_TTL_MS) {
    return cachedAuth.data;
  }
  if (!forceRefresh && inFlightAuthPromise) {
    return inFlightAuthPromise;
  }

  inFlightAuthPromise = _computeAuthState().finally(() => {
    inFlightAuthPromise = null;
  });
  return inFlightAuthPromise;
}

async function _computeAuthState(): Promise<AuthState> {
  const secret = await getSigningSecret();
  const selectedChannelId = await getSelectedChannelId();

  if (!secret) {
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

  // Heal any corrupted or legacy channel ID stored in chrome.storage
  if (selectedChannel && selectedChannel.id !== selectedChannelId) {
    chrome.storage.local.set({ koda_selected_channel_id: selectedChannel.id }).catch(() => {});
  }

  if (!selectedChannel && webIndex !== null) {
    const webAccount = accounts.find((a) => a.authUser === webIndex);
    if (webAccount) {
      selectedChannel = webAccount.channels.find((c) => c.selectedOnWeb) || webAccount.channels[0] || null;
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
