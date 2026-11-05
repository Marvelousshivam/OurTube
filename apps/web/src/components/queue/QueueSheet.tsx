import React from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';

export interface QueueSheetProps {
  isEmbedded?: boolean;
}

export const QueueSheet: React.FC<QueueSheetProps> = ({ isEmbedded = false }) => {
  const {
    currentTrack,
    queue,
    queueIndex,
    playTrack,
    removeFromQueue,
    setQueueOpen
  } = usePlayerStore();

  const formatDuration = (secs?: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        maxWidth: isEmbedded ? '100%' : '760px',
        margin: '0 auto',
        padding: isEmbedded ? '0 12px' : '20px 24px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Standalone Header (Modal sheet only) */}
      {!isEmbedded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="material-symbols-rounded"
              style={{ color: 'var(--md-sys-color-primary)', fontSize: '22px' }}
            >
              queue_music
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em' }}>Up Next</h2>
            <span
              className="glass-pill"
              style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
                color: 'var(--md-sys-color-outline)'
              }}
            >
              {queue.length} TRACKS
            </span>
          </div>

          <button
            onClick={() => setQueueOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--md-sys-color-on-surface)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '50%'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              close
            </span>
          </button>
        </div>
      )}

      {/* Fluid Track Queue List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: isEmbedded ? '16px 8px 120px 8px' : '16px 4px 100px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {queue.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '240px',
              gap: '12px',
              color: 'var(--md-sys-color-outline)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '36px', opacity: 0.5 }}>
              queue_music
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Queue is empty</span>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = idx === queueIndex || track.id === currentTrack?.id;
            return (
              <div
                key={`${track.id}-${idx}`}
                onClick={() => playTrack(track)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  backgroundColor: isCurrent
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'transparent',
                  border: isCurrent
                    ? '1px solid rgba(255, 255, 255, 0.16)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'rgba(255, 255, 255, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  {/* Track Index or Playing Wave Indicator */}
                  <div
                    style={{
                      width: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {isCurrent ? (
                      <span
                        className="material-symbols-rounded"
                        style={{
                          fontSize: '18px',
                          color: 'var(--md-sys-color-primary)',
                          animation: 'pulse 1.2s infinite'
                        }}
                      >
                        equalizer
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--md-sys-color-outline)',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Artwork Thumbnail */}
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <img
                      src={sizedArtwork(track.thumbnailUrl, 120)}
                      alt={track.title}
                      onError={(e) => handleArtworkError(e, track.thumbnailUrl)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Track Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: isCurrent ? 800 : 600,
                        color: isCurrent
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-on-surface)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {track.title}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--md-sys-color-outline)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {track.artist}
                    </span>
                  </div>
                </div>

                {/* Right Actions: Duration & Remove */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: 'var(--md-sys-color-outline)'
                    }}
                  >
                    {formatDuration(track.duration)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(idx);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--md-sys-color-outline)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '50%'
                    }}
                    title="Remove from queue"
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                      remove_circle_outline
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
