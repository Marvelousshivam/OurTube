import React, { useEffect, useState } from 'react';
import { VideoItem } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { prefetchVideoStream } from '../../api/streamResolver';

interface VideoCinemaStageProps {
  lead: VideoItem;
  /** Partially watched videos from local history (resume targets) */
  resumeItems: VideoItem[];
  /** Next feed picks to fill the stack when resume list is short */
  upNext: VideoItem[];
  onPlayVideo: (video: VideoItem) => void;
}

const formatClock = (sec: number) => {
  if (!sec || !Number.isFinite(sec) || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Material 3 Expressive Contained Ambient Cinema Stage (Video Mode counterpart to YourMixHero):
 * - Contained 36px M3 surface-container-low stage with dynamic ambient radial mesh blobs
 * - Interactive spotlight switcher: hovering right-hand Bento Queue cards previews them on the stage
 * - Strictly bounded 16:9 cinema frame (never overflows grid column) + connected M3 morphing action pod
 */
export const VideoCinemaStage: React.FC<VideoCinemaStageProps> = ({
  lead,
  resumeItems,
  upNext,
  onPlayVideo
}) => {
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [isLeadHovered, setIsLeadHovered] = useState(false);
  const [isWatchBtnHovered, setIsWatchBtnHovered] = useState(false);
  const [isWatchBtnPressed, setIsWatchBtnPressed] = useState(false);
  const [isListenBtnHovered, setIsListenBtnHovered] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const { playTrack, openChannel, currentVideo, isPlaying, videoQuality } = usePlayerStore();
  const { videoHistory, toggleWatchLaterVideo, isWatchLaterVideo } = useTasteStore();

  // Build 4-item interactive deck combining lead + resume items + upNext (excluding Members-Only)
  const allCandidates: { video: VideoItem; isResume: boolean }[] = [
    { video: lead, isResume: false },
    ...resumeItems
      .filter((v) => !v.isMembersOnly)
      .map((v) => ({ video: v, isResume: true })),
    ...upNext
      .filter((v) => !v.isMembersOnly)
      .map((v) => ({ video: v, isResume: false }))
  ]
    .filter((item, idx, arr) => arr.findIndex((x) => x.video.id === item.video.id) === idx)
    .slice(0, 4);

  const safeIdx = spotlightIdx < allCandidates.length ? spotlightIdx : 0;
  const activeItem = allCandidates[safeIdx]?.video || lead;

  // Automatically pre-warm the spotlighted hero item so clicking "Watch Now" / "Resume" starts in 0ms
  useEffect(() => {
    if (!activeItem?.id || activeItem.isMembersOnly) return;
    const timer = setTimeout(() => {
      prefetchVideoStream(activeItem.id, videoQuality);
    }, 120);
    return () => clearTimeout(timer);
  }, [activeItem?.id, activeItem?.isMembersOnly, videoQuality]);

  const activeHistory = videoHistory.find((h) => h.id === activeItem.id);
  const activeResumeSec =
    activeHistory?.resumeTimeSeconds &&
    activeHistory.resumeTimeSeconds > 5 &&
    (activeHistory.watchedPercentage || 0) < 95
      ? activeHistory.resumeTimeSeconds
      : 0;
  const activeWatchedPct =
    activeHistory?.watchedPercentage ?? activeItem.watchedPercentage ?? 0;
  const activeInWatchLater = isWatchLaterVideo(activeItem.id);
  const isActivePlaying = currentVideo?.id === activeItem.id && isPlaying;

  const cleanViews =
    activeItem.viewCount && activeItem.viewCount.toLowerCase() !== 'recommended'
      ? activeItem.viewCount
      : '';
  const activeStats = [cleanViews, activeItem.uploadedDate].filter(Boolean).join(' • ');
  const hasResumeInStack = allCandidates.some((c) => c.isResume);

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: '34px',
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        padding: 'clamp(20px, 2.5vw, 32px)',
        marginBottom: '32px',
        overflow: 'hidden',
        boxShadow: '0 16px 48px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.22))'
      }}
    >
      {/* Dynamic Ambient Radial Mesh Blobs (Matching Music Mode YourMixHero) */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '-10%',
          width: '55%',
          height: '130%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--md-sys-color-primary-container) 0%, transparent 70%)',
          opacity: 0.42,
          filter: 'blur(56px)',
          animation: 'm3AmbientMeshDrift 14s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-35%',
          right: '-8%',
          width: '50%',
          height: '120%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--md-sys-color-tertiary-container) 0%, transparent 70%)',
          opacity: 0.34,
          filter: 'blur(64px)',
          animation: 'm3AmbientMeshDrift2 18s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Subtle Blurred Artwork Aura from Active Video */}
      <img
        key={`aura-${activeItem.id}`}
        src={activeItem.thumbnailUrl}
        alt=""
        referrerPolicy="no-referrer"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.12,
          filter: 'blur(48px) saturate(150%)',
          animation: 'm3BackdropFade 380ms ease both',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div className="ot-m3-cinema-grid">
        {/* ================= LEFT COLUMN: 16:9 CINEMA VIEWPORT + CONNECTED M3 ACTION BAR ================= */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: 0,
            width: '100%',
            zIndex: 2
          }}
        >
          {/* Strictly Contained 16:9 Cinema Frame */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onPlayVideo(activeItem)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPlayVideo(activeItem);
              }
            }}
            onMouseEnter={() => setIsLeadHovered(true)}
            onMouseLeave={() => setIsLeadHovered(false)}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              borderRadius: isLeadHovered ? '28px' : '22px',
              overflow: 'hidden',
              cursor: 'pointer',
              backgroundColor: 'var(--md-sys-color-surface-container-highest)',
              border: '1.5px solid rgba(255, 255, 255, 0.1)',
              boxShadow: isLeadHovered
                ? '0 22px 48px rgba(0, 0, 0, 0.5)'
                : '0 12px 32px rgba(0, 0, 0, 0.32)',
              transition:
                'border-radius 340ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 260ms ease',
              outline: 'none'
            }}
          >
            <img
              key={activeItem.id}
              src={activeItem.thumbnailUrl}
              alt={activeItem.title}
              referrerPolicy="no-referrer"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${isLeadHovered ? 1.04 : 1})`,
                animation: 'm3SpotlightMorph 420ms var(--m3-spring-spatial-slow, cubic-bezier(0.16, 1, 0.3, 1)) both',
                transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)'
              }}
            />

            {/* Multi-Stop Editorial Scrim */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(10, 11, 15, 0.55) 0%, rgba(10, 11, 15, 0.08) 38%, rgba(10, 11, 15, 0.72) 72%, rgba(10, 11, 15, 0.95) 100%)',
                pointerEvents: 'none'
              }}
            />

            {/* Expressive Center Play Squircle Badge on Hover */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '58px',
                height: '58px',
                borderRadius: isLeadHovered ? '18px' : '50%',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55)',
                opacity: isLeadHovered ? 0.96 : 0,
                transform: `translate(-50%, -50%) scale(${isLeadHovered ? 1 : 0.72})`,
                transition:
                  'opacity 200ms ease, transform 320ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), border-radius 320ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))',
                pointerEvents: 'none',
                zIndex: 2
              }}
            >
              <span className="material-symbols-rounded filled" style={{ fontSize: '32px' }}>
                play_arrow
              </span>
            </div>

            {/* Top Bar Inside Frame: Creator Pill + Duration Badge */}
            <div
              style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                right: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                zIndex: 2
              }}
            >
              {/* Creator Glass Pill */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  openChannel({
                    id: activeItem.channelId,
                    name: activeItem.channelName,
                    avatarUrl: activeItem.channelIconUrl
                  });
                }}
                title={`View ${activeItem.channelName}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 12px 5px 6px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(16, 18, 24, 0.76)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  cursor: 'pointer',
                  maxWidth: '75%'
                }}
              >
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-on-primary-container)',
                    fontSize: '10px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {activeItem.channelIconUrl && !avatarError ? (
                    <img
                      src={activeItem.channelIconUrl}
                      alt=""
                      onError={() => setAvatarError(true)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    activeItem.channelName.slice(0, 2).toUpperCase()
                  )}
                </span>

                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {activeItem.channelName}
                </span>

                {activeItem.isVerified && (
                  <span
                    className="material-symbols-rounded filled"
                    style={{
                      fontSize: '15px',
                      color: 'var(--md-sys-color-primary)',
                      flexShrink: 0
                    }}
                  >
                    check_circle
                  </span>
                )}
              </div>

              {/* Duration Pill */}
              {activeItem.durationFormatted && (
                <span
                  style={{
                    padding: '5px 11px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(16, 18, 24, 0.78)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    flexShrink: 0
                  }}
                >
                  {activeItem.durationFormatted}
                </span>
              )}
            </div>

            {/* Bottom Headline & Metadata Inside Frame */}
            <div
              key={`meta-${activeItem.id}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: 'clamp(16px, 2.2vw, 24px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                animation: 'm3TextSlideUp 300ms var(--m3-ease-emphasized-decelerate, cubic-bezier(0.05, 0.7, 0.1, 1)) both',
                zIndex: 2
              }}
            >
              {activeStats && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.78)',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  <span
                    className="material-symbols-rounded filled"
                    style={{ fontSize: '14px', color: 'var(--md-sys-color-primary)' }}
                  >
                    auto_awesome
                  </span>
                  <span>{activeStats}</span>
                </div>
              )}

              <h2
                style={{
                  margin: 0,
                  fontFamily: "'Syne', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: 'clamp(18px, 2vw, 26px)',
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  color: '#FFFFFF',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {activeItem.title}
              </h2>
            </div>

            {/* Watch Progress Bar at Bottom Edge */}
            {activeWatchedPct > 2 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  zIndex: 3
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, activeWatchedPct)}%`,
                    height: '100%',
                    backgroundColor: 'var(--md-sys-color-primary)'
                  }}
                />
              </div>
            )}
          </div>

          {/* Connected M3 Expressive Action Pod (Matches YourMixHero Button Architecture) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Primary Extended Morphing FAB */}
              <button
                type="button"
                onClick={() => onPlayVideo(activeItem)}
                onMouseEnter={() => setIsWatchBtnHovered(true)}
                onMouseLeave={() => {
                  setIsWatchBtnHovered(false);
                  setIsWatchBtnPressed(false);
                }}
                onMouseDown={() => setIsWatchBtnPressed(true)}
                onMouseUp={() => setIsWatchBtnPressed(false)}
                style={{
                  height: '48px',
                  padding: '0 24px',
                  borderRadius: isWatchBtnPressed
                    ? '14px'
                    : isWatchBtnHovered
                    ? '16px'
                    : '9999px',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: isWatchBtnHovered
                    ? '0 10px 24px rgba(0, 0, 0, 0.3)'
                    : '0 4px 14px rgba(0, 0, 0, 0.2)',
                  transform: isWatchBtnPressed
                    ? 'scale(0.96)'
                    : isWatchBtnHovered
                    ? 'scale(1.02) translateY(-1px)'
                    : 'scale(1)',
                  transition:
                    'border-radius 300ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease'
                }}
              >
                <span className="material-symbols-rounded filled" style={{ fontSize: '22px' }}>
                  {isActivePlaying ? 'equalizer' : 'play_arrow'}
                </span>
                <span>
                  {activeResumeSec
                    ? `Resume • ${formatClock(activeResumeSec)}`
                    : 'Watch Now'}
                </span>
              </button>

              {/* Secondary Tonal Listen as Music Button */}
              <button
                type="button"
                onClick={() =>
                  playTrack({
                    id: activeItem.id,
                    title: activeItem.title,
                    artist: activeItem.channelName,
                    artistId: activeItem.channelId,
                    duration: activeItem.duration || 210,
                    thumbnailUrl: activeItem.thumbnailUrl,
                    highResThumbnailUrl: activeItem.thumbnailUrl
                  })
                }
                onMouseEnter={() => setIsListenBtnHovered(true)}
                onMouseLeave={() => setIsListenBtnHovered(false)}
                style={{
                  height: '48px',
                  padding: '0 18px',
                  borderRadius: isListenBtnHovered ? '9999px' : '16px',
                  backgroundColor: 'var(--md-sys-color-secondary-container)',
                  color: 'var(--md-sys-color-on-secondary-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transform: isListenBtnHovered ? 'scale(1.02) translateY(-1px)' : 'scale(1)',
                  transition:
                    'border-radius 300ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 180ms ease'
                }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '19px' }}>
                  headphones
                </span>
                <span>Listen</span>
              </button>

              {/* Tonal Watch Later Toggle Button */}
              <button
                type="button"
                title={activeInWatchLater ? 'Saved in Watch Later' : 'Save to Watch Later'}
                onClick={() =>
                  toggleWatchLaterVideo({
                    id: activeItem.id,
                    title: activeItem.title,
                    channelName: activeItem.channelName,
                    channelId: activeItem.channelId,
                    channelIconUrl: activeItem.channelIconUrl,
                    thumbnailUrl: activeItem.thumbnailUrl,
                    duration: activeItem.duration,
                    viewCountText: cleanViews
                  })
                }
                style={{
                  height: '48px',
                  padding: '0 16px',
                  borderRadius: activeInWatchLater ? '9999px' : '16px',
                  backgroundColor: activeInWatchLater
                    ? 'var(--md-sys-color-tertiary-container)'
                    : 'var(--md-sys-color-surface-container-high)',
                  color: activeInWatchLater
                    ? 'var(--md-sys-color-on-tertiary-container)'
                    : 'var(--md-sys-color-on-surface)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 240ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                <span
                  className={`material-symbols-rounded ${activeInWatchLater ? 'filled' : ''}`}
                  style={{ fontSize: '18px' }}
                >
                  {activeInWatchLater ? 'task_alt' : 'schedule'}
                </span>
                <span>{activeInWatchLater ? 'Saved' : 'Watch Later'}</span>
              </button>
            </div>

            {/* Spotlight Index Selector Pills (01..04) */}
            {allCandidates.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {allCandidates.map((c, idx) => {
                  const isCurrent = idx === safeIdx;
                  return (
                    <button
                      key={c.video.id}
                      type="button"
                      onClick={() => setSpotlightIdx(idx)}
                      title={`Preview: ${c.video.title}`}
                      style={{
                        height: '32px',
                        minWidth: isCurrent ? '42px' : '32px',
                        padding: '0 8px',
                        borderRadius: isCurrent ? '10px' : '9999px',
                        border: isCurrent
                          ? '1px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: isCurrent
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface-container)',
                        color: isCurrent
                          ? 'var(--md-sys-color-on-primary-container)'
                          : 'var(--md-sys-color-on-surface-variant)',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        cursor: 'pointer',
                        transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      0{idx + 1}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: M3 EXPRESSIVE BENTO QUEUE STACK ================= */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px',
            minWidth: 0,
            width: '100%',
            zIndex: 2
          }}
        >
          {/* Stack Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 4px 2px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="material-symbols-rounded filled"
                style={{ fontSize: '18px', color: 'var(--md-sys-color-primary)' }}
              >
                {hasResumeInStack ? 'history' : 'bolt'}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 800,
                  letterSpacing: '-0.015em',
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                {hasResumeInStack ? 'Continue & Up Next' : 'Spotlight Queue'}
              </h3>
            </div>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              Hover to preview • Tap to play
            </span>
          </div>

          {/* 4 Tactile M3 Bento Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {allCandidates.map(({ video, isResume }, idx) => {
              const isSelected = idx === safeIdx;
              const isHovered = hoveredCardId === video.id;
              const hist = videoHistory.find((h) => h.id === video.id);
              const pct = hist?.watchedPercentage ?? video.watchedPercentage;
              const resumeAt = hist?.resumeTimeSeconds;
              const remaining =
                isResume && video.duration && resumeAt
                  ? Math.max(0, video.duration - resumeAt)
                  : 0;
              const vCount =
                video.viewCount && video.viewCount.toLowerCase() !== 'recommended'
                  ? video.viewCount
                  : '';
              const metaLine =
                isResume && remaining
                  ? `Resume • ${formatClock(remaining)} left`
                  : [vCount, video.uploadedDate].filter(Boolean).join(' • ');

              return (
                <div
                  key={video.id}
                  role="button"
                  tabIndex={0}
                  onMouseEnter={() => {
                    setHoveredCardId(video.id);
                    setSpotlightIdx(idx);
                  }}
                  onMouseLeave={() => setHoveredCardId(null)}
                  onClick={() => onPlayVideo(video)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPlayVideo(video);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '9px 12px 9px 9px',
                    borderRadius: isHovered || isSelected ? '22px' : '16px',
                    backgroundColor: isSelected
                      ? 'var(--md-sys-color-secondary-container)'
                      : isHovered
                      ? 'var(--md-sys-color-surface-container-high)'
                      : 'var(--md-sys-color-surface-container)',
                    border: isSelected
                      ? '1px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant)',
                    cursor: 'pointer',
                    minWidth: 0,
                    transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
                    transition:
                      'border-radius 280ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 180ms ease, transform 200ms ease, border-color 180ms ease',
                    outline: 'none'
                  }}
                >
                  {/* Thumbnail + Text */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      minWidth: 0,
                      flex: 1
                    }}
                  >
                    {/* Fixed-Width 16:9 Mini Frame */}
                    <div
                      style={{
                        position: 'relative',
                        width: '120px',
                        aspectRatio: '16 / 9',
                        borderRadius: isHovered || isSelected ? '14px' : '10px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                        transition: 'border-radius 260ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: `scale(${isHovered ? 1.05 : 1})`,
                          transition: 'transform 340ms ease'
                        }}
                      />
                      {video.durationFormatted && (
                        <span
                          style={{
                            position: 'absolute',
                            right: '5px',
                            bottom: pct ? '7px' : '5px',
                            padding: '1px 5px',
                            borderRadius: '5px',
                            backgroundColor: 'rgba(10, 11, 14, 0.84)',
                            color: '#FFFFFF',
                            fontSize: '10px',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {video.durationFormatted}
                        </span>
                      )}
                      {pct && pct > 2 ? (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: '3px',
                            backgroundColor: 'rgba(255,255,255,0.22)'
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              height: '100%',
                              backgroundColor: 'var(--md-sys-color-primary)'
                            }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {/* Text Stack */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        minWidth: 0,
                        flex: 1
                      }}
                    >
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 750,
                          lineHeight: 1.28,
                          color: isSelected
                            ? 'var(--md-sys-color-on-secondary-container)'
                            : 'var(--md-sys-color-on-surface)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {video.title}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: 'var(--md-sys-color-on-surface-variant)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {video.channelName}
                        </span>
                        {video.isVerified && (
                          <span
                            className="material-symbols-rounded filled"
                            style={{
                              fontSize: '13px',
                              color: 'var(--md-sys-color-primary)',
                              flexShrink: 0
                            }}
                          >
                            check_circle
                          </span>
                        )}
                      </div>

                      {metaLine && (
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: isResume ? 700 : 500,
                            color: isResume
                              ? 'var(--md-sys-color-primary)'
                              : 'var(--md-sys-color-on-surface-variant)',
                            opacity: isResume ? 1 : 0.85,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {metaLine}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right M3 Morphing Play Badge */}
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: isHovered || isSelected ? '12px' : '50%',
                      backgroundColor:
                        isHovered || isSelected
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container-highest)',
                      color:
                        isHovered || isSelected
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface-variant)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                  >
                    <span className="material-symbols-rounded filled" style={{ fontSize: '20px' }}>
                      play_arrow
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .ot-m3-cinema-grid {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(0, 1.32fr) minmax(0, 1fr);
          gap: clamp(20px, 2.4vw, 32px);
          align-items: stretch;
          width: 100%;
        }
        @media (max-width: 1040px) {
          .ot-m3-cinema-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  );
};
