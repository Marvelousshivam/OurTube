import React, { useRef, useState } from 'react';
import { VideoItem } from '../../types';
import { VideoActionMenu } from './VideoActionMenu';

interface VideoCardProps {
  video: VideoItem;
  onClick: (video: VideoItem) => void;
  className?: string;
}

/**
 * 16:9 Video Lockup Card matching Koda's 41-home-video-recommended.png:
 * - 16:9 aspect ratio thumbnail with 16dp rounded corners
 * - Duration badge on bottom-right (e.g. "14:53")
 * - Channel avatar circle (genuine photo with initials fallback)
 * - Two-line bold title
 * - Creator metadata (channel • views • upload date + verified badge)
 * - Interactive 3-dot action menu
 */
export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleCardClick = () => {
    if (isMenuOpen) return;
    onClick(video);
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
        transform: `scale(${isPressed ? 0.985 : isHovered ? 1.018 : 1})`,
        transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {/* 16:9 Thumbnail Frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
          boxShadow: isHovered
            ? '0 10px 28px rgba(0, 0, 0, 0.35)'
            : '0 2px 8px rgba(0, 0, 0, 0.12)',
          transition: 'box-shadow 250ms ease'
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
            transform: `scale(${isHovered ? 1.05 : 1})`,
            transition: 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />

        {/* Hover Quick Play Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.22)',
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
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              color: '#ffd8e4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              transform: `scale(${isHovered ? 1 : 0.8})`,
              transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '26px' }}>
              play_arrow
            </span>
          </div>
        </div>

        {/* Duration Pill Badge */}
        {video.durationFormatted && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.78)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '6px',
              letterSpacing: '0.03em',
              fontVariantNumeric: 'tabular-nums',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
              zIndex: 2
            }}
          >
            {video.durationFormatted}
          </div>
        )}

        {/* YouTube Red Resume Watch Progress Bar */}
        {typeof video.watchedPercentage === 'number' && video.watchedPercentage > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.28)',
              overflow: 'hidden',
              zIndex: 3
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, video.watchedPercentage))}%`,
                backgroundColor: '#ff0000',
                borderRadius: '0 2px 2px 0',
                transition: 'width 200ms ease'
              }}
            />
          </div>
        )}
      </div>

      {/* Info Row: Channel Avatar + Metadata + 3-Dot Menu */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          paddingTop: '12px',
          paddingBottom: '8px',
          alignItems: 'flex-start',
          position: 'relative'
        }}
      >
        {/* Channel Avatar Circle */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--md-sys-color-secondary-container, #4a4458)',
            color: 'var(--md-sys-color-on-secondary-container, #e8def8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 700,
            flexShrink: 0,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)'
          }}
        >
          {video.channelIconUrl && !avatarError ? (
            <img
              src={video.channelIconUrl}
              alt={video.channelName}
              loading="lazy"
              onError={() => setAvatarError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            video.channelName.slice(0, 2).toUpperCase()
          )}
        </div>

        {/* Video Text Details */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: '4px' }}>
          <h3
            style={{
              margin: '0 0 4px',
              fontSize: '15px',
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--md-sys-color-on-surface, #e6e1e5)',
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {video.channelName}
            </span>

            {/* Verified Creator Badge */}
            {video.isVerified && (
              <span
                className="material-symbols-rounded"
                title="Verified"
                style={{
                  fontSize: '14px',
                  color: 'var(--md-sys-color-primary, #d0bcff)',
                  flexShrink: 0
                }}
              >
                check_circle
              </span>
            )}

            {video.viewCount && <span>• {video.viewCount}</span>}
            {video.uploadedDate && <span>• {video.uploadedDate}</span>}
          </div>

          {/* Members Only or Custom Badge */}
          {(video.isMembersOnly || video.badge) && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '4px',
                fontSize: '12px',
                fontWeight: 700,
                color: video.isMembersOnly ? '#2ba640' : 'var(--md-sys-color-primary, #d0bcff)'
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: video.isMembersOnly ? '#2ba640' : 'currentColor',
                  flexShrink: 0
                }}
              />
              <span>{video.badge || 'Members only'}</span>
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
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isHovered || isMenuOpen ? 1 : 0,
              transition: 'opacity 150ms ease, background-color 150ms ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')}
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
