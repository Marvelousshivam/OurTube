import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import {
  useVideoShaderStore,
  VIDEO_SHADER_PRESETS,
  STARTER_SHADER_TEMPLATES,
  VideoShaderPresetId,
  SHARPNESS_OFF,
  NEUTRAL_BRIGHTNESS,
  NEUTRAL_CONTRAST,
  NEUTRAL_SATURATION,
  isPictureNeutral,
  isShaderEffectActive,
  getPresetMeta
} from '../../store/videoShaderStore';
import { validateCustomFragmentShader } from './KodaVideoShaderCanvas';
import { VideoQuality } from '../../types';

export interface KodaPlaybackSettingsSheetProps {
  open?: boolean;
  isOpen?: boolean;
  initialTab?: 'quality' | 'speed' | 'audio' | 'shaders';
  onClose: () => void;
  isTheater?: boolean;
  timedCommentsActive?: boolean;
  onTimedCommentsChanged?: (active: boolean) => void;
  commentsOpen?: boolean;
  onOpenComments?: () => void;
  onEnterPip?: () => void;
  onListenAsMusic?: () => void;
  onLockScreen?: () => void;
}

type SettingsPicker = 'QUALITY' | 'SPEED' | 'AUDIO' | 'SHADERS';

const SPEED_PRESETS = [1.0, 1.25, 1.5, 2.0];
const VIDEO_MIN_SPEED = 0.25;
const VIDEO_MAX_SPEED = 4.0;
const VIDEO_SPEED_LOG_SPAN = Math.log(VIDEO_MAX_SPEED / VIDEO_MIN_SPEED);

function videoSpeedToSlider(speed: number): number {
  const clamped = Math.max(VIDEO_MIN_SPEED, Math.min(VIDEO_MAX_SPEED, speed));
  return Math.max(0, Math.min(1, Math.log(clamped / VIDEO_MIN_SPEED) / VIDEO_SPEED_LOG_SPAN));
}

function videoSliderToSpeed(pos: number): number {
  const clamped = Math.max(0, Math.min(1, pos));
  return VIDEO_MIN_SPEED * Math.exp(clamped * VIDEO_SPEED_LOG_SPAN);
}

function snapVideoSpeed(raw: number): number {
  const bounded = Math.max(VIDEO_MIN_SPEED, Math.min(VIDEO_MAX_SPEED, raw));
  if (Math.abs(bounded - 1.0) < 0.03) return 1.0;
  return bounded <= 2.0 ? Math.round(bounded * 20) / 20 : Math.round(bounded * 4) / 4;
}

function renderPresetIcon(id: VideoShaderPresetId) {
  switch (id) {
    case 'none':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        </svg>
      );
    case 'vivid':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      );
    case 'clarity':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" fillOpacity="0.35" />
        </svg>
      );
    case 'film':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M7 4v16M17 4v16M2 8h5M17 8h5M2 12h20M2 16h5M17 16h5" />
        </svg>
      );
    case 'noir':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18" />
          <path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" fillOpacity="0.4" />
        </svg>
      );
    case 'anime':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      );
    case 'neon':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'dream':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.9 10.8 12 4l2.1 6.8L21 13l-6.9 2.2L12 22l-2.1-6.8L3 13l6.9-2.2z" />
        </svg>
      );
    case 'vintage':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.5" />
          <circle cx="12" cy="7" r="1" fill="currentColor" />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
          <circle cx="7" cy="12" r="1" fill="currentColor" />
          <circle cx="17" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case 'vhs':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <path d="M8 14h8" />
        </svg>
      );
    case 'crt':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="15" rx="3" />
          <path d="M8 21h8M12 19v2" />
        </svg>
      );
    case 'pixel':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      );
    case 'comic':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case 'sketch':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      );
    case 'night_vision':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'custom':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
  }
}

export const KodaPlaybackSettingsSheet: React.FC<KodaPlaybackSettingsSheetProps> = ({
  open,
  isOpen,
  initialTab,
  onClose,
  isTheater = false,
  timedCommentsActive = true,
  onTimedCommentsChanged = () => {},
  commentsOpen = false,
  onOpenComments = () => {},
  onEnterPip = () => {},
  onListenAsMusic = () => {},
  onLockScreen
}) => {
  const {
    videoQuality,
    setVideoQuality,
    playbackSpeed,
    setPlaybackSpeed,
    audioTracks,
    selectedAudioTrackId,
    setAudioTrack,
    autoplay,
    toggleAutoplay,
    isLooping,
    toggleLoop,
    fitMode,
    toggleFitMode,
    sleepTimerMinutes,
    setSleepTimer
  } = usePlayerStore();

  const shaderStore = useVideoShaderStore();

  const effectiveOpen = Boolean(open ?? isOpen);
  const [deck, setDeck] = useState<SettingsPicker>('QUALITY');
  const [shaderSubTab, setShaderSubTab] = useState<'PRESETS' | 'PICTURE'>('PRESETS');
  const [showSleepPicker, setShowSleepPicker] = useState(false);

  useEffect(() => {
    if (effectiveOpen && initialTab) {
      const upper = initialTab.toUpperCase() as SettingsPicker;
      if (upper === 'QUALITY' || upper === 'SPEED' || upper === 'AUDIO' || upper === 'SHADERS') {
        setDeck(upper);
      }
    }
  }, [effectiveOpen, initialTab]);

  // Custom GLSL Shader editor state
  const [customDraft, setCustomDraft] = useState(shaderStore.customShaderSource);
  const [compileStatus, setCompileStatus] = useState<{
    checked: boolean;
    error: string | null;
  }>({ checked: false, error: null });

  if (!effectiveOpen) return null;

  const qualities: { id: VideoQuality; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: '1080p', label: '1080p HD' },
    { id: '720p', label: '720p' },
    { id: '480p', label: '480p' },
    { id: '360p', label: '360p' }
  ];

  const speedLabel = (s: number) => (s === 1 ? 'Normal' : `${Number(s.toFixed(2))}x`);

  const activeTrackLabel =
    audioTracks.find((t) => t.id === selectedAudioTrackId)?.displayName ||
    audioTracks.find((t) => t.isOriginal)?.displayName ||
    'Original';

  const shaderSummaryLabel = !isShaderEffectActive(shaderStore)
    ? 'Original'
    : shaderStore.activePreset === 'none' && !isPictureNeutral(shaderStore)
      ? 'Adjusted'
      : getPresetMeta(shaderStore.activePreset).title;

  const tabs: { id: SettingsPicker; label: string; value: string }[] = [
    {
      id: 'QUALITY',
      label: 'Quality',
      value: videoQuality === 'auto' ? 'Auto' : videoQuality
    },
    {
      id: 'SPEED',
      label: 'Speed',
      value: speedLabel(playbackSpeed)
    },
    ...(audioTracks.length > 0
      ? [
          {
            id: 'AUDIO' as SettingsPicker,
            label: 'Audio',
            value: activeTrackLabel.split(' ')[0]
          }
        ]
      : []),
    {
      id: 'SHADERS',
      label: 'Shaders',
      value: shaderSummaryLabel
    }
  ];

  const activeDeck = deck === 'AUDIO' && audioTracks.length === 0 ? 'QUALITY' : deck;
  const activePresetMeta = getPresetMeta(shaderStore.activePreset);
  const pictureNeutral = isPictureNeutral(shaderStore);
  const isZoomed = shaderStore.zoomToFill || fitMode === 'fill';

  const handleToggleZoom = () => {
    const next = !isZoomed;
    shaderStore.setZoomToFill(next);
    if ((fitMode === 'fill') !== next) {
      toggleFitMode();
    }
  };

  const handleCompileCustomShader = () => {
    const err = validateCustomFragmentShader(customDraft);
    setCompileStatus({ checked: true, error: err });
    if (err === null) {
      shaderStore.setCustomShader(customDraft, true);
    } else {
      shaderStore.setCustomShader(customDraft, false);
    }
  };

  const renderContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Top Connected Values Deck (Quality | Speed | Audio | Shaders) */}
      <div
        style={{
          borderRadius: '28px',
          backgroundColor: 'var(--md-sys-color-surface-container-high, #25252C)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Connected ToggleButton Row */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            width: '100%'
          }}
        >
          {tabs.map((tab, idx) => {
            const selected = activeDeck === tab.id;
            const isFirst = idx === 0;
            const isLast = idx === tabs.length - 1;
            const borderRadius = selected
              ? '16px'
              : isFirst
                ? '24px 8px 8px 24px'
                : isLast
                  ? '8px 24px 24px 8px'
                  : '8px';

            return (
              <button
                key={tab.id}
                onClick={() => setDeck(tab.id)}
                style={{
                  flex: 1,
                  minHeight: '58px',
                  padding: '8px 6px',
                  borderRadius,
                  border: 'none',
                  backgroundColor: selected
                    ? 'var(--md-sys-color-primary, #D0BCFF)'
                    : 'var(--md-sys-color-surface-container-highest, #32323A)',
                  color: selected
                    ? 'var(--md-sys-color-on-primary, #1C1B1F)'
                    : 'var(--md-sys-color-on-surface-variant, #CAC4D0)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  transition: 'all 220ms cubic-bezier(0.2, 0, 0, 1)'
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 500, opacity: selected ? 0.9 : 0.78 }}>
                  {tab.label}
                </span>
                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%'
                  }}
                >
                  {tab.value}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Deck Body */}
        {activeDeck === 'QUALITY' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '8px'
            }}
          >
            {qualities.map((q) => {
              const selected = videoQuality === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setVideoQuality(q.id)}
                  style={{
                    minHeight: '48px',
                    padding: '8px 4px',
                    borderRadius: selected ? '12px' : '24px',
                    border: 'none',
                    backgroundColor: selected
                      ? 'var(--md-sys-color-primary, #D0BCFF)'
                      : 'var(--md-sys-color-surface-container-highest, #32323A)',
                    color: selected
                      ? 'var(--md-sys-color-on-primary, #1C1B1F)'
                      : 'var(--md-sys-color-on-surface, #E6E1E5)',
                    fontWeight: selected ? 700 : 500,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)'
                  }}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        )}

        {activeDeck === 'SPEED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Logarithmic Slider + Reset IconButton */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.005}
                value={videoSpeedToSlider(playbackSpeed)}
                onChange={(e) => {
                  const snapped = snapVideoSpeed(videoSliderToSpeed(parseFloat(e.target.value)));
                  setPlaybackSpeed(snapped);
                }}
                style={{
                  flex: 1,
                  accentColor: 'var(--md-sys-color-primary, #D0BCFF)',
                  height: '6px',
                  cursor: 'pointer'
                }}
              />
              {playbackSpeed !== 1.0 && (
                <button
                  onClick={() => setPlaybackSpeed(1.0)}
                  title="Reset to 1x"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'var(--md-sys-color-surface-container-highest, #32323A)',
                    color: 'var(--md-sys-color-on-surface-variant, #CAC4D0)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              )}
            </div>

            {/* 4 One-Tap Speed Cells */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '8px'
              }}
            >
              {SPEED_PRESETS.map((preset) => {
                const selected = Math.abs(playbackSpeed - preset) < 0.01;
                return (
                  <button
                    key={preset}
                    onClick={() => setPlaybackSpeed(preset)}
                    style={{
                      minHeight: '48px',
                      padding: '8px 4px',
                      borderRadius: selected ? '12px' : '24px',
                      border: 'none',
                      backgroundColor: selected
                        ? 'var(--md-sys-color-primary, #D0BCFF)'
                        : 'var(--md-sys-color-surface-container-highest, #32323A)',
                      color: selected
                        ? 'var(--md-sys-color-on-primary, #1C1B1F)'
                        : 'var(--md-sys-color-on-surface, #E6E1E5)',
                      fontWeight: selected ? 700 : 500,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)'
                    }}
                  >
                    {speedLabel(preset)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeDeck === 'AUDIO' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
          >
            {audioTracks.map((track) => {
              const selected =
                track.id === selectedAudioTrackId || (!selectedAudioTrackId && track.isOriginal);
              return (
                <button
                  key={track.id}
                  onClick={() => setAudioTrack(track.id)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: selected
                      ? 'var(--md-sys-color-secondary-container, rgba(208, 188, 255, 0.18))'
                      : 'var(--md-sys-color-surface-container-highest, #32323A)',
                    color: 'var(--md-sys-color-on-surface, #E6E1E5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: selected ? 700 : 500 }}>
                        {track.displayName}
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {track.isOriginal
                          ? 'Original Audio Track'
                          : track.isAutoDubbed
                            ? 'Auto-Dubbed Audio Track'
                            : 'Alternate Track'}{' '}
                        • {Math.round((track.bitrate || 128000) / 1000)} kbps
                      </div>
                    </div>
                  </div>
                  {selected && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--md-sys-color-primary, #D0BCFF)"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Koda ShaderDeck (Ported 1:1 from VideoPlayerContent.kt + VideoShaderControls.kt) */}
        {activeDeck === 'SHADERS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Presets vs Picture Sub-Toggle + Reset Picture Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
                {(['PRESETS', 'PICTURE'] as const).map((sub, idx) => {
                  const selected = shaderSubTab === sub;
                  return (
                    <button
                      key={sub}
                      onClick={() => setShaderSubTab(sub)}
                      style={{
                        flex: 1,
                        minHeight: '38px',
                        padding: '6px 10px',
                        borderRadius: selected
                          ? '12px'
                          : idx === 0
                            ? '20px 6px 6px 20px'
                            : '6px 20px 20px 6px',
                        border: 'none',
                        backgroundColor: selected
                          ? 'var(--md-sys-color-secondary-container, rgba(208, 188, 255, 0.24))'
                          : 'var(--md-sys-color-surface-container-highest, #32323A)',
                        color: selected
                          ? 'var(--md-sys-color-primary, #D0BCFF)'
                          : 'var(--md-sys-color-on-surface-variant, #CAC4D0)',
                        fontWeight: selected ? 700 : 500,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 180ms ease'
                      }}
                    >
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {sub === 'PRESETS' ? 'Presets (16)' : 'Picture Tuning'}
                    </button>
                  );
                })}
              </div>

              {shaderSubTab === 'PICTURE' && !pictureNeutral && (
                <button
                  onClick={() => shaderStore.resetPictureValues()}
                  title="Reset picture sliders"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'var(--md-sys-color-surface-container-highest, #32323A)',
                    color: 'var(--md-sys-color-primary, #D0BCFF)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              )}
            </div>

            {shaderSubTab === 'PRESETS' ? (
              <>
                {/* 4-Column Koda PresetCell Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: '8px'
                  }}
                >
                  {VIDEO_SHADER_PRESETS.map((preset) => {
                    const selected = shaderStore.activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => shaderStore.setActivePreset(preset.id)}
                        title={preset.description}
                        style={{
                          minHeight: '68px',
                          padding: '10px 4px',
                          borderRadius: selected ? '14px' : '24px',
                          border: 'none',
                          backgroundColor: selected
                            ? 'var(--md-sys-color-primary, #D0BCFF)'
                            : 'var(--md-sys-color-surface-container-highest, #32323A)',
                          color: selected
                            ? 'var(--md-sys-color-on-primary, #1C1B1F)'
                            : 'var(--md-sys-color-on-surface, #E6E1E5)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 200ms cubic-bezier(0.2, 0, 0, 1)'
                        }}
                      >
                        <span
                          style={{
                            color: selected
                              ? 'var(--md-sys-color-on-primary, #1C1B1F)'
                              : 'var(--md-sys-color-primary, #D0BCFF)',
                            display: 'flex'
                          }}
                        >
                          {renderPresetIcon(preset.id)}
                        </span>
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: selected ? 700 : 500,
                            lineHeight: 1.15,
                            textAlign: 'center'
                          }}
                        >
                          {preset.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Look Subtitle Banner */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    fontSize: '0.78rem',
                    color: 'var(--md-sys-color-on-surface-variant, #CAC4D0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <span>
                    <strong style={{ color: 'var(--md-sys-color-on-surface, #E6E1E5)' }}>
                      {activePresetMeta.title}:
                    </strong>{' '}
                    {activePresetMeta.description}
                  </span>
                </div>

                {/* Custom GLSL Fragment Shader Editor (when Custom preset is chosen) */}
                {shaderStore.activePreset === 'custom' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '20px',
                      backgroundColor: 'var(--md-sys-color-surface-container, #1D1B20)',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--md-sys-color-primary, #D0BCFF)' }}>
                      Starter GLSL Templates
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {STARTER_SHADER_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          onClick={() => {
                            setCustomDraft(tpl.source);
                            setCompileStatus({ checked: false, error: null });
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.14)',
                            backgroundColor: 'var(--md-sys-color-surface-container-high, #25252C)',
                            color: 'var(--md-sys-color-on-surface, #E6E1E5)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {tpl.title}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={customDraft}
                      onChange={(e) => {
                        setCustomDraft(e.target.value);
                        setCompileStatus({ checked: false, error: null });
                      }}
                      spellCheck={false}
                      rows={7}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '14px',
                        border: '1px solid rgba(255,255,255,0.14)',
                        backgroundColor: '#121216',
                        color: '#E6E1E5',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '0.76rem',
                        lineHeight: 1.45,
                        resize: 'vertical'
                      }}
                    />

                    {compileStatus.checked && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: '12px',
                          backgroundColor: compileStatus.error
                            ? 'rgba(242, 184, 181, 0.14)'
                            : 'rgba(168, 218, 181, 0.14)',
                          color: compileStatus.error ? '#F2B8B5' : '#A8DAB5',
                          fontSize: '0.76rem',
                          fontFamily: compileStatus.error ? 'monospace' : 'inherit'
                        }}
                      >
                        {compileStatus.error
                          ? `GLSL Error: ${compileStatus.error}`
                          : 'Shader compiled & applied to video pipeline.'}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleCompileCustomShader}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: 'var(--md-sys-color-primary, #D0BCFF)',
                          color: 'var(--md-sys-color-on-primary, #1C1B1F)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        Compile & Apply
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Koda ShaderPictureSliders (Sharpen, Brightness, Contrast, Saturation) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 4px' }}>
                <PictureSliderRow
                  label="Sharpen (CAS)"
                  valueText={
                    !activePresetMeta.sharpens
                      ? 'Not used by look'
                      : shaderStore.sharpness <= 0.005
                        ? 'Off'
                        : `${Math.round(shaderStore.sharpness * 100)}%`
                  }
                  value={shaderStore.sharpness}
                  min={0}
                  max={1}
                  neutral={SHARPNESS_OFF}
                  enabled={activePresetMeta.sharpens}
                  onChange={(val) => shaderStore.setPictureValues({ sharpness: val })}
                />
                <PictureSliderRow
                  label="Brightness"
                  valueText={
                    shaderStore.activePreset === 'custom'
                      ? 'Not used'
                      : `${shaderStore.brightness > 0 ? '+' : ''}${Math.round(shaderStore.brightness * 100)}%`
                  }
                  value={shaderStore.brightness}
                  min={-0.4}
                  max={0.4}
                  neutral={NEUTRAL_BRIGHTNESS}
                  enabled={shaderStore.activePreset !== 'custom'}
                  onChange={(val) => shaderStore.setPictureValues({ brightness: val })}
                />
                <PictureSliderRow
                  label="Contrast"
                  valueText={
                    shaderStore.activePreset === 'custom'
                      ? 'Not used'
                      : `${Math.round(shaderStore.contrast * 100)}%`
                  }
                  value={shaderStore.contrast}
                  min={0.5}
                  max={1.5}
                  neutral={NEUTRAL_CONTRAST}
                  enabled={shaderStore.activePreset !== 'custom'}
                  onChange={(val) => shaderStore.setPictureValues({ contrast: val })}
                />
                <PictureSliderRow
                  label="Saturation"
                  valueText={
                    shaderStore.activePreset === 'custom'
                      ? 'Not used'
                      : `${Math.round(shaderStore.saturation * 100)}%`
                  }
                  value={shaderStore.saturation}
                  min={0}
                  max={2}
                  neutral={NEUTRAL_SATURATION}
                  enabled={shaderStore.activePreset !== 'custom'}
                  onChange={(val) => shaderStore.setPictureValues({ saturation: val })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sleep Timer Inline Picker (if opened) */}
      {showSleepPicker && (
        <div
          style={{
            borderRadius: '24px',
            backgroundColor: 'var(--md-sys-color-surface-container-high, #25252C)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--md-sys-color-on-surface-variant, #CAC4D0)',
              padding: '0 4px'
            }}
          >
            Sleep Timer
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
            {[
              { min: null, label: 'Off' },
              { min: 15, label: '15m' },
              { min: 30, label: '30m' },
              { min: 45, label: '45m' },
              { min: 60, label: '60m' }
            ].map((opt) => {
              const selected = sleepTimerMinutes === opt.min;
              return (
                <button
                  key={String(opt.min)}
                  onClick={() => {
                    setSleepTimer(opt.min);
                    setShowSleepPicker(false);
                  }}
                  style={{
                    minHeight: '42px',
                    borderRadius: selected ? '12px' : '20px',
                    border: 'none',
                    backgroundColor: selected
                      ? 'var(--md-sys-color-primary, #D0BCFF)'
                      : 'var(--md-sys-color-surface-container-highest, #32323A)',
                    color: selected
                      ? 'var(--md-sys-color-on-primary, #1C1B1F)'
                      : 'var(--md-sys-color-on-surface, #E6E1E5)',
                    fontWeight: selected ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Switch Tiles Grid (4 Columns — Filled State Tiles) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '8px'
        }}
      >
        {/* Autoplay Tile */}
        <OptionTile
          label="Autoplay"
          selected={autoplay}
          onClick={toggleAutoplay}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          }
        />

        {/* Loop Tile */}
        <OptionTile
          label="Loop"
          selected={isLooping}
          onClick={toggleLoop}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          }
        />

        {/* Zoom to Fill Tile */}
        <OptionTile
          label={isZoomed ? 'Zoomed' : 'Zoom Fill'}
          selected={isZoomed}
          onClick={handleToggleZoom}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          }
        />

        {/* Ambient Cinema Glow Tile */}
        <OptionTile
          label="Ambilight"
          selected={shaderStore.ambientGlowEnabled}
          onClick={() => shaderStore.setAmbientGlowEnabled(!shaderStore.ambientGlowEnabled)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          }
        />

        {/* Sleep Timer Tile */}
        <OptionTile
          label={sleepTimerMinutes ? `${sleepTimerMinutes}m left` : 'Sleep'}
          selected={Boolean(sleepTimerMinutes)}
          onClick={() => setShowSleepPicker(!showSleepPicker)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          }
        />

        {/* Timed Comments Tile */}
        <OptionTile
          label="Timed CC"
          selected={timedCommentsActive}
          onClick={() => onTimedCommentsChanged(!timedCommentsActive)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
        />

        {/* SponsorBlock Auto-Skip Tile */}
        <OptionTile
          label={shaderStore.sponsorBlockEnabled ? 'SponsorSkip' : 'Sponsor Off'}
          selected={shaderStore.sponsorBlockEnabled}
          onClick={() => shaderStore.setSponsorBlockEnabled(!shaderStore.sponsorBlockEnabled)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          }
        />

        {/* Screen Lock Tile */}
        {onLockScreen && (
          <OptionTile
            label="Lock Touch"
            selected={false}
            onClick={() => {
              onClose();
              onLockScreen();
            }}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
          />
        )}
      </div>

      {/* Shortcuts Grid (Unfilled Utility Cells) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '8px'
        }}
      >
        <OptionUtility
          label="Mini / PiP"
          onClick={() => {
            onClose();
            onEnterPip();
          }}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <rect x="11" y="11" width="9" height="7" rx="1" fill="currentColor" />
            </svg>
          }
        />

        <OptionUtility
          label={commentsOpen ? 'Close Comments' : 'Comments'}
          onClick={() => {
            onClose();
            onOpenComments();
          }}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          }
        />

        <OptionUtility
          label="Listen as music"
          onClick={() => {
            onClose();
            onListenAsMusic();
          }}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          }
        />
      </div>
    </div>
  );

  if (isTheater) {
    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10050,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '390px',
            maxWidth: '92vw',
            height: 'calc(100% - 24px)',
            margin: '12px',
            borderRadius: '28px',
            backgroundColor: 'var(--md-sys-color-surface-container, #1D1B20)',
            color: 'var(--md-sys-color-on-surface, #E6E1E5)',
            padding: '18px',
            overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 700 }}>Playback settings</h3>
            <button
              onClick={onClose}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-surface-container-high, #2B2930)',
                color: 'var(--md-sys-color-on-surface, #E6E1E5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '86vh',
          borderRadius: '28px 28px 0 0',
          backgroundColor: 'var(--md-sys-color-surface-container, #1D1B20)',
          color: 'var(--md-sys-color-on-surface, #E6E1E5)',
          padding: '12px 16px 28px',
          overflowY: 'auto',
          boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.65)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '4px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            margin: '4px auto 14px'
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 12px'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.22rem', fontWeight: 700 }}>Playback settings</h3>
          <button
            onClick={onClose}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-surface-container-high, #2B2930)',
              color: 'var(--md-sys-color-on-surface, #E6E1E5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

interface PictureSliderRowProps {
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  neutral: number;
  enabled: boolean;
  onChange: (value: number) => void;
}

const PictureSliderRow: React.FC<PictureSliderRowProps> = ({
  label,
  valueText,
  value,
  min,
  max,
  neutral,
  enabled,
  onChange
}) => {
  const detent = (max - min) * 0.03;
  const changed = enabled && Math.abs(value - neutral) > 0.005;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: enabled ? 1 : 0.48 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--md-sys-color-on-surface, #E6E1E5)' }}>
          {label}
        </span>
        <span
          style={{
            fontSize: '0.82rem',
            fontWeight: changed ? 700 : 500,
            color: changed
              ? 'var(--md-sys-color-primary, #D0BCFF)'
              : 'var(--md-sys-color-on-surface-variant, #CAC4D0)'
          }}
        >
          {valueText}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        disabled={!enabled}
        value={value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          const next = Math.abs(raw - neutral) <= detent ? neutral : Math.round(raw * 100) / 100;
          onChange(next);
        }}
        style={{
          width: '100%',
          accentColor: 'var(--md-sys-color-primary, #D0BCFF)',
          height: '6px',
          cursor: enabled ? 'pointer' : 'not-allowed'
        }}
      />
    </div>
  );
};

interface OptionTileProps {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}

const OptionTile: React.FC<OptionTileProps> = ({ icon, label, selected, onClick }) => (
  <button
    onClick={onClick}
    style={{
      minHeight: '72px',
      padding: '10px 6px',
      borderRadius: selected ? '16px' : '24px',
      border: 'none',
      backgroundColor: selected
        ? 'var(--md-sys-color-primary, #D0BCFF)'
        : 'var(--md-sys-color-surface-container-high, #25252C)',
      color: selected
        ? 'var(--md-sys-color-on-primary, #1C1B1F)'
        : 'var(--md-sys-color-on-surface, #E6E1E5)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      cursor: 'pointer',
      transition: 'all 220ms cubic-bezier(0.2, 0, 0, 1)'
    }}
  >
    <span style={{ display: 'flex' }}>{icon}</span>
    <span
      style={{
        fontSize: '0.76rem',
        fontWeight: selected ? 700 : 500,
        textAlign: 'center',
        lineHeight: 1.15,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}
    >
      {label}
    </span>
  </button>
);

interface OptionUtilityProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const OptionUtility: React.FC<OptionUtilityProps> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      minHeight: '64px',
      padding: '10px 6px',
      borderRadius: '20px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backgroundColor: 'transparent',
      color: 'var(--md-sys-color-on-surface-variant, #CAC4D0)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      cursor: 'pointer',
      transition: 'background-color 180ms ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
    }}
  >
    <span style={{ display: 'flex' }}>{icon}</span>
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 500,
        textAlign: 'center',
        lineHeight: 1.15
      }}
    >
      {label}
    </span>
  </button>
);
