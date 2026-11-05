import React, { useState } from 'react';
import { TrackMetadata } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

interface NerdStatsCardProps {
  track: TrackMetadata;
}

export const NerdStatsCard: React.FC<NerdStatsCardProps> = ({ track }) => {
  const { streamAudioUrl, playbackMode, lyricsData } = usePlayerStore();
  const [copied, setCopied] = useState(false);

  const isOpus = streamAudioUrl?.includes('opus') || streamAudioUrl?.includes('webm');
  const codecName = isOpus ? 'Opus 251 (WebM)' : 'AAC-LC 140 (MP4)';
  const bitrateStr = isOpus ? '160 kbps' : '256 kbps (HQ AAC)';
  const sampleRate = '44.1 kHz · 16-bit Stereo';

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
            style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)' }}
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
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: 'var(--md-sys-color-on-surface)',
            letterSpacing: '0.04em'
          }}
        >
          {codecName.split(' ')[0]}
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
            Audio Codec
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
              fontFamily: 'monospace'
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
            Track ID
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
            {track.id}
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
        Streamed via direct VisionOS unencrypted Google Video CDN with native byte-range audio decoding.
      </div>
    </div>
  );
};
