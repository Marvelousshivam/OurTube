import {
  BridgeRequest,
  BridgeResponse,
  BridgeMessageType,
  AuthState,
  FetchRequestPayload,
  FetchResponsePayload,
  LyricsFetchRequestPayload,
  LyricsFetchResponsePayload,
  StreamResolutionRequest,
  StreamResolutionResponse,
  YtAccount,
  YtChannel
} from '@koda/bridge-types';
import { isDesktopApp } from './desktop';
import { handleDesktopRequest } from './desktopBridge';

export type ExtensionConnectionState = 'checking' | 'missing' | 'connected';

const INITIAL_AUTH_STATE: AuthState = {
  isAuthenticated: false,
  accounts: [],
  selectedChannelId: null,
  selectedChannel: null
};

function sanitizeAuthState(state: AuthState): AuthState {
  if (!state) return INITIAL_AUTH_STATE;
  // Never allow raw session secrets or cookies to exist in the web app context or localStorage
  const raw = state as unknown as Record<string, unknown>;
  delete raw.sapisid;
  delete raw.sapisidHash;
  delete raw.cookies;

  if (!state.accounts) return state;
  for (const acc of state.accounts) {
    if (acc.channels) {
      for (const ch of acc.channels) {
        // Strip out any leaked Google Account Gaia IDs that were mistakenly treated as brand pageIds
        if (ch.pageId && (ch.pageId.length > 15 || ch.pageId === 'undefined')) {
          ch.pageId = null;
          ch.brand = false;
          ch.id = `${ch.authUser}:own`;
        }
      }
    }
  }
  if (state.selectedChannel && state.selectedChannel.pageId && (state.selectedChannel.pageId.length > 15 || state.selectedChannel.pageId === 'undefined')) {
    state.selectedChannel.pageId = null;
    state.selectedChannel.brand = false;
    state.selectedChannel.id = `${state.selectedChannel.authUser}:own`;
    state.selectedChannelId = state.selectedChannel.id;
  }
  return state;
}

function loadCachedAuth(): AuthState {
  if (typeof window === 'undefined') return INITIAL_AUTH_STATE;
  try {
    const cached = localStorage.getItem('ourtube_auth_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      const hadLeakedSecrets = Boolean(parsed?.sapisid || parsed?.sapisidHash || parsed?.cookies);
      if (parsed && Array.isArray(parsed.accounts)) {
        // Filter out legacy placeholder or duplicate avatar-less entries when a full account entry exists
        parsed.accounts = parsed.accounts.filter(
          (a: YtAccount, idx: number, arr: YtAccount[]) =>
            a.email !== 'account2@gmail.com' &&
            a.name !== 'Secondary Google Account' &&
            !(
              !a.avatarUrl &&
              a.email &&
              arr.some((other, oIdx) => oIdx !== idx && other.email === a.email && Boolean(other.avatarUrl))
            )
        );
        const cleaned = sanitizeAuthState(parsed);
        if (hadLeakedSecrets) {
          saveCachedAuth(cleaned);
        }
        if (cleaned.accounts.length > 0) {
          return cleaned;
        }
      }
    }
  } catch {
    // fallback
  }
  return INITIAL_AUTH_STATE;
}

function saveCachedAuth(state: AuthState) {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = sanitizeAuthState({ ...state });
    localStorage.setItem('ourtube_auth_cache', JSON.stringify(cleaned));
  } catch {
    // ignore
  }
}

class BridgeClient {
  private isAvailable: boolean = false;
  private connectionState: ExtensionConnectionState = 'checking';
  private pendingRequests: Map<string, { resolve: (res: any) => void; reject: (err: any) => void }> = new Map();
  private authState: AuthState = loadCachedAuth();
  private listeners: Set<(available: boolean) => void> = new Set();
  private stateListeners: Set<(state: ExtensionConnectionState) => void> = new Set();
  private accountListeners: Set<(auth: AuthState) => void> = new Set();
  private pollTimer: number | null = null;
  private checkGraceTimer: number | null = null;
  private isDesktop: boolean = isDesktopApp();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleWindowMessage.bind(this));
      
      // Reactive re-check when the user switches tabs back from chrome://extensions
      window.addEventListener('focus', () => {
        if (!this.isAvailable) {
          this.pingBridge();
        }
      });

      // Inside the Tauri desktop shell the bridge is native and always ready
      if (this.isDesktop) {
        this.markConnected();
      } else {
        // Initial ping
        this.pingBridge();
      }

      // Grace period before flipping from 'checking' to 'missing'
      this.checkGraceTimer = window.setTimeout(() => {
        if (!this.isAvailable && this.connectionState === 'checking') {
          this.setConnectionState('missing');
          this.startPolling();
        }
      }, 750);
    }
  }

  public onAvailabilityChange(callback: (available: boolean) => void): () => void {
    this.listeners.add(callback);
    callback(this.isAvailable);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public onStateChange(callback: (state: ExtensionConnectionState) => void): () => void {
    this.stateListeners.add(callback);
    callback(this.connectionState);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  public onAccountChange(callback: (auth: AuthState) => void): () => void {
    this.accountListeners.add(callback);
    callback(this.authState);
    return () => {
      this.accountListeners.delete(callback);
    };
  }

  private notifyAccountChange() {
    this.accountListeners.forEach((cb) => {
      try {
        cb(this.authState);
      } catch (err) {
        console.warn('[BridgeClient] Error in account listener:', err);
      }
    });
  }

  public getIsAvailable(): boolean {
    return this.isAvailable;
  }

  public getConnectionState(): ExtensionConnectionState {
    return this.connectionState;
  }

  public getAuthState(): AuthState {
    return this.authState;
  }

  private setConnectionState(newState: ExtensionConnectionState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.stateListeners.forEach((fn) => fn(newState));
    }
  }

  private handleWindowMessage(event: MessageEvent) {
    if (event.source !== window || !event.data) return;

    if (
      event.data.channel === 'OURTUBE_BRIDGE_READY' ||
      event.data.channel === 'KODA_BRIDGE_READY'
    ) {
      console.log('[OurTube Web] Companion extension bridge announced ready!');
      this.markConnected();
      return;
    }

    if (
      event.data.channel === 'OURTUBE_BRIDGE_RES' ||
      event.data.channel === 'KODA_BRIDGE_RES'
    ) {
      const res = event.data as BridgeResponse;
      const pending = this.pendingRequests.get(res.id);
      if (pending) {
        this.pendingRequests.delete(res.id);
        if (res.success) {
          pending.resolve(res.data);
        } else {
          pending.reject(new Error(res.error || 'Bridge call failed'));
        }
      }
    }
  }

  private markConnected() {
    this.isAvailable = true;
    this.setConnectionState('connected');
    this.stopPolling();
    if (this.checkGraceTimer) {
      clearTimeout(this.checkGraceTimer);
      this.checkGraceTimer = null;
    }
    this.listeners.forEach((fn) => fn(true));
    this.refreshAuth();
  }

  private startPolling() {
    if (this.pollTimer !== null) return;
    this.pollTimer = window.setInterval(() => {
      if (!this.isAvailable) {
        this.pingBridge();
      } else {
        this.stopPolling();
      }
    }, 2500);
  }

  private stopPolling() {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public async checkNow(): Promise<boolean> {
    return this.pingBridge();
  }

  private async pingBridge(): Promise<boolean> {
    try {
      const res = await this.sendRequest('KODA_BRIDGE_PING', {}, 1200);
      if (res) {
        this.markConnected();
        return true;
      }
    } catch {
      // not detected yet
    }
    return false;
  }

  public async refreshAuth(): Promise<AuthState> {
    if (!this.isAvailable) {
      return this.authState;
    }
    try {
      const prevChannelId = this.authState.selectedChannelId;
      const auth = await this.sendRequest<AuthState>('KODA_BRIDGE_GET_AUTH');
      if (auth && Array.isArray(auth.accounts)) {
        this.authState = sanitizeAuthState(auth);
        saveCachedAuth(this.authState);
        if (this.authState.selectedChannelId !== prevChannelId) {
          this.notifyAccountChange();
        }
      }
      return this.authState;
    } catch (err) {
      console.warn('[OurTube Web] Auth refresh error:', err);
      return this.authState;
    }
  }

  public async selectAccount(channelId: string): Promise<AuthState> {
    const allChannels = this.authState.accounts.flatMap((a) => a.channels);
    let targetChannel = allChannels.find((c) => c.id === channelId);
    if (!targetChannel) {
      const [authPrefix] = channelId.split(':');
      const matchingAccount = this.authState.accounts.find((a) => a.authUser === authPrefix);
      if (matchingAccount && matchingAccount.channels.length > 0) {
        targetChannel = matchingAccount.channels[0];
      }
    }

    if (targetChannel) {
      this.authState = {
        ...this.authState,
        selectedChannelId: channelId,
        selectedChannel: targetChannel
      };
      saveCachedAuth(this.authState);
    }

    if (!this.isAvailable) {
      this.notifyAccountChange();
      return this.authState;
    }

    try {
      const updatedAuth = await this.sendRequest<AuthState>('KODA_BRIDGE_SELECT_ACCOUNT', { channelId });
      if (updatedAuth && updatedAuth.accounts) {
        this.authState = updatedAuth;
        saveCachedAuth(updatedAuth);
      }
    } catch (err) {
      console.error('[OurTube Web] Account switch failed:', err);
    } finally {
      // Notify listeners strictly AFTER extension has persisted the new active identity
      this.notifyAccountChange();
    }
    return this.authState;
  }

  public async sendRequest<T = any>(type: BridgeMessageType, payload?: any, timeoutMs: number = 10000): Promise<T> {
    // Desktop (Tauri): bridge messages are answered natively, not by the extension
    if (this.isDesktop) {
      return handleDesktopRequest<T>(type as string, payload);
    }
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Bridge request timed out (${type})`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      const req: BridgeRequest = {
        channel: 'OURTUBE_BRIDGE_REQ',
        id,
        type,
        payload
      };

      window.postMessage(req, '*');
    });
  }

  public async fetchInnertube(payload: FetchRequestPayload): Promise<FetchResponsePayload> {
    if (!this.isAvailable) {
      throw new Error('Extension bridge not connected. Please install the OurTube Companion Extension.');
    }
    return this.sendRequest<FetchResponsePayload>('KODA_BRIDGE_FETCH', payload);
  }

  public async lyricsFetch(
    payload: LyricsFetchRequestPayload,
    timeoutMs: number = 15000
  ): Promise<LyricsFetchResponsePayload | null> {
    if (!this.isAvailable) {
      return null;
    }
    try {
      return await this.sendRequest<LyricsFetchResponsePayload>('KODA_BRIDGE_LYRICS_FETCH', payload, timeoutMs);
    } catch {
      return null;
    }
  }

  public async scrapeYouTubePage(url?: string): Promise<any> {
    if (!this.isAvailable) return null;
    try {
      return await this.sendRequest('KODA_BRIDGE_SCRAPE_HOME', { url }, 12000);
    } catch (err) {
      console.warn('[OurTube Web] Scrape page error:', err);
      return null;
    }
  }

  public async resolveStream(req: StreamResolutionRequest): Promise<StreamResolutionResponse> {
    if (!this.isAvailable) {
      return {
        audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`,
        videoUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
        videoQuality: '720p',
        audioBitrate: 160000
      };
    }
    return this.sendRequest<StreamResolutionResponse>('KODA_BRIDGE_STREAM_URL', req);
  }
}

export const bridgeClient = new BridgeClient();
