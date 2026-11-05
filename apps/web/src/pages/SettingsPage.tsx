import React, { useState, useEffect } from 'react';
import {
  useSettingsStore,
  ThemeMode,
  AudioStreamQuality,
  HomeLayoutMode
} from '../store/settingsStore';
import {
  SettingsCard,
  SettingsRow,
  SettingsToggleRow,
  SettingsChoiceRow,
  SettingsSliderRow,
  SettingsSectionHeader,
  SettingsDivider
} from '../components/settings/SettingsComponents';
import { DiscordPreviewCard } from '../components/settings/DiscordPreviewCard';
import { PlayerStyleGallery } from '../components/settings/PlayerStyleGallery';
import { PaletteStudio } from '../components/theme/PaletteStudio';
import { APP_PALETTES, PaletteStyle } from '../theme/ColorPalettes';
import { bridgeClient } from '../api/bridgeClient';
import { AuthState, YtChannel } from '../types';

export type SettingsTabId =
  | 'account'
  | 'appearance'
  | 'playback'
  | 'discord'
  | 'content'
  | 'storage'
  | 'about';

interface SettingsPageProps {
  onBack: () => void;
  initialTab?: SettingsTabId;
}

const CATEGORIES: { id: SettingsTabId; label: string; icon: string; getSubtitle: (s: any) => string }[] = [
  {
    id: 'account',
    label: 'Account & Identity',
    icon: 'account_circle',
    getSubtitle: (s) => (s.authState?.isAuthenticated ? s.authState.selectedChannel?.name || 'Connected' : 'Guest mode')
  },
  {
    id: 'appearance',
    label: 'Appearance & Customization',
    icon: 'palette',
    getSubtitle: (s) => `${capitalize(s.themeMode)} · ${s.paletteName || 'Dynamic'}`
  },
  {
    id: 'playback',
    label: 'Playback & Audio Quality',
    icon: 'graphic_eq',
    getSubtitle: (s) => `${s.audioQuality === 'high' ? 'High (256kbps)' : s.audioQuality === 'normal' ? 'Normal (128kbps)' : 'Data Saver'}`
  },
  {
    id: 'discord',
    label: 'Discord Rich Presence',
    icon: 'chat',
    getSubtitle: (s) => (s.discordRpcEnabled ? (s.discordIncognito ? 'Incognito' : 'Broadcasting active') : 'Disabled')
  },
  {
    id: 'content',
    label: 'Content & Feeds',
    icon: 'video_library',
    getSubtitle: (s) => `${capitalize(s.homeLayoutMode)} Home`
  },
  {
    id: 'storage',
    label: 'Storage & Cache',
    icon: 'folder',
    getSubtitle: (s) => s.cacheSize || '14.2 MB cached'
  },
  {
    id: 'about',
    label: 'System & Diagnostics',
    icon: 'info',
    getSubtitle: () => 'OurTube Web v4.4'
  }
];

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, initialTab = 'appearance' }) => {
  const settings = useSettingsStore();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [authState, setAuthState] = useState<AuthState>(bridgeClient.getAuthState());
  const [isPaletteStudioOpen, setIsPaletteStudioOpen] = useState(false);
  const [cacheClearedToast, setCacheClearedToast] = useState(false);
  const [cacheSize] = useState('14.2 MB cached');

  useEffect(() => {
    bridgeClient.refreshAuth().then(setAuthState);
    const unsub = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        bridgeClient.refreshAuth().then(setAuthState);
      }
    });
    return () => unsub();
  }, []);

  const currentPalette = APP_PALETTES.find((p) => p.id === settings.selectedPaletteId) || APP_PALETTES[0];

  const handleSelectChannel = async (channel: YtChannel) => {
    try {
      const newAuth = await bridgeClient.selectAccount(channel.id);
      setAuthState(newAuth);
    } catch (err) {
      console.warn('[SettingsPage] Error switching channel:', err);
    }
  };

  const handleClearCache = () => {
    setCacheClearedToast(true);
    setTimeout(() => setCacheClearedToast(false), 3000);
  };

  const currentSubtitleContext = {
    authState,
    themeMode: settings.themeMode,
    paletteName: currentPalette.name,
    audioQuality: settings.audioQuality,
    discordRpcEnabled: settings.discordRpcEnabled,
    discordIncognito: settings.discordIncognito,
    homeLayoutMode: settings.homeLayoutMode,
    cacheSize
  };

  // Filter categories by search
  const filteredCategories = CATEGORIES.filter(
    (c) =>
      c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.getSubtitle(currentSubtitleContext).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        gap: '24px'
      }}
    >
      {/* Top App Bar & Search Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--md-sys-color-outline-variant)'
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Settings
          </h1>
          <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            OurTube Experience Studio & Integrations
          </span>
        </div>

        {/* Search Pill Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            borderRadius: '9999px',
            padding: '8px 18px',
            border: '1px solid var(--md-sys-color-outline-variant)',
            width: '280px',
            maxWidth: '100%'
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '18px', color: 'var(--md-sys-color-outline)' }}>
            search
          </span>
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--md-sys-color-on-surface)',
              fontSize: '13px',
              width: '100%',
              fontWeight: 600
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--md-sys-color-outline)', cursor: 'pointer' }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                close
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Two-Pane Master-Detail Canvas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '28px',
          alignItems: 'start',
          flex: 1
        }}
        className="settings-canvas"
      >
        {/* Left Category Master Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SettingsSectionHeader title="Categories" />
          <SettingsCard>
            {filteredCategories.map((cat, idx) => {
              const isSelected = activeTab === cat.id;
              const subtitle = cat.getSubtitle(currentSubtitleContext);

              return (
                <React.Fragment key={cat.id}>
                  {idx > 0 && <SettingsDivider />}
                  <div
                    onClick={() => setActiveTab(cat.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-secondary-container)'
                        : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '12px',
                          backgroundColor: isSelected
                            ? 'var(--md-sys-color-primary)'
                            : 'var(--md-sys-color-surface-container-highest)',
                          color: isSelected
                            ? 'var(--md-sys-color-on-primary)'
                            : 'var(--md-sys-color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                          {cat.icon}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: isSelected ? 800 : 700,
                            color: isSelected
                              ? 'var(--md-sys-color-on-secondary-container)'
                              : 'var(--md-sys-color-on-surface)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {cat.label}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            color: isSelected
                              ? 'var(--md-sys-color-on-secondary-container)'
                              : 'var(--md-sys-color-outline)',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            opacity: isSelected ? 0.85 : 1
                          }}
                        >
                          {subtitle}
                        </span>
                      </div>
                    </div>

                    <span
                      className="material-symbols-rounded"
                      style={{
                        fontSize: '18px',
                        color: isSelected
                          ? 'var(--md-sys-color-on-secondary-container)'
                          : 'var(--md-sys-color-outline)'
                      }}
                    >
                      chevron_right
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </SettingsCard>

          {/* Quick Diagnostics Widget */}
          <div
            style={{
              marginTop: '12px',
              padding: '14px 18px',
              borderRadius: '20px',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: bridgeClient.getIsAvailable() ? '#4caf50' : '#ff9800',
                  boxShadow: bridgeClient.getIsAvailable() ? '0 0 8px #4caf50' : 'none'
                }}
              />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                {bridgeClient.getIsAvailable() ? 'Extension Bridge Active' : 'Guest Mode'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
              MV3
            </span>
          </div>
        </div>

        {/* Right Detail Pane */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          {/* ================= ACCOUNT & IDENTITY ================= */}
          {activeTab === 'account' && (
            <div>
              <SettingsSectionHeader
                title="Active Profile"
                subtitle="Your YouTube Music identity and brand channel settings"
              />
              <SettingsCard>
                <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {authState.selectedChannel?.avatarUrl ? (
                    <img
                      src={authState.selectedChannel.avatarUrl}
                      alt=""
                      style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 900
                      }}
                    >
                      {authState.selectedChannel?.name ? authState.selectedChannel.name[0].toUpperCase() : 'U'}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                        {authState.selectedChannel?.name || 'Guest User'}
                      </span>
                      {authState.selectedChannel?.brand && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            backgroundColor: 'var(--md-sys-color-primary-container)',
                            color: 'var(--md-sys-color-on-primary-container)'
                          }}
                        >
                          BRAND
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--md-sys-color-outline)' }}>
                      {authState.selectedChannel?.handle || 'YouTube Music account'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
                      {authState.isAuthenticated ? 'Connected via OurTube Extension Bridge' : 'Not signed in'}
                    </span>
                  </div>
                </div>

                <SettingsDivider />

                <SettingsToggleRow
                  icon="visibility_off"
                  title="Incognito Session"
                  subtitle="Do not log listening history or update YouTube Music recommendations"
                  checked={settings.incognitoSession}
                  onChange={settings.setIncognitoSession}
                />
              </SettingsCard>

              {/* Account Switcher Roster */}
              <SettingsSectionHeader
                title="Switch Channel or Google Account"
                subtitle="Select which identity should be active for playlists and feeds"
              />
              <SettingsCard>
                {authState.accounts && authState.accounts.length > 0 ? (
                  authState.accounts.map((acc, aIdx) => (
                    <div key={aIdx} style={{ display: 'flex', flexDirection: 'column' }}>
                      {acc.email && (
                        <div
                          style={{
                            padding: '12px 20px 6px 20px',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            color: 'var(--md-sys-color-outline)',
                            textTransform: 'uppercase'
                          }}
                        >
                          {acc.email}
                        </div>
                      )}
                      {acc.channels.map((chan) => {
                        const isCurrent = authState.selectedChannel?.id === chan.id;
                        return (
                          <div
                            key={chan.id}
                            onClick={() => handleSelectChannel(chan)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 20px',
                              cursor: 'pointer',
                              backgroundColor: isCurrent
                                ? 'var(--md-sys-color-surface-container-high)'
                                : 'transparent',
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {chan.avatarUrl ? (
                                <img
                                  src={chan.avatarUrl}
                                  alt=""
                                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: 700
                                  }}
                                >
                                  {chan.name[0]}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                                    {chan.name}
                                  </span>
                                  {chan.brand && (
                                    <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--md-sys-color-outline)' }}>
                                      (Brand)
                                    </span>
                                  )}
                                </div>
                                {chan.handle && (
                                  <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)' }}>
                                    {chan.handle}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isCurrent && (
                              <span
                                className="material-symbols-rounded"
                                style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)', fontWeight: 800 }}
                              >
                                check_circle
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--md-sys-color-outline)' }}>
                    No accounts loaded yet. Ensure OurTube Companion extension is installed and you are signed in to YouTube Music.
                  </div>
                )}

                <SettingsDivider />

                <SettingsRow
                  icon="add"
                  title="Add Another Google Account"
                  value="Opens Google sign-in to attach an additional session"
                  onClick={() => {
                    window.open(
                      'https://accounts.google.com/AddSession?service=youtube&continue=https://music.youtube.com/',
                      '_blank'
                    );
                  }}
                  showChevron
                />

                <SettingsDivider />

                <SettingsRow
                  icon="refresh"
                  title="Refresh YouTube Music Session"
                  value="Re-reads credentials and refreshes all playlists"
                  onClick={() => {
                    bridgeClient.refreshAuth().then(setAuthState);
                  }}
                  showChevron
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= APPEARANCE & CUSTOMIZATION ================= */}
          {activeTab === 'appearance' && (
            <div>
              <SettingsSectionHeader
                title="Theme & Canvas"
                subtitle="Light, dark, pure OLED black, and dynamic HCT tonal science"
              />
              <SettingsCard>
                <SettingsChoiceRow<ThemeMode>
                  icon="dark_mode"
                  title="Theme Mode"
                  subtitle="Choose your preferred system appearance"
                  selected={settings.themeMode}
                  onSelect={settings.setThemeMode}
                  options={[
                    { id: 'system', label: 'System', icon: 'settings_brightness' },
                    { id: 'light', label: 'Light', icon: 'light_mode' },
                    { id: 'dark', label: 'Dark', icon: 'dark_mode' },
                    { id: 'amoled', label: 'AMOLED', icon: 'contrast' }
                  ]}
                />

                <SettingsDivider />

                {/* Color Palette Row with direct studio trigger */}
                <SettingsRow
                  icon="palette"
                  title="Color Palette Studio"
                  value={`${currentPalette.name} · ${settings.paletteStyle.replace('_', ' ')} (26 HCT Palettes)`}
                  detail="Tap to choose from 26 curated dynamic palettes or extract from album art"
                  onClick={() => setIsPaletteStudioOpen(true)}
                  showChevron
                  trailing={
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: currentPalette.seedPrimary
                        }}
                      />
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: currentPalette.seedSecondary
                        }}
                      />
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: currentPalette.seedTertiary
                        }}
                      />
                    </div>
                  }
                />

                <SettingsDivider />

                {/* Palette Style Segmented Row */}
                <SettingsChoiceRow<PaletteStyle>
                  icon="tune"
                  title="Palette Chroma Style"
                  subtitle="Controls saturation, contrast, and color temperature"
                  selected={settings.paletteStyle}
                  onSelect={settings.setPaletteStyle}
                  options={[
                    { id: 'TONAL_SPOT', label: 'Tonal Spot' },
                    { id: 'EXPRESSIVE', label: 'Expressive' },
                    { id: 'VIBRANT', label: 'Vibrant' },
                    { id: 'FRUIT_SALAD', label: 'Fruit Salad' },
                    { id: 'MONOCHROME', label: 'Mono' }
                  ]}
                />
              </SettingsCard>

              {/* Player Styles Section (Koda's 6 iconic styles) */}
              <SettingsSectionHeader
                title="Player Styles"
                subtitle="Select the geometric layout for the expanded now-playing screen"
              />
              <SettingsCard style={{ padding: '20px' }}>
                <PlayerStyleGallery />
              </SettingsCard>

              {/* Atmosphere & Chromatic Mist */}
              <SettingsSectionHeader
                title="Background & Atmosphere"
                subtitle="Immersive color extraction and dynamic effects"
              />
              <SettingsCard>
                <SettingsToggleRow
                  icon="blur_on"
                  title="Ambient Background (Chromatic Mist)"
                  subtitle="Fluid multi-stop mesh gradient animated from now-playing artwork"
                  checked={settings.ambientBackground}
                  onChange={settings.setAmbientBackground}
                />

                {settings.ambientBackground && (
                  <>
                    <SettingsDivider />
                    <SettingsSliderRow
                      icon="opacity"
                      title="Mist Intensity"
                      value={Math.round(settings.ambientIntensity * 100)}
                      min={20}
                      max={100}
                      step={5}
                      unit="%"
                      onChange={(v) => settings.setAmbientIntensity(v / 100)}
                    />
                  </>
                )}

                <SettingsDivider />

                <SettingsToggleRow
                  icon="speed"
                  title="Reduce Motion"
                  subtitle="Disables blur shaders and spring physics for lower power consumption"
                  checked={settings.reduceMotion}
                  onChange={settings.setReduceMotion}
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= PLAYBACK & AUDIO QUALITY ================= */}
          {activeTab === 'playback' && (
            <div>
              <SettingsSectionHeader
                title="Streaming Audio Quality"
                subtitle="Bitrate and codec preferences for music playback"
              />
              <SettingsCard>
                <SettingsChoiceRow<AudioStreamQuality>
                  icon="high_quality"
                  title="Audio Stream Quality"
                  subtitle="Higher bitrates consume more bandwidth but provide pristine fidelity"
                  selected={settings.audioQuality}
                  onSelect={settings.setAudioQuality}
                  options={[
                    { id: 'high', label: 'High (256k AAC)' },
                    { id: 'normal', label: 'Normal (128k)' },
                    { id: 'saver', label: 'Data Saver (64k)' }
                  ]}
                />

                <SettingsDivider />

                <SettingsToggleRow
                  icon="graphic_eq"
                  title="Audio Normalization"
                  subtitle="ReplayGain dynamic loudness leveling across different tracks"
                  checked={settings.audioNormalization}
                  onChange={settings.setAudioNormalization}
                />
              </SettingsCard>

              <SettingsSectionHeader
                title="Playback Transitions & Queue"
                subtitle="Crossfade and continuous listening configuration"
              />
              <SettingsCard>
                <SettingsToggleRow
                  icon="tune"
                  title="Crossfade"
                  subtitle="Smoothly fade between outgoing and incoming tracks"
                  checked={settings.crossfadeEnabled}
                  onChange={settings.setCrossfadeEnabled}
                />

                {settings.crossfadeEnabled && (
                  <>
                    <SettingsDivider />
                    <SettingsSliderRow
                      icon="timer"
                      title="Crossfade Duration"
                      value={settings.crossfadeDuration}
                      min={1}
                      max={12}
                      step={1}
                      unit="s"
                      onChange={settings.setCrossfadeDuration}
                    />
                  </>
                )}

                <SettingsDivider />

                <SettingsToggleRow
                  icon="queue_music"
                  title="Auto-load Queue (Infinite Radio)"
                  subtitle="Automatically append personalized radio recommendations when queue runs low"
                  checked={settings.autoLoadQueue}
                  onChange={settings.setAutoLoadQueue}
                />

                <SettingsDivider />

                <SettingsToggleRow
                  icon="history"
                  title="Save Listening History"
                  subtitle="Record played tracks locally for Taste Profile and Top Artists compilation"
                  checked={settings.saveListeningHistory}
                  onChange={settings.setSaveListeningHistory}
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= DISCORD RICH PRESENCE ================= */}
          {activeTab === 'discord' && (
            <div>
              <SettingsSectionHeader
                title="Discord Rich Presence (BitChord Protocol)"
                subtitle="Show what you are listening to on your Discord profile in real time"
              />
              <SettingsCard>
                <SettingsToggleRow
                  icon="chat"
                  title="Enable Discord Rich Presence"
                  subtitle="Broadcast current track, artist, album, and artwork to Discord"
                  checked={settings.discordRpcEnabled}
                  onChange={settings.setDiscordRpcEnabled}
                />

                {settings.discordRpcEnabled && (
                  <>
                    <SettingsDivider />
                    <SettingsToggleRow
                      icon="visibility_off"
                      title="Incognito Discord Presence"
                      subtitle="Temporarily hide playback from Discord without disconnecting"
                      checked={settings.discordIncognito}
                      onChange={settings.setDiscordIncognito}
                    />
                  </>
                )}
              </SettingsCard>

              {/* Live Discord Card Mockup */}
              <SettingsSectionHeader
                title="Discord Profile Preview"
                subtitle="Real-time simulation of how your status appears to friends"
              />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <DiscordPreviewCard />
              </div>

              {/* Presence Customization Options */}
              <SettingsSectionHeader
                title="Presence Customization"
                subtitle="Choose what details are visible on your Discord card"
              />
              <SettingsCard>
                <SettingsToggleRow
                  icon="timer"
                  title="Show Elapsed & Remaining Time"
                  subtitle="Display progress timeline and countdown bar"
                  checked={settings.discordShowElapsed}
                  onChange={settings.setDiscordShowElapsed}
                />

                <SettingsDivider />

                <SettingsToggleRow
                  icon="image"
                  title="Show High-Resolution Album Art"
                  subtitle="Mirror artwork to Discord's CDN for high-density displays"
                  checked={settings.discordShowArtwork}
                  onChange={settings.setDiscordShowArtwork}
                />

                <SettingsDivider />

                <SettingsToggleRow
                  icon="smart_button"
                  title="Show Interactive Action Buttons"
                  subtitle="Includes 'Listen on YouTube Music' and 'Open OurTube' links"
                  checked={settings.discordShowButtons}
                  onChange={settings.setDiscordShowButtons}
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= CONTENT & FEEDS ================= */}
          {activeTab === 'content' && (
            <div>
              <SettingsSectionHeader
                title="Home & Discovery"
                subtitle="Organize your landing page feeds and music recommendations"
              />
              <SettingsCard>
                <SettingsChoiceRow<HomeLayoutMode>
                  icon="grid_view"
                  title="Home Screen Layout"
                  subtitle="Choose how quick picks, radios, and playlists are presented"
                  selected={settings.homeLayoutMode}
                  onSelect={settings.setHomeLayoutMode}
                  options={[
                    { id: 'spotlight', label: 'Spotlight (Koda Paged)', icon: 'auto_awesome' },
                    { id: 'classic', label: 'Classic Grid', icon: 'grid_view' }
                  ]}
                />

                <SettingsDivider />

                <SettingsToggleRow
                  icon="explicit"
                  title="Filter Explicit Content"
                  subtitle="Hide songs and videos marked with explicit advisory tags"
                  checked={settings.filterExplicit}
                  onChange={settings.setFilterExplicit}
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= STORAGE & CACHE ================= */}
          {activeTab === 'storage' && (
            <div>
              <SettingsSectionHeader
                title="Device Storage & Cache"
                subtitle="Manage artwork, lyrics, and locally saved metadata"
              />
              <SettingsCard>
                <SettingsRow
                  icon="folder"
                  title="Image & Artwork Cache"
                  value={cacheSize}
                  detail="Cached album art, artist headers, and thumbnails for fast offline viewing"
                />

                <SettingsDivider />

                <SettingsRow
                  icon="delete_sweep"
                  title="Clear Artwork & Lyrics Cache"
                  value={cacheClearedToast ? 'Cache cleared successfully!' : 'Free up local memory'}
                  onClick={handleClearCache}
                  showChevron
                />

                <SettingsDivider />

                <SettingsRow
                  icon="restart_alt"
                  title="Reset All Preferences to Defaults"
                  value="Restore all theme, player, and playback settings"
                  destructive
                  onClick={() => {
                    if (window.confirm('Are you sure you want to reset all OurTube settings to default values?')) {
                      settings.resetToDefaults();
                    }
                  }}
                  showChevron
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= SYSTEM & ABOUT ================= */}
          {activeTab === 'about' && (
            <div>
              <SettingsSectionHeader
                title="About OurTube"
                subtitle="Material 3 Expressive Music & Video Experience"
              />
              <SettingsCard>
                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '20px',
                      backgroundColor: 'var(--md-sys-color-primary)',
                      color: 'var(--md-sys-color-on-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px',
                      fontWeight: 900,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                    }}
                  >
                    O
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--md-sys-color-on-surface)' }}>
                      OurTube Web v4.4
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--md-sys-color-outline)' }}>
                      Material 3 Expressive edition with HCT color science
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                      Inspired by Koda by Ivor & BitChord by Kushagra
                    </span>
                  </div>
                </div>

                <SettingsDivider />

                <SettingsRow
                  icon="extension"
                  title="Companion Extension Bridge"
                  value={bridgeClient.getIsAvailable() ? 'Active (v1.0.0)' : 'Guest Mode (No companion)'}
                  detail="Provides authenticated YouTube Music requests, CORS bypass, and Discord gateway"
                  trailing={
                    <button
                      onClick={() => bridgeClient.refreshAuth().then(setAuthState)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--md-sys-color-surface-container)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        color: 'var(--md-sys-color-on-surface)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      Ping Bridge
                    </button>
                  }
                />

                <SettingsDivider />

                <SettingsRow
                  icon="code"
                  title="Innertube Client Version"
                  value="WEB_REMIX 1.20251006.03.00"
                  detail="Authentic YouTube Music desktop client spoofing"
                />

                <SettingsDivider />

                <SettingsRow
                  icon="open_in_new"
                  title="Koda GitHub Repository"
                  value="https://github.com/Ivorisnoob/Koda"
                  onClick={() => window.open('https://github.com/Ivorisnoob/Koda', '_blank')}
                  showChevron
                />
              </SettingsCard>
            </div>
          )}
        </div>
      </div>

      {/* Palette Studio Modal if triggered */}
      {isPaletteStudioOpen && (
        <PaletteStudio onClose={() => setIsPaletteStudioOpen(false)} />
      )}
    </div>
  );
};
