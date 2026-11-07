import React, { useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';
import { QueueEntry } from '../../types';

export interface QueueSheetProps {
  isEmbedded?: boolean;
}

const MOOD_CHIPS = ['All', 'Familiar', 'Popular', 'Discover', 'Deep cuts'];

export const QueueSheet: React.FC<QueueSheetProps> = ({ isEmbedded = false }) => {
  const {
    currentTrack,
    isPlaying,
    queue,
    queueIndex,
    autoplay,
    toggleAutoplay,
    loadRadioQueue,
    jumpToQueueIndex,
    removeFromQueue,
    clearUserQueue,
    setQueueOpen
  } = usePlayerStore();

  const [activeMood, setActiveMood] = useState('All');
  const [showHistory, setShowHistory] = useState(false);

  const formatDuration = (secs?: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Group queue entries into BitChord 3-tier structure
  const currentEntry: QueueEntry | null =
    queue[queueIndex] || (currentTrack ? { entryId: 'current', track: currentTrack, tier: 'context' } : null);

  const historyEntries: { entry: QueueEntry; actualIndex: number }[] = [];
  const upcomingUserEntries: { entry: QueueEntry; actualIndex: number }[] = [];
  const upcomingContextEntries: { entry: QueueEntry; actualIndex: number }[] = [];
  const upcomingAutoplayEntries: { entry: QueueEntry; actualIndex: number }[] = [];

  queue.forEach((entry, idx) => {
    if (idx < queueIndex) {
      historyEntries.push({ entry, actualIndex: idx });
    } else if (idx > queueIndex) {
      if (entry.tier === 'user') {
        upcomingUserEntries.push({ entry, actualIndex: idx });
      } else if (entry.tier === 'context') {
        upcomingContextEntries.push({ entry, actualIndex: idx });
      } else {
        upcomingAutoplayEntries.push({ entry, actualIndex: idx });
      }
    }
  });

  const contextSourceTitle =
    upcomingContextEntries[0]?.entry.sourceTitle ||
    currentEntry?.sourceTitle ||
    currentTrack?.album ||
    'Album / Playlist';

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
      <style>{`
        @keyframes eq1 {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }
        @keyframes eq2 {
          0%, 100% { height: 12px; }
          50% { height: 5px; }
        }
        @keyframes eq3 {
          0%, 100% { height: 7px; }
          50% { height: 15px; }
        }
        .eq-bar-1 { animation: eq1 0.8s ease-in-out infinite; }
        .eq-bar-2 { animation: eq2 0.7s ease-in-out infinite 0.15s; }
        .eq-bar-3 { animation: eq3 0.9s ease-in-out infinite 0.3s; }
      `}</style>

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
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>Up Next</h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
            aria-label="Close queue"
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              close
            </span>
          </button>
        </div>
      )}

      {/* Scrollable Queue Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: isEmbedded ? '12px 4px 120px 4px' : '12px 4px 100px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* 0. Collapsible Played History (if any) */}
        {historyEntries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--md-sys-color-outline)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>
                {showHistory ? 'expand_less' : 'expand_more'}
              </span>
              History ({historyEntries.length})
            </button>

            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', opacity: 0.6 }}>
                {historyEntries.map(({ entry, actualIndex }) => (
                  <div
                    key={entry.entryId}
                    onClick={() => jumpToQueueIndex(actualIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'background 120ms ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <img
                        src={sizedArtwork(entry.track.thumbnailUrl, 96)}
                        alt={entry.track.title}
                        style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }}
                        onError={(e) => handleArtworkError(e, entry.track.thumbnailUrl)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--md-sys-color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.track.title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.track.artist}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)' }}>
                      {formatDuration(entry.track.duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 1. Now Playing Section */}
        {currentEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--md-sys-color-primary)',
                paddingLeft: '6px'
              }}
            >
              Now Playing
            </span>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '18px',
                backgroundColor: 'rgba(255, 255, 255, 0.09)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                  <img
                    src={sizedArtwork(currentEntry.track.thumbnailUrl, 160)}
                    alt={currentEntry.track.title}
                    style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }}
                    onError={(e) => handleArtworkError(e, currentEntry.track.thumbnailUrl)}
                  />
                  {isPlaying && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2.5px'
                      }}
                    >
                      <div className="eq-bar-1" style={{ width: '3px', height: '12px', backgroundColor: '#ffffff', borderRadius: '1.5px' }} />
                      <div className="eq-bar-2" style={{ width: '3px', height: '12px', backgroundColor: '#ffffff', borderRadius: '1.5px' }} />
                      <div className="eq-bar-3" style={{ width: '3px', height: '12px', backgroundColor: '#ffffff', borderRadius: '1.5px' }} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--md-sys-color-on-surface)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {currentEntry.track.title}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {currentEntry.track.artist}
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  marginLeft: '12px'
                }}
              >
                {formatDuration(currentEntry.track.duration)}
              </span>
            </div>
          </div>
        )}

        {/* 2. Hand-Queued User Queue Tier (if user queued items) */}
        {upcomingUserEntries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--md-sys-color-on-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px', color: 'var(--md-sys-color-primary)' }}>
                  playlist_play
                </span>
                Queue · {upcomingUserEntries.length}
              </span>

              <button
                onClick={clearUserQueue}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--md-sys-color-outline)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-outline)')}
              >
                Clear
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {upcomingUserEntries.map(({ entry, actualIndex }) => (
                <div
                  key={entry.entryId}
                  onClick={() => jumpToQueueIndex(actualIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <img
                      src={sizedArtwork(entry.track.thumbnailUrl, 112)}
                      alt={entry.track.title}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                      onError={(e) => handleArtworkError(e, entry.track.thumbnailUrl)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 650, color: 'var(--md-sys-color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.track.title}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.track.artist}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)' }}>
                      {formatDuration(entry.track.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(actualIndex);
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
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-error, #f87171)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--md-sys-color-outline)')}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                        close
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Next From Context (Album / Playlist Tracks) */}
        {upcomingContextEntries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--md-sys-color-on-surface-variant)',
                paddingLeft: '6px'
              }}
            >
              Next from: {contextSourceTitle}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {upcomingContextEntries.map(({ entry, actualIndex }) => (
                <div
                  key={entry.entryId}
                  onClick={() => jumpToQueueIndex(actualIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'background 120ms ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <img
                      src={sizedArtwork(entry.track.thumbnailUrl, 112)}
                      alt={entry.track.title}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                      onError={(e) => handleArtworkError(e, entry.track.thumbnailUrl)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: 650, color: 'var(--md-sys-color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.track.title}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--md-sys-color-outline)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.track.artist}
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)' }}>
                    {formatDuration(entry.track.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Autoplay Radio Station Tier (Matching YouTube Music & BitChord) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          {/* Autoplay Toggle Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                Auto-play is {autoplay ? 'on' : 'off'}
              </span>
            </div>

            {/* Material 3 Expressive Switch */}
            <button
              onClick={toggleAutoplay}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '9999px',
                backgroundColor: autoplay ? 'var(--md-sys-color-primary, #e53935)' : 'rgba(255, 255, 255, 0.16)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: '2px',
                transition: 'background-color 200ms ease'
              }}
              aria-label="Toggle autoplay"
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  transform: autoplay ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)'
                }}
              />
            </button>
          </div>

          {/* YouTube Music Mood Filter Chips (Image 5) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: '2px'
            }}
          >
            {MOOD_CHIPS.map((chip) => {
              const isSelected = activeMood === chip;
              return (
                <button
                  key={chip}
                  onClick={() => {
                    setActiveMood(chip);
                    if (currentTrack) {
                      loadRadioQueue(currentTrack.id, chip);
                    }
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: isSelected
                      ? 'var(--md-sys-color-on-surface, #ffffff)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isSelected ? '#121316' : 'var(--md-sys-color-on-surface)',
                    fontSize: '12px',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 150ms ease'
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {/* Autoplay Station Tracks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {upcomingAutoplayEntries.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 0',
                  gap: '8px',
                  color: 'var(--md-sys-color-outline)',
                  fontSize: '13px'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                  radio
                </span>
                {autoplay ? 'Building radio station...' : 'Turn on autoplay for continuous recommendations'}
              </div>
            ) : (
              upcomingAutoplayEntries.map(({ entry, actualIndex }) => (
                <div
                  key={entry.entryId}
                  onClick={() => jumpToQueueIndex(actualIndex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  }}
                  title="Click to pivot station around this track"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <img
                      src={sizedArtwork(entry.track.thumbnailUrl, 112)}
                      alt={entry.track.title}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                      onError={(e) => handleArtworkError(e, entry.track.thumbnailUrl)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 650,
                          color: 'var(--md-sys-color-on-surface)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {entry.track.title}
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
                        {entry.track.artist}
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--md-sys-color-outline)' }}>
                    {formatDuration(entry.track.duration)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
