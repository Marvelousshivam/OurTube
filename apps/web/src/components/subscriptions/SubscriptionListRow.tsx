import React, { useRef, useState } from 'react';
import { VideoItem } from '../../types';
import { VideoActionMenu } from '../video/VideoActionMenu';

interface SubscriptionListRowProps {
  video: VideoItem;
  onClick: (video: VideoItem) => void;
  className?: string;
}

export const SubscriptionListRow: React.FC<SubscriptionListRowProps> = ({
  video,
  onClick,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (isMenuOpen) return;
    onClick(video);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
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
        alignItems: 'center',
        gap: '16px',
        padding: '10px 14px',
        borderRadius: '16px',
        backgroundColor: isHovered
          ? 'var(--md-sys-color-surface-container-high, rgba(255,255,255,0.06))'
          : 'transparent',
        cursor: 'pointer',
        userSelect: 'none',
        outline: 'none',
        position: 'relative',
        transform: `scale(${isPressed ? 0.99 : isHovered ? 1.006 : 1})`,
        transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms ease'
      }}
    >
      {/* 16:9 Thumbnail Frame */}
      <div
        style={{
          position: 'relative',
          width: '180px',
          minWidth: '160px',
          aspectRatio: '16 / 9',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'var(--md-sys-color-surface-container-high, #2b2930)',
          flexShrink: 0,
          boxShadow: isHovered
            ? '0 6px 18px rgba(0, 0, 0, 0.35)'
            : '0 2px 6px rgba(0, 0, 0, 0.15)',
          transition: 'box-shadow 200ms ease'
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
            transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)'
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
            backgroundColor: 'rgba(0, 0, 0, 0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 180ms ease',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'var(--md-sys-color-primary, #ffd8e4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              transform: `scale(${isHovered ? 1 : 0.8})`,
              transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '22px' }}>
              play_arrow
            </span>
          </div>
        </div>

        {/* Duration Badge */}
        {video.durationFormatted && (
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
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
              height: '3px',
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
                borderRadius: '0 2px 2px 0'
              }}
            />
          </div>
        )}
      </div>

      {/* Middle: Video & Channel Metadata */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          minWidth: 0,
          gap: '4px'
        }}
      >
        {/* Title */}
        <h3
          title={video.title}
          style={{
            fontSize: '14.5px',
            fontWeight: 600,
            lineHeight: '1.35',
            color: 'var(--md-sys-color-on-surface, #e6e0e9)',
            margin: 0,
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

        {/* Creator Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {/* Channel Avatar */}
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: 'var(--md-sys-color-surface-container-highest, #36343b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {video.channelIconUrl && !avatarError ? (
              <img
                src={video.channelIconUrl}
                alt={video.channelName}
                onError={() => setAvatarError(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-primary, #ffd8e4)'
                }}
              >
                {video.channelName?.charAt(0) || 'Y'}
              </span>
            )}
          </div>

          <span
            style={{
              fontWeight: 600,
              color: 'var(--md-sys-color-on-surface, #e6e0e9)'
            }}
          >
            {video.channelName}
          </span>

          {video.isVerified && (
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: '14px',
                color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
                marginLeft: '-4px'
              }}
              title="Verified channel"
            >
              check_circle
            </span>
          )}

          <span style={{ opacity: 0.6 }}>•</span>
          <span>{video.viewCount}</span>

          {video.uploadedDate && (
            <>
              <span style={{ opacity: 0.6 }}>•</span>
              <span>{video.uploadedDate}</span>
            </>
          )}

          {video.isMembersOnly && (
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#2e7d32',
                backgroundColor: 'rgba(46, 125, 50, 0.14)',
                padding: '1px 6px',
                borderRadius: '4px',
                letterSpacing: '0.02em',
                marginLeft: '4px'
              }}
            >
              Members only
            </span>
          )}
        </div>

        {/* Optional Description Snippet */}
        {video.description && (
          <p
            style={{
              fontSize: '12px',
              lineHeight: '1.3',
              color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
              margin: '2px 0 0 0',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: 0.8
            }}
          >
            {video.description}
          </p>
        )}
      </div>

      {/* Right: 3-dot Action Menu */}
      <div
        style={{ flexShrink: 0, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={menuButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          aria-label="More options"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: isHovered
              ? 'var(--md-sys-color-surface-container-highest, #36343b)'
              : 'transparent',
            border: 'none',
            color: 'var(--md-sys-color-on-surface-variant, #cac4d0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 150ms ease, color 150ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--md-sys-color-on-surface, #e6e0e9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--md-sys-color-on-surface-variant, #cac4d0)';
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>
            more_vert
          </span>
        </button>

        {isMenuOpen && (
          <VideoActionMenu
            video={video}
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onPlayVideo={onClick}
            anchorRef={menuButtonRef}
          />
        )}
      </div>
    </div>
  );
};
