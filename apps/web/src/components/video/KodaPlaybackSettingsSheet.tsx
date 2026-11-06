import React, { useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { VideoQuality, YouTubeAudioTrackOption } from '../../types';

export type SettingsTab = 'quality' | 'speed' | 'audio';

interface KodaPlaybackSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const QUALITY_OPTIONS: VideoQuality[] = ['auto', '1080p', '720p', '480p', '360p'];
const SLEEP_TIMER_OPTIONS = [
  { label: 'Off', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 }
];

export const KodaPlaybackSettingsSheet: React.FC<KodaPlaybackSettingsSheetProps> = ({
  isOpen,
  onClose,
  initialTab = 'quality'
}) => {
  const {
    videoQuality,
    setVideoQuality,
    playbackSpeed,
    setPlaybackSpeed,
    audioTracks,
    selectedAudioTrackId,
    setAudioTrack,
    isLooping,
    toggleLoop,
    fitMode,
    toggleFitMode,
    sleepTimerEndsAt,
    sleepTimerMinutes,
    setSleepTimer,
    autoplay,
    toggleAutoplay,
    listenAsMusic
  } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [showSleepPicker, setShowSleepPicker] = useState(false);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const currentTrackObj = audioTracks.find((t) => t.id === selectedAudioTrackId) || audioTracks[0];
  const audioTrackLabel = currentTrackObj
    ? currentTrackObj.displayName
    : 'Original';

  const formatSpeed = (s: number) => (s === 1.0 ? '1.0×' : `${s}×`);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      {/* Dark Scrim */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'opacity 200ms ease'
        }}
        onClick={onClose}
      />

      {/* Material 3 Bottom Sheet / Modal Dialog (Matching Koda PlayerSettingsSections) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--md-sys-color-surface-container, #1d2024)',
          borderRadius: '28px',
          border: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.12))',
          padding: '20px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: 'var(--md-sys-color-on-surface, #e2e2e9)',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'kodaToastIn 200ms ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant, rgba(255, 255, 255, 0.08))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '22px',
                color: 'var(--md-sys-color-primary, #a8c7fa)'
              }}
            >
              tune
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                letterSpacing: '-0.01em'
              }}
            >
              Playback Settings
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 150ms ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              close
            </span>
          </button>
        </div>

        {/* TOP BLOCK: SurfaceContainerHigh Deck (Connected Tabs + Deck) */}
        <div
          style={{
            borderRadius: '22px',
            backgroundColor: 'var(--md-sys-color-surface-container-high, #282a2f)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          {/* Connected Button Group Tabs */}
          <div
            style={{
              display: 'flex',
              borderRadius: '9999px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              padding: '4px',
              gap: '4px'
            }}
          >
            {/* Quality Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('quality')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor:
                  activeTab === 'quality'
                    ? 'var(--md-sys-color-primary, #a8c7fa)'
                    : 'transparent',
                color:
                  activeTab === 'quality'
                    ? 'var(--md-sys-color-on-primary, #083063)'
                    : 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
              }}
            >
              <span>Quality</span>
              <span style={{ fontSize: '10px', opacity: 0.85, textTransform: 'uppercase' }}>
                {videoQuality}
              </span>
            </button>

            {/* Speed Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('speed')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor:
                  activeTab === 'speed'
                    ? 'var(--md-sys-color-primary, #a8c7fa)'
                    : 'transparent',
                color:
                  activeTab === 'speed'
                    ? 'var(--md-sys-color-on-primary, #083063)'
                    : 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
              }}
            >
              <span>Speed</span>
              <span style={{ fontSize: '10px', opacity: 0.85 }}>
                {formatSpeed(playbackSpeed)}
              </span>
            </button>

            {/* Audio Track Tab (only when audio tracks exist) */}
            {audioTracks.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('audio')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor:
                    activeTab === 'audio'
                      ? 'var(--md-sys-color-primary, #a8c7fa)'
                      : 'transparent',
                  color:
                    activeTab === 'audio'
                      ? 'var(--md-sys-color-on-primary, #083063)'
                      : 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
                }}
              >
                <span>Audio</span>
                <span
                  style={{
                    fontSize: '10px',
                    opacity: 0.85,
                    maxWidth: '85px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {audioTrackLabel}
                </span>
              </button>
            )}
          </div>

          {/* Tab Content Deck */}
          <div style={{ paddingTop: '4px' }}>
            {/* 1. QUALITY DECK */}
            {activeTab === 'quality' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px'
                }}
              >
                {QUALITY_OPTIONS.map((q) => {
                  const isSelected = videoQuality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setVideoQuality(q)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary, #a8c7fa)'
                          : 'rgba(255, 255, 255, 0.06)',
                        color: isSelected
                          ? 'var(--md-sys-color-on-primary, #083063)'
                          : 'var(--md-sys-color-on-surface, #e2e2e9)',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 150ms ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            'rgba(255, 255, 255, 0.12)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            'rgba(255, 255, 255, 0.06)';
                        }
                      }}
                    >
                      {q.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. SPEED DECK */}
            {activeTab === 'speed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Continuous Slider with Reset Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: '18px', color: 'var(--md-sys-color-on-surface-variant, #94a3b8)' }}
                  >
                    speed
                  </span>
                  <input
                    type="range"
                    min="0.25"
                    max="2.0"
                    step="0.05"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: 'var(--md-sys-color-primary, #a8c7fa)',
                      cursor: 'pointer'
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: 700,
                      width: '44px',
                      textAlign: 'right'
                    }}
                  >
                    {formatSpeed(playbackSpeed)}
                  </span>
                  {playbackSpeed !== 1.0 && (
                    <button
                      type="button"
                      title="Reset to 1.0x"
                      onClick={() => setPlaybackSpeed(1.0)}
                      style={{
                        padding: '4px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        color: 'var(--md-sys-color-on-surface, #e2e2e9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                        restart_alt
                      </span>
                    </button>
                  )}
                </div>

                {/* Preset Cells */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px'
                  }}
                >
                  {SPEED_PRESETS.map((p) => {
                    const isSelected = Math.abs(playbackSpeed - p) < 0.02;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlaybackSpeed(p)}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: isSelected
                            ? 'var(--md-sys-color-primary, #a8c7fa)'
                            : 'rgba(255, 255, 255, 0.06)',
                          color: isSelected
                            ? 'var(--md-sys-color-on-primary, #083063)'
                            : 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 150ms ease'
                        }}
                      >
                        {formatSpeed(p)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. AUDIO DECK */}
            {activeTab === 'audio' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}
              >
                {audioTracks.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      padding: '12px',
                      fontSize: '13px',
                      color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                      textAlign: 'center'
                    }}
                  >
                    Original soundtrack active. No alternate dubs.
                  </p>
                ) : (
                  audioTracks.map((track) => {
                    const isSelected =
                      selectedAudioTrackId === track.id ||
                      (!selectedAudioTrackId && track.isOriginal);

                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => setAudioTrack(track.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: 'none',
                          backgroundColor: isSelected
                            ? 'var(--md-sys-color-primary-container, #23477c)'
                            : 'rgba(255, 255, 255, 0.04)',
                          color: isSelected
                            ? 'var(--md-sys-color-on-primary-container, #d3e3fd)'
                            : 'var(--md-sys-color-on-surface, #e2e2e9)',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '13px',
                          textAlign: 'left',
                          transition: 'background-color 150ms ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span
                            className="material-symbols-rounded"
                            style={{
                              fontSize: '18px',
                              color: isSelected
                                ? 'var(--md-sys-color-primary, #a8c7fa)'
                                : 'var(--md-sys-color-on-surface-variant, #94a3b8)'
                            }}
                          >
                            {track.isOriginal ? 'music_note' : 'translate'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {track.displayName}
                          </span>
                        </div>
                        {isSelected && (
                          <span
                            className="material-symbols-rounded"
                            style={{ fontSize: '18px', color: 'var(--md-sys-color-primary, #a8c7fa)' }}
                          >
                            check
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM BLOCK: Action Grid (M3 Filled OptionTiles) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px'
          }}
        >
          {/* Autoplay */}
          <button
            type="button"
            onClick={toggleAutoplay}
            style={{
              padding: '12px 8px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: autoplay
                ? 'var(--md-sys-color-primary, #a8c7fa)'
                : 'rgba(255, 255, 255, 0.06)',
              color: autoplay
                ? 'var(--md-sys-color-on-primary, #083063)'
                : 'var(--md-sys-color-on-surface, #e2e2e9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              play_circle
            </span>
            <span>Autoplay</span>
          </button>

          {/* Loop */}
          <button
            type="button"
            onClick={toggleLoop}
            style={{
              padding: '12px 8px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: isLooping
                ? 'var(--md-sys-color-primary, #a8c7fa)'
                : 'rgba(255, 255, 255, 0.06)',
              color: isLooping
                ? 'var(--md-sys-color-on-primary, #083063)'
                : 'var(--md-sys-color-on-surface, #e2e2e9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              repeat
            </span>
            <span>Loop</span>
          </button>

          {/* Sleep Timer */}
          <button
            type="button"
            onClick={() => setShowSleepPicker(!showSleepPicker)}
            style={{
              padding: '12px 8px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: sleepTimerEndsAt
                ? 'var(--md-sys-color-primary, #a8c7fa)'
                : 'rgba(255, 255, 255, 0.06)',
              color: sleepTimerEndsAt
                ? 'var(--md-sys-color-on-primary, #083063)'
                : 'var(--md-sys-color-on-surface, #e2e2e9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              bedtime
            </span>
            <span>{sleepTimerMinutes ? `${sleepTimerMinutes}m` : 'Sleep'}</span>
          </button>

          {/* Zoom to Fill */}
          <button
            type="button"
            onClick={toggleFitMode}
            style={{
              padding: '12px 8px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: fitMode === 'fill'
                ? 'var(--md-sys-color-primary, #a8c7fa)'
                : 'rgba(255, 255, 255, 0.06)',
              color: fitMode === 'fill'
                ? 'var(--md-sys-color-on-primary, #083063)'
                : 'var(--md-sys-color-on-surface, #e2e2e9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              {fitMode === 'fill' ? 'zoom_in_map' : 'aspect_ratio'}
            </span>
            <span>{fitMode === 'fill' ? 'Fill' : 'Fit'}</span>
          </button>
        </div>

        {/* Sleep Timer Picker Expandable Sub-panel */}
        {showSleepPicker && (
          <div
            style={{
              padding: '12px',
              borderRadius: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface-variant, #94a3b8)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Set Sleep Timer
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {SLEEP_TIMER_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setSleepTimer(opt.minutes);
                    setShowSleepPicker(false);
                  }}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor:
                      sleepTimerMinutes === opt.minutes
                        ? 'var(--md-sys-color-primary, #a8c7fa)'
                        : 'rgba(255, 255, 255, 0.06)',
                    color:
                      sleepTimerMinutes === opt.minutes
                        ? 'var(--md-sys-color-on-primary, #083063)'
                        : 'var(--md-sys-color-on-surface, #e2e2e9)',
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pivot Action: Listen as Music */}
        <button
          type="button"
          onClick={() => {
            onClose();
            listenAsMusic();
          }}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '18px',
            backgroundColor: 'var(--md-sys-color-secondary-container, #3f4759)',
            color: 'var(--md-sys-color-on-secondary-container, #dae2f9)',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'background-color 150ms ease'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-primary, #a8c7fa)';
            (e.currentTarget as HTMLElement).style.color = 'var(--md-sys-color-on-primary, #083063)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-secondary-container, #3f4759)';
            (e.currentTarget as HTMLElement).style.color = 'var(--md-sys-color-on-secondary-container, #dae2f9)';
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
            headphones
          </span>
          <span>Listen as Music in Background</span>
        </button>
      </div>
    </div>
  );
};
