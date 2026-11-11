import React, { useState } from 'react';
import { TrackMetadata } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { useSettingsStore } from '../../store/settingsStore';

interface NerdStatsCardProps {
  track: TrackMetadata;
}

const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

export const NerdStatsCard: React.FC<NerdStatsCardProps> = ({ track }) => {
  const { streamAudioUrl, activeStreamSpec, lyricsData } = usePlayerStore();
  const { dacBitPerfectExclusive, setDacBitPerfectExclusive } = useSettingsStore();
  const [copied, setCopied] = useState(false);

  const isOpus = streamAudioUrl?.includes('opus') || streamAudioUrl?.includes('webm');
  const codecName = activeStreamSpec?.codec || (isOpus ? 'Opus 251 (WebM)' : 'AAC-LC 140 (MP4)');
  const bitrateStr = activeStreamSpec?.bitrateKbps
    ? `${activeStreamSpec.bitrateKbps} kbps`
    : isOpus
      ? '160 kbps'
      : '256 kbps (HQ AAC)';

  const sampleRate = activeStreamSpec?.sampleRate
    ? `${(activeStreamSpec.sampleRate / 1000).toFixed(activeStreamSpec.sampleRate % 1000 === 0 ? 0 : 1)} kHz · ${activeStreamSpec.bitDepth || 16}-bit Stereo`
    : '44.1 kHz · 16-bit Stereo';

  const sourceName = activeStreamSpec?.sourceName || 'YouTube Music';
  const outputMode = activeStreamSpec?.outputMode || 'Standard Shared Mixer';
  const dacDevice = activeStreamSpec?.dacDeviceName || 'Windows Default Render Endpoint';

  const lyricsTimingStr = lyricsData?.wordSynced
    ? 'Word-by-word synced (Apple Music TTML)'
    : lyricsData?.synced
      ? 'Line-synced'
      : lyricsData?.lines && lyricsData.lines.length > 0
        ? 'Plain text'
        : 'None available';

  const lyricsProviderStr =
    lyricsData?.provider === 'lrc.red'
      ? 'lrc.red (Apple Music catalog)'
      : lyricsData?.provider === 'lrclib'
        ? 'lrclib.net'
        : lyricsData?.provider === 'innertube'
          ? 'YouTube Music official'
          : '—';

  const handleCopyLyrics = async () => {
    if (!lyricsData || lyricsData.lines.length === 0) return;
    const fullText = lyricsData.lines.map((l) => l.text).join('\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
        borderRadius: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="material-symbols-rounded"
            style={{
              fontSize: '20px',
              color: activeStreamSpec?.isLossless ? '#facc15' : 'var(--md-sys-color-primary)'
            }}
          >
            tune
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase'
            }}
          >
            Audio & Metadata Specs
          </span>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '9999px',
            backgroundColor: activeStreamSpec?.isLossless
              ? 'rgba(234, 179, 8, 0.18)'
              : 'rgba(255, 255, 255, 0.06)',
            color: activeStreamSpec?.isLossless ? '#facc15' : 'var(--md-sys-color-on-surface)',
            border: activeStreamSpec?.isLossless
              ? '1px solid rgba(234, 179, 8, 0.45)'
              : '1px solid transparent',
            letterSpacing: '0.04em'
          }}
        >
          {activeStreamSpec?.shortBadgeText || codecName.split(' ')[0]}
        </span>
      </div>

      {/* Technical Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px'
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Audio Bitrate
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px',
              fontFamily: 'monospace'
            }}
          >
            {bitrateStr}
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Audio Codec & Stream
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px',
              fontFamily: 'monospace'
            }}
          >
            {codecName}
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Sample Resolution
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px',
              fontFamily: 'monospace',
              color: activeStreamSpec?.isLossless ? '#facc15' : 'inherit'
            }}
          >
            {sampleRate}
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Source Provider
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {sourceName}
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Output Architecture
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px',
              color: outputMode.includes('Exclusive') ? '#34d399' : 'inherit'
            }}
          >
            {outputMode}
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Hardware DAC Endpoint
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={dacDevice}
          >
            {dacDevice}
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Lyrics Timing
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px',
              color: lyricsData?.wordSynced ? 'var(--md-sys-color-primary)' : 'inherit'
            }}
          >
            {lyricsTimingStr}
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
            Lyrics Provider
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              marginTop: '4px'
            }}
          >
            {lyricsProviderStr}
          </div>
        </div>
      </div>

      {/* Desktop WASAPI Bit-Perfect Quick Toggle */}
      {isTauri && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '14px',
            backgroundColor: dacBitPerfectExclusive ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.04)',
            border: dacBitPerfectExclusive ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>
              DAC Bit-Perfect Exclusive Mode
            </span>
            <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)' }}>
              Locks hardware DAC sample rate & bit depth directly (bypasses Windows mixer)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDacBitPerfectExclusive(!dacBitPerfectExclusive)}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: 'none',
              backgroundColor: dacBitPerfectExclusive ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
              color: dacBitPerfectExclusive ? '#022c22' : 'var(--md-sys-color-on-surface)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 150ms ease'
            }}
          >
            {dacBitPerfectExclusive ? 'Active' : 'Off'}
          </button>
        </div>
      )}

      {/* Copy Lyrics Action Button inside Specs */}
      {lyricsData && lyricsData.lines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={handleCopyLyrics}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 18px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: copied ? '#4caf50' : 'var(--md-sys-color-on-surface)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>
              {copied ? 'Lyrics copied to clipboard' : `Copy Full Lyrics (${lyricsData.lines.length} lines)`}
            </span>
          </button>
        </div>
      )}

      {/* Stream Architecture Footnote */}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--md-sys-color-outline)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          lineHeight: '1.4'
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '15px' }}>
          info
        </span>
        {activeStreamSpec?.isLossless
          ? `Streamed in bit-perfect lossless FLAC via extension addon: ${activeStreamSpec.sourceName}.`
          : 'Streamed via direct VisionOS unencrypted Google Video CDN with native byte-range audio decoding.'}
      </div>
    </div>
  );
};
