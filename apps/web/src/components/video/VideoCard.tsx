import React, { useEffect, useRef, useState } from 'react';
import { VideoItem } from '../../types';
import { VideoActionMenu } from './VideoActionMenu';
import { usePlayerStore } from '../../store/playerStore';
import { useTasteStore } from '../../store/tasteStore';
import { prefetchVideoStream } from '../../api/streamResolver';

interface VideoCardProps {
  video: VideoItem;
  onClick: (video: VideoItem) => void;
  className?: string;
}

/**
 * Material 3 Expressive 16:9 Video Lockup Card:
 * - Tonal M3 surface container card with shape-morphing corners (20px -> 26px)
 * - Top-right quick actions on hover (Watch Later + Listen as Music)
 * - Duration badge on bottom-right + persistent M3 primary watch progress bar
 * - Interactive Channel avatar & 2-line metadata hierarchy (never crushes channel name)
 */
export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [video.channelIconUrl]);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { playTrack, openChannel, currentVideo, isPlaying, videoQuality } = usePlayerStore();
  const {
    videoHistory,
    toggleWatchLaterVideo,
    isWatchLaterVideo
  } = useTasteStore();

  // Hover-intent stream prefetcher: resolves stream URL & pre-warms initial 768KB after 140ms hover
  useEffect(() => {
    if (!isHovered || video.isMembersOnly) return;
    const timer = setTimeout(() => {
      prefetchVideoStream(video.id, videoQuality);
    }, 140);
    return () => clearTimeout(timer);
  }, [isHovered, video.id, video.isMembersOnly, videoQuality]);

  const inWatchLater = isWatchLaterVideo(video.id);
  const isCurrentlyPlaying = currentVideo?.id === video.id;

  const historyEntry = videoHistory.find((h) => h.id === video.id);
  const effectiveWatchedPct =
    typeof video.watchedPercentage === 'number' && video.watchedPercentage > 0
      ? video.watchedPercentage
      : historyEntry?.watchedPercentage;

  const cleanViewCount =
    video.viewCount && video.viewCount.toLowerCase() !== 'recommended'
      ? video.viewCount
      : '';
  const statsLine = [cleanViewCount, video.uploadedDate].filter(Boolean).join(' • ');

  const handleCardClick = () => {
    if (isMenuOpen) return;
    onClick(video);
  };

  const handleOpenChannel = (e: React.MouseEvent) => {
    e.stopPropagation();
    openChannel({
      id: video.channelId,
      name: video.channelName,
      avatarUrl: video.channelIconUrl
    });
  };

  const handleQuickWatchLater = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchLaterVideo({
      id: video.id,
      title: video.title,
      channelName: video.channelName,
      channelId: video.channelId,
      channelIconUrl: video.channelIconUrl,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      viewCountText: cleanViewCount
    });
  };

  const handleQuickListenMusic = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrack({
      id: video.id,
      title: video.title,
      artist: video.channelName,
      artistId: video.channelId,
      duration: video.duration || 210,
      thumbnailUrl: video.thumbnailUrl,
      highResThumbnailUrl: video.thumbnailUrl
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        userSelect: 'none',
        outline: 'none',
        position: 'relative',
        padding: '10px',
        borderRadius: isHovered || isCurrentlyPlaying ? '26px' : '20px',
        backgroundColor: isCurrentlyPlaying
          ? 'var(--md-sys-color-secondary-container)'
          : isHovered
          ? 'var(--md-sys-color-surface-container-high)'
          : 'var(--md-sys-color-surface-container-low)',
        border: isCurrentlyPlaying
          ? '1px solid var(--md-sys-color-primary)'
          : isHovered
          ? '1px solid var(--md-sys-color-outline-variant)'
          : '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: isHovered
          ? '0 14px 34px var(--md-sys-elevation-shadow, rgba(0, 0, 0, 0.28))'
          : '0 2px 10px rgba(0, 0, 0, 0.08)',
        transform: `scale(${isPressed ? 0.975 : 1}) translateY(${isHovered ? '-4px' : '0px'})`,
        animation: 'm3CardCascade 340ms var(--m3-spring-spatial-slow, cubic-bezier(0.16, 1, 0.3, 1)) both',
        transition:
          'border-radius 320ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), background-color 200ms ease, transform 240ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)), box-shadow 240ms ease, border-color 180ms ease'
      }}
    >
      {/* 16:9 Thumbnail Frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: isHovered ? '18px' : '14px',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-highest)',
          transition: 'border-radius 280ms cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${isHovered ? 1.045 : 1})`,
            transition: 'transform 440ms cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        />

        {/* Top-Right Hover Quick Actions: Watch Later & Listen as Music */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isHovered || inWatchLater ? 1 : 0,
            transform: `translateY(${isHovered || inWatchLater ? '0px' : '-4px'})`,
            transition: 'opacity 180ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
            zIndex: 4
          }}
        >
          {isHovered && (
            <button
              type="button"
              onClick={handleQuickListenMusic}
              title="Listen as Music (Audio Only)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                backgroundColor: 'rgba(14, 15, 19, 0.82)',
                color: 'var(--md-sys-color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                animation: 'm3PlayPop 260ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1)) both',
                transition: 'transform 160ms var(--m3-spring-spatial-default), border-radius 200ms ease'
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.currentTarget.style.transform = 'scale(0.88)';
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '17px' }}>
                headphones
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleQuickWatchLater}
            title={inWatchLater ? 'Saved to Watch Later' : 'Watch Later'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: inWatchLater ? '50%' : '10px',
              border: inWatchLater
                ? '1px solid var(--md-sys-color-primary)'
                : '1px solid rgba(255, 255, 255, 0.18)',
              backgroundColor: inWatchLater
                ? 'var(--md-sys-color-primary-container)'
                : 'rgba(14, 15, 19, 0.82)',
              color: inWatchLater
                ? 'var(--md-sys-color-on-primary-container)'
                : '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'all 220ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))'
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.currentTarget.style.transform = 'scale(0.88)';
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span
              key={inWatchLater ? 'saved' : 'unsaved'}
              className={`material-symbols-rounded ${inWatchLater ? 'filled' : ''}`}
              style={{
                fontSize: '17px',
                animation: inWatchLater
                  ? 'm3ThumbLikeBurst 340ms var(--m3-spring-spatial-default, cubic-bezier(0.34, 1.56, 0.64, 1))'
                  : 'none'
              }}
            >
              {inWatchLater ? 'task_alt' : 'schedule'}
            </span>
          </button>
        </div>

        {/* Hover Quick Play Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 200ms ease',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: isHovered ? '16px' : '50%',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.38)',
              transform: `scale(${isHovered ? 1 : 0.82})`,
              transition:
                'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), border-radius 260ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <span className="material-symbols-rounded filled" style={{ fontSize: '26px' }}>
              {isCurrentlyPlaying && isPlaying ? 'equalizer' : 'play_arrow'}
            </span>
          </div>
        </div>

        {/* Duration Pill Badge */}
        {video.durationFormatted && (
          <div
            style={{
              position: 'absolute',
              bottom: effectiveWatchedPct ? '10px' : '8px',
              right: '8px',
              backgroundColor: 'rgba(12, 13, 16, 0.84)',
              color: '#F3F4F6',
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '2.5px 8px',
              borderRadius: '8px',
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
              zIndex: 2
            }}
          >
            {video.durationFormatted}
          </div>
        )}

        {/* Resume Watch Progress Bar */}
        {typeof effectiveWatchedPct === 'number' && effectiveWatchedPct > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.24)',
              overflow: 'hidden',
              zIndex: 3
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, effectiveWatchedPct))}%`,
                backgroundColor: 'var(--md-sys-color-primary)',
                borderRadius: '0 2px 2px 0',
                transition: 'width 200ms ease'
              }}
            />
          </div>
        )}
      </div>

      {/* Info Row: Channel Avatar + 2-Line Metadata + 3-Dot Menu */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          paddingTop: '12px',
          paddingBottom: '4px',
          paddingLeft: '2px',
          paddingRight: '2px',
          alignItems: 'flex-start',
          position: 'relative'
        }}
      >
        {/* Interactive Channel Avatar Circle */}
        <div
          onClick={handleOpenChannel}
          title={`View ${video.channelName}`}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: isHovered ? '12px' : '50%',
            backgroundColor: 'var(--md-sys-color-secondary-container)',
            color: 'var(--md-sys-color-on-secondary-container)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 700,
            flexShrink: 0,
            overflow: 'hidden',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            transition:
              'border-radius 260ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 160ms ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {video.channelIconUrl && !avatarError ? (
            <img
              src={video.channelIconUrl}
              alt={video.channelName}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            video.channelName.slice(0, 2).toUpperCase()
          )}
        </div>

        {/* Video Text Details */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: '2px' }}>
          <h3
            style={{
              margin: '0 0 5px',
              fontSize: '14.5px',
              fontWeight: 750,
              lineHeight: 1.34,
              color: isCurrentlyPlaying
                ? 'var(--md-sys-color-on-secondary-container)'
                : 'var(--md-sys-color-on-surface)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em'
            }}
          >
            {video.title}
          </h3>

          {/* Line 1: Full Channel Name + Verified Badge */}
          <div
            onClick={handleOpenChannel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              maxWidth: '100%',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--md-sys-color-on-surface-variant)',
              lineHeight: 1.3,
              cursor: 'pointer',
              transition: 'color 140ms ease'
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'var(--md-sys-color-on-surface)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'var(--md-sys-color-on-surface-variant)')
            }
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {video.channelName}
            </span>

            {video.isVerified && (
              <span
                className="material-symbols-rounded filled"
                title="Verified Creator"
                style={{
                  fontSize: '14px',
                  color: 'var(--md-sys-color-primary)',
                  flexShrink: 0
                }}
              >
                check_circle
              </span>
            )}
          </div>

          {/* Line 2: Views • Uploaded Date (tabular-nums, never crushes channel name) */}
          {statsLine && (
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--md-sys-color-on-surface-variant)',
                opacity: 0.78,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.35,
                marginTop: '1px',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {statsLine}
            </div>
          )}
        </div>

        {/* 3-Dot Action Menu Button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={menuButtonRef}
            type="button"
            title="More actions"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              color: 'var(--md-sys-color-on-surface-variant)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isHovered || isMenuOpen ? 1 : 0.45,
              transition: 'opacity 150ms ease, background-color 150ms ease'
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
              more_vert
            </span>
          </button>

          {/* Popup Action Menu */}
          <VideoActionMenu
            video={video}
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onPlayVideo={onClick}
            anchorRef={menuButtonRef}
          />
        </div>
      </div>
    </div>
  );
};
