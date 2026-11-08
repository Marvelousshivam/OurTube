import React, { useMemo, useState } from 'react';
import { PlayLogEntry } from '../../store/tasteStore';
import { TasteEntry, TrackMetadata } from '../../types';
import { SHAPES } from '../../design-system/tokens';
import { sizedArtwork, handleArtworkError } from '../../api/artworkService';

export interface SongPlayStats {
  songId: string;
  title: string;
  artist: string;
  album?: string;
  thumbnailUrl?: string;
  durationSec: number;
  playCount: number;
  totalTimeMs: number;
  lastPlayed: number;
}

export interface ArtistPlayStats {
  name: string;
  playCount: number;
  totalTimeMs: number;
  songCount: number;
  thumbnailUrl?: string;
}

export interface DayActivity {
  dayOfWeek: number; // 0 = Mon .. 6 = Sun
  dayLabel: string;
  fullDayLabel: string;
  playCount: number;
  listenTimeMs: number;
  isToday: boolean;
}

export interface ListeningStats {
  totalPlays: number;
  totalListenTimeMs: number;
  uniqueSongs: number;
  uniqueArtists: number;
  topSongs: SongPlayStats[];
  topArtists: ArtistPlayStats[];
  weeklyActivity: DayActivity[];
  currentStreakDays: number;
  longestStreakDays: number;
  nextMilestonePlays: number;
  milestoneProgress: number;
}

const MILESTONE_TIERS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FULL_DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Epoch day in the user's local timezone, matching temp_koda StatsRepository.kt */
export function localEpochDay(timestampMs: number): number {
  const offsetMs = new Date(timestampMs).getTimezoneOffset() * -60000;
  return Math.floor((timestampMs + offsetMs) / 86_400_000);
}

/** "1h 14m", "14m", "48s" — matching temp_koda formatListeningTime */
export function formatListeningTime(ms: number): string {
  if (!ms || ms <= 0) return '0m';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

export function computeListeningStats(
  playLog: PlayLogEntry[],
  history: TasteEntry[],
  likedTracks: TrackMetadata[]
): ListeningStats {
  // Build unified event stream from playLog; fallback to history if playLog is empty
  const events: PlayLogEntry[] =
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

  if (events.length === 0) {
    const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 .. Sun=6
    return {
      totalPlays: 0,
      totalListenTimeMs: 0,
      uniqueSongs: 0,
      uniqueArtists: 0,
      topSongs: [],
      topArtists: [],
      weeklyActivity: DAY_LABELS.map((label, i) => ({
        dayOfWeek: i,
        dayLabel: label,
        fullDayLabel: FULL_DAY_LABELS[i],
        playCount: 0,
        listenTimeMs: 0,
        isToday: i === todayIdx
      })),
      currentStreakDays: 0,
      longestStreakDays: 0,
      nextMilestonePlays: MILESTONE_TIERS[0],
      milestoneProgress: 0
    };
  }

  const totalPlays = events.length;
  const totalListenTimeMs = events.reduce(
    (sum, e) => sum + (e.duration && e.duration > 0 ? e.duration : 210) * 1000,
    0
  );

  // Song stats
  const songMap = new Map<string, SongPlayStats>();
  for (const e of events) {
    const durSec = e.duration && e.duration > 0 ? e.duration : 210;
    const durMs = durSec * 1000;
    const existing = songMap.get(e.trackId);
    if (existing) {
      existing.playCount += 1;
      existing.totalTimeMs += durMs;
      if (e.timestamp > existing.lastPlayed) existing.lastPlayed = e.timestamp;
      if (!existing.thumbnailUrl && (e.highResThumbnailUrl || e.thumbnailUrl)) {
        existing.thumbnailUrl = e.highResThumbnailUrl || e.thumbnailUrl;
      }
    } else {
      songMap.set(e.trackId, {
        songId: e.trackId,
        title: e.title,
        artist: e.artist,
        album: e.album,
        thumbnailUrl: e.highResThumbnailUrl || e.thumbnailUrl,
        durationSec: durSec,
        playCount: 1,
        totalTimeMs: durMs,
        lastPlayed: e.timestamp
      });
    }
  }

  const topSongs = Array.from(songMap.values())
    .sort((a, b) => b.playCount - a.playCount || b.totalTimeMs - a.totalTimeMs)
    .slice(0, 10);

  // Artist stats
  const artistGroups = new Map<
    string,
    { name: string; playCount: number; totalTimeMs: number; songIds: Set<string>; thumbnailUrl?: string }
  >();
  for (const e of events) {
    const cleanArtist = (e.artist || 'Unknown Artist').trim();
    const key = cleanArtist.toLowerCase();
    const durMs = (e.duration && e.duration > 0 ? e.duration : 210) * 1000;
    const existing = artistGroups.get(key);
    if (existing) {
      existing.playCount += 1;
      existing.totalTimeMs += durMs;
      existing.songIds.add(e.trackId);
      if (!existing.thumbnailUrl && (e.highResThumbnailUrl || e.thumbnailUrl)) {
        existing.thumbnailUrl = e.highResThumbnailUrl || e.thumbnailUrl;
      }
    } else {
      artistGroups.set(key, {
        name: cleanArtist,
        playCount: 1,
        totalTimeMs: durMs,
        songIds: new Set([e.trackId]),
        thumbnailUrl: e.highResThumbnailUrl || e.thumbnailUrl
      });
    }
  }

  const topArtists: ArtistPlayStats[] = Array.from(artistGroups.values())
    .map((g) => ({
      name: g.name,
      playCount: g.playCount,
      totalTimeMs: g.totalTimeMs,
      songCount: g.songIds.size,
      thumbnailUrl: g.thumbnailUrl
    }))
    .sort((a, b) => b.playCount - a.playCount || b.totalTimeMs - a.totalTimeMs)
    .slice(0, 10);

  // Weekly activity (Mon..Sun of current week)
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeekMs = startOfToday - todayDow * 86_400_000;

  const weeklyBuckets = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    dayLabel: DAY_LABELS[i],
    fullDayLabel: FULL_DAY_LABELS[i],
    playCount: 0,
    listenTimeMs: 0,
    isToday: i === todayDow
  }));

  for (const e of events) {
    if (e.timestamp >= startOfWeekMs) {
      const dayIdx = Math.floor((e.timestamp - startOfWeekMs) / 86_400_000);
      if (dayIdx >= 0 && dayIdx < 7) {
        weeklyBuckets[dayIdx].playCount += 1;
        weeklyBuckets[dayIdx].listenTimeMs +=
          (e.duration && e.duration > 0 ? e.duration : 210) * 1000;
      }
    }
  }

  // Streak calculation (matching temp_koda StatsRepository.computeStreaks)
  const distinctEpochDays = Array.from(new Set(events.map((e) => localEpochDay(e.timestamp)))).sort(
    (a, b) => a - b
  );
  let longestStreakDays = 0;
  let run = 0;
  let prevDay: number | null = null;
  for (const d of distinctEpochDays) {
    run = prevDay !== null && d === prevDay + 1 ? run + 1 : 1;
    if (run > longestStreakDays) longestStreakDays = run;
    prevDay = d;
  }

  const todayEpoch = localEpochDay(Date.now());
  const daySet = new Set(distinctEpochDays);
  const anchorDay = daySet.has(todayEpoch)
    ? todayEpoch
    : daySet.has(todayEpoch - 1)
    ? todayEpoch - 1
    : null;
  let currentStreakDays = 0;
  if (anchorDay !== null) {
    let d = anchorDay;
    while (daySet.has(d)) {
      currentStreakDays += 1;
      d -= 1;
    }
  }

  // Milestone calculation
  const nextMilestonePlays =
    MILESTONE_TIERS.find((t) => t > totalPlays) || Math.ceil((totalPlays + 1) / 5000) * 5000;
  const prevTier = [...MILESTONE_TIERS].reverse().find((t) => t <= totalPlays) || 0;
  const span = Math.max(1, nextMilestonePlays - prevTier);
  const milestoneProgress = Math.min(1, Math.max(0, (totalPlays - prevTier) / span));

  return {
    totalPlays,
    totalListenTimeMs,
    uniqueSongs: songMap.size,
    uniqueArtists: artistGroups.size,
    topSongs,
    topArtists,
    weeklyActivity: weeklyBuckets,
    currentStreakDays,
    longestStreakDays,
    nextMilestonePlays,
    milestoneProgress
  };
}

// Custom Material 3 Expressive polygon clip-paths matching temp_koda MaterialShapes
export const M3_EXPRESSIVE_SHAPES = {
  softBurst: SHAPES.softBurst,
  cookie9Sided:
    'polygon(50% 2%, 67% 8%, 83% 6%, 91% 21%, 99% 36%, 93% 52%, 96% 69%, 82% 80%, 76% 96%, 59% 93%, 41% 93%, 24% 96%, 18% 80%, 4% 69%, 7% 52%, 1% 36%, 9% 21%, 17% 6%, 33% 8%)',
  clover4Leaf:
    'polygon(35% 4%, 50% 14%, 65% 4%, 83% 6%, 94% 17%, 96% 35%, 86% 50%, 96% 65%, 94% 83%, 83% 94%, 65% 96%, 50% 86%, 35% 96%, 17% 94%, 6% 83%, 4% 65%, 14% 50%, 4% 35%, 6% 17%, 17% 6%)',
  sunny:
    'polygon(50% 0%, 61% 11%, 75% 4%, 80% 18%, 95% 19%, 92% 34%, 100% 46%, 91% 58%, 96% 73%, 82% 79%, 80% 94%, 66% 91%, 56% 100%, 44% 100%, 34% 91%, 20% 94%, 18% 79%, 4% 73%, 9% 58%, 0% 46%, 8% 34%, 5% 19%, 20% 18%, 25% 4%, 39% 11%)',
  flower:
    'polygon(50% 3%, 63% 11%, 79% 9%, 86% 23%, 97% 34%, 92% 50%, 97% 66%, 86% 77%, 79% 91%, 63% 89%, 50% 97%, 37% 89%, 21% 91%, 14% 77%, 3% 66%, 8% 50%, 3% 34%, 14% 23%, 21% 9%, 37% 11%)',
  gem: 'polygon(28% 6%, 72% 6%, 96% 34%, 50% 96%, 4% 34%)',
  pill: 'inset(0% round 999px)'
};

export interface ListeningStatsViewProps {
  playLog: PlayLogEntry[];
  history: TasteEntry[];
  likedTracks: TrackMetadata[];
  onPlaySong?: (song: SongPlayStats) => void;
  onOpenArtist?: (artist: { name: string; imageUrl?: string }) => void;
  onOpenLikedSongs?: () => void;
  onOpenHistory?: () => void;
}

export const ListeningStatsView: React.FC<ListeningStatsViewProps> = ({
  playLog,
  history,
  likedTracks,
  onPlaySong,
  onOpenArtist,
  onOpenLikedSongs,
  onOpenHistory
}) => {
  const stats = useMemo(
    () => computeListeningStats(playLog, history, likedTracks),
    [playLog, history, likedTracks]
  );
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  if (stats.totalPlays === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          borderRadius: '28px',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          textAlign: 'center',
          gap: '16px'
        }}
      >
        <div
          style={{
            width: '96px',
            height: '96px',
            backgroundColor: 'var(--md-sys-color-primary-container)',
            color: 'var(--md-sys-color-on-primary-container)',
            clipPath: M3_EXPRESSIVE_SHAPES.softBurst,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '42px' }}>
            headphones
          </span>
        </div>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 800,
            margin: 0,
            color: 'var(--md-sys-color-on-surface)'
          }}
        >
          No listening stats yet
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--md-sys-color-on-surface-variant)',
            maxWidth: '420px',
            margin: 0,
            lineHeight: 1.5
          }}
        >
          Play some songs and your listening summary, 7-day activity chart, streaks, and top tracks will come alive here.
        </p>
      </div>
    );
  }

  const maxWeeklyPlays = Math.max(1, ...stats.weeklyActivity.map((d) => d.playCount));
  const totalWeekPlays = stats.weeklyActivity.reduce((sum, d) => sum + d.playCount, 0);
  const remainingMilestone = Math.max(0, stats.nextMilestonePlays - stats.totalPlays);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        animation: 'm3CardCascade 320ms var(--m3-ease-emphasized-decelerate) both'
      }}
    >
      {/* 1. Hero Total Listening Time Card (temp_koda HeroListeningTimeCard) */}
      <div
        onClick={onOpenHistory}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          padding: '24px 28px',
          borderRadius: '28px',
          backgroundColor: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)',
          cursor: onOpenHistory ? 'pointer' : 'default',
          flexWrap: 'wrap',
          transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
        }}
        onMouseEnter={(e) => {
          if (onOpenHistory) e.currentTarget.style.transform = 'translateY(-2px) scale(1.005)';
        }}
        onMouseLeave={(e) => {
          if (onOpenHistory) e.currentTarget.style.transform = 'translateY(0) scale(1)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              clipPath: M3_EXPRESSIVE_SHAPES.softBurst,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span className="material-symbols-rounded filled" style={{ fontSize: '30px' }}>
              headphones
            </span>
          </div>
          <div>
            <div
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 850,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: 'var(--md-sys-color-on-primary-container)'
              }}
            >
              {formatListeningTime(stats.totalListenTimeMs)}
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                marginTop: '4px',
                opacity: 0.82
              }}
            >
              listened • {stats.totalPlays} {stats.totalPlays === 1 ? 'play' : 'plays'}
            </div>
          </div>
        </div>

        {onOpenHistory && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '999px',
              backgroundColor: 'color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)',
              color: 'var(--md-sys-color-on-primary-container)',
              fontSize: '13px',
              fontWeight: 700
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>
              history
            </span>
            <span>View play log</span>
          </div>
        )}
      </div>

      {/* 2. 2x2 Expressive Stat Tiles (temp_koda ExpressiveStatTile) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Tile 1: Songs played */}
        <ExpressiveStatTile
          icon="music_note"
          value={String(stats.uniqueSongs)}
          label="Songs played"
          containerColor="var(--md-sys-color-secondary-container)"
          contentColor="var(--md-sys-color-on-secondary-container)"
          badgeColor="var(--md-sys-color-secondary)"
          badgeIconColor="var(--md-sys-color-on-secondary)"
          clipPath={M3_EXPRESSIVE_SHAPES.cookie9Sided}
        />

        {/* Tile 2: Artists explored */}
        <ExpressiveStatTile
          icon="person"
          value={String(stats.uniqueArtists)}
          label="Artists explored"
          containerColor="var(--md-sys-color-tertiary-container)"
          contentColor="var(--md-sys-color-on-tertiary-container)"
          badgeColor="var(--md-sys-color-tertiary)"
          badgeIconColor="var(--md-sys-color-on-tertiary)"
          clipPath={M3_EXPRESSIVE_SHAPES.clover4Leaf}
        />

        {/* Tile 3: Liked songs */}
        <ExpressiveStatTile
          icon="favorite"
          value={String(likedTracks.length)}
          label="Liked songs"
          containerColor="var(--md-sys-color-surface-container-high)"
          contentColor="var(--md-sys-color-on-surface)"
          badgeColor="var(--md-sys-color-primary)"
          badgeIconColor="var(--md-sys-color-on-primary)"
          clipPath={M3_EXPRESSIVE_SHAPES.sunny}
          onClick={onOpenLikedSongs}
        />

        {/* Tile 4: Top artist */}
        <ExpressiveStatTile
          icon="auto_awesome"
          value={stats.topArtists[0]?.name || '—'}
          label="Top artist"
          containerColor="var(--md-sys-color-surface-container-high)"
          contentColor="var(--md-sys-color-on-surface)"
          badgeColor="var(--md-sys-color-secondary)"
          badgeIconColor="var(--md-sys-color-on-secondary)"
          clipPath={M3_EXPRESSIVE_SHAPES.pill}
          isTextValue={true}
          onClick={
            stats.topArtists[0] && onOpenArtist
              ? () =>
                  onOpenArtist({
                    name: stats.topArtists[0].name,
                    imageUrl: stats.topArtists[0].thumbnailUrl
                  })
              : undefined
          }
        />
      </div>

      {/* 3. Weekly Activity Card + Streak & Milestone Row (Responsive 2-Column on Desktop) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px'
        }}
      >
        {/* 7-Day Weekly Activity Chart (temp_koda WeeklyActivityCard) */}
        <div
          style={{
            padding: '22px 24px',
            borderRadius: '24px',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '18px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                This week
              </span>
              {hoveredDay !== null && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--md-sys-color-primary)',
                    marginLeft: '10px'
                  }}
                >
                  {stats.weeklyActivity[hoveredDay].fullDayLabel}:{' '}
                  {stats.weeklyActivity[hoveredDay].playCount} plays •{' '}
                  {formatListeningTime(stats.weeklyActivity[hoveredDay].listenTimeMs)}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              {totalWeekPlays} {totalWeekPlays === 1 ? 'play' : 'plays'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              alignItems: 'end',
              height: '124px',
              gap: '10px'
            }}
          >
            {stats.weeklyActivity.map((day, idx) => {
              const rawFraction = day.playCount / maxWeeklyPlays;
              const heightPct = day.playCount > 0 ? Math.max(18, Math.round(rawFraction * 100)) : 8;
              return (
                <div
                  key={day.dayOfWeek}
                  onMouseEnter={() => setHoveredDay(idx)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '26px',
                        maxWidth: '100%',
                        height: `${heightPct}%`,
                        borderRadius: '999px',
                        backgroundColor: day.isToday
                          ? 'var(--md-sys-color-primary)'
                          : day.playCount > 0
                          ? 'color-mix(in srgb, var(--md-sys-color-primary) 55%, transparent)'
                          : 'var(--md-sys-color-surface-container-highest)',
                        transition: 'height 380ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms ease',
                        transform: hoveredDay === idx ? 'scaleX(1.12)' : 'scaleX(1)'
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: day.isToday ? 800 : 600,
                      color: day.isToday
                        ? 'var(--md-sys-color-primary)'
                        : 'var(--md-sys-color-on-surface-variant)'
                    }}
                  >
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak & Milestone Row (temp_koda StreakAndMilestoneRow) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px'
          }}
        >
          {/* Streak Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '24px',
              backgroundColor: 'var(--md-sys-color-tertiary-container)',
              color: 'var(--md-sys-color-on-tertiary-container)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '148px'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--md-sys-color-tertiary)',
                color: 'var(--md-sys-color-on-tertiary)',
                clipPath: M3_EXPRESSIVE_SHAPES.flower,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span className="material-symbols-rounded filled" style={{ fontSize: '20px' }}>
                local_fire_department
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 850,
                  lineHeight: 1.15
                }}
              >
                {stats.currentStreakDays === 1 ? '1 day' : `${stats.currentStreakDays} days`}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  marginTop: '4px',
                  opacity: 0.82
                }}
              >
                {stats.longestStreakDays > stats.currentStreakDays
                  ? `Streak • best ${stats.longestStreakDays}d`
                  : 'Listening streak'}
              </div>
            </div>
          </div>

          {/* Next Milestone Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '24px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '148px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  clipPath: M3_EXPRESSIVE_SHAPES.gem,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '18px' }}>
                  emoji_events
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'var(--md-sys-color-primary)',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  padding: '3px 8px',
                  borderRadius: '999px'
                }}
              >
                {Math.round(stats.milestoneProgress * 100)}%
              </span>
            </div>

            <div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 850,
                  lineHeight: 1.15,
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                {remainingMilestone} to go
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  marginTop: '2px',
                  marginBottom: '8px'
                }}
              >
                Next: {stats.nextMilestonePlays} plays
              </div>
              {/* Expressive Progress Track */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${Math.max(6, Math.round(stats.milestoneProgress * 100))}%`,
                    height: '100%',
                    borderRadius: '999px',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    transition: 'width 420ms cubic-bezier(0.22, 1, 0.36, 1)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Top Songs & Top Artists (2-Column Responsive Segmented Lists matching StatsScreen.kt) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px',
          marginTop: '4px'
        }}
      >
        {/* Top Songs Segmented Group */}
        {stats.topSongs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 800,
                margin: '0 4px',
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              Top songs
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {stats.topSongs.map((song, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === stats.topSongs.length - 1;
                const borderRadius =
                  stats.topSongs.length === 1
                    ? '24px'
                    : isFirst
                    ? '24px 24px 6px 6px'
                    : isLast
                    ? '6px 6px 24px 24px'
                    : '6px';

                return (
                  <div
                    key={song.songId}
                    onClick={() => onPlaySong?.(song)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius,
                      backgroundColor: 'var(--md-sys-color-surface-container-low)',
                      cursor: onPlaySong ? 'pointer' : 'default',
                      transition: 'background-color 150ms ease, transform 150ms ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--md-sys-color-surface-container-high)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--md-sys-color-surface-container-low)';
                    }}
                  >
                    <RankBadge rank={idx + 1} />
                    <img
                      src={sizedArtwork(
                        song.thumbnailUrl || `https://i.ytimg.com/vi/${song.songId}/hqdefault.jpg`,
                        120
                      )}
                      alt={song.title}
                      referrerPolicy="no-referrer"
                      onError={(e) =>
                        handleArtworkError(
                          e,
                          song.thumbnailUrl || `https://i.ytimg.com/vi/${song.songId}/hqdefault.jpg`
                        )
                      }
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--md-sys-color-on-surface)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {song.title}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--md-sys-color-on-surface-variant)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px'
                        }}
                      >
                        {song.artist} • {formatListeningTime(song.totalTimeMs)}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: 'var(--md-sys-color-primary)',
                        flexShrink: 0
                      }}
                    >
                      {song.playCount}×
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Artists Segmented Group */}
        {stats.topArtists.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 800,
                margin: '0 4px',
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              Top artists
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {stats.topArtists.map((artist, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === stats.topArtists.length - 1;
                const borderRadius =
                  stats.topArtists.length === 1
                    ? '24px'
                    : isFirst
                    ? '24px 24px 6px 6px'
                    : isLast
                    ? '6px 6px 24px 24px'
                    : '6px';

                return (
                  <div
                    key={artist.name}
                    onClick={() =>
                      onOpenArtist?.({ name: artist.name, imageUrl: artist.thumbnailUrl })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius,
                      backgroundColor: 'var(--md-sys-color-surface-container-low)',
                      cursor: onOpenArtist ? 'pointer' : 'default',
                      transition: 'background-color 150ms ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--md-sys-color-surface-container-high)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'var(--md-sys-color-surface-container-low)';
                    }}
                  >
                    <RankBadge rank={idx + 1} />
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        backgroundColor: 'var(--md-sys-color-surface-container-high)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {artist.thumbnailUrl ? (
                        <img
                          src={sizedArtwork(artist.thumbnailUrl, 120)}
                          alt={artist.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleArtworkError(e, artist.thumbnailUrl)}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span
                          className="material-symbols-rounded"
                          style={{ fontSize: '24px', color: 'var(--md-sys-color-on-surface-variant)' }}
                        >
                          person
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--md-sys-color-on-surface)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {artist.name}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--md-sys-color-on-surface-variant)',
                          marginTop: '2px'
                        }}
                      >
                        {artist.songCount} {artist.songCount === 1 ? 'song' : 'songs'} •{' '}
                        {formatListeningTime(artist.totalTimeMs)}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: 'var(--md-sys-color-primary)',
                        flexShrink: 0
                      }}
                    >
                      {artist.playCount}×
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ExpressiveStatTile: React.FC<{
  icon: string;
  value: string;
  label: string;
  containerColor: string;
  contentColor: string;
  badgeColor: string;
  badgeIconColor: string;
  clipPath: string;
  isTextValue?: boolean;
  onClick?: () => void;
}> = ({
  icon,
  value,
  label,
  containerColor,
  contentColor,
  badgeColor,
  badgeIconColor,
  clipPath,
  isTextValue = false,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '18px 20px',
        borderRadius: '24px',
        backgroundColor: containerColor,
        color: contentColor,
        minHeight: '132px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          backgroundColor: badgeColor,
          color: badgeIconColor,
          clipPath,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span className="material-symbols-rounded filled" style={{ fontSize: '20px' }}>
          {icon}
        </span>
      </div>
      <div>
        <div
          style={{
            fontSize: isTextValue ? '18px' : '26px',
            fontWeight: 850,
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={value}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            marginTop: '3px',
            opacity: 0.78
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const config =
    rank === 1
      ? {
          bg: 'var(--md-sys-color-primary)',
          fg: 'var(--md-sys-color-on-primary)',
          clipPath: M3_EXPRESSIVE_SHAPES.sunny
        }
      : rank === 2
      ? {
          bg: 'var(--md-sys-color-secondary)',
          fg: 'var(--md-sys-color-on-secondary)',
          clipPath: M3_EXPRESSIVE_SHAPES.cookie9Sided
        }
      : rank === 3
      ? {
          bg: 'var(--md-sys-color-tertiary)',
          fg: 'var(--md-sys-color-on-tertiary)',
          clipPath: M3_EXPRESSIVE_SHAPES.clover4Leaf
        }
      : {
          bg: 'var(--md-sys-color-surface-container-highest)',
          fg: 'var(--md-sys-color-on-surface-variant)',
          clipPath: M3_EXPRESSIVE_SHAPES.cookie9Sided
        };

  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        backgroundColor: config.bg,
        color: config.fg,
        clipPath: config.clipPath,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 850,
        flexShrink: 0
      }}
    >
      {rank}
    </div>
  );
};
