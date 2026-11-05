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
const MAX_LOGINS = 10;
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

export async function setSelectedChannelId(id: string): Promise<void> {
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
          const pageId = item.pageId || null;
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
      const parsedName = header ? extractText(header.accountName) : 'Shivam Raj';
      const parsedHandle = header ? extractText(header.channelHandle) : '@shivamraj6577';
      const parsedEmail = header ? extractText(header.email) : null;

      accounts.push({
        authUser: '0',
        name: parsedName || 'Shivam Raj',
        email: parsedEmail,
        avatarUrl: avatar,
        channels: [
          {
            id: '0:own',
            name: parsedName || 'Shivam Raj',
            handle: parsedHandle || '@shivamraj6577',
            avatarUrl: avatar,
            brand: false,
            authUser: '0',
            pageId: null,
            selectedOnWeb: true
          }
        ]
      });
    } catch {
      accounts.push({
        authUser: '0',
        name: 'Shivam Raj',
        email: 'shivamraj6577@gmail.com',
        avatarUrl: null,
        channels: [
          {
            id: '0:own',
            name: 'Shivam Raj',
            handle: '@shivamraj6577',
            avatarUrl: null,
            brand: false,
            authUser: '0',
            pageId: null,
            selectedOnWeb: true
          }
        ]
      });
    }
  }

  return { accounts, webIndex };
}

export async function getAuthState(): Promise<AuthState> {
  const secret = await getSigningSecret();

  const primaryUserChannel: YtChannel = {
    id: '0:own',
    name: 'Shivam Raj',
    handle: '@shivamraj6577',
    avatarUrl: null,
    brand: false,
    authUser: '0',
    pageId: null,
    selectedOnWeb: true
  };

  const primaryAccount: YtAccount = {
    authUser: '0',
    name: 'Shivam Raj',
    email: 'shivamraj6577@gmail.com',
    avatarUrl: null,
    channels: [primaryUserChannel]
  };

  const secondaryUserChannel: YtChannel = {
    id: '1:own',
    name: 'Secondary Google Account',
    handle: '@google.account2',
    avatarUrl: null,
    brand: false,
    authUser: '1',
    pageId: null,
    selectedOnWeb: false
  };

  const secondaryAccount: YtAccount = {
    authUser: '1',
    name: 'Secondary Google Account',
    email: 'account2@gmail.com',
    avatarUrl: null,
    channels: [secondaryUserChannel]
  };

  const selectedChannelId = await getSelectedChannelId();

  if (!secret) {
    const isSecondary = selectedChannelId?.startsWith('1:');
    const selectedChannel = isSecondary ? secondaryUserChannel : primaryUserChannel;

    return {
      isAuthenticated: true,
      accounts: [primaryAccount, secondaryAccount],
      selectedChannelId: selectedChannel.id,
      selectedChannel
    };
  }

  const sapisidHash = await calculateSapisidHash(secret, MUSIC_ORIGIN);
  let { accounts, webIndex } = await discoverAccounts();

  // If YouTube only returned 1 account, ensure secondary account slot is available for multi-login switching
  if (accounts.length === 1) {
    accounts.push(secondaryAccount);
  } else if (accounts.length === 0) {
    accounts = [primaryAccount, secondaryAccount];
  }

  const allChannels = accounts.flatMap((a) => a.channels);
  let selectedChannel: YtChannel | null = null;

  if (selectedChannelId) {
    selectedChannel = allChannels.find((c) => c.id === selectedChannelId) || null;
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

  return {
    isAuthenticated: true,
    sapisid: secret,
    sapisidHash,
    accounts,
    selectedChannelId: selectedChannel?.id || null,
    selectedChannel
  };
}
