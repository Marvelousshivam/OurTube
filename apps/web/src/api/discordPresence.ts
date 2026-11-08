import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore, DiscordUser } from '../store/settingsStore';
import { sizedArtwork } from './artworkService';
import { bridgeClient } from './bridgeClient';

export interface DiscordActivityPayload {
  track: {
    videoId: string;
    title: string;
    artist: string;
    album: string | null;
    artworkUrl: string | null;
    positionMs: number;
    durationMs: number;
    playbackRate?: number;
  } | null;
  options: {
    activityType: 'listening' | 'playing' | 'watching' | 'competing';
    status: 'online' | 'idle' | 'dnd' | 'invisible';
    useDetails: boolean;
    activityName: string;
    showElapsed: boolean;
    showArtwork: boolean;
    showButtons: boolean;
    button1Visible: boolean;
    button1Text: string;
    button2Visible: boolean;
    button2Text: string;
    incognito: boolean;
  };
}

export interface ExtensionDiscordState {
  available: boolean;
  connected: boolean;
  enabled: boolean;
  user: DiscordUser | null;
  gateway: 'off' | 'connecting' | 'ready' | 'error';
  problem: string | null;
}

class DiscordPresenceManager {
  private timer: any = null;
  private lastSentKey: string | null = null;
  private isUnsubscribed: (() => void) | null = null;

  public init() {
    if (typeof window === 'undefined') return;

    const unsubAvail = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        this.refreshState();
        this.schedulePublish(true);
      }
    });

    if (bridgeClient.getIsAvailable()) {
      this.refreshState();
    }

    // Subscribe to player store changes (track, play/pause, and seek jumps)
    const unsubPlayer = usePlayerStore.subscribe((state, prevState) => {
      const settings = useSettingsStore.getState();
      if (!settings.discordRpcEnabled || settings.discordIncognito) {
        this.clearPresence();
        return;
      }

      const trackChanged = state.currentTrack?.id !== prevState.currentTrack?.id;
      const playStateChanged = state.isPlaying !== prevState.isPlaying;
      const seeked =
        state.isPlaying &&
        prevState.isPlaying &&
        Math.abs(state.currentTime - prevState.currentTime) > 2.5;

      if (trackChanged || playStateChanged || seeked) {
        this.schedulePublish(trackChanged || seeked || (!prevState.isPlaying && state.isPlaying));
      }
    });

    // Subscribe to settings changes
    const unsubSettings = useSettingsStore.subscribe((state, prevState) => {
      if (state.discordRpcEnabled !== prevState.discordRpcEnabled) {
        if (bridgeClient.getIsAvailable()) {
          bridgeClient
            .sendRequest('OURTUBE_BRIDGE_DISCORD_SET_ENABLED' as any, {
              enabled: state.discordRpcEnabled
            })
            .then((res) => this.adoptState(res))
            .catch(() => {});
        }
      }

      if (
        state.discordRpcEnabled !== prevState.discordRpcEnabled ||
        state.discordIncognito !== prevState.discordIncognito ||
        state.discordShowElapsed !== prevState.discordShowElapsed ||
        state.discordShowArtwork !== prevState.discordShowArtwork ||
        state.discordShowButtons !== prevState.discordShowButtons ||
        state.discordActivityType !== prevState.discordActivityType ||
        state.discordOnlineStatus !== prevState.discordOnlineStatus ||
        state.discordActivityName !== prevState.discordActivityName ||
        state.discordUseDetails !== prevState.discordUseDetails ||
        state.discordButton1Visible !== prevState.discordButton1Visible ||
        state.discordButton1Text !== prevState.discordButton1Text ||
        state.discordButton2Visible !== prevState.discordButton2Visible ||
        state.discordButton2Text !== prevState.discordButton2Text
      ) {
        if (!state.discordRpcEnabled || state.discordIncognito) {
          this.clearPresence();
        } else {
          this.schedulePublish(true);
        }
      }
    });

    this.isUnsubscribed = () => {
      unsubAvail();
      unsubPlayer();
      unsubSettings();
    };

    this.schedulePublish(true);
  }

  public destroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.isUnsubscribed) this.isUnsubscribed();
    this.clearPresence();
  }

  private adoptState(extState?: ExtensionDiscordState | null) {
    if (!extState || typeof extState.connected !== 'boolean') return;
    const settings = useSettingsStore.getState();
    settings.setDiscordConnected(extState.connected);
    settings.setDiscordUser(extState.user ?? null);
    settings.setDiscordGateway(extState.gateway || 'off', extState.problem ?? null);

    const { isPlaying, currentTrack } = usePlayerStore.getState();
    if (!extState.connected || !settings.discordRpcEnabled) {
      settings.setDiscordStatus('disconnected');
    } else if (extState.gateway === 'connecting') {
      settings.setDiscordStatus('connecting');
    } else if (isPlaying && currentTrack && !settings.discordIncognito) {
      settings.setDiscordStatus('broadcasting');
    } else {
      settings.setDiscordStatus('connected');
    }
  }

  public async refreshState(): Promise<ExtensionDiscordState | null> {
    if (!bridgeClient.getIsAvailable()) return null;
    try {
      const state = await bridgeClient.sendRequest<ExtensionDiscordState>(
        'OURTUBE_BRIDGE_DISCORD_STATE' as any
      );
      this.adoptState(state);
      return state;
    } catch {
      return null;
    }
  }

  public async connectAccount(): Promise<ExtensionDiscordState> {
    if (!bridgeClient.getIsAvailable()) {
      throw new Error('OurTube Companion Extension is not connected.');
    }
    const settings = useSettingsStore.getState();
    settings.setDiscordGateway('connecting', null);
    try {
      const state = await bridgeClient.sendRequest<ExtensionDiscordState>(
        'OURTUBE_BRIDGE_DISCORD_CONNECT' as any,
        {},
        95000
      );
      this.adoptState(state);
      this.schedulePublish(true);
      return state;
    } catch (err: any) {
      settings.setDiscordGateway('error', err?.message || 'Failed to connect Discord account.');
      throw err;
    }
  }

  public async disconnectAccount(): Promise<ExtensionDiscordState | null> {
    if (!bridgeClient.getIsAvailable()) return null;
    try {
      const state = await bridgeClient.sendRequest<ExtensionDiscordState>(
        'OURTUBE_BRIDGE_DISCORD_DISCONNECT' as any
      );
      this.adoptState(state);
      return state;
    } catch {
      return null;
    }
  }

  private schedulePublish(force: boolean = false) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.publishPresence(force);
    }, 400);
  }

  private buildOptions() {
    const s = useSettingsStore.getState();
    return {
      activityType: s.discordActivityType,
      status: s.discordOnlineStatus,
      useDetails: s.discordUseDetails,
      activityName: s.discordActivityName || 'OurTube',
      showElapsed: s.discordShowElapsed,
      showArtwork: s.discordShowArtwork,
      showButtons: s.discordShowButtons,
      button1Visible: s.discordButton1Visible,
      button1Text: s.discordButton1Text || 'Listen on YouTube Music',
      button2Visible: s.discordButton2Visible,
      button2Text: s.discordButton2Text || 'Visit OurTube',
      incognito: s.discordIncognito
    };
  }

  private publishPresence(force: boolean = false) {
    const { currentTrack, isPlaying, currentTime, duration } = usePlayerStore.getState();
    const settings = useSettingsStore.getState();

    if (!settings.discordRpcEnabled || settings.discordIncognito || !isPlaying || !currentTrack) {
      this.clearPresence();
      return;
    }

    const options = this.buildOptions();
    const payload: DiscordActivityPayload = {
      track: {
        videoId: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || null,
        artworkUrl: currentTrack.thumbnailUrl ? sizedArtwork(currentTrack.thumbnailUrl, 480) : null,
        positionMs: Math.round(currentTime * 1000),
        durationMs: Math.round((duration || 210) * 1000),
        playbackRate: 1
      },
      options
    };

    const key = `${currentTrack.id}_${isPlaying}_${JSON.stringify(options)}`;
    if (!force && this.lastSentKey === key) return;
    this.lastSentKey = key;

    if (bridgeClient.getIsAvailable()) {
      bridgeClient
        .sendRequest<ExtensionDiscordState>('OURTUBE_BRIDGE_DISCORD' as any, payload, 25000)
        .then((res) => {
          this.adoptState(res);
          if (res?.connected) {
            settings.setDiscordStatus('broadcasting');
          }
        })
        .catch(() => {
          settings.setDiscordStatus('idle');
        });
    } else {
      settings.setDiscordStatus('idle');
    }
  }

  private clearPresence() {
    if (this.lastSentKey === 'cleared') return;
    this.lastSentKey = 'cleared';

    if (bridgeClient.getIsAvailable()) {
      bridgeClient
        .sendRequest<ExtensionDiscordState>('OURTUBE_BRIDGE_DISCORD' as any, {
          track: null,
          options: this.buildOptions()
        })
        .then((res) => this.adoptState(res))
        .catch(() => {});
    }

    const settings = useSettingsStore.getState();
    if (settings.discordIncognito) {
      settings.setDiscordStatus('idle');
    } else if (!settings.discordRpcEnabled || !settings.discordConnected) {
      settings.setDiscordStatus('disconnected');
    } else {
      settings.setDiscordStatus('idle');
    }
  }
}

export const discordPresenceManager = new DiscordPresenceManager();
