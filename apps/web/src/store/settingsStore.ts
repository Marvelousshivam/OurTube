import { create } from 'zustand';
import { PlayerStyle } from '../types';
import { PaletteStyle, AppPalette, APP_PALETTES, applyPaletteTheme } from '../theme/ColorPalettes';
import { usePlayerStore } from './playerStore';

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';
export type AudioStreamQuality = 'high' | 'normal' | 'saver';
export type HomeLayoutMode = 'spotlight' | 'classic';
export type DiscordStatus = 'disconnected' | 'connecting' | 'connected' | 'broadcasting' | 'idle';

export interface DiscordUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface SettingsState {
  // Appearance
  themeMode: ThemeMode;
  selectedPaletteId: string;
  paletteStyle: PaletteStyle;
  playerStyle: PlayerStyle;
  ambientBackground: boolean;
  ambientIntensity: number; // 0.2 to 1.0
  reduceMotion: boolean;

  // Playback & Audio Quality
  audioQuality: AudioStreamQuality;
  videoQuality: 'auto' | '1080p' | '720p' | '480p';
  crossfadeEnabled: boolean;
  crossfadeDuration: number; // in seconds, 1 to 12
  autoLoadQueue: boolean;
  saveListeningHistory: boolean;
  audioNormalization: boolean;

  // Discord Rich Presence
  discordRpcEnabled: boolean;
  discordShowElapsed: boolean;
  discordShowArtwork: boolean;
  discordShowButtons: boolean;
  discordIncognito: boolean;
  discordStatus: DiscordStatus;
  discordUser: DiscordUser | null;

  // Content & Identity
  homeLayoutMode: HomeLayoutMode;
  filterExplicit: boolean;
  incognitoSession: boolean;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  setSelectedPaletteId: (paletteId: string) => void;
  setPaletteStyle: (style: PaletteStyle) => void;
  setPlayerStyle: (style: PlayerStyle) => void;
  setAmbientBackground: (enabled: boolean) => void;
  setAmbientIntensity: (intensity: number) => void;
  setReduceMotion: (reduce: boolean) => void;

  setAudioQuality: (quality: AudioStreamQuality) => void;
  setVideoQuality: (quality: 'auto' | '1080p' | '720p' | '480p') => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (seconds: number) => void;
  setAutoLoadQueue: (enabled: boolean) => void;
  setSaveListeningHistory: (enabled: boolean) => void;
  setAudioNormalization: (enabled: boolean) => void;

  setDiscordRpcEnabled: (enabled: boolean) => void;
  setDiscordShowElapsed: (show: boolean) => void;
  setDiscordShowArtwork: (show: boolean) => void;
  setDiscordShowButtons: (show: boolean) => void;
  setDiscordIncognito: (incognito: boolean) => void;
  setDiscordStatus: (status: DiscordStatus) => void;
  setDiscordUser: (user: DiscordUser | null) => void;

  setHomeLayoutMode: (mode: HomeLayoutMode) => void;
  setFilterExplicit: (filter: boolean) => void;
  setIncognitoSession: (incognito: boolean) => void;

  getStorageEstimate: () => Promise<{ usedMb: string; quotaMb: string }>;
  clearLocalCache: () => Promise<boolean>;
  exportUserData: () => void;
  importUserData: (file: File) => Promise<boolean>;

  resetToDefaults: () => void;
}

const getStored = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    return JSON.parse(val);
  } catch {
    return fallback;
  }
};

const setStored = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[SettingsStore] Failed to store ${key}:`, err);
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Appearance Defaults
  themeMode: getStored<ThemeMode>('koda_theme_mode', 'dark'),
  selectedPaletteId: localStorage.getItem('koda_selected_palette') || 'electric',
  paletteStyle: (localStorage.getItem('koda_palette_style') as PaletteStyle) || 'TONAL_SPOT',
  playerStyle: (localStorage.getItem('koda_player_style') as PlayerStyle) || 'EDITORIAL',
  ambientBackground: localStorage.getItem('koda_ambient_bg') !== 'false',
  ambientIntensity: getStored<number>('koda_ambient_intensity', 0.8),
  reduceMotion: getStored<boolean>('koda_reduce_motion', false),

  // Playback Defaults
  audioQuality: getStored<AudioStreamQuality>('koda_audio_quality', 'high'),
  videoQuality: getStored<'auto' | '1080p' | '720p' | '480p'>('koda_video_quality', 'auto'),
  crossfadeEnabled: getStored<boolean>('koda_crossfade_enabled', true),
  crossfadeDuration: getStored<number>('koda_crossfade_duration', 3),
  autoLoadQueue: getStored<boolean>('koda_auto_load_queue', true),
  saveListeningHistory: getStored<boolean>('koda_save_history', true),
  audioNormalization: getStored<boolean>('koda_audio_normalization', false),

  // Discord Defaults
  discordRpcEnabled: getStored<boolean>('koda_discord_rpc_enabled', true),
  discordShowElapsed: getStored<boolean>('koda_discord_show_elapsed', true),
  discordShowArtwork: getStored<boolean>('koda_discord_show_artwork', true),
  discordShowButtons: getStored<boolean>('koda_discord_show_buttons', true),
  discordIncognito: getStored<boolean>('koda_discord_incognito', false),
  discordStatus: 'broadcasting',
  discordUser: {
    id: '1543679166967193620',
    name: 'Koda Listener',
    username: 'kodalistener',
    avatarUrl: null
  },

  // Content Defaults
  homeLayoutMode: getStored<HomeLayoutMode>('koda_home_layout', 'spotlight'),
  filterExplicit: getStored<boolean>('koda_filter_explicit', false),
  incognitoSession: false,

  // Appearance Actions
  setThemeMode: (mode: ThemeMode) => {
    setStored('koda_theme_mode', mode);
    set({ themeMode: mode });

    // Apply or remove amoled class on root document
    if (typeof document !== 'undefined') {
      if (mode === 'amoled') {
        document.documentElement.classList.add('amoled-mode');
      } else {
        document.documentElement.classList.remove('amoled-mode');
      }
    }

    // Re-apply current palette with new dark/light state
    const { selectedPaletteId, paletteStyle } = get();
    const pal = APP_PALETTES.find((p) => p.id === selectedPaletteId) || APP_PALETTES[0];
    const isDark = mode === 'dark' || mode === 'amoled' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyPaletteTheme(pal, isDark, paletteStyle);
  },

  setSelectedPaletteId: (paletteId: string) => {
    localStorage.setItem('koda_selected_palette', paletteId);
    set({ selectedPaletteId: paletteId });
    const { themeMode, paletteStyle } = get();
    const pal = APP_PALETTES.find((p) => p.id === paletteId) || APP_PALETTES[0];
    const isDark = themeMode !== 'light';
    applyPaletteTheme(pal, isDark, paletteStyle);
  },

  setPaletteStyle: (style: PaletteStyle) => {
    localStorage.setItem('koda_palette_style', style);
    set({ paletteStyle: style });
    const { selectedPaletteId, themeMode } = get();
    const pal = APP_PALETTES.find((p) => p.id === selectedPaletteId) || APP_PALETTES[0];
    const isDark = themeMode !== 'light';
    applyPaletteTheme(pal, isDark, style);
  },

  setPlayerStyle: (style: PlayerStyle) => {
    localStorage.setItem('koda_player_style', style);
    set({ playerStyle: style });
    usePlayerStore.getState().setPlayerStyle(style);
  },

  setAmbientBackground: (enabled: boolean) => {
    localStorage.setItem('koda_ambient_bg', String(enabled));
    set({ ambientBackground: enabled });
    usePlayerStore.getState().setAmbientBackground(enabled);
  },

  setAmbientIntensity: (intensity: number) => {
    setStored('koda_ambient_intensity', intensity);
    set({ ambientIntensity: intensity });
  },

  setReduceMotion: (reduce: boolean) => {
    setStored('koda_reduce_motion', reduce);
    set({ reduceMotion: reduce });
  },

  // Playback Actions
  setAudioQuality: (quality: AudioStreamQuality) => {
    setStored('koda_audio_quality', quality);
    set({ audioQuality: quality });
  },

  setVideoQuality: (quality: 'auto' | '1080p' | '720p' | '480p') => {
    setStored('koda_video_quality', quality);
    set({ videoQuality: quality });
  },

  setCrossfadeEnabled: (enabled: boolean) => {
    setStored('koda_crossfade_enabled', enabled);
    set({ crossfadeEnabled: enabled });
  },

  setCrossfadeDuration: (seconds: number) => {
    setStored('koda_crossfade_duration', seconds);
    set({ crossfadeDuration: seconds });
  },

  setAutoLoadQueue: (enabled: boolean) => {
    setStored('koda_auto_load_queue', enabled);
    set({ autoLoadQueue: enabled });
  },

  setSaveListeningHistory: (enabled: boolean) => {
    setStored('koda_save_history', enabled);
    set({ saveListeningHistory: enabled });
  },

  setAudioNormalization: (enabled: boolean) => {
    setStored('koda_audio_normalization', enabled);
    set({ audioNormalization: enabled });
  },

  // Discord Actions
  setDiscordRpcEnabled: (enabled: boolean) => {
    setStored('koda_discord_rpc_enabled', enabled);
    set({ discordRpcEnabled: enabled });
  },

  setDiscordShowElapsed: (show: boolean) => {
    setStored('koda_discord_show_elapsed', show);
    set({ discordShowElapsed: show });
  },

  setDiscordShowArtwork: (show: boolean) => {
    setStored('koda_discord_show_artwork', show);
    set({ discordShowArtwork: show });
  },

  setDiscordShowButtons: (show: boolean) => {
    setStored('koda_discord_show_buttons', show);
    set({ discordShowButtons: show });
  },

  setDiscordIncognito: (incognito: boolean) => {
    setStored('koda_discord_incognito', incognito);
    set({ discordIncognito: incognito });
  },

  setDiscordStatus: (status: DiscordStatus) => {
    set({ discordStatus: status });
  },

  setDiscordUser: (user: DiscordUser | null) => {
    set({ discordUser: user });
  },

  // Content Actions
  setHomeLayoutMode: (mode: HomeLayoutMode) => {
    setStored('koda_home_layout', mode);
    set({ homeLayoutMode: mode });
  },

  setFilterExplicit: (filter: boolean) => {
    setStored('koda_filter_explicit', filter);
    set({ filterExplicit: filter });
  },

  setIncognitoSession: (incognito: boolean) => {
    set({ incognitoSession: incognito });
  },

  getStorageEstimate: async (): Promise<{ usedMb: string; quotaMb: string }> => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const used = ((est.usage || 0) / (1024 * 1024)).toFixed(1);
        const quota = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
        return { usedMb: `${used} MB`, quotaMb: `${quota} MB` };
      } catch {
        // fallback
      }
    }
    return { usedMb: '1.2 MB', quotaMb: 'Available' };
  },

  clearLocalCache: async (): Promise<boolean> => {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      return true;
    } catch (err) {
      console.warn('[SettingsStore] Clear cache error:', err);
      return false;
    }
  },

  exportUserData: () => {
    try {
      const taste = localStorage.getItem('koda_taste_profile_v1');
      const liked = localStorage.getItem('koda_liked_tracks');
      const auth = localStorage.getItem('ourtube_auth_cache');
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        taste: taste ? JSON.parse(taste) : null,
        liked: liked ? JSON.parse(liked) : null,
        auth: auth ? JSON.parse(auth) : null
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ourtube-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('[SettingsStore] Export data failed:', err);
    }
  },

  importUserData: async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.taste) {
        localStorage.setItem('koda_taste_profile_v1', JSON.stringify(parsed.taste));
      }
      if (parsed.liked) {
        localStorage.setItem('koda_liked_tracks', JSON.stringify(parsed.liked));
      }
      return true;
    } catch (err) {
      console.warn('[SettingsStore] Import data failed:', err);
      return false;
    }
  },

  resetToDefaults: () => {
    if (typeof localStorage !== 'undefined') {
      const keys = [
        'koda_theme_mode',
        'koda_selected_palette',
        'koda_palette_style',
        'koda_player_style',
        'koda_ambient_bg',
        'koda_ambient_intensity',
        'koda_reduce_motion',
        'koda_audio_quality',
        'koda_video_quality',
        'koda_crossfade_enabled',
        'koda_crossfade_duration',
        'koda_auto_load_queue',
        'koda_save_history',
        'koda_audio_normalization',
        'koda_discord_rpc_enabled',
        'koda_discord_show_elapsed',
        'koda_discord_show_artwork',
        'koda_discord_show_buttons',
        'koda_discord_incognito',
        'koda_home_layout',
        'koda_filter_explicit'
      ];
      keys.forEach((k) => localStorage.removeItem(k));
    }
    // Re-apply default theme
    applyPaletteTheme(APP_PALETTES[0], true, 'TONAL_SPOT');
    window.location.reload();
  }
}));
