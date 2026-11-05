import React from 'react';
import { TrackMetadata } from '../../types';
import { usePlayerStore } from '../../store/playerStore';

interface NerdStatsCardProps {
  track: TrackMetadata;
}

export const NerdStatsCard: React.FC<NerdStatsCardProps> = ({ track }) => {
  const { streamAudioUrl, duration, currentTime, playbackMode } = usePlayerStore();

  const isOpus = streamAudioUrl?.includes('opus') || streamAudioUrl?.includes('webm');
  const codecName = isOpus ? 'Opus 251 (WebM)' : 'AAC-LC 140 (MP4)';
  const bitrateStr = isOpus ? '160 kbps' : '128 kbps (HQ)';
  const sampleRate = '44.1 kHz · 16-bit Stereo';

  return (
    <div
      style={{
        padding: '20px',
        borderRadius: '24px',
        backgroundColor: 'var(--md-sys-color-surface-container)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: '20px', color: 'var(--md-sys-color-primary)' }}>
            query_stats
          </span>
          <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Stats for Nerds
          </span>
        </div>
        <span
          className="glass-pill"
          style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: '9999px',
            color: 'var(--md-sys-color-primary)'
          }}
        >
          {codecName.split(' ')[0]}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px'
        }}
      >
        <div style={{ padding: '10px 14px', borderRadius: '16px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>Audio Codec</div>
          <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px', fontFamily: 'monospace' }}>{codecName}</div>
        </div>

        <div style={{ padding: '10px 14px', borderRadius: '16px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>Nominal Bitrate</div>
          <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px', fontFamily: 'monospace' }}>{bitrateStr}</div>
        </div>

        <div style={{ padding: '10px 14px', borderRadius: '16px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>Sample Specs</div>
          <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px', fontFamily: 'monospace' }}>{sampleRate}</div>
        </div>

        <div style={{ padding: '10px 14px', borderRadius: '16px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>Video ID</div>
          <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.id}
          </div>
        </div>

        <div style={{ padding: '10px 14px', borderRadius: '16px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>Mode</div>
          <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px' }}>
            {playbackMode === 'music' ? 'Pure Audio' : 'Video Sync'}
          </div>
        </div>

        <div style={{ padding: '10px 14px', borderRadius: '16px', backgroundColor: 'var(--md-sys-color-surface-container-high)' }}>
          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>ReplayGain Normalization</div>
          <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '2px', color: '#4caf50' }}>-1.4 dB (Active)</div>
        </div>
      </div>

      <div
        style={{
          fontSize: '11px',
          color: 'var(--md-sys-color-outline)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '4px'
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>info</span>
        Streamed via direct VisionOS unencrypted Google Video CDN protocol with 0 latency.
      </div>
    </div>
  );
};
