/**
 * Reports played tracks to the user's YouTube Music listening history
 * (`playbackTracking.videostatsPlaybackUrl`), matching official WEB_REMIX
 * behavior so:
 * 1. Songs played in OurTube appear in `FEmusic_history` and train the user's
 *    recommendations / Supermix.
 * 2. Signed session traffic looks like a normal listening client (instead of
 *    browsing without ever reporting plays).
 *
 * Respects `settingsStore.incognitoSession` ("Do not log listening history or
 * update YouTube Music recommendations"). Stream resolution and googlevideo
 * bytes remain 100% anonymous.
 */
import { bridgeClient } from './bridgeClient';
import { usePlayerStore } from '../store/playerStore';
import { useSettingsStore } from '../store/settingsStore';

const REPORT_DELAY_MS = 3500;
const CPN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function generateCpn(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += CPN_ALPHABET[bytes[i] & 63];
  }
  return out;
}

class PlaybackReportingManager {
  private initialized = false;
  private lastReportedVideoId: string | null = null;
  private pendingTimer: number | null = null;

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    usePlayerStore.subscribe((state, prevState) => {
      const videoId = state.currentTrack?.id || state.currentVideo?.id || null;
      const prevVideoId = prevState.currentTrack?.id || prevState.currentVideo?.id || null;

      if (videoId !== prevVideoId) {
        this.clearPending();
      }

      if (!videoId || !state.isPlaying) {
        this.clearPending();
        return;
      }

      if (videoId === this.lastReportedVideoId || this.pendingTimer !== null) {
        return;
      }

      this.pendingTimer = window.setTimeout(() => {
        this.pendingTimer = null;
        const current = usePlayerStore.getState();
        const activeId = current.currentTrack?.id || current.currentVideo?.id || null;
        if (current.isPlaying && activeId === videoId) {
          this.reportPlay(videoId).catch(() => {});
        }
      }, REPORT_DELAY_MS);
    });
  }

  private clearPending(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private async reportPlay(videoId: string): Promise<void> {
    if (useSettingsStore.getState().incognitoSession) return;
    if (!bridgeClient.getIsAvailable()) return;
    if (!bridgeClient.getAuthState()?.isAuthenticated) return;

    this.lastReportedVideoId = videoId;

    const playerRes = await bridgeClient.fetchInnertube({
      url: 'https://music.youtube.com/youtubei/v1/player?prettyPrint=false',
      method: 'POST',
      body: {
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
      }
    });

    const data =
      typeof playerRes?.data === 'string' ? JSON.parse(playerRes.data) : playerRes?.data;
    const rawPlaybackUrl: string | undefined =
      data?.playbackTracking?.videostatsPlaybackUrl?.baseUrl;
    if (!rawPlaybackUrl) return;

    const trackingUrl = new URL(rawPlaybackUrl);
    // Route through music.youtube.com so our signed proxy allowlist accepts it
    trackingUrl.hostname = 'music.youtube.com';
    trackingUrl.searchParams.set('ver', '2');
    trackingUrl.searchParams.set('c', 'WEB_REMIX');
    trackingUrl.searchParams.set('cpn', generateCpn());
    trackingUrl.searchParams.set('cmt', '0');

    await bridgeClient.fetchInnertube({
      url: trackingUrl.toString(),
      method: 'GET'
    });
  }
}

export const playbackReportingManager = new PlaybackReportingManager();
