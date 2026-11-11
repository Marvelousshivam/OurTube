import { create } from 'zustand';
import { PlayerStyle } from '../types';
import { PaletteStyle, AppPalette, APP_PALETTES, applyPaletteTheme } from '../theme/ColorPalettes';
import { usePlayerStore } from './playerStore';
import { useTasteStore } from './tasteStore';

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
  bottomEqualizer: boolean;

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
  discordConnected: boolean;
  discordGateway: 'off' | 'connecting' | 'ready' | 'error';
  discordProblem: string | null;
  discordActivityType: 'listening' | 'playing' | 'watching' | 'competing';
  discordOnlineStatus: 'online' | 'idle' | 'dnd' | 'invisible';
  discordActivityName: string;
  discordUseDetails: boolean;
  discordButton1Visible: boolean;
  discordButton1Text: string;
  discordButton2Visible: boolean;
  discordButton2Text: string;

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
  setBottomEqualizer: (enabled: boolean) => void;

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
  setDiscordConnected: (connected: boolean) => void;
  setDiscordGateway: (gateway: 'off' | 'connecting' | 'ready' | 'error', problem?: string | null) => void;
  setDiscordActivityType: (type: 'listening' | 'playing' | 'watching' | 'competing') => void;
  setDiscordOnlineStatus: (status: 'online' | 'idle' | 'dnd' | 'invisible') => void;
  setDiscordActivityName: (name: string) => void;
  setDiscordUseDetails: (useDetails: boolean) => void;
  setDiscordButton1Visible: (visible: boolean) => void;
  setDiscordButton1Text: (text: string) => void;
  setDiscordButton2Visible: (visible: boolean) => void;
  setDiscordButton2Text: (text: string) => void;

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
  bottomEqualizer: localStorage.getItem('koda_bottom_equalizer') !== 'false',

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
  discordStatus: getStored<boolean>('koda_discord_rpc_enabled', true) ? 'idle' : 'disconnected',
  discordUser: null,
  discordConnected: false,
  discordGateway: 'off',
  discordProblem: null,
  discordActivityType: getStored<'listening' | 'playing' | 'watching' | 'competing'>('ourtube_discord_activity_type', 'listening'),
  discordOnlineStatus: getStored<'online' | 'idle' | 'dnd' | 'invisible'>('ourtube_discord_online_status', 'online'),
  discordActivityName: getStored<string>('ourtube_discord_activity_name', 'OurTube'),
  discordUseDetails: getStored<boolean>('ourtube_discord_use_details', false),
  discordButton1Visible: getStored<boolean>('ourtube_discord_btn1_vis', true),
  discordButton1Text: getStored<string>('ourtube_discord_btn1_text', 'Listen on YouTube Music'),
  discordButton2Visible: getStored<boolean>('ourtube_discord_btn2_vis', true),
  discordButton2Text: getStored<string>('ourtube_discord_btn2_text', 'Visit OurTube'),

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
    const isDark =
      themeMode === 'dark' ||
      themeMode === 'amoled' ||
      (themeMode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyPaletteTheme(pal, isDark, paletteStyle);
  },

  setPaletteStyle: (style: PaletteStyle) => {
    localStorage.setItem('koda_palette_style', style);
    set({ paletteStyle: style });
    const { selectedPaletteId, themeMode } = get();
    const pal = APP_PALETTES.find((p) => p.id === selectedPaletteId) || APP_PALETTES[0];
    const isDark =
      themeMode === 'dark' ||
      themeMode === 'amoled' ||
      (themeMode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
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
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-reduce-motion', String(reduce));
    }
  },

  setBottomEqualizer: (enabled: boolean) => {
    localStorage.setItem('koda_bottom_equalizer', String(enabled));
    set({ bottomEqualizer: enabled });
  },

  // Playback Actions
  setAudioQuality: (quality: AudioStreamQuality) => {
    setStored('koda_audio_quality', quality);
    set({ audioQuality: quality });
  },

  setVideoQuality: (quality: 'auto' | '1080p' | '720p' | '480p') => {
    setStored('koda_video_quality', quality);
    set({ videoQuality: quality });
    usePlayerStore.getState().setVideoQuality(quality);
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
    if (usePlayerStore.getState().autoplay !== enabled) {
      usePlayerStore.getState().toggleAutoplay();
    }
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
    set({ discordRpcEnabled: enabled, discordStatus: enabled ? 'idle' : 'disconnected' });
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

  setDiscordConnected: (connected: boolean) => {
    set({ discordConnected: connected });
  },

  setDiscordGateway: (gateway: 'off' | 'connecting' | 'ready' | 'error', problem: string | null = null) => {
    set({ discordGateway: gateway, discordProblem: problem });
  },

  setDiscordActivityType: (type: 'listening' | 'playing' | 'watching' | 'competing') => {
    setStored('ourtube_discord_activity_type', type);
    set({ discordActivityType: type });
  },

  setDiscordOnlineStatus: (status: 'online' | 'idle' | 'dnd' | 'invisible') => {
    setStored('ourtube_discord_online_status', status);
    set({ discordOnlineStatus: status });
  },

  setDiscordActivityName: (name: string) => {
    setStored('ourtube_discord_activity_name', name);
    set({ discordActivityName: name });
  },

  setDiscordUseDetails: (useDetails: boolean) => {
    setStored('ourtube_discord_use_details', useDetails);
    set({ discordUseDetails: useDetails });
  },

  setDiscordButton1Visible: (visible: boolean) => {
    setStored('ourtube_discord_btn1_vis', visible);
    set({ discordButton1Visible: visible });
  },

  setDiscordButton1Text: (text: string) => {
    setStored('ourtube_discord_btn1_text', text);
    set({ discordButton1Text: text });
  },

  setDiscordButton2Visible: (visible: boolean) => {
    setStored('ourtube_discord_btn2_vis', visible);
    set({ discordButton2Visible: visible });
  },

  setDiscordButton2Text: (text: string) => {
    setStored('ourtube_discord_btn2_text', text);
    set({ discordButton2Text: text });
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
    if (typeof window !== 'undefined') {
      (window as any).__koda_incognito_session = incognito;
    }
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
      const tasteState = useTasteStore.getState();
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        taste: {
          likedTracks: tasteState.likedTracks,
          history: tasteState.history,
          savedPlaylists: tasteState.savedPlaylists,
          followedArtists: tasteState.followedArtists,
          subscribedChannels: tasteState.subscribedChannels,
          likedVideos: tasteState.likedVideos,
          pickedArtists: tasteState.pickedArtists,
          pickedGenres: tasteState.pickedGenres,
          deckVerdicts: tasteState.deckVerdicts
        },
        settings: {
          themeMode: get().themeMode,
          selectedPaletteId: get().selectedPaletteId,
          paletteStyle: get().paletteStyle,
          playerStyle: get().playerStyle,
          audioQuality: get().audioQuality,
          videoQuality: get().videoQuality,
          crossfadeEnabled: get().crossfadeEnabled,
          crossfadeDuration: get().crossfadeDuration,
          autoLoadQueue: get().autoLoadQueue,
          saveListeningHistory: get().saveListeningHistory,
          audioNormalization: get().audioNormalization,
          homeLayoutMode: get().homeLayoutMode,
          filterExplicit: get().filterExplicit
        }
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
        await useTasteStore.getState().importTasteData(parsed.taste);
      } else if (Array.isArray(parsed.liked)) {
        await useTasteStore.getState().importTasteData({ likedTracks: parsed.liked });
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        const s = parsed.settings;
        if (s.themeMode) get().setThemeMode(s.themeMode);
        if (s.selectedPaletteId) get().setSelectedPaletteId(s.selectedPaletteId);
        if (s.paletteStyle) get().setPaletteStyle(s.paletteStyle);
        if (s.playerStyle) get().setPlayerStyle(s.playerStyle);
        if (s.audioQuality) get().setAudioQuality(s.audioQuality);
        if (s.videoQuality) get().setVideoQuality(s.videoQuality);
        if (typeof s.crossfadeEnabled === 'boolean') get().setCrossfadeEnabled(s.crossfadeEnabled);
        if (typeof s.crossfadeDuration === 'number') get().setCrossfadeDuration(s.crossfadeDuration);
        if (typeof s.autoLoadQueue === 'boolean') get().setAutoLoadQueue(s.autoLoadQueue);
        if (typeof s.saveListeningHistory === 'boolean') get().setSaveListeningHistory(s.saveListeningHistory);
        if (typeof s.audioNormalization === 'boolean') get().setAudioNormalization(s.audioNormalization);
        if (s.homeLayoutMode) get().setHomeLayoutMode(s.homeLayoutMode);
        if (typeof s.filterExplicit === 'boolean') get().setFilterExplicit(s.filterExplicit);
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
