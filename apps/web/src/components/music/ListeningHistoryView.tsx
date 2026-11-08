import React, { useMemo, useState } from 'react';
import { PlayLogEntry } from '../../store/tasteStore';
import { TasteEntry, TrackMetadata } from '../../types';
import {
  formatListeningTime,
  localEpochDay,
  M3_EXPRESSIVE_SHAPES
} from './ListeningStatsView';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';

export type HistoryRange = 'today' | 'week' | 'all';

interface HistoryRun {
  key: string;
  entry: PlayLogEntry;
  playCount: number;
  track: TrackMetadata;
}

interface HistoryDayGroup {
  epochDay: number;
  label: string;
  runs: HistoryRun[];
  plays: number;
  listenedMs: number;
}

function formatDayLabel(epochDay: number, todayEpoch: number, sampleTimestamp: number): string {
  if (epochDay === todayEpoch) return 'Today';
  if (epochDay === todayEpoch - 1) return 'Yesterday';
  const d = new Date(sampleTimestamp);
  if (epochDay > todayEpoch - 7) {
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(
    undefined,
    sameYear
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  );
}

function formatTimeOfDay(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export interface ListeningHistoryViewProps {
  playLog: PlayLogEntry[];
  history: TasteEntry[];
  ytmHistory: TrackMetadata[];
  searchQuery: string;
  streakDays: number;
  saveMusicHistory: boolean;
  currentTrackId?: string;
  isPlaying?: boolean;
  isLiked: (trackId: string) => boolean;
  onToggleSaveHistory: (enabled: boolean) => void;
  onPlayTrack: (track: TrackMetadata, queue: TrackMetadata[]) => void;
  onToggleLike: (track: TrackMetadata) => void;
  onOpenArtist?: (artist: { name: string; imageUrl?: string }) => void;
  onRemoveEntry: (
    trackId: string,
    timestamp?: number,
    allPlaysOfSong?: boolean
  ) => Promise<{ history: TasteEntry[]; playLog: PlayLogEntry[] }>;
  onClearHistory: () => Promise<{ history: TasteEntry[]; playLog: PlayLogEntry[] }>;
  onRestoreHistory: (snapshot: { history: TasteEntry[]; playLog: PlayLogEntry[] }) => Promise<void>;
  onOpenStats?: () => void;
}

export const ListeningHistoryView: React.FC<ListeningHistoryViewProps> = ({
  playLog,
  history,
  ytmHistory,
  searchQuery,
  streakDays,
  saveMusicHistory,
  currentTrackId,
  isPlaying,
  isLiked,
  onToggleSaveHistory,
  onPlayTrack,
  onToggleLike,
  onOpenArtist,
  onRemoveEntry,
  onClearHistory,
  onRestoreHistory,
  onOpenStats
}) => {
  const [range, setRange] = useState<HistoryRange>('week');
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [undoBanner, setUndoBanner] = useState<{
    message: string;
    snapshot: { history: TasteEntry[]; playLog: PlayLogEntry[] };
  } | null>(null);

  // Merge playLog with any YTM history tracks that aren't already in playLog
  const unifiedEvents = useMemo<PlayLogEntry[]>(() => {
    const baseEvents: PlayLogEntry[] =
      playLog.length > 0
        ? playLog
        : history.flatMap((h) => {
            const count = Math.max(1, h.playCount || 1);
            const base = h.playedAt || Date.now();
            const dur = h.duration && h.duration > 0 ? h.duration : 210;
            return Array.from({ length: Math.min(count, 25) }, (_, i) => ({
              id: `${h.trackId}_${base - i * 1000}`,
              trackId: h.trackId,
              title: h.title,
              artist: h.artist,
              artistId: h.artistId,
              album: h.album,
              thumbnailUrl: h.thumbnailUrl,
              highResThumbnailUrl: h.highResThumbnailUrl,
              duration: dur,
              timestamp: base - i * 1000
            }));
          });

    const seenTrackIds = new Set(baseEvents.map((e) => e.trackId));
    const ytmExtras: PlayLogEntry[] = [];
    const fallbackDayBase = Date.now() - 3600_000;
    ytmHistory.forEach((yt, idx) => {
      if (!seenTrackIds.has(yt.id)) {
        seenTrackIds.add(yt.id);
        ytmExtras.push({
          id: `ytm_${yt.id}_${idx}`,
          trackId: yt.id,
          title: yt.title,
          artist: yt.artist,
          artistId: yt.artistId,
          album: yt.album,
          thumbnailUrl: yt.thumbnailUrl,
          highResThumbnailUrl: yt.highResThumbnailUrl,
          duration: yt.duration && yt.duration > 0 ? yt.duration : 210,
          timestamp: fallbackDayBase - idx * 180_000
        });
      }
    });

    return [...baseEvents, ...ytmExtras].sort((a, b) => b.timestamp - a.timestamp);
  }, [playLog, history, ytmHistory]);

  // Build day groups + collapsed runs (matching temp_koda buildHistoryDays)
  const { days, visibleListenedMs, visiblePlays, visibleSongs, flatPlayQueue } = useMemo(() => {
    const todayEpoch = localEpochDay(Date.now());
    const daysBack = range === 'today' ? 0 : range === 'week' ? 6 : null;
    const q = searchQuery.trim().toLowerCase();

    const matching = unifiedEvents.filter((entry) => {
      const day = localEpochDay(entry.timestamp);
      if (daysBack !== null && day < todayEpoch - daysBack) {
        return false;
      }
      if (q) {
        const inTitle = entry.title.toLowerCase().includes(q);
        const inArtist = (entry.artist || '').toLowerCase().includes(q);
        const inAlbum = (entry.album || '').toLowerCase().includes(q);
        if (!inTitle && !inArtist && !inAlbum) return false;
      }
      return true;
    });

    const groupedByDay = new Map<number, PlayLogEntry[]>();
    for (const entry of matching) {
      const epochDay = localEpochDay(entry.timestamp);
      const list = groupedByDay.get(epochDay);
      if (list) list.push(entry);
      else groupedByDay.set(epochDay, [entry]);
    }

    const sortedDays: HistoryDayGroup[] = Array.from(groupedByDay.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([epochDay, entries]) => {
        const runs: HistoryRun[] = [];
        for (const entry of entries) {
          const last = runs[runs.length - 1];
          if (last && last.entry.trackId === entry.trackId) {
            last.playCount += 1;
          } else {
            const thumb =
              entry.highResThumbnailUrl ||
              entry.thumbnailUrl ||
              `https://i.ytimg.com/vi/${entry.trackId}/hqdefault.jpg`;
            runs.push({
              key: `${epochDay}_${entry.trackId}_${entry.timestamp}`,
              entry,
              playCount: 1,
              track: {
                id: entry.trackId,
                title: entry.title,
                artist: entry.artist,
                artistId: entry.artistId,
                album: entry.album,
                duration: entry.duration || 210,
                thumbnailUrl: thumb,
                highResThumbnailUrl: sizedArtwork(thumb, 600)
              }
            });
          }
        }

        const listenedMs = entries.reduce(
          (sum, e) => sum + (e.duration && e.duration > 0 ? e.duration : 210) * 1000,
          0
        );

        return {
          epochDay,
          label: formatDayLabel(epochDay, todayEpoch, entries[0].timestamp),
          runs,
          plays: entries.length,
          listenedMs
        };
      });

    const totalMs = sortedDays.reduce((s, d) => s + d.listenedMs, 0);
    const totalPlays = sortedDays.reduce((s, d) => s + d.plays, 0);
    const uniqueSongIds = new Set<string>();
    const queue: TrackMetadata[] = [];
    for (const d of sortedDays) {
      for (const r of d.runs) {
        if (!uniqueSongIds.has(r.track.id)) {
          uniqueSongIds.add(r.track.id);
          queue.push(r.track);
        }
      }
    }

    return {
      days: sortedDays,
      visibleListenedMs: totalMs,
      visiblePlays: totalPlays,
      visibleSongs: uniqueSongIds.size,
      flatPlayQueue: queue
    };
  }, [unifiedEvents, range, searchQuery]);

  const rangeLabel =
    range === 'today' ? 'today' : range === 'week' ? 'this week' : 'all time';

  const handleRemoveRun = async (run: HistoryRun, allPlays: boolean) => {
    setOpenMenuKey(null);
    const snap = await onRemoveEntry(run.entry.trackId, run.entry.timestamp, allPlays);
    setUndoBanner({
      message: allPlays
        ? `Removed all plays of "${run.entry.title}"`
        : run.playCount > 1
        ? `Removed ${run.playCount} plays from history`
        : 'Removed from listening history',
      snapshot: snap
    });
  };

  const handleConfirmClear = async () => {
    setConfirmClearOpen(false);
    const snap = await onClearHistory();
    setUndoBanner({
      message: 'Listening history cleared',
      snapshot: snap
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'm3CardCascade 300ms var(--m3-ease-emphasized-decelerate) both'
      }}
    >
      {/* Undo Banner */}
      {undoBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderRadius: '18px',
            backgroundColor: 'var(--md-sys-color-inverse-surface)',
            color: 'var(--md-sys-color-inverse-on-surface)',
            fontSize: '13px',
            fontWeight: 650,
            boxShadow: '0 8px 24px rgba(0,0,0,0.22)'
          }}
        >
          <span>{undoBanner.message}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={async () => {
                const snap = undoBanner.snapshot;
                setUndoBanner(null);
                await onRestoreHistory(snap);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--md-sys-color-inverse-primary)',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Undo
            </button>
            <button
              onClick={() => setUndoBanner(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--md-sys-color-inverse-on-surface)',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                close
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 1. History Hero Card (temp_koda HistoryHeroCard - 20-listening-history.png) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          padding: '22px 26px',
          borderRadius: '28px',
          backgroundColor: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              clipPath: M3_EXPRESSIVE_SHAPES.softBurst,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '28px' }}>
              history
            </span>
          </div>

          <div>
            <div
              style={{
                fontSize: 'clamp(28px, 3.6vw, 38px)',
                fontWeight: 850,
                lineHeight: 1.05,
                letterSpacing: '-0.025em'
              }}
            >
              {formatListeningTime(visibleListenedMs)}
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                marginTop: '4px',
                opacity: 0.82
              }}
            >
              {searchQuery.trim() ? 'matching' : rangeLabel} •{' '}
              {visiblePlays === 1 ? '1 play' : `${visiblePlays} plays`} •{' '}
              {visibleSongs === 1 ? '1 song' : `${visibleSongs} songs`}
            </div>

            {streakDays > 1 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '10px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  backgroundColor: 'color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)',
                  fontSize: '12px',
                  fontWeight: 750
                }}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '15px' }}>
                  local_fire_department
                </span>
                <span>{streakDays} day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* History Actions: Insights, Pause/Resume & Clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onOpenStats && (
            <button
              onClick={onOpenStats}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                fontSize: '12px',
                fontWeight: 750,
                cursor: 'pointer'
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
                insights
              </span>
              <span>Stats & Insights</span>
            </button>
          )}

          <button
            onClick={() => onToggleSaveHistory(!saveMusicHistory)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '999px',
              border: '1px solid color-mix(in srgb, var(--md-sys-color-on-primary-container) 22%, transparent)',
              backgroundColor: 'transparent',
              color: 'var(--md-sys-color-on-primary-container)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title={saveMusicHistory ? 'Pause listening history' : 'Resume listening history'}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
              {saveMusicHistory ? 'pause_circle' : 'play_circle'}
            </span>
            <span>{saveMusicHistory ? 'Pause history' : 'Resume history'}</span>
          </button>

          {unifiedEvents.length > 0 && (
            <button
              onClick={() => setConfirmClearOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                borderRadius: '999px',
                border: '1px solid color-mix(in srgb, var(--md-sys-color-on-primary-container) 22%, transparent)',
                backgroundColor: 'transparent',
                color: 'var(--md-sys-color-on-primary-container)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Clear listening history"
            >
              <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
                delete_sweep
              </span>
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. M3 Expressive Connected Range Selector (Today / This week / All time) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '4px',
          width: '100%'
        }}
      >
        {(
          [
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This week' },
            { id: 'all', label: 'All time' }
          ] as { id: HistoryRange; label: string }[]
        ).map((item, idx) => {
          const selected = range === item.id;
          const borderRadius = selected
            ? '999px'
            : idx === 0
            ? '24px 8px 8px 24px'
            : idx === 2
            ? '8px 24px 24px 8px'
            : '8px';
          return (
            <button
              key={item.id}
              onClick={() => setRange(item.id)}
              style={{
                height: '44px',
                borderRadius,
                border: 'none',
                backgroundColor: selected
                  ? 'var(--md-sys-color-primary)'
                  : 'var(--md-sys-color-surface-container-high)',
                color: selected
                  ? 'var(--md-sys-color-on-primary)'
                  : 'var(--md-sys-color-on-surface-variant)',
                fontSize: '13px',
                fontWeight: selected ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)'
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 3. Paused History Banner */}
      {!saveMusicHistory && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '14px 20px',
            borderRadius: '20px',
            backgroundColor: 'var(--md-sys-color-tertiary-container)',
            color: 'var(--md-sys-color-on-tertiary-container)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              pause_circle
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Listening history is paused. New plays won't be recorded until you resume.
            </span>
          </div>
          <button
            onClick={() => onToggleSaveHistory(true)}
            style={{
              padding: '7px 16px',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-tertiary)',
              color: 'var(--md-sys-color-on-tertiary)',
              fontSize: '12px',
              fontWeight: 750,
              cursor: 'pointer'
            }}
          >
            Resume
          </button>
        </div>
      )}

      {/* 4. Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div
          style={{
            padding: '20px 24px',
            borderRadius: '24px',
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>Clear all listening history?</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>
              This will remove {unifiedEvents.length} recorded plays and reset your listening statistics.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setConfirmClearOpen(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--md-sys-color-on-error-container)',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClear}
              style={{
                padding: '8px 18px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-error)',
                color: 'var(--md-sys-color-on-error)',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Clear history
            </button>
          </div>
        </div>
      )}

      {/* 5. Empty State or Day-Grouped Segmented Runs */}
      {days.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '56px 24px',
            borderRadius: '24px',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            gap: '12px',
            textAlign: 'center'
          }}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: '48px', color: 'var(--md-sys-color-outline)' }}
          >
            history
          </span>
          <div style={{ fontSize: '16px', fontWeight: 750, color: 'var(--md-sys-color-on-surface)' }}>
            {searchQuery.trim()
              ? `No plays matching "${searchQuery}"`
              : range !== 'all' && unifiedEvents.length > 0
              ? `No plays recorded ${rangeLabel}`
              : 'No listening history yet'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            {range !== 'all' && unifiedEvents.length > 0
              ? 'Switch to All time to see your earlier plays.'
              : 'Songs you listen to will appear here in chronological order.'}
          </div>
          {range !== 'all' && unifiedEvents.length > 0 && (
            <button
              onClick={() => setRange('all')}
              style={{
                marginTop: '6px',
                padding: '8px 18px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                fontSize: '13px',
                fontWeight: 750,
                cursor: 'pointer'
              }}
            >
              Show all time
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {days.map((day) => (
            <div key={day.epochDay} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Day Header (temp_koda DayHeader) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: 'var(--md-sys-color-secondary)',
                      clipPath: M3_EXPRESSIVE_SHAPES.cookie9Sided
                    }}
                  />
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: 'var(--md-sys-color-on-surface)'
                    }}
                  >
                    {day.label}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    color: 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  {day.plays} • {formatListeningTime(day.listenedMs)}
                </span>
              </div>

              {/* Segmented Runs within this Day */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {day.runs.map((run, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === day.runs.length - 1;
                  const borderRadius =
                    day.runs.length === 1
                      ? '24px'
                      : isFirst
                      ? '24px 24px 6px 6px'
                      : isLast
                      ? '6px 6px 24px 24px'
                      : '6px';
                  const activePlaying = currentTrackId === run.track.id && isPlaying;
                  const liked = isLiked(run.track.id);
                  const menuOpen = openMenuKey === run.key;

                  return (
                    <div
                      key={run.key}
                      onClick={() => onPlayTrack(run.track, flatPlayQueue)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '12px 16px',
                        borderRadius,
                        backgroundColor: activePlaying
                          ? 'var(--md-sys-color-secondary-container)'
                          : 'var(--md-sys-color-surface-container-low)',
                        cursor: 'pointer',
                        transition: 'background-color 150ms ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!activePlaying) {
                          e.currentTarget.style.backgroundColor =
                            'var(--md-sys-color-surface-container-high)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!activePlaying) {
                          e.currentTarget.style.backgroundColor =
                            'var(--md-sys-color-surface-container-low)';
                        }
                      }}
                    >
                      {/* 52px Rounded Artwork */}
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          backgroundColor: 'var(--md-sys-color-surface-container-high)',
                          flexShrink: 0,
                          position: 'relative'
                        }}
                      >
                        <img
                          src={sizedArtwork(run.track.thumbnailUrl, 120)}
                          alt={run.track.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleArtworkError(e, run.track.thumbnailUrl)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>

                      {/* Title & Artist */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: activePlaying
                              ? 'var(--md-sys-color-primary)'
                              : 'var(--md-sys-color-on-surface)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {run.track.title}
                        </div>
                        <div
                          onClick={(e) => {
                            if (onOpenArtist) {
                              e.stopPropagation();
                              onOpenArtist({ name: run.track.artist });
                            }
                          }}
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--md-sys-color-on-surface-variant)',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'inline-block',
                            maxWidth: '100%'
                          }}
                        >
                          {run.track.artist}
                        </div>
                      </div>

                      {/* Trailing Timestamp + ×N Repeat Badge + Like + Menu */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '4px'
                          }}
                        >
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--md-sys-color-on-surface-variant)'
                            }}
                          >
                            {formatTimeOfDay(run.entry.timestamp)}
                          </span>
                          {run.playCount > 1 && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                backgroundColor: 'var(--md-sys-color-tertiary-container)',
                                color: 'var(--md-sys-color-on-tertiary-container)'
                              }}
                              title={`Played ${run.playCount} times in a row`}
                            >
                              ×{run.playCount}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => onToggleLike(run.track)}
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'transparent',
                            color: liked
                              ? 'var(--md-sys-color-primary)'
                              : 'var(--md-sys-color-on-surface-variant)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title={liked ? 'Unlike' : 'Like'}
                        >
                          <span
                            className={`material-symbols-rounded ${liked ? 'filled' : ''}`}
                            style={{ fontSize: '19px' }}
                          >
                            favorite
                          </span>
                        </button>

                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setOpenMenuKey(menuOpen ? null : run.key)}
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--md-sys-color-on-surface-variant)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="More options"
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
                              more_vert
                            </span>
                          </button>

                          {menuOpen && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '38px',
                                zIndex: 40,
                                minWidth: '210px',
                                borderRadius: '18px',
                                backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                                border: '1px solid var(--md-sys-color-outline-variant)',
                                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
                                padding: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}
                            >
                              <button
                                onClick={() => {
                                  setOpenMenuKey(null);
                                  onPlayTrack(run.track, flatPlayQueue);
                                }}
                                style={menuItemStyle}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                                  play_arrow
                                </span>
                                <span>Play</span>
                              </button>
                              <button
                                onClick={() => handleRemoveRun(run, false)}
                                style={menuItemStyle}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                                  delete
                                </span>
                                <span>
                                  {run.playCount > 1
                                    ? `Remove these ${run.playCount} plays`
                                    : 'Remove this play'}
                                </span>
                              </button>
                              <button
                                onClick={() => handleRemoveRun(run, true)}
                                style={{
                                  ...menuItemStyle,
                                  color: 'var(--md-sys-color-error)'
                                }}
                              >
                                <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
                                  delete_sweep
                                </span>
                                <span>Remove all plays of song</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--md-sys-color-on-surface)',
  fontSize: '13px',
  fontWeight: 650,
  textAlign: 'left',
  cursor: 'pointer'
};
