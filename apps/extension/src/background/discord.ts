import { installDiscordFetchRule } from './rules';

export interface DiscordNowPlaying {
  videoId: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  positionMs: number;
  durationMs: number;
  playbackRate?: number;
}

export interface DiscordPresenceOptions {
  activityType?: 'listening' | 'playing' | 'watching' | 'competing';
  status?: 'online' | 'idle' | 'dnd' | 'invisible';
  useDetails?: boolean;
  activityName?: string;
  showElapsed?: boolean;
  showArtwork?: boolean;
  showButtons?: boolean;
  button1Text?: string;
  button1Visible?: boolean;
  button2Text?: string;
  button2Visible?: boolean;
  incognito?: boolean;
}

export interface DiscordUserInfo {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface DiscordState {
  available: boolean;
  connected: boolean;
  enabled: boolean;
  user: DiscordUserInfo | null;
  gateway: 'off' | 'connecting' | 'ready' | 'error';
  problem: string | null;
}

/** Registered Discord application ID (from BitChord DiscordApplication.kt) used for external-assets & activity buttons */
export const APPLICATION_ID = '1543679166967193620';
const GATEWAY = 'wss://gateway.discord.gg/?v=9&encoding=json';
const API = 'https://discord.com/api/v9';
const PROJECT_URL = 'https://github.com/Marvelousshivam/OurTube';
const DEFAULT_BUTTON_1 = 'Listen on YouTube Music';
const DEFAULT_BUTTON_2 = 'Visit OurTube';
const APP_NAME = 'OurTube';

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 60_000;
const STALE_GRACE_MS = 15_000;
const SESSION_WAIT_MS = 20_000;
const KEEPALIVE_MS = 20_000;
const IDLE_CLOSE_MS = 5 * 60_000;

const ACCOUNT_KEY = 'discord.account';
const ENABLED_KEY = 'discord.enabled';

interface Account {
  token: string;
  user: DiscordUserInfo;
}

function osName(): string {
  const ua = navigator.userAgent;
  return /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS/.test(ua)
      ? 'Mac OS X'
      : /Android/.test(ua)
        ? 'Android'
        : 'Linux';
}

let superProperties: string | null = null;
function superPropertiesBase64(): string {
  superProperties ??= btoa(
    JSON.stringify({
      os: osName(),
      browser: 'Chrome',
      device: '',
      system_locale: navigator.language,
      browser_user_agent: navigator.userAgent,
      browser_version: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? '',
      os_version: '',
      referrer: '',
      referring_domain: '',
      release_channel: 'stable',
      client_build_number: 352675,
      client_event_source: null
    })
  );
  return superProperties;
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  await installDiscordFetchRule();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: token,
      'X-Super-Properties': superPropertiesBase64(),
      ...(init.body && { 'Content-Type': 'application/json' }),
      ...init.headers
    }
  });
  if (response.status === 401) {
    throw Object.assign(new Error('Discord refused the token'), { code: 'unauthenticated' });
  }
  if (!response.ok) {
    throw new Error(`Discord ${path} failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function userInfo(token: string): Promise<DiscordUserInfo> {
  const me = await api<{
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  }>(token, '/users/@me');
  return {
    id: me.id,
    username: me.username,
    name: me.global_name || me.username,
    avatarUrl: me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png` : null
  };
}

/** Mirrors external HTTP cover art onto Discord's `mp:` proxy CDN (cached up to 50 tracks). */
const artworkCache = new Map<string, string | null>();
async function externalAsset(token: string, imageUrl: string): Promise<string | null> {
  if (artworkCache.has(imageUrl)) return artworkCache.get(imageUrl)!;
  try {
    const list = await api<{ external_asset_path?: string }[]>(
      token,
      `/applications/${APPLICATION_ID}/external-assets`,
      {
        method: 'POST',
        body: JSON.stringify({ urls: [imageUrl] })
      }
    );
    const assetPath = list[0]?.external_asset_path;
    const asset = assetPath ? `mp:${assetPath}` : null;
    artworkCache.set(imageUrl, asset);
    if (artworkCache.size > 50) {
      const oldest = artworkCache.keys().next().value;
      if (oldest) artworkCache.delete(oldest);
    }
    return asset;
  } catch {
    return null;
  }
}

type Presence = { activities: unknown[]; afk: boolean; since: number; status: string };

interface Payload {
  op: number;
  d?: unknown;
  s?: number | null;
  t?: string | null;
}

const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE_UPDATE: 3,
  RESUME: 6,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11
};

export class Gateway {
  private socket: WebSocket | null = null;
  private sequence = 0;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private heartbeatInterval = 0;
  private heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  private keepAlive: ReturnType<typeof setInterval> | undefined;
  private awaitingAck = false;
  private lastAckAt = 0;
  private immediateRetry = false;
  private backoff = INITIAL_RECONNECT_MS;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private looping = false;
  private closed = false;
  private ready = false;
  private readyWaiters: (() => void)[] = [];
  private lastPresence: Presence | null = null;
  private delivered: string | null = null;

  constructor(
    private readonly token: string,
    private readonly onStatus: (status: DiscordState['gateway'], problem?: string) => void,
    private readonly url = GATEWAY
  ) {}

  connect(): void {
    if (this.closed || this.looping) return;
    this.looping = true;
    this.open();
  }

  retryNow(): void {
    if (this.closed || this.socket || !this.looping) return;
    clearTimeout(this.retryTimer);
    this.open();
  }

  private open(): void {
    if (this.closed) return;
    this.onStatus('connecting');
    const socket = new WebSocket(this.resumeUrl ?? this.url);
    this.socket = socket;
    let opened = false;
    socket.onopen = () => {
      opened = true;
      this.backoff = INITIAL_RECONNECT_MS;
      this.keepAlive ??= setInterval(() => {
        chrome.runtime.getPlatformInfo(() => {});
      }, KEEPALIVE_MS);
    };
    socket.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(String(event.data)) as Payload);
      } catch (error) {
        console.warn('[OurTube Discord] Gateway frame error:', error);
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.teardown();
      if (this.closed) return;
      if (event.code === 4004) {
        this.looping = false;
        this.onStatus('error', 'Discord refused the token. Reconnect your account.');
        return;
      }
      if (!opened) this.forgetSession();
      if (this.immediateRetry) {
        this.immediateRetry = false;
        this.open();
        return;
      }
      this.onStatus('connecting');
      this.retryTimer = setTimeout(() => this.open(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, MAX_RECONNECT_MS);
    };
  }

  private teardown(): void {
    this.ready = false;
    this.awaitingAck = false;
    this.delivered = null;
    clearTimeout(this.heartbeatTimer);
    clearInterval(this.keepAlive);
    this.keepAlive = undefined;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
  }

  private forgetSession(): void {
    this.resumeUrl = null;
    this.sessionId = null;
    this.sequence = 0;
  }

  private drop(why: string): void {
    console.info(`[OurTube Discord] Gateway dropped (${why})`);
    this.ready = false;
    this.socket?.close();
  }

  private send(op: number, d: unknown): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ op, d }));
    return true;
  }

  private onMessage(payload: Payload): void {
    if (typeof payload.s === 'number') this.sequence = payload.s;
    switch (payload.op) {
      case OP.DISPATCH:
        if (payload.t === 'READY') {
          const ready = payload.d as { session_id: string; resume_gateway_url: string };
          this.sessionId = ready.session_id;
          this.resumeUrl = `${ready.resume_gateway_url}/?v=9&encoding=json`;
          this.sessionReady();
        } else if (payload.t === 'RESUMED') {
          this.sessionReady();
        }
        break;
      case OP.HEARTBEAT:
        this.heartbeat();
        break;
      case OP.HEARTBEAT_ACK:
        this.awaitingAck = false;
        this.lastAckAt = Date.now();
        break;
      case OP.RECONNECT:
        this.immediateRetry = true;
        this.drop('gateway asked to reconnect');
        break;
      case OP.INVALID_SESSION:
        this.forgetSession();
        setTimeout(() => this.identify(), 150);
        break;
      case OP.HELLO: {
        this.heartbeatInterval = (payload.d as { heartbeat_interval: number }).heartbeat_interval;
        if (this.sequence > 0 && this.sessionId) {
          this.send(OP.RESUME, {
            token: this.token,
            session_id: this.sessionId,
            seq: this.sequence
          });
        } else {
          this.identify();
        }
        this.startHeartbeats();
        break;
      }
    }
  }

  private identify(): void {
    this.send(OP.IDENTIFY, {
      token: this.token,
      capabilities: 16381,
      properties: { os: osName(), browser: 'Chrome', device: '' },
      presence: { status: 'online', since: 0, activities: [], afk: false },
      compress: false,
      client_state: {
        guild_versions: {},
        highest_last_message_id: '0',
        read_state_version: 0,
        user_guild_settings_version: -1,
        user_settings_version: -1,
        private_channels_version: '0',
        api_code_version: 0
      }
    });
  }

  private heartbeat(): void {
    this.send(OP.HEARTBEAT, this.sequence || null);
  }

  private startHeartbeats(): void {
    clearTimeout(this.heartbeatTimer);
    this.awaitingAck = false;
    this.lastAckAt = Date.now();
    const beat = () => {
      if (this.awaitingAck) return this.drop('heartbeat went unacknowledged');
      this.awaitingAck = true;
      this.heartbeat();
      this.heartbeatTimer = setTimeout(beat, this.heartbeatInterval);
    };
    this.heartbeatTimer = setTimeout(beat, this.heartbeatInterval * Math.random());
  }

  private stale(): boolean {
    return (
      this.heartbeatInterval > 0 &&
      this.lastAckAt > 0 &&
      Date.now() - this.lastAckAt > this.heartbeatInterval + STALE_GRACE_MS
    );
  }

  private sessionReady(): void {
    this.lastAckAt = Date.now();
    this.ready = true;
    this.onStatus('ready');
    this.readyWaiters.splice(0).forEach((resolve) => resolve());
    if (this.lastPresence) this.deliver(this.lastPresence);
  }

  private deliver(presence: Presence): void {
    const json = JSON.stringify(presence);
    if (this.delivered === json) return;
    if (this.send(OP.PRESENCE_UPDATE, presence)) this.delivered = json;
  }

  async sendActivity(presence: Presence): Promise<void> {
    this.lastPresence = presence;
    if (this.closed) return;
    if (this.ready && this.stale()) this.drop('stale before a presence push');
    this.connect();
    this.retryNow();
    if (!this.ready) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, SESSION_WAIT_MS);
        this.readyWaiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (this.ready) this.deliver(presence);
  }

  clearActivity(): void {
    const presence: Presence = { activities: [], afk: true, since: 0, status: 'online' };
    this.lastPresence = presence;
    if (this.ready && !this.stale()) this.deliver(presence);
  }

  close(): void {
    this.closed = true;
    this.looping = false;
    clearTimeout(this.retryTimer);
    this.lastPresence = null;
    this.forgetSession();
    this.teardown();
    this.onStatus('off');
  }
}

function resolveVariables(text: string, track: DiscordNowPlaying): string {
  return text
    .replaceAll('{song_name}', track.title)
    .replaceAll('{artist_name}', track.artist)
    .replaceAll('{album_name}', track.album ?? '');
}

const ACTIVITY_TYPES = { playing: 0, listening: 2, watching: 3, competing: 5 } as const;

export async function buildPresence(
  token: string,
  track: DiscordNowPlaying,
  options: DiscordPresenceOptions
): Promise<Presence> {
  const now = Date.now();
  const rate = track.playbackRate && track.playbackRate > 0 ? track.playbackRate : 1;
  const watchUrl = `https://music.youtube.com/watch?v=${track.videoId}`;

  const showBtns = options.showButtons !== false;
  const btn1Vis = showBtns && options.button1Visible !== false;
  const btn2Vis = showBtns && options.button2Visible !== false;

  const buttons: [string, string][] = [];
  if (btn1Vis) {
    buttons.push([resolveVariables(options.button1Text?.trim() || DEFAULT_BUTTON_1, track), watchUrl]);
  }
  if (btn2Vis) {
    buttons.push([resolveVariables(options.button2Text?.trim() || DEFAULT_BUTTON_2, track), PROJECT_URL]);
  }

  const showArt = options.showArtwork !== false;
  const art = showArt && track.artworkUrl?.startsWith('http') ? track.artworkUrl : null;
  const largeImage = art ? ((await externalAsset(token, art)) ?? art) : null;

  const actType = options.activityType ?? 'listening';
  const showElapsed = options.showElapsed !== false;

  return {
    activities: [
      {
        name: options.activityName?.trim() || APP_NAME,
        details: rate !== 1 ? `${track.title} [${rate.toFixed(2)}x]` : track.title,
        details_url: watchUrl,
        state: track.artist,
        state_url: null,
        type: ACTIVITY_TYPES[actType] ?? 2,
        status_display_type: options.useDetails ? 2 : 1,
        ...(showElapsed && {
          timestamps: {
            start: Math.round(now - track.positionMs / rate),
            end: Math.round(now + Math.max(0, track.durationMs - track.positionMs) / rate)
          }
        }),
        assets: {
          large_image: largeImage,
          small_image: null,
          large_text: track.album || APP_NAME,
          small_text: null
        },
        ...(buttons.length > 0 && {
          buttons: buttons.map(([label]) => label.slice(0, 32)),
          metadata: { button_urls: buttons.map(([, url]) => url) },
          application_id: APPLICATION_ID
        }),
        url: null
      }
    ],
    afk: true,
    since: now,
    status: options.status || 'online'
  };
}

let gateway: Gateway | null = null;
let gatewayStatus: DiscordState['gateway'] = 'off';
let gatewayProblem: string | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

async function getStoredAccount(): Promise<Account | null> {
  const data = await chrome.storage.local.get(ACCOUNT_KEY);
  return (data[ACCOUNT_KEY] as Account | undefined) ?? null;
}

async function getStoredEnabled(): Promise<boolean> {
  const data = await chrome.storage.local.get(ENABLED_KEY);
  if (typeof data[ENABLED_KEY] === 'boolean') return data[ENABLED_KEY];
  return true;
}

export async function discordState(): Promise<DiscordState> {
  const held = await getStoredAccount();
  const isEnabled = await getStoredEnabled();
  return {
    available: true,
    connected: Boolean(held),
    enabled: isEnabled,
    user: held
      ? {
          id: held.user.id,
          name: held.user.name,
          username: held.user.username,
          avatarUrl: held.user.avatarUrl
        }
      : null,
    gateway: gatewayStatus,
    problem: gatewayProblem
  };
}

function closeGateway(): void {
  clearTimeout(idleTimer);
  gateway?.close();
  gateway = null;
}

function ensureGateway(token: string): Gateway {
  gateway ??= new Gateway(token, (status, problem) => {
    gatewayStatus = status;
    gatewayProblem = problem ?? (status === 'error' ? gatewayProblem : null);
  });
  return gateway;
}

export async function setPresence(
  track: DiscordNowPlaying | null,
  options: DiscordPresenceOptions = {}
): Promise<DiscordState> {
  const held = await getStoredAccount();
  const isEnabled = await getStoredEnabled();
  if (!held || !isEnabled || options.incognito) {
    gateway?.clearActivity();
    return discordState();
  }
  clearTimeout(idleTimer);
  if (!track) {
    gateway?.clearActivity();
    idleTimer = setTimeout(closeGateway, IDLE_CLOSE_MS);
    return discordState();
  }
  const presence = await buildPresence(held.token, track, options);
  await ensureGateway(held.token).sendActivity(presence);
  return discordState();
}

export async function setDiscordEnabled(on: boolean): Promise<DiscordState> {
  await chrome.storage.local.set({ [ENABLED_KEY]: on });
  if (!on) {
    closeGateway();
  } else {
    const held = await getStoredAccount();
    if (held) {
      ensureGateway(held.token).connect();
    }
  }
  return discordState();
}

export async function disconnectDiscord(): Promise<DiscordState> {
  closeGateway();
  gatewayStatus = 'off';
  gatewayProblem = null;
  artworkCache.clear();
  await chrome.storage.local.remove([ACCOUNT_KEY]);
  return discordState();
}

/**
 * Runs inside the discord.com tab's MAIN world to read the user's Discord token.
 * Combines BitChord's same-origin iframe localStorage trick with a webpackChunkdiscord_app
 * fallback in case the Discord web app has already deleted `localStorage.token`.
 */
function readTokenFromDiscordPage(): string {
  try {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    document.body.appendChild(frame);
    const raw = frame.contentWindow?.localStorage.getItem('token') ?? null;
    frame.remove();
    if (raw) {
      const cleaned = raw.replace(/^"|"$/g, '').trim();
      if (cleaned.length > 20) return cleaned;
    }
  } catch {}

  try {
    const wp = (window as any).webpackChunkdiscord_app;
    if (Array.isArray(wp)) {
      let found = '';
      wp.push([
        [Symbol()],
        {},
        (req: any) => {
          for (const mod of Object.values(req?.c || {})) {
            try {
              const exp = (mod as any)?.exports;
              const t =
                exp?.default?.getToken?.() ||
                exp?.getToken?.() ||
                exp?.Z?.getToken?.() ||
                exp?.ZP?.getToken?.();
              if (typeof t === 'string' && t.length > 20) {
                found = t;
                break;
              }
            } catch {}
          }
        }
      ]);
      wp.pop();
      if (found) return found;
    }
  } catch {}

  return '';
}

/**
 * BitChord's `connectFromTab`: reads the Discord session from an open discord.com tab
 * (or opens https://discord.com/app if none is open) and verifies it via /users/@me.
 */
export async function connectDiscordFromTab(): Promise<DiscordState> {
  const tabs = await chrome.tabs.query({
    url: ['https://discord.com/*', 'https://*.discord.com/*']
  });
  let tab = tabs[0];
  let openedNewTab = false;

  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: 'https://discord.com/app', active: true });
    openedNewTab = true;
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: readTokenFromDiscordPage,
        world: 'MAIN'
      });
      const token = typeof results?.[0]?.result === 'string' ? results[0].result : '';
      if (token) {
        const user = await userInfo(token);
        await chrome.storage.local.set({
          [ACCOUNT_KEY]: { token, user } satisfies Account,
          [ENABLED_KEY]: true
        });
        gatewayProblem = null;
        if (openedNewTab && tab.id) {
          await chrome.tabs.remove(tab.id).catch(() => undefined);
        }
        // Immediately connect the gateway so status transitions to 'ready'
        ensureGateway(token).connect();
        return discordState();
      }
    } catch {
      // Tab still loading or navigating through login
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error('Could not find an active Discord session. Make sure you are signed in at discord.com and try again.');
}
