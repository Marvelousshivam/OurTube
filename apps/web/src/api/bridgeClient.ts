import {
  BridgeRequest,
  BridgeResponse,
  BridgeMessageType,
  AuthState,
  FetchRequestPayload,
  FetchResponsePayload,
  StreamResolutionRequest,
  StreamResolutionResponse,
  YtAccount,
  YtChannel
} from '@koda/bridge-types';

export type ExtensionConnectionState = 'checking' | 'missing' | 'connected';

const INITIAL_PRIMARY_CHANNEL: YtChannel = {
  id: '0:own',
  name: 'Shivam Raj',
  handle: '@shivamraj6577',
  avatarUrl: null,
  brand: false,
  authUser: '0',
  pageId: null,
  selectedOnWeb: true
};

const INITIAL_SECONDARY_CHANNEL: YtChannel = {
  id: '1:own',
  name: 'Secondary Google Account',
  handle: '@google.account2',
  avatarUrl: null,
  brand: false,
  authUser: '1',
  pageId: null,
  selectedOnWeb: false
};

const INITIAL_AUTH_STATE: AuthState = {
  isAuthenticated: true,
  accounts: [
    {
      authUser: '0',
      name: 'Shivam Raj',
      email: 'shivamraj6577@gmail.com',
      avatarUrl: null,
      channels: [INITIAL_PRIMARY_CHANNEL]
    },
    {
      authUser: '1',
      name: 'Secondary Google Account',
      email: 'account2@gmail.com',
      avatarUrl: null,
      channels: [INITIAL_SECONDARY_CHANNEL]
    }
  ],
  selectedChannelId: '0:own',
  selectedChannel: INITIAL_PRIMARY_CHANNEL
};

function loadCachedAuth(): AuthState {
  if (typeof window === 'undefined') return INITIAL_AUTH_STATE;
  try {
    const cached = localStorage.getItem('ourtube_auth_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.accounts && parsed.accounts.length > 0) {
        return parsed;
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
    localStorage.setItem('ourtube_auth_cache', JSON.stringify(state));
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
  private pollTimer: number | null = null;
  private checkGraceTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleWindowMessage.bind(this));
      
      // Reactive re-check when the user switches tabs back from chrome://extensions
      window.addEventListener('focus', () => {
        if (!this.isAvailable) {
          this.pingBridge();
        }
      });

      // Initial ping
      this.pingBridge();

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
      const auth = await this.sendRequest<AuthState>('KODA_BRIDGE_GET_AUTH');
      if (auth && auth.accounts && auth.accounts.length > 0) {
        this.authState = auth;
        saveCachedAuth(auth);
      }
      return this.authState;
    } catch (err) {
      console.warn('[OurTube Web] Auth refresh error:', err);
      return this.authState;
    }
  }

  public async selectAccount(channelId: string): Promise<AuthState> {
    const allChannels = this.authState.accounts.flatMap((a) => a.channels);
    const targetChannel = allChannels.find((c) => c.id === channelId);
    if (targetChannel) {
      this.authState = {
        ...this.authState,
        selectedChannelId: channelId,
        selectedChannel: targetChannel
      };
      saveCachedAuth(this.authState);
    }

    if (!this.isAvailable) {
      return this.authState;
    }

    try {
      const updatedAuth = await this.sendRequest<AuthState>('KODA_BRIDGE_SELECT_ACCOUNT', { channelId });
      if (updatedAuth && updatedAuth.accounts) {
        this.authState = updatedAuth;
        saveCachedAuth(updatedAuth);
      }
      return this.authState;
    } catch (err) {
      console.error('[OurTube Web] Account switch failed:', err);
      return this.authState;
    }
  }

  public async sendRequest<T = any>(type: BridgeMessageType, payload?: any, timeoutMs: number = 10000): Promise<T> {
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
      // Also send KODA_BRIDGE_REQ for older content script compatibility
      window.postMessage({ ...req, channel: 'KODA_BRIDGE_REQ' }, '*');
    });
  }

  public async fetchInnertube(payload: FetchRequestPayload): Promise<FetchResponsePayload> {
    if (!this.isAvailable) {
      throw new Error('Extension bridge not connected. Please install the OurTube Companion Extension.');
    }
    return this.sendRequest<FetchResponsePayload>('KODA_BRIDGE_FETCH', payload);
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
