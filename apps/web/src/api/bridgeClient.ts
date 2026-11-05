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
  private pendingRequests: Map<string, { resolve: (res: any) => void; reject: (err: any) => void }> = new Map();
  private authState: AuthState = loadCachedAuth();
  private listeners: Set<(available: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleWindowMessage.bind(this));
      // Ping immediately to check if extension is already loaded
      this.pingBridge();
    }
  }

  public onAvailabilityChange(callback: (available: boolean) => void): () => void {
    this.listeners.add(callback);
    callback(this.isAvailable);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getIsAvailable(): boolean {
    return this.isAvailable;
  }

  public getAuthState(): AuthState {
    return this.authState;
  }

  private handleWindowMessage(event: MessageEvent) {
    if (event.source !== window || !event.data) return;

    if (event.data.channel === 'KODA_BRIDGE_READY') {
      console.log('[OurTube Web] Companion extension bridge detected!');
      this.isAvailable = true;
      this.listeners.forEach((fn) => fn(true));
      this.refreshAuth();
      return;
    }

    if (event.data.channel === 'KODA_BRIDGE_RES') {
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

  private async pingBridge() {
    try {
      const res = await this.sendRequest('KODA_BRIDGE_PING', {}, 1500);
      if (res) {
        this.isAvailable = true;
        this.listeners.forEach((fn) => fn(true));
        this.refreshAuth();
      }
    } catch {
      // Extension not present yet, listener will pick it up on injection
    }
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
    // Immediately update optimistic state
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

    if (this.isAvailable) {
      try {
        const auth = await this.sendRequest<AuthState>('KODA_BRIDGE_SELECT_ACCOUNT', { channelId });
        if (auth && auth.accounts && auth.accounts.length > 0) {
          this.authState = auth;
          saveCachedAuth(auth);
        }
      } catch (err) {
        console.warn('[OurTube Web] Bridge account select failed:', err);
      }
    }
    return this.authState;
  }

  public async sendRequest<T = any>(
    type: BridgeMessageType,
    payload: any = {},
    timeoutMs: number = 10000
  ): Promise<T> {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Bridge request ${type} timed out after ${timeoutMs}ms`));
        }
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
        channel: 'KODA_BRIDGE_REQ',
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

  public async resolveStream(req: StreamResolutionRequest): Promise<StreamResolutionResponse> {
    if (!this.isAvailable) {
      // Fallback for demonstration / guest preview when extension is not installed
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
