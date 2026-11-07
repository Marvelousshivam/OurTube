import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';
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
  } | null;
  options: {
    showElapsed: boolean;
    showArtwork: boolean;
    showButtons: boolean;
    incognito: boolean;
  };
}

class DiscordPresenceManager {
  private timer: any = null;
  private lastSentKey: string | null = null;
  private isUnsubscribed: (() => void) | null = null;

  public init() {
    if (typeof window === 'undefined') return;

    // Subscribe to player store changes
    const unsubPlayer = usePlayerStore.subscribe((state, prevState) => {
      const settings = useSettingsStore.getState();
      if (!settings.discordRpcEnabled || settings.discordIncognito) {
        this.clearPresence();
        return;
      }

      // Check for playback state changes or track changes
      const trackChanged = state.currentTrack?.id !== prevState.currentTrack?.id;
      const playStateChanged = state.isPlaying !== prevState.isPlaying;

      if (trackChanged || playStateChanged) {
        this.schedulePublish(trackChanged);
      }
    });

    // Subscribe to settings changes
    const unsubSettings = useSettingsStore.subscribe((state, prevState) => {
      if (
        state.discordRpcEnabled !== prevState.discordRpcEnabled ||
        state.discordIncognito !== prevState.discordIncognito ||
        state.discordShowElapsed !== prevState.discordShowElapsed ||
        state.discordShowArtwork !== prevState.discordShowArtwork ||
        state.discordShowButtons !== prevState.discordShowButtons
      ) {
        if (!state.discordRpcEnabled || state.discordIncognito) {
          this.clearPresence();
        } else {
          this.schedulePublish(true);
        }
      }
    });

    this.isUnsubscribed = () => {
      unsubPlayer();
      unsubSettings();
    };

    // Initial broadcast if already playing
    this.schedulePublish(true);
  }

  public destroy() {
    if (this.timer) clearTimeout(this.timer);
    if (this.isUnsubscribed) this.isUnsubscribed();
    this.clearPresence();
  }

  private schedulePublish(force: boolean = false) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.publishPresence(force);
    }, 400);
  }

  private publishPresence(force: boolean = false) {
    const { currentTrack, isPlaying, currentTime, duration } = usePlayerStore.getState();
    const settings = useSettingsStore.getState();

    if (!settings.discordRpcEnabled || settings.discordIncognito || !isPlaying || !currentTrack) {
      this.clearPresence();
      return;
    }

    const payload: DiscordActivityPayload = {
      track: {
        videoId: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || null,
        artworkUrl: currentTrack.thumbnailUrl ? sizedArtwork(currentTrack.thumbnailUrl, 480) : null,
        positionMs: Math.round(currentTime * 1000),
        durationMs: Math.round((duration || 210) * 1000)
      },
      options: {
        showElapsed: settings.discordShowElapsed,
        showArtwork: settings.discordShowArtwork,
        showButtons: settings.discordShowButtons,
        incognito: settings.discordIncognito
      }
    };

    const key = `${currentTrack.id}_${isPlaying}_${JSON.stringify(payload.options)}`;
    if (!force && this.lastSentKey === key) return;
    this.lastSentKey = key;

    // Send payload to companion bridge if connected
    if (bridgeClient.getIsAvailable()) {
      try {
        bridgeClient
          .sendRequest('KODA_BRIDGE_DISCORD', payload)
          .then(() => {
            settings.setDiscordStatus('broadcasting');
          })
          .catch(() => {
            settings.setDiscordStatus('idle');
          });
      } catch (err) {
        settings.setDiscordStatus('idle');
      }
    } else {
      settings.setDiscordStatus('idle');
    }
  }

  private clearPresence() {
    if (this.lastSentKey === 'cleared') return;
    this.lastSentKey = 'cleared';

    if (bridgeClient.getIsAvailable()) {
      try {
        bridgeClient
          .sendRequest('KODA_BRIDGE_DISCORD' as any, { track: null, options: {} })
          .catch(() => {});
      } catch {}
    }

    const settings = useSettingsStore.getState();
    if (settings.discordIncognito) {
      settings.setDiscordStatus('idle');
    } else if (!settings.discordRpcEnabled) {
      settings.setDiscordStatus('disconnected');
    } else {
      settings.setDiscordStatus('idle');
    }
  }
}

export const discordPresenceManager = new DiscordPresenceManager();
