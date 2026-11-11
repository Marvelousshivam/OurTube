import React, { useState, useEffect, useRef } from 'react';
import {
  useSettingsStore,
  ThemeMode,
  AudioStreamQuality
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
import { KeyboardShortcutsModal } from '../components/settings/KeyboardShortcutsModal';
import { OurTubeLogo } from '../components/common/OurTubeLogo';
import { isDesktopApp } from '../api/desktop';
import { openDesktopLogin, signOutDesktop } from '../api/desktopAuth';
import { APP_PALETTES, PaletteStyle } from '../theme/ColorPalettes';
import { bridgeClient } from '../api/bridgeClient';
import { discordPresenceManager } from '../api/discordPresence';
import { AuthState, YtChannel } from '../types';

export type SettingsTabId =
  | 'account'
  | 'appearance'
  | 'playback'
  | 'discord'
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
    getSubtitle: (s) => `${s.audioQuality === 'high' ? 'High (256k AAC)' : s.audioQuality === 'normal' ? 'Normal (128k)' : 'Data Saver'}`
  },
  {
    id: 'discord',
    label: 'Discord Rich Presence',
    icon: 'chat',
    getSubtitle: (s) => {
      if (!s.discordConnected) return 'Not connected';
      if (!s.discordRpcEnabled) return `${s.discordUser?.name || 'Connected'} · Off`;
      if (s.discordIncognito) return 'Incognito';
      return `${s.discordUser?.name || 'Connected'} · Active`;
    }
  },
  {
    id: 'storage',
    label: 'Storage & Data',
    icon: 'folder',
    getSubtitle: (s) => s.storageUsed || 'Calculating...'
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
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Storage and backup states
  const [storageEstimate, setStorageEstimate] = useState<{ usedMb: string; quotaMb: string }>({
    usedMb: 'Calculating...',
    quotaMb: '...'
  });
  const [cacheClearedToast, setCacheClearedToast] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Diagnostics states
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [isDiscordBusy, setIsDiscordBusy] = useState(false);
  const [discordError, setDiscordError] = useState<string | null>(null);

  const refreshStorage = () => {
    settings.getStorageEstimate().then(setStorageEstimate);
  };

  useEffect(() => {
    refreshStorage();
    bridgeClient.refreshAuth().then(setAuthState);
    discordPresenceManager.refreshState();
    const unsubAvail = bridgeClient.onAvailabilityChange((available) => {
      if (available) {
        bridgeClient.refreshAuth().then(setAuthState);
        discordPresenceManager.refreshState();
      }
    });
    const unsubAcct = bridgeClient.onAccountChange(setAuthState);
    return () => {
      unsubAvail();
      unsubAcct();
    };
  }, []);

  const handleDiscordConnectToggle = async () => {
    setIsDiscordBusy(true);
    setDiscordError(null);
    try {
      if (settings.discordConnected) {
        await discordPresenceManager.disconnectAccount();
      } else {
        await discordPresenceManager.connectAccount();
      }
    } catch (err: any) {
      setDiscordError(err?.message || 'Could not connect to Discord. Please sign in at discord.com and try again.');
    } finally {
      setIsDiscordBusy(false);
    }
  };

  const currentPalette = APP_PALETTES.find((p) => p.id === settings.selectedPaletteId) || APP_PALETTES[0];
  const QUICK_PALETTES = APP_PALETTES.slice(0, 7);

  const handleSelectChannel = async (channel: YtChannel) => {
    try {
      const newAuth = await bridgeClient.selectAccount(channel.id);
      setAuthState(newAuth);
    } catch (err) {
      console.warn('[SettingsPage] Error switching channel:', err);
    }
  };

  const handleClearCache = async () => {
    await settings.clearLocalCache();
    setCacheClearedToast(true);
    refreshStorage();
    setTimeout(() => setCacheClearedToast(false), 3000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await settings.importUserData(file);
    if (ok) {
      setImportToast('Taste profile restored successfully!');
      setTimeout(() => setImportToast(null), 3500);
    } else {
      setImportToast('Failed to parse backup file');
      setTimeout(() => setImportToast(null), 3500);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePingBridge = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await bridgeClient.sendRequest('KODA_BRIDGE_PING', {}, 2500);
      const ms = Math.round(performance.now() - start);
      setPingResult(`${ms} ms roundtrip · Companion extension ready`);
    } catch {
      setPingResult('Companion extension unreachable');
    } finally {
      setIsPinging(false);
    }
  };

  const currentSubtitleContext = {
    authState,
    themeMode: settings.themeMode,
    paletteName: currentPalette.name,
    audioQuality: settings.audioQuality,
    discordRpcEnabled: settings.discordRpcEnabled,
    discordIncognito: settings.discordIncognito,
    discordConnected: settings.discordConnected,
    discordUser: settings.discordUser,
    storageUsed: storageEstimate.usedMb
  };

  // Filter categories by search query
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
        gap: '24px',
        paddingBottom: '160px' // Adequate clearance for bottom MiniPlayer
      }}
    >
      {/* Top Header & Search Filter Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--md-sys-color-outline-variant)'
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--md-sys-color-on-surface)' }}>
            Settings
          </h1>
          <span style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 500 }}>
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
              style={{ background: 'transparent', border: 'none', color: 'var(--md-sys-color-outline)', cursor: 'pointer', padding: 0 }}
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

          {/* Extension Status Indicator Card */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                {bridgeClient.getIsAvailable() ? 'Companion Extension Active' : 'Extension Missing'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 700 }}>
              v1.0.0
            </span>
          </div>
        </div>

        {/* Right Detail Pane */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          {/* ================= 1. ACCOUNT & IDENTITY ================= */}
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
                      {authState.isAuthenticated
                        ? isDesktopApp()
                          ? 'Connected via OurTube Desktop'
                          : 'Connected via OurTube Extension Bridge'
                        : 'Not signed in'}
                    </span>
                  </div>
                  {isDesktopApp() && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openDesktopLogin(authState.isAuthenticated)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '9999px',
                          border: 'none',
                          backgroundColor: 'var(--md-sys-color-primary)',
                          color: 'var(--md-sys-color-on-primary)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {authState.isAuthenticated ? 'Add Account' : 'Sign in with Google'}
                      </button>
                      {authState.isAuthenticated && (
                        <button
                          onClick={async () => {
                            await signOutDesktop();
                            const fresh = await bridgeClient.refreshAuth(true);
                            setAuthState(fresh);
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '9999px',
                            border: '1px solid var(--md-sys-color-outline-variant)',
                            backgroundColor: 'transparent',
                            color: 'var(--md-sys-color-on-surface)',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Sign out
                        </button>
                      )}
                    </div>
                  )}
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

              {/* Multi-Account Channel Switcher Roster */}
              <SettingsSectionHeader
                title="Switch Channel or Google Account"
                subtitle="Select which identity should be active for playlists, feeds, and recommendations"
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
                                <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>
                                  {chan.handle || `Account ${chan.authUser}`}
                                </span>
                              </div>
                            </div>

                            {isCurrent && (
                              <span className="material-symbols-rounded" style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)' }}>
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
                    {isDesktopApp()
                      ? 'No Google accounts connected yet. Click "Sign in with Google" above to link your YouTube Music account.'
                      : 'No Google accounts detected. Please ensure the extension is enabled.'}
                  </div>
                )}
              </SettingsCard>
            </div>
          )}

          {/* ================= 2. APPEARANCE & CUSTOMIZATION ================= */}
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

                {/* Color Palette Row with direct Studio Trigger & Quick Swatches */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="material-symbols-rounded" style={{ fontSize: '24px', color: 'var(--md-sys-color-primary)' }}>
                        palette
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                          Color Palette Studio
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>
                          Active: {currentPalette.name} ({settings.paletteStyle.replace('_', ' ')})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsPaletteStudioOpen(true)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        color: 'var(--md-sys-color-primary)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      Browse 26 Palettes
                      <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                        chevron_right
                      </span>
                    </button>
                  </div>

                  {/* Quick-Pick Swatch Strip */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      overflowX: 'auto',
                      scrollbarWidth: 'none',
                      padding: '4px 0'
                    }}
                  >
                    {QUICK_PALETTES.map((pal) => {
                      const isSelected = settings.selectedPaletteId === pal.id;
                      return (
                        <div
                          key={pal.id}
                          onClick={() => settings.setSelectedPaletteId(pal.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 14px',
                            borderRadius: '9999px',
                            cursor: 'pointer',
                            backgroundColor: isSelected
                              ? 'var(--md-sys-color-primary-container)'
                              : 'rgba(255, 255, 255, 0.04)',
                            border: isSelected
                              ? '1px solid var(--md-sys-color-primary)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            transition: 'all 150ms ease'
                          }}
                        >
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: pal.seedPrimary
                            }}
                          />
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: isSelected ? 800 : 600,
                              color: isSelected
                                ? 'var(--md-sys-color-on-primary-container)'
                                : 'var(--md-sys-color-on-surface)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {pal.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

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

              {/* Player Styles Section (Koda's iconic styles) */}
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

                <SettingsDivider />

                <SettingsToggleRow
                  icon="graphic_eq"
                  title="Bottom Soundwave Equalizer"
                  subtitle="Animate an organic audio equalizer wave at the bottom of the player"
                  checked={settings.bottomEqualizer}
                  onChange={settings.setBottomEqualizer}
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= 3. PLAYBACK & AUDIO QUALITY ================= */}
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
                  subtitle="Higher bitrates provide pristine fidelity; data saver protects cellular bandwidth"
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
                  title="Audio Loudness Normalization"
                  subtitle="Real Web Audio compressor leveling across tracks so volume is uniform"
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
                  subtitle="Smoothly fade volume between outgoing and incoming tracks"
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

          {/* ================= 4. DISCORD RICH PRESENCE ================= */}
          {activeTab === 'discord' && (
            <div>
              <SettingsSectionHeader
                title="Discord Account (BitChord Gateway)"
                subtitle="Connect your browser's Discord session via the Companion Extension to publish live activity"
              />
              <SettingsCard>
                <div
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    {settings.discordUser?.avatarUrl ? (
                      <img
                        src={settings.discordUser.avatarUrl}
                        alt={settings.discordUser.name}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #5865f2',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '14px',
                          backgroundColor: settings.discordConnected ? '#5865f2' : 'var(--md-sys-color-surface-container-high)',
                          color: settings.discordConnected ? '#ffffff' : 'var(--md-sys-color-on-surface-variant)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '24px' }}>
                          {settings.discordConnected ? 'verified_user' : 'forum'}
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                          {settings.discordConnected && settings.discordUser
                            ? settings.discordUser.name
                            : 'Discord Account Not Connected'}
                        </span>
                        {settings.discordConnected && settings.discordUser?.username && (
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--md-sys-color-on-surface-variant)'
                            }}
                          >
                            @{settings.discordUser.username}
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>
                        {!settings.discordConnected
                          ? 'Click Connect to read your active session from an open discord.com tab'
                          : !settings.discordRpcEnabled
                            ? 'Presence disabled'
                            : settings.discordGateway === 'ready'
                              ? 'Gateway Ready · Showing what you play on Discord'
                              : settings.discordGateway === 'connecting'
                                ? 'Connecting to Discord WebSocket Gateway…'
                                : settings.discordProblem || 'Connected · Ready to broadcast when music plays'}
                      </span>

                      {(discordError || settings.discordProblem) && (
                        <span style={{ fontSize: '12px', color: '#f28b82', fontWeight: 600, marginTop: '2px' }}>
                          {discordError || settings.discordProblem}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isDiscordBusy}
                    onClick={handleDiscordConnectToggle}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '9999px',
                      border: settings.discordConnected
                        ? '1px solid var(--md-sys-color-outline-variant)'
                        : 'none',
                      backgroundColor: settings.discordConnected
                        ? 'var(--md-sys-color-surface-container-high)'
                        : '#5865f2',
                      color: settings.discordConnected
                        ? 'var(--md-sys-color-on-surface)'
                        : '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: isDiscordBusy ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: settings.discordConnected ? 'none' : '0 6px 20px rgba(88, 101, 242, 0.38)',
                      transition: 'all 180ms ease'
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                      {isDiscordBusy
                        ? 'progress_activity'
                        : settings.discordConnected
                          ? 'link_off'
                          : 'add_link'}
                    </span>
                    <span>
                      {isDiscordBusy
                        ? 'Connecting Discord…'
                        : settings.discordConnected
                          ? 'Disconnect'
                          : 'Connect Discord'}
                    </span>
                  </button>
                </div>
              </SettingsCard>

              {!settings.discordConnected && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--md-sys-color-outline)',
                    padding: '10px 6px 4px 6px',
                    lineHeight: 1.5
                  }}
                >
                  Connect reads your Discord session from an open <code>discord.com</code> tab (or opens one for you to sign in).
                  The token stays inside the extension&rsquo;s local storage and is never exposed to the web page.
                </div>
              )}

              <SettingsSectionHeader
                title="Rich Presence Configuration"
                subtitle="Customize how your OurTube activity card appears on Discord"
              />
              <SettingsCard>
                <SettingsToggleRow
                  icon="chat"
                  title="Show What You're Playing"
                  subtitle="Broadcast current track, artist, album, and artwork to Discord"
                  checked={settings.discordRpcEnabled}
                  onChange={settings.setDiscordRpcEnabled}
                />

                {settings.discordRpcEnabled && (
                  <>
                    <SettingsDivider />
                    <SettingsChoiceRow<'listening' | 'playing' | 'watching' | 'competing'>
                      icon="podcasts"
                      title="Activity Type"
                      subtitle="Choose the verb displayed in your Discord status header"
                      selected={settings.discordActivityType}
                      onSelect={settings.setDiscordActivityType}
                      options={[
                        { id: 'listening', label: 'Listening to' },
                        { id: 'playing', label: 'Playing' },
                        { id: 'watching', label: 'Watching' },
                        { id: 'competing', label: 'Competing in' }
                      ]}
                    />

                    <SettingsDivider />
                    <SettingsChoiceRow<'online' | 'idle' | 'dnd' | 'invisible'>
                      icon="circle"
                      title="Online Status"
                      subtitle="Presence indicator dot shown alongside your activity"
                      selected={settings.discordOnlineStatus}
                      onSelect={settings.setDiscordOnlineStatus}
                      options={[
                        { id: 'online', label: 'Online' },
                        { id: 'idle', label: 'Idle' },
                        { id: 'dnd', label: 'Do Not Disturb' },
                        { id: 'invisible', label: 'Invisible' }
                      ]}
                    />

                    <SettingsDivider />
                    <div
                      style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span
                          className="material-symbols-rounded"
                          style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)' }}
                        >
                          badge
                        </span>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                            Activity Name
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>
                            Application name shown after &ldquo;Listening to&rdquo;
                          </div>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="OurTube"
                        value={settings.discordActivityName}
                        onChange={(e) => settings.setDiscordActivityName(e.target.value)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: '1px solid var(--md-sys-color-outline-variant)',
                          backgroundColor: 'var(--md-sys-color-surface-container-high)',
                          color: 'var(--md-sys-color-on-surface)',
                          fontSize: '13px',
                          fontWeight: 600,
                          width: '200px',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <SettingsDivider />
                    <SettingsToggleRow
                      icon="format_List_bulleted"
                      title="Lead with the Song"
                      subtitle="Server member lists display the song title instead of the artist"
                      checked={settings.discordUseDetails}
                      onChange={settings.setDiscordUseDetails}
                    />

                    <SettingsDivider />
                    <SettingsToggleRow
                      icon="schedule"
                      title="Show Elapsed Time"
                      subtitle="Display playback timer and track length on Discord"
                      checked={settings.discordShowElapsed}
                      onChange={settings.setDiscordShowElapsed}
                    />

                    <SettingsDivider />
                    <SettingsToggleRow
                      icon="image"
                      title="Show Album Artwork"
                      subtitle="Mirror album art via Discord External Assets CDN"
                      checked={settings.discordShowArtwork}
                      onChange={settings.setDiscordShowArtwork}
                    />

                    <SettingsDivider />
                    <SettingsToggleRow
                      icon="smart_button"
                      title="Show Listen on YouTube Music Button"
                      subtitle="Button 1 linking directly to the active song on YouTube Music"
                      checked={settings.discordButton1Visible}
                      onChange={settings.setDiscordButton1Visible}
                    />

                    {settings.discordButton1Visible && (
                      <div
                        style={{
                          padding: '8px 20px 14px 54px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>
                          Button 1 Label (supports <code>{'{song_name}'}</code>, <code>{'{artist_name}'}</code>)
                        </span>
                        <input
                          type="text"
                          placeholder="Listen on YouTube Music"
                          value={settings.discordButton1Text}
                          onChange={(e) => settings.setDiscordButton1Text(e.target.value)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '10px',
                            border: '1px solid var(--md-sys-color-outline-variant)',
                            backgroundColor: 'var(--md-sys-color-surface-container-high)',
                            color: 'var(--md-sys-color-on-surface)',
                            fontSize: '12px',
                            fontWeight: 600,
                            width: '220px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    )}

                    <SettingsDivider />
                    <SettingsToggleRow
                      icon="open_in_new"
                      title="Show Visit OurTube Button"
                      subtitle="Button 2 linking to the OurTube repository"
                      checked={settings.discordButton2Visible}
                      onChange={settings.setDiscordButton2Visible}
                    />

                    {settings.discordButton2Visible && (
                      <div
                        style={{
                          padding: '8px 20px 14px 54px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)' }}>
                          Button 2 Label
                        </span>
                        <input
                          type="text"
                          placeholder="Visit OurTube"
                          value={settings.discordButton2Text}
                          onChange={(e) => settings.setDiscordButton2Text(e.target.value)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '10px',
                            border: '1px solid var(--md-sys-color-outline-variant)',
                            backgroundColor: 'var(--md-sys-color-surface-container-high)',
                            color: 'var(--md-sys-color-on-surface)',
                            fontSize: '12px',
                            fontWeight: 600,
                            width: '220px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    )}

                    <SettingsDivider />
                    <SettingsToggleRow
                      icon="visibility_off"
                      title="Incognito Presence"
                      subtitle="Pause presence broadcasting temporarily without disconnecting"
                      checked={settings.discordIncognito}
                      onChange={settings.setDiscordIncognito}
                    />
                  </>
                )}
              </SettingsCard>

              {/* Interactive Live Discord Preview Card */}
              <SettingsSectionHeader
                title="Live Presence Preview"
                subtitle="How your status appears to friends on desktop and mobile Discord"
              />
              <DiscordPreviewCard />
            </div>
          )}

          {/* ================= 5. STORAGE & DATA ================= */}
          {activeTab === 'storage' && (
            <div>
              <SettingsSectionHeader
                title="Device Storage & Cache"
                subtitle="Real-time storage measurement and offline data management"
              />
              <SettingsCard>
                <SettingsRow
                  icon="folder"
                  title="Local Storage Footprint"
                  value={storageEstimate.usedMb}
                  detail={`Device quota: ${storageEstimate.quotaMb}. Cached cover art, lyrics TTML, and offline assets.`}
                />

                <SettingsDivider />

                <SettingsRow
                  icon="delete_sweep"
                  title="Clear Artwork & Lyrics Cache"
                  value={cacheClearedToast ? 'Cache Purged Successfully!' : 'Free up local memory'}
                  detail="Purges CacheStorage blobs while preserving your liked songs and playlists"
                  onClick={handleClearCache}
                  showChevron
                />
              </SettingsCard>

              <SettingsSectionHeader
                title="Data Portability & Backups"
                subtitle="Export or restore your taste profile, liked songs, and settings"
              />
              <SettingsCard>
                <SettingsRow
                  icon="file_download"
                  title="Export Taste Profile & Liked Tracks"
                  value="Download backup JSON"
                  detail="Saves your complete listening history and liked tracks to a portable JSON file"
                  onClick={settings.exportUserData}
                  showChevron
                />

                <SettingsDivider />

                <SettingsRow
                  icon="file_upload"
                  title="Import Backup File"
                  value={importToast || 'Upload backup JSON'}
                  detail="Merge a previously saved backup into your taste profile"
                  onClick={() => fileInputRef.current?.click()}
                  showChevron
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  style={{ display: 'none' }}
                />

                <SettingsDivider />

                <SettingsRow
                  icon="restart_alt"
                  title="Reset All Preferences to Defaults"
                  value="Factory Reset"
                  destructive
                  detail="Clears custom themes, audio settings, and restores initial defaults"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to reset all OurTube settings to defaults?')) {
                      settings.resetToDefaults();
                    }
                  }}
                  showChevron
                />
              </SettingsCard>
            </div>
          )}

          {/* ================= 6. SYSTEM & ABOUT ================= */}
          {activeTab === 'about' && (
            <div>
              <SettingsSectionHeader
                title="About OurTube"
                subtitle="Material 3 Expressive Music Experience"
              />
              <SettingsCard>
                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <OurTubeLogo size={64} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--md-sys-color-on-surface)' }}>
                      OurTube Web v4.4
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--md-sys-color-outline)' }}>
                      Material 3 Expressive edition with HCT color science
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                      Engineered after Koda & BitChord
                    </span>
                  </div>
                </div>

                <SettingsDivider />

                <SettingsRow
                  icon="extension"
                  title="OurTube Companion Extension"
                  value={bridgeClient.getIsAvailable() ? 'Connected · v1.0.0 Active' : 'Extension Missing'}
                  detail={pingResult || 'Enables zero-CORS streaming, YouTube Music multi-account auth, and unencrypted playback'}
                  trailing={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <a
                        href="/downloads/ourtube-companion.zip"
                        download="ourtube-companion.zip"
                        style={{
                          padding: '6px 14px',
                          borderRadius: '9999px',
                          backgroundColor: '#e53935',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
                          download
                        </span>
                        Download Zip
                      </a>
                      <button
                        onClick={handlePingBridge}
                        disabled={isPinging}
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
                        {isPinging ? 'Pinging...' : 'Ping Test'}
                      </button>
                    </div>
                  }
                />

                <SettingsDivider />

                <SettingsRow
                  icon="keyboard"
                  title="Keyboard Shortcuts"
                  value="View Cheat Sheet"
                  detail="Inspect desktop player controls and navigation hotkeys"
                  onClick={() => setIsShortcutsModalOpen(true)}
                  showChevron
                />

                <SettingsDivider />

                <SettingsRow
                  icon="code"
                  title="Innertube Client Profile"
                  value="WEB_REMIX 1.20251006.03.00"
                  detail="Official YouTube Music client profile with signed SAPISID auth"
                />

                <SettingsDivider />

                <SettingsRow
                  icon="open_in_new"
                  title="GitHub Repository"
                  value="https://github.com/Marvelousshivam/OurTube"
                  onClick={() => window.open('https://github.com/Marvelousshivam/OurTube', '_blank')}
                  showChevron
                />
              </SettingsCard>
            </div>
          )}
        </div>
      </div>

      {/* Palette Studio Modal */}
      {isPaletteStudioOpen && (
        <PaletteStudio onClose={() => setIsPaletteStudioOpen(false)} />
      )}

      {/* Keyboard Shortcuts Modal */}
      {isShortcutsModalOpen && (
        <KeyboardShortcutsModal onClose={() => setIsShortcutsModalOpen(false)} />
      )}
    </div>
  );
};
